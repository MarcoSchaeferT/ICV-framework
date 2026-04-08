from os import listdir
import os
import io
import csv
from .parseCSVdata import ParsedData, snanitize_value, snanitize_date, stream_csv_rows
from .createTable import getColumnSQLdataType, SQL_DATATYPES
from .db_utils import get_db_connection_params
import psycopg
from psycopg import sql


async def insertData(data: ParsedData):
    """Insert CSV data using PostgreSQL COPY command for maximum efficiency and minimal memory usage"""
    from .uploadFileToDB import setProgress
    from backend.index import fileUploadErrors

    print(f"Starting COPY insert for {data.total_rows} rows into {data.db_name}")
    
    # Validate file path exists
    if not data.file_path:
        fileUploadErrors["ERROR"] = "File path is missing from parsed data"
        return
    
    try:
        # Get connection parameters
        conn_params = get_db_connection_params()
        
        # Use psycopg for COPY command (much more efficient than INSERT)
        with psycopg.connect(**conn_params) as conn:
            with conn.cursor() as cur:
                # COPY is very efficient - can handle large chunks with constant memory
                chunk_size = 10000  # 10k rows per COPY operation
                columns = ', '.join(data.sanitized_column_names)
                
                # Create a buffer for COPY data
                buffer = io.StringIO()
                csv_writer = csv.writer(buffer, delimiter='\t', quoting=csv.QUOTE_MINIMAL)
                
                row_count = 0
                
                for i, row in enumerate(stream_csv_rows(data.file_path)):
                    # Update progress
                    progressVal: float = (i + 1) / data.total_rows * 99
                    setProgress(progressVal)
                    
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
                        fileUploadErrors["ERROR"] = f"ERROR processing column: {current_col} in row: {i} of file: {data.db_name} problem: {e}"
                        return
                    
                    # Execute COPY when chunk is full or at end of file
                    if row_count >= chunk_size or (i + 1) == data.total_rows:
                        # Reset buffer position to start
                        buffer.seek(0)
                        
                        try:
                            # Use COPY FROM for bulk insert
                            column_identifiers = sql.SQL(', ').join(
                                sql.Identifier(col) for col in data.sanitized_column_names
                            )
                            copy_query = sql.SQL("COPY {} ({}) FROM STDIN").format(
                                sql.Identifier(data.db_name),
                                column_identifiers
                            )
                            with cur.copy(copy_query) as copy:
                                while data_chunk := buffer.read(8192):
                                    copy.write(data_chunk)
                            
                            conn.commit()
                            print(f"{i + 1} records inserted via COPY!")
                            
                        except Exception as e:
                            conn.rollback()
                            print(f"COPY failed at row {i}: {e}")
                            fileUploadErrors["ERROR"] = f"COPY failed at row {i}: {e}"
                            # Fall back to row-by-row insert for this chunk
                            buffer.seek(0)
                            success = await _fallback_insert(
                                conn, cur, data.db_name, columns, 
                                buffer, i, chunk_size, fileUploadErrors
                            )
                            if not success:
                                return
                        
                        # Clear buffer for next chunk
                        buffer = io.StringIO()
                        csv_writer = csv.writer(buffer, delimiter='\t', quoting=csv.QUOTE_MINIMAL)
                        row_count = 0
        setProgress(100)        
        cleanUp(data.file_path)  # Only clean up the specific file
        
        print(f"Successfully inserted {data.total_rows} rows into {data.db_name}")
        
    except Exception as e:
        print(f"ERROR in insertData: {e}")
        fileUploadErrors["ERROR"] = f"ERROR inserting data: {e}"
        return


async def _fallback_insert(
    conn, cur, table_name: str, columns: str,
    buffer: io.StringIO, current_row: int, chunk_size: int,
    fileUploadErrors: dict
) -> bool:
    """Fallback to row-by-row INSERT if COPY fails (to identify problematic row)"""
    buffer.seek(0)
    reader = csv.reader(buffer, delimiter='\t')
    
    for j, row_data in enumerate(reader):
        try:
            placeholders = ', '.join(['%s'] * len(row_data))
            query = f"INSERT INTO {table_name} ({columns}) VALUES ({placeholders})"
            cur.execute(query, row_data)
            conn.commit()
        except Exception as row_error:
            conn.rollback()
            row_num = current_row - chunk_size + j + 1
            print(f"ERROR inserting row {row_num}: {row_error}")
            fileUploadErrors["ERROR"] = f"ERROR inserting data at line {row_num}: {row_error}"
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
