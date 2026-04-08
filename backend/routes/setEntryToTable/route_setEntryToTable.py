from flask import request, jsonify, Blueprint
from pathlib import Path
import os
from os import listdir
from flasgger import swag_from
from backend.routes.setFilesToDB.db_utils import query_raw, execute_raw
from psycopg import errors as psycopg_errors



# Blueprint configuration
route_setEntryToTable = Blueprint('setEntryToTable', __name__)

#***************#
# *** Route *** #
#***************#
@swag_from('../../API_docs/set_entry_to_table.yml')
@route_setEntryToTable.route("", methods=["POST"])
async def setEntryToTable():
  if request.method == "POST":
    relation_name = request.form.get('relationName')
    print(relation_name)

    if relation_name == "feedback_csv":
      print("Creating feedback_csv table if it doesn't exist")
      await ensure_feedback_csv_exists()


    if relation_name != None or relation_name != "":
      columns = []
      values = []
      for key, value in request.form.items():
        if key != 'relationName':
          columns.append(f'"{key}"')
          values.append(f"'{value}'")
      # Add created_at column with current timestamp if it exists in the relation
      
     
      insert_query = f'INSERT INTO "{relation_name}" ({", ".join(columns)}) VALUES ({", ".join(values)});'
      print(insert_query)
      from backend.index import fileUploadErrors

      # insert the data into the table
      try:
        await execute_raw(insert_query)
      except psycopg_errors.UndefinedTable:
        data = {"ERROR": f"Table '{relation_name}' does not exist. Please create the table first."}
        return jsonify(data), 404
      except Exception as e:
        data = {"ERROR": f"Error inserting data into table: {str(e)}"}
        return jsonify(data), 500

    return (
      jsonify(
        {"SUCCESS": "Form data submitted successfully"}
      ),
      200,
    )
  

async def create_Feedback_Relation():
  create_query = """
    CREATE TABLE feedback_csv (
      id SERIAL PRIMARY KEY,
      name VARCHAR,
      email VARCHAR,
      feedback_type VARCHAR,
      message VARCHAR,
      created_at DATE DEFAULT CURRENT_DATE
    );
  """
  try:
    await execute_raw(create_query)
  except Exception as e:
    print("Error creating feedback_csv table:", e)



async def ensure_feedback_csv_exists():
    from backend.routes.getDataFromDB.route_getListOfRelationsDB  import getListOfRelationsDB 

    result = await getListOfRelationsDB()
    result = result.get_json() if hasattr(result, 'get_json') else {}
    table_exists = "feedback_csv" in [row for row in result]

    print("Table exists check result:", table_exists)

    if not table_exists:
        await create_Feedback_Relation()

 
