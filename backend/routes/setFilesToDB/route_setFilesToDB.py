from flask import request, jsonify, Blueprint
from pathlib import Path
import os
from os import listdir
from flasgger import swag_from
import asyncio
from threading import Thread
import uuid
import shutil

# custom modules
from .uploadFileToDB import uploadFileToDB

# Blueprint configuration
route_setFilesToDB = Blueprint('setFilesToDB', __name__)

# Background event loop for processing
_bg_loop = asyncio.new_event_loop()
_bg_thread = Thread(target=lambda: _bg_loop.run_forever(), daemon=True)
_bg_thread.start()

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
          file.save(file_path)
          saved_files.append(file_path)
          print(f"Saved file: {file_path}")
        except Exception as e:
          # Clean up on error
          shutil.rmtree(upload_dir, ignore_errors=True)
          return jsonify({"ERROR": "Error saving file: " + str(e)}), 500
    
    if not saved_files:
      shutil.rmtree(upload_dir, ignore_errors=True)
      return jsonify({"ERROR": "No files were saved"}), 400
    
    # Start background processing and return immediately
    # Frontend will poll getUploadProgress for status
    async def process_files():
      try:
        for file_path in saved_files:
          try:
            print(f"Processing file: {file_path}")
            error = await uploadFileToDB(file_path)
            if error:
              from backend.index import fileUploadErrors
              fileUploadErrors["ERROR"] = f"Error processing {file_path}"
              print(f"Error processing file: {file_path}")
              return
            print(f"Completed file: {file_path}")
          except Exception as e:
            from backend.index import fileUploadErrors
            fileUploadErrors["ERROR"] = f"Error processing file {file_path}: {str(e)}"
            print(f"Exception processing file {file_path}: {e}")
            return
      finally:
        # Clean up the upload directory after processing (success or failure)
        shutil.rmtree(upload_dir, ignore_errors=True)
        print(f"Cleaned up upload directory: {upload_dir}")
    
    # Schedule background processing
    asyncio.run_coroutine_threadsafe(process_files(), _bg_loop)
    
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
        "file_paths": [str(f) for f in saved_files],
        "table_exist": tables_exist
      }
      ),
      200,
    )
