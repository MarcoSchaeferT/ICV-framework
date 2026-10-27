import importlib
import io
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

from backend import metadata_utils
from backend.routes.setFilesToDB.parseCSVdata import ParsedData


create_table_module = importlib.import_module(
    "backend.routes.setFilesToDB.createTable"
)


class CreateTableConsoleEncodingTests(unittest.TestCase):
    def test_type_inference_log_is_encodable_on_windows_console(self):
        data = ParsedData()
        data.column_names = ["value"]
        data.file_path = Path("dataset.csv")

        output_bytes = io.BytesIO()
        windows_stdout = io.TextIOWrapper(output_bytes, encoding="cp1252")

        with (
            patch.object(create_table_module, "loadMetadata", return_value={}),
            patch.object(
                create_table_module,
                "stream_csv_rows",
                return_value=[({"value": "42"}, 2)],
            ),
            redirect_stdout(windows_stdout),
        ):
            inferred = create_table_module.infer_column_types(data)
            windows_stdout.flush()

        self.assertEqual(inferred, {"value": "int4"})
        self.assertIn(b"value", output_bytes.getvalue())

    def test_csv_metadata_and_inference_work_without_index_metadata(self):
        data = ParsedData()
        data.column_names = ["x", "value"]
        data.file_path = Path("dataset.csv")

        create_table_module.loadMetadata.cache_clear()
        try:
            with (
                patch.object(
                    metadata_utils,
                    "_META_DATA_BASE",
                    Path(__file__).resolve().parents[2] / "messages" / "metaData.csv",
                ),
                patch.object(
                    create_table_module,
                    "stream_csv_rows",
                    return_value=[({"x": "", "value": "42"}, 2)],
                ),
            ):
                inferred = create_table_module.infer_column_types(data)
                resolved = [
                    create_table_module.getColumnSQLdataType(col, inferred)
                    for col in data.column_names
                ]
        finally:
            create_table_module.loadMetadata.cache_clear()

        self.assertEqual(inferred, {"value": "int4"})
        self.assertEqual(resolved, ["float4", "int4"])


if __name__ == "__main__":
    unittest.main()
