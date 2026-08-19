from os import listdir
import os
import time
from .parseCSVdata import ParsedData, snanitize_date, stream_csv_rows
from .createTable import prepare_column_types
from .db_utils import get_db_connection_params
import psycopg
from psycopg import sql


async def insertData(data: ParsedData, upload_id: str) -> int | None:
    """Insert CSV data using PostgreSQL COPY and return the inserted row count."""
    from backend.upload_state import NO_ERROR, upload_state

    print(f"Starting COPY insert into {data.db_name}")

    # Compute inferred types once so value casting matches the schema.
    _, column_sql_types = prepare_column_types(data)

    # Validate file path exists
    if not data.file_path:
        upload_state.set_error(upload_id, "File path is missing from parsed data")
        return

    # Progress is derived from bytes consumed vs. file size — no row-counting
    # pre-pass over the file is needed.
    file_size = data.file_size or data.file_path.stat().st_size or 1

    try:
        # Get connection parameters
        conn_params = get_db_connection_params()

        # Use psycopg for COPY command (much more efficient than INSERT)
        with psycopg.connect(**conn_params) as conn:
            with conn.cursor() as cur:
                # Use psycopg.sql for safe identifiers
                safe_columns = [sql.Identifier(col) for col in data.sanitized_column_names]
                column_identifiers = sql.SQL(', ').join(safe_columns)
                copy_query = sql.SQL("COPY {} ({}) FROM STDIN").format(
                    sql.Identifier(data.db_name),
                    column_identifiers
                )

                # The frontend polls once per second. Four combined Redis
                # updates per second keep it smooth without excessive I/O.
                last_progress_written_at = 0.0
                last_progress_fraction = -1.0
                i = -1
                with cur.copy(copy_query) as copy:
                    for i, (row, bytes_read) in enumerate(
                        stream_csv_rows(data.file_path)
                    ):
                        # 100 is reserved for completion of the whole upload batch.
                        progress_fraction = min(1.0, bytes_read / file_size)
                        progressVal: float = progress_fraction * 99
                        now = time.monotonic()
                        reached_end_since_last_update = (
                            progress_fraction >= 1.0
                            and last_progress_fraction < 1.0
                        )
                        if (
                            now - last_progress_written_at >= 0.25
                            or reached_end_since_last_update
                        ):
                            upload_state.set_db_ingestion_progress(
                                upload_id,
                                progressVal,
                                progress_fraction * 100,
                            )
                            last_progress_written_at = now
                            last_progress_fraction = progress_fraction

                        row_data = []
                        current_col = ""

                        try:
                            for col, col_type in zip(
                                data.column_names, column_sql_types
                            ):
                                current_col = col
                                value = row.get(col, "")

                                match col_type:
                                    case "float4":
                                        value = float(value) if value != "" else 0.0
                                    case "int4":
                                        value = int(value) if value != "" else 0
                                    case "date":
                                        value = (
                                            snanitize_date(value)
                                            if value != ""
                                            else "0001-01-01"
                                        )
                                    case _:
                                        # copy.write_row() performs PostgreSQL
                                        # escaping, so quotes, tabs, and newlines
                                        # stay byte-for-byte intact.
                                        value = value or ""

                                row_data.append(value)

                            copy.write_row(row_data)
                        except Exception as row_error:
                            print(
                                f"ERROR processing row {i}, col {current_col}: "
                                f"{row_error}"
                            )
                            upload_state.set_error(
                                upload_id,
                                f"ERROR processing column: {current_col} in row: "
                                f"{i} of file: {data.db_name} problem: {row_error}",
                            )
                            raise

                conn.commit()
        upload_state.set_db_ingestion_progress(upload_id, 99.0, 100.0)
        cleanUp(data.file_path)  # Only clean up the specific file

        print(f"Successfully inserted {i + 1} rows into {data.db_name}")
        return i + 1

    except Exception as e:
        print(f"ERROR in insertData: {e}")
        if upload_state.get_status(upload_id)["error"] == NO_ERROR:
            upload_state.set_error(upload_id, f"ERROR inserting data: {e}")
        return


def cleanUp(file_path=None):
    """Clean up the specific processed file"""
    from pathlib import Path
    import os

    if file_path:
        # Only delete the specific file that was processed
        try:
            if Path(file_path).exists():
                os.remove(file_path)
                print(f"Cleaned up: {file_path}")
        except Exception as e:
            print(f"Warning: Could not delete {file_path}: {e}")
    else:
        # Fallback: clean all files (legacy behavior)
        from backend.index import dataPaths
        existing_files: list[str] = [f for f in listdir(dataPaths.data_sets_save_location) if Path.is_file(Path.joinpath(dataPaths.data_sets_save_location, f))]
        if existing_files:
            print("Cleaning up all files: ")
        for index, file_to_delete in enumerate(existing_files):
            os.remove(Path.joinpath(dataPaths.data_sets_save_location, file_to_delete))
            print(f"{index}: {file_to_delete} removed")
