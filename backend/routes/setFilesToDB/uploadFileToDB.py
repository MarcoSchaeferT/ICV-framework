import asyncio
from pathlib import Path

# custom modules
from .parseCSVdata import parseCSVdata, ParsedData
from .createTable import createTable
from .insertData import insertData
from backend.routes.columnMetadata.route_columnMetadata import populate_column_metadata
from backend.routes.processData.assignGeoPosToCountry import assign_geo_pos_to_country
from backend.upload_state import NO_ERROR, upload_state
from backend.cache import response_cache


async def uploadFileToDB(file_path: Path, upload_id: str):
    file_name = Path(file_path).name

    # Prevent duplicate processing of the same file (Redis-backed lock,
    # shared across all Gunicorn workers)
    if not upload_state.try_acquire_file_lock(file_name):
        print(f"File {file_name} is already being processed, skipping duplicate request")
        return {"ERROR": f"File {file_name} is already being processed"}

    try:
        # *** PARSE *** #
        data: ParsedData = await parseCSVdata(file_path)
        if checkErrors(data):
            return checkErrors(data)

        has_geometry = "geometry" in data.sanitized_column_names
        upload_state.set_phase(upload_id, "db")
        upload_state.set_has_geometry(upload_id, has_geometry)
        upload_state.set_db_progress(upload_id, 0.0)
        upload_state.set_country_progress(upload_id, 0.0)

        # *** REPLACE TABLE SCHEMA *** #
        # The uploaded file is a complete snapshot. Recreating the table also
        # picks up rolling columns, such as the next six ENSO forecast months.
        res = await createTable(data)
        print("res", res)
        if checkErrors(res):
            return checkErrors(res)

        # *** INSERT *** #
        # Run insert synchronously since we're already in an async function
        # This allows proper sequential processing of multiple files
        try:
            inserted_rows = await insertData(data, upload_id)
        except Exception as e:
            return {"ERROR": f"Insert failed: {str(e)}"}

        insert_error = upload_state.get_status(upload_id)["error"]
        if insert_error != NO_ERROR:
            return {"ERROR": insert_error}

        # *** POPULATE COLUMN METADATA *** #
        # Auto-fill column_metadata_en and column_metadata_de from CSV suggestions
        print(f"[uploadFileToDB] About to populate column metadata for '{data.db_name}' with columns: {data.column_names}")
        try:
            populate_column_metadata(
                data.db_name,
                data.column_names,
                resolved_sql_types=dict(
                    zip(data.column_names, data.column_sql_types)
                ),
                replace_existing=True,
            )
        except Exception as e:
            import traceback
            print(f"WARNING: Column metadata population failed: {e}")
            traceback.print_exc()

        # *** ASSIGN COUNTRIES *** #
        # Geometry is detected from the sanitized CSV header, which is also
        # the actual PostgreSQL column name created above.
        if has_geometry:
            upload_state.set_phase(upload_id, "country")
            upload_state.set_country_progress(upload_id, 0.0)

            def report_country_progress(processed_rows: int, total_rows: int) -> None:
                ratio = processed_rows / total_rows if total_rows else 1.0
                upload_state.set_country_progress(
                    upload_id, min(100.0, ratio * 100)
                )

            try:
                updated_count = await asyncio.to_thread(
                    assign_geo_pos_to_country,
                    data.db_name,
                    skip_existing=True,
                    progress_callback=report_country_progress,
                    total_rows=inserted_rows,
                )
                upload_state.set_country_progress(upload_id, 100.0)
                print(
                    f"[uploadFileToDB] Assigned countries for '{data.db_name}' "
                    f"({updated_count} rows updated)"
                )
            except Exception as e:
                return {"ERROR": f"Country assignment failed: {str(e)}"}

        # *** INVALIDATE CACHE *** #
        # The table's content (and possibly schema) just changed — drop
        # cached query results in ALL workers via the Redis epoch bump.
        evicted = response_cache.invalidate(data.db_name)
        print(f"[CACHE] Invalidated '{data.db_name}' after upload ({evicted} local entries)")

        return None  # Return None on success, error dict only on error

    finally:
        # Always release the processing lock when done
        upload_state.release_file_lock(file_name)


def checkErrors(result):
    if isinstance(result, dict):
        if "ERROR" in result:
            return result
        if "restart" in result:
            return result
    return False
