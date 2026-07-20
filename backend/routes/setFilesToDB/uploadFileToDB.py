import asyncio
from pathlib import Path

# custom modules
from .parseCSVdata import parseCSVdata, ParsedData
from .createTable import createTable
from .insertData import insertData
from .resetTable import resetTable
from backend.routes.columnMetadata.route_columnMetadata import populate_column_metadata
from backend.upload_state import upload_state
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

        # *** CREATE *** #
        res = await createTable(data)
        print("res", res)
        if checkErrors(res):
            return checkErrors(res)

        # *** RESET *** #
        res = await resetTable(data.db_name)
        if checkErrors(res):
            return checkErrors(res)

        # *** INSERT *** #
        # Run insert synchronously since we're already in an async function
        # This allows proper sequential processing of multiple files
        try:
            await insertData(data, upload_id)
        except Exception as e:
            return {"ERROR": f"Insert failed: {str(e)}"}

        # *** POPULATE COLUMN METADATA *** #
        # Auto-fill column_metadata_en and column_metadata_de from CSV suggestions
        print(f"[uploadFileToDB] About to populate column metadata for '{data.db_name}' with columns: {data.column_names}")
        try:
            populate_column_metadata(data.db_name, data.column_names)
        except Exception as e:
            import traceback
            print(f"WARNING: Column metadata population failed: {e}")
            traceback.print_exc()

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
  if result != None:
      if type(result) is dict:
          if "ERROR" in result and "already exists" not in result["ERROR"]:
              return result
          if "restart" in result:
            return result
  return False