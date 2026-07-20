from os import listdir
import os
import io
import csv
from .parseCSVdata import ParsedData, snanitize_value, snanitize_date, stream_csv_rows
from .createTable import getColumnSQLdataType, SQL_DATATYPES
from .db_utils import get_db_connection_params
import psycopg
from psycopg import sql


async def insertData(data: ParsedData, upload_id: str):
    """Insert CSV data using PostgreSQL COPY command for maximum efficiency and minimal memory usage"""
    from backend.upload_state import upload_state

    print(f"Starting COPY insert into {data.db_name}")

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
                # COPY is very efficient - can handle large chunks with constant memory
                chunk_size = 10000  # 10k rows per COPY operation

                # Use psycopg.sql for safe identifiers
                safe_columns = [sql.Identifier(col) for col in data.sanitized_column_names]
                column_identifiers = sql.SQL(', ').join(safe_columns)
                copy_query = sql.SQL("COPY {} ({}) FROM STDIN").format(
                    sql.Identifier(data.db_name),
                    column_identifiers
                )

                async def flush_chunk(buffer: io.StringIO, last_row: int) -> bool:
                    """COPY the buffered rows; fall back to row-by-row INSERT on failure."""
                    buffer.seek(0)
                    try:
                        with cur.copy(copy_query) as copy:
                            while data_chunk := buffer.read(8192):
                                copy.write(data_chunk)
                        conn.commit()
                        print(f"{last_row + 1} records inserted via COPY!")
                        return True
                    except Exception as e:
                        conn.rollback()
                        print(f"COPY failed at row {last_row}: {e}")
                        upload_state.set_error(upload_id, f"COPY failed at row {last_row}: {e}")
                        # Fall back to row-by-row insert for this chunk
                        buffer.seek(0)
                        return await _fallback_insert(
                            conn, cur, data.db_name, safe_columns,
                            buffer, last_row, chunk_size, upload_id
                        )

                # Create a buffer for COPY data
                buffer = io.StringIO()
                csv_writer = csv.writer(buffer, delimiter='\t', quoting=csv.QUOTE_MINIMAL)

                row_count = 0
                # Throttle progress updates: each set_progress() is a Redis
                # round-trip, so writing it per row would dominate the whole
                # insert time on large files. The frontend only polls once per
                # second — 0.1-point steps (≤990 writes per file) are plenty.
                last_progress_written = -1.0
                i = -1

                for i, (row, bytes_read) in enumerate(stream_csv_rows(data.file_path)):
                    # Update progress (caps at 99 — 100 is set by the upload
                    # route once ALL files of the batch are processed)
                    progressVal: float = bytes_read / file_size * 99
                    if progressVal - last_progress_written >= 0.1:
                        upload_state.set_progress(upload_id, progressVal)
                        last_progress_written = progressVal

                    row_data = []
                    current_col = ""

                    try:
                        for j, col in enumerate(data.column_names):
                            current_col = col
                            col_type = getColumnSQLdataType(col)
                            value = row.get(col, "")

                            match col_type:
                                case "float4":
                                    value = float(value) if value != "" else 0.0
                                case "int4":
                                    value = int(value) if value != "" else 0
                                case "date":
                                    value = snanitize_date(value) if value != "" else "0001-01-01"
                                case _:
                                    if value and value != "":
                                        value = snanitize_value(value)
                                    else:
                                        value = ""  # Empty string for COPY, not NULL

                            row_data.append(value)

                        csv_writer.writerow(row_data)
                        row_count += 1

                    except Exception as e:
                        print(f"ERROR processing row {i}, col {current_col}: {e}")
                        upload_state.set_error(upload_id, f"ERROR processing column: {current_col} in row: {i} of file: {data.db_name} problem: {e}")
                        return

                    # Execute COPY when chunk is full
                    if row_count >= chunk_size:
                        if not await flush_chunk(buffer, i):
                            return
                        # Clear buffer for next chunk
                        buffer = io.StringIO()
                        csv_writer = csv.writer(buffer, delimiter='\t', quoting=csv.QUOTE_MINIMAL)
                        row_count = 0

                # Flush the final partial chunk (end of file)
                if row_count > 0:
                    if not await flush_chunk(buffer, i):
                        return
        cleanUp(data.file_path)  # Only clean up the specific file

        print(f"Successfully inserted {i + 1} rows into {data.db_name}")

    except Exception as e:
        print(f"ERROR in insertData: {e}")
        upload_state.set_error(upload_id, f"ERROR inserting data: {e}")
        return


async def _fallback_insert(
    conn, cur, table_name: str, safe_columns: list[sql.Identifier],
    buffer: io.StringIO, current_row: int, chunk_size: int, upload_id: str
) -> bool:
    """Fallback to row-by-row INSERT if COPY fails (to identify problematic row)"""
    from backend.upload_state import upload_state
    buffer.seek(0)
    reader = csv.reader(buffer, delimiter='\t')

    for j, row_data in enumerate(reader):
        try:
            # Build safe parameterized INSERT query
            placeholders = sql.SQL(", ").join(sql.Placeholder() * len(row_data))
            columns_sql = sql.SQL(", ").join(safe_columns)
            query = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
                sql.Identifier(table_name),
                columns_sql,
                placeholders
            )
            cur.execute(query, row_data)
            conn.commit()
        except Exception as row_error:
            conn.rollback()
            row_num = current_row - chunk_size + j + 1
            print(f"ERROR inserting row {row_num}: {row_error}")
            upload_state.set_error(upload_id, f"ERROR inserting data at line {row_num}: {row_error}")
            return False
    return True


def cleanUp(file_path=None):
    """Clean up the specific processed file"""
    from pathlib import Path
    import os
    import time
    time.sleep(1)  # Small delay to ensure file handles are released

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
