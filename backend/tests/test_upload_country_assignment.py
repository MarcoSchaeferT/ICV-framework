import importlib
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from backend.routes.setFilesToDB.parseCSVdata import ParsedData, sanitize_names


upload_module = importlib.import_module(
    "backend.routes.setFilesToDB.uploadFileToDB"
)


class UploadCountryAssignmentTests(unittest.IsolatedAsyncioTestCase):
    async def _run_upload(self, columns: list[str]):
        data = ParsedData()
        data.db_name = "uploaded_dataset"
        data.column_names = columns
        data.sanitized_column_names = sanitize_names(columns)
        data.column_sql_types = [
            "float4" if column == "value" else "varchar"
            for column in columns
        ]

        state = MagicMock()
        state.try_acquire_file_lock.return_value = True
        state.get_status.return_value = {"error": "false"}
        insert_mock = AsyncMock(return_value=100)

        def run_assignment(*args, progress_callback, **kwargs):
            progress_callback(50, 100)
            return 4

        assignment_mock = MagicMock(side_effect=run_assignment)
        metadata_mock = MagicMock()

        with (
            patch.object(upload_module, "upload_state", state),
            patch.object(
                upload_module,
                "parseCSVdata",
                AsyncMock(return_value=data),
            ),
            patch.object(upload_module, "createTable", AsyncMock(return_value=None)),
            patch.object(upload_module, "insertData", insert_mock),
            patch.object(upload_module, "populate_column_metadata", metadata_mock),
            patch.object(upload_module, "assign_geo_pos_to_country", assignment_mock),
            patch.object(upload_module.response_cache, "invalidate"),
        ):
            result = await upload_module.uploadFileToDB(
                Path("uploaded_dataset.csv"), "upload-id"
            )

        return result, data, state, insert_mock, assignment_mock, metadata_mock

    async def test_geometry_column_runs_country_assignment(self):
        result, data, state, insert_mock, assignment_mock, metadata_mock = await self._run_upload(
            ["value", "Geometry"]
        )

        self.assertIsNone(result)
        insert_mock.assert_awaited_once_with(data, "upload-id")
        state.set_has_geometry.assert_called_once_with("upload-id", True)
        state.set_phase.assert_any_call("upload-id", "country")
        assignment_mock.assert_called_once()
        self.assertEqual(assignment_mock.call_args.args, ("uploaded_dataset",))
        self.assertTrue(assignment_mock.call_args.kwargs["skip_existing"])
        self.assertEqual(assignment_mock.call_args.kwargs["total_rows"], 100)
        progress_callback = assignment_mock.call_args.kwargs["progress_callback"]
        self.assertTrue(callable(progress_callback))
        state.set_country_progress.assert_any_call("upload-id", 50.0)
        state.set_country_progress.assert_any_call("upload-id", 100.0)
        metadata_mock.assert_called_once_with(
            "uploaded_dataset",
            ["value", "Geometry"],
            resolved_sql_types={"value": "float4", "Geometry": "varchar"},
            replace_existing=True,
        )

    async def test_dataset_without_geometry_skips_country_assignment(self):
        result, data, state, insert_mock, assignment_mock, metadata_mock = await self._run_upload(
            ["value", "date"]
        )

        self.assertIsNone(result)
        insert_mock.assert_awaited_once_with(data, "upload-id")
        state.set_has_geometry.assert_called_once_with("upload-id", False)
        assignment_mock.assert_not_called()
        metadata_mock.assert_called_once()


if __name__ == "__main__":
    unittest.main()
