import asyncio
from flask import jsonify
from pathlib import Path
from threading import Lock

# custom modules
from .parseCSVdata import parseCSVdata, ParsedData
from .createTable import createTable
from .insertData import insertData
from .resetTable import resetTable
from backend.routes.columnMetadata.route_columnMetadata import populate_column_metadata


# Lock to prevent concurrent uploads of the same file
_upload_lock = Lock()
_currently_processing = set()

async def uploadFileToDB(file_path: Path):
    file_name = Path(file_path).name
    
    # Prevent duplicate processing of the same file
    with _upload_lock:
        if file_name in _currently_processing:
            print(f"File {file_name} is already being processed, skipping duplicate request")
            return jsonify({"ERROR": f"File {file_name} is already being processed"})
        _currently_processing.add(file_name)
    
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
            await insertData(data)
        except Exception as e:
            return jsonify({"ERROR": f"Insert failed: {str(e)}"})

        # *** POPULATE COLUMN METADATA *** #
        # Auto-fill column_metadata_en and column_metadata_de from CSV suggestions
        print(f"[uploadFileToDB] About to populate column metadata for '{data.db_name}' with columns: {data.column_names}")
        try:
            populate_column_metadata(data.db_name, data.column_names)
        except Exception as e:
            import traceback
            print(f"WARNING: Column metadata population failed: {e}")
            traceback.print_exc()

        return None  # Return None on success, jsonify only on error
    
    finally:
        # Always remove from processing set when done
        with _upload_lock:
            _currently_processing.discard(file_name)


def setProgress(progress):
  from backend.index import progressVal
  progressVal[0] = progress

def checkErrors(result):
  if result != None:
      if type(result) is dict:
          if "ERROR" in result and "already exists" not in result["ERROR"]:
              return jsonify(result)
          if "restart" in result:
            return result
  return False