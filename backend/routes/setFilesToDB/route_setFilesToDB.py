from flask import request, jsonify, Blueprint
from pathlib import Path
import os
from os import listdir
from flasgger import swag_from
import asyncio
from threading import Thread, Lock
import uuid
import shutil

# custom modules
from .uploadFileToDB import uploadFileToDB
from backend.upload_state import upload_state

# Blueprint configuration
route_setFilesToDB = Blueprint('setFilesToDB', __name__)

# Background event loop for processing.
# Created lazily PER PROCESS: with Gunicorn's preload_app=True this module is
# imported in the master process, and a thread started at import time does not
# survive the fork into workers — the workers would inherit a loop object that
# no thread is running, so scheduled coroutines would never execute. The PID
# check detects the fork and gives each worker its own running loop.
_bg_loop = None
_bg_loop_pid = None
_bg_loop_lock = Lock()

def _get_bg_loop() -> asyncio.AbstractEventLoop:
  global _bg_loop, _bg_loop_pid
  with _bg_loop_lock:
    if _bg_loop is None or _bg_loop_pid != os.getpid():
      _bg_loop = asyncio.new_event_loop()
      Thread(target=_bg_loop.run_forever, daemon=True).start()
      _bg_loop_pid = os.getpid()
    return _bg_loop

#***************#
# *** Route *** #
#***************#
@swag_from('../../API_docs/set_files_to_db.yml')
@route_setFilesToDB.route("", methods=[ "POST"])
async def setFilesToDB():
  from backend.index import dataPaths 
  if request.method == "POST":
    print(request.files)
    if "files" not in request.files:
      return jsonify({"ERROR": "No files part in the request"}), 400
    files = request.files.getlist("files")
    if not files:
      return jsonify({"ERROR": "No selected files"}), 400
    
    # Create a unique directory for this upload batch to avoid race conditions
    upload_id = str(uuid.uuid4())
    upload_dir = Path(dataPaths.data_sets_save_location) / upload_id
    os.makedirs(upload_dir, exist_ok=True)
    print(f"Created upload directory: {upload_dir}")
    
    # Save ALL files to the unique upload directory
    saved_files = []
    for file in files:
      if not file.filename or file.filename == "":
        continue
      if file:
        filename = file.filename
        file_path = upload_dir / filename
        try:
          # This copy out of the multipart spool happens BEFORE the response,
          # while the proxy's idle timeout is ticking — use a large buffer so
          # multi-GB files finish well within proxyTimeout (next.config.mjs).
          file.save(file_path, buffer_size=16 * 1024 * 1024)
          saved_files.append(file_path)
          print(f"Saved file: {file_path}")
        except Exception as e:
          # Clean up on error
          shutil.rmtree(upload_dir, ignore_errors=True)
          return jsonify({"ERROR": "Error saving file: " + str(e)}), 500
    
    if not saved_files:
      shutil.rmtree(upload_dir, ignore_errors=True)
      return jsonify({"ERROR": "No files were saved"}), 400
    
    # Initialize the shared progress/error state for this upload BEFORE
    # returning the upload_id, so the client can poll it immediately.
    upload_state.start(upload_id)

    # Start background processing and return immediately
    # Frontend will poll /api/uploadStatus?id=<upload_id> for status
    async def process_files():
      try:
        for file_path in saved_files:
          try:
            print(f"Processing file: {file_path}")
            error = await uploadFileToDB(file_path, upload_id)
            if error:
              detail = error.get("ERROR") if isinstance(error, dict) else str(error)
              upload_state.set_error(upload_id, f"Error processing {file_path}: {detail}")
              print(f"Error processing file: {file_path}: {detail}")
              return
            print(f"Completed file: {file_path}")
          except Exception as e:
            upload_state.set_error(upload_id, f"Error processing file {file_path}: {str(e)}")
            print(f"Exception processing file {file_path}: {e}")
            return
        # Progress 100 means the WHOLE batch is done (per-file inserts cap
        # at 99), so a multi-file upload can't signal completion early.
        upload_state.set_progress(upload_id, 100)
      finally:
        # Clean up the upload directory after processing (success or failure)
        shutil.rmtree(upload_dir, ignore_errors=True)
        print(f"Cleaned up upload directory: {upload_dir}")
    
    # Schedule background processing
    asyncio.run_coroutine_threadsafe(process_files(), _get_bg_loop())
    
    # Return immediately - frontend polls for progress
    # Check if tables exist (based on file names)
    tables_exist = False
    try:
      from backend.routes.setFilesToDB.db_utils import query_raw
      from backend.routes.setFilesToDB.parseCSVdata import sanitize_names
      from psycopg import sql
      for file_path in saved_files:
        table_name = sanitize_names([Path(file_path).stem])[0]
        # Use parameterized query for table existence check
        check_query = sql.SQL("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = %s)")
        result = await query_raw(check_query, (table_name,))
        tables_exist = bool(result[0].get('exists', False)) if result else False
    except Exception as e:
      print(f"Error checking table existence: {e}")
      pass

    
    return (
      jsonify(
      {
        "SUCCESS": "Files upload started",
        "upload_id": upload_id,
        "file_paths": [str(f) for f in saved_files],
        "table_exist": tables_exist
      }
      ),
      200,
    )
