import importlib
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from flask import Flask, jsonify, request
from shapely.geometry import box
from shapely.strtree import STRtree

from backend.routes.processData import assignGeoPosToCountry as country_module
from backend.routes.processData.assignGeoPosToCountry import _vectorized_updates
from backend.routes.setFilesToDB import createTable as create_table_module
from backend.routes.setFilesToDB.parseCSVdata import ParsedData
from backend.upload_request import DirectUploadRequest, UPLOAD_DIR_ENV_KEY
from backend.upload_state import _UploadState


insert_module = importlib.import_module(
    "backend.routes.setFilesToDB.insertData"
)


class DirectUploadRequestTests(unittest.TestCase):
    def test_multipart_file_is_streamed_to_configured_work_directory(self):
        with tempfile.TemporaryDirectory() as temp_directory:
            upload_directory = Path(temp_directory).resolve()
            app = Flask(__name__)
            app.request_class = DirectUploadRequest

            @app.post("/upload")
            def upload():
                request.environ[UPLOAD_DIR_ENV_KEY] = str(upload_directory)
                uploaded_file = request.files["files"]
                destination = Path(uploaded_file.stream.name).resolve()
                uploaded_file.stream.flush()
                uploaded_file.close()
                return jsonify({"destination": str(destination)})

            response = app.test_client().post(
                "/upload",
                data={"files": (io.BytesIO(b"geometry,value\nPOINT (1 2),3\n"), "sample.csv")},
                content_type="multipart/form-data",
            )

            self.assertEqual(response.status_code, 200)
            destination = Path(response.get_json()["destination"])
            self.assertEqual(destination.parent, upload_directory)
            self.assertEqual(destination.name, "sample.csv")
            self.assertEqual(
                destination.read_bytes(), b"geometry,value\nPOINT (1 2),3\n"
            )

    def test_client_path_components_are_removed_from_filename(self):
        with tempfile.TemporaryDirectory() as temp_directory:
            upload_directory = Path(temp_directory).resolve()
            app = Flask(__name__)
            app.request_class = DirectUploadRequest

            @app.post("/upload")
            def upload():
                request.environ[UPLOAD_DIR_ENV_KEY] = str(upload_directory)
                uploaded_file = request.files["files"]
                destination = Path(uploaded_file.stream.name).resolve()
                uploaded_file.close()
                return jsonify({"destination": str(destination)})

            response = app.test_client().post(
                "/upload",
                data={"files": (io.BytesIO(b"value\n1\n"), "C:\\client\\sample.csv")},
                content_type="multipart/form-data",
            )

            self.assertEqual(response.status_code, 200)
            destination = Path(response.get_json()["destination"])
            self.assertEqual(destination, upload_directory / "sample.csv")


class UploadTypePreparationTests(unittest.TestCase):
    def test_column_types_are_inferred_and_resolved_only_once(self):
        data = ParsedData()
        data.column_names = ["value", "geometry"]

        with (
            patch.object(
                create_table_module,
                "infer_column_types",
                return_value={"value": "float4", "geometry": "varchar"},
            ) as infer_types,
            patch.object(
                create_table_module,
                "getColumnSQLdataType",
                side_effect=["float4", "varchar"],
            ) as resolve_type,
        ):
            first = create_table_module.prepare_column_types(data)
            second = create_table_module.prepare_column_types(data)

        self.assertEqual(first, second)
        self.assertEqual(first[1], ["float4", "varchar"])
        infer_types.assert_called_once_with(data)
        self.assertEqual(resolve_type.call_count, 2)


class TableReplacementTests(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def _data() -> ParsedData:
        data = ParsedData()
        data.db_name = "rolling_forecast"
        data.column_names = ["Forecast: Sep 2026"]
        data.sanitized_column_names = ["forecast___sep_2026"]
        return data

    async def test_existing_table_is_dropped_before_new_schema_is_created(self):
        connection_context = MagicMock()
        connection = connection_context.__enter__.return_value
        cursor = connection.cursor.return_value.__enter__.return_value

        with (
            patch.object(
                create_table_module,
                "prepare_column_types",
                return_value=({}, ["float4"]),
            ),
            patch.object(
                create_table_module,
                "get_db_connection_params",
                return_value={},
            ),
            patch.object(
                create_table_module.psycopg,
                "connect",
                return_value=connection_context,
            ),
        ):
            result = await create_table_module.createTable(self._data())

        self.assertIsNone(result)
        self.assertEqual(cursor.execute.call_count, 2)
        queries = [str(call.args[0]) for call in cursor.execute.call_args_list]
        self.assertIn("DROP TABLE IF EXISTS", queries[0])
        self.assertIn("CREATE TABLE", queries[1])

    async def test_failed_create_propagates_through_transaction_context(self):
        connection_context = MagicMock()
        connection = connection_context.__enter__.return_value
        cursor = connection.cursor.return_value.__enter__.return_value
        cursor.execute.side_effect = [None, RuntimeError("invalid schema")]

        with (
            patch.object(
                create_table_module,
                "prepare_column_types",
                return_value=({}, ["float4"]),
            ),
            patch.object(
                create_table_module,
                "get_db_connection_params",
                return_value={},
            ),
            patch.object(
                create_table_module.psycopg,
                "connect",
                return_value=connection_context,
            ),
        ):
            result = await create_table_module.createTable(self._data())

        self.assertIn("invalid schema", result["ERROR"])
        self.assertIs(connection_context.__exit__.call_args.args[0], RuntimeError)


class NativeCopyUploadTests(unittest.IsolatedAsyncioTestCase):
    async def test_native_copy_preserves_quotes_tabs_and_geojson(self):
        data = ParsedData()
        data.db_name = "uploaded_dataset"
        data.file_path = Path("uploaded_dataset.csv")
        data.file_size = 100
        data.column_names = ["geometry", "label"]
        data.sanitized_column_names = ["geometry", "label"]
        source_row = {
            "geometry": '{"type":"Point","coordinates":[2.3,48.8]}',
            "label": 'O\'Brien\t"quoted"',
        }

        connection_context = MagicMock()
        connection = connection_context.__enter__.return_value
        cursor = connection.cursor.return_value.__enter__.return_value
        copy = cursor.copy.return_value.__enter__.return_value

        with (
            patch.object(
                insert_module,
                "prepare_column_types",
                return_value=({}, ["varchar", "varchar"]),
            ),
            patch.object(
                insert_module,
                "stream_csv_rows",
                return_value=iter([(source_row, 100)]),
            ),
            patch.object(
                insert_module.psycopg,
                "connect",
                return_value=connection_context,
            ),
            patch.object(insert_module, "get_db_connection_params", return_value={}),
            patch.object(insert_module, "cleanUp"),
            patch("backend.upload_state.upload_state") as state,
        ):
            state.get_status.return_value = {"error": "false"}
            inserted_rows = await insert_module.insertData(data, "upload-id")

        self.assertEqual(inserted_rows, 1)
        copy.write_row.assert_called_once_with(
            [source_row["geometry"], source_row["label"]]
        )
        connection.commit.assert_called_once_with()
        self.assertEqual(state.set_db_ingestion_progress.call_count, 2)


class CountryAssignmentVectorizationTests(unittest.TestCase):
    def test_batch_parsing_and_spatial_query_support_wkt_and_geojson(self):
        countries = [box(0, 0, 10, 10), box(10, 0, 20, 10)]
        tree = STRtree(countries)
        rows = [
            (1, "POINT (2 2)"),
            (2, '{"type":"Point","coordinates":[12,2]}'),
            (3, "not-a-geometry"),
            (4, ""),
        ]

        updates = _vectorized_updates(
            rows,
            tree,
            ["AAA", "BBB"],
            ["Country A", "Country B"],
        )

        self.assertCountEqual(
            updates,
            [(1, "AAA", "Country A"), (2, "BBB", "Country B")],
        )

    def test_vector_failure_falls_back_to_scalar_assignment(self):
        country = box(0, 0, 10, 10)
        index = (
            STRtree([country]),
            [country],
            ["AAA"],
            ["Country A"],
            {id(country): 0},
        )

        with patch.object(
            country_module, "_vectorized_updates", side_effect=ValueError("bad batch")
        ):
            updates = country_module._country_updates([(1, "POINT (2 2)")], index)

        self.assertEqual(updates, [(1, "AAA", "Country A")])


class CombinedProgressTests(unittest.TestCase):
    def test_db_progress_uses_one_redis_pipeline(self):
        state = _UploadState()
        redis_client = MagicMock()
        pipeline = redis_client.pipeline.return_value
        state._client = redis_client

        state.set_db_ingestion_progress("upload-id", 42.0, 43.0)

        redis_client.pipeline.assert_called_once_with()
        self.assertEqual(pipeline.set.call_count, 2)
        pipeline.execute.assert_called_once_with()

    def test_status_reads_all_progress_fields_in_one_redis_request(self):
        state = _UploadState()
        redis_client = MagicMock()
        redis_client.mget.return_value = [
            "42.0",
            "false",
            "db",
            "true",
            "43.0",
            "12.0",
        ]
        state._client = redis_client

        status = state.get_status("upload-id")

        redis_client.mget.assert_called_once()
        self.assertEqual(
            status,
            {
                "progress": 42.0,
                "error": "false",
                "phase": "db",
                "has_geometry": True,
                "db_progress": 43.0,
                "country_progress": 12.0,
            },
        )

    def test_db_progress_updates_both_local_fallback_values(self):
        state = _UploadState()
        state._redis_down_until = float("inf")

        state.set_db_ingestion_progress("upload-id", 42.0, 43.0)
        status = state.get_status("upload-id")

        self.assertEqual(status["progress"], 42.0)
        self.assertEqual(status["db_progress"], 43.0)


if __name__ == "__main__":
    unittest.main()
