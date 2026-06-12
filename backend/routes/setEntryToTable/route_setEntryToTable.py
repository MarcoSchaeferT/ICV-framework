from flask import request, jsonify, Blueprint
from pathlib import Path
import os
from os import listdir
from flasgger import swag_from
from backend.routes.setFilesToDB.db_utils import query_raw, execute_raw, get_db_connection_params
import psycopg
from psycopg import errors as psycopg_errors, sql



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
    if not relation_name:
      return jsonify({"ERROR": "Missing relationName parameter"}), 400
      
    print(relation_name)

    if relation_name == "feedback_csv":
      print("Creating feedback_csv table if it doesn't exist")
      await ensure_feedback_csv_exists()
    elif relation_name == "page_visits":
      print("Creating page_visits table if it doesn't exist")
      await ensure_page_visits_exists()

    columns = []
    values = []
    for key, value in request.form.items():
      if key != 'relationName':
        columns.append(sql.Identifier(key))
        values.append(value)
    
    if not columns:
      return jsonify({"ERROR": "No data provided to insert"}), 400

    # Build safe INSERT query
    insert_query = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
        sql.Identifier(relation_name),
        sql.SQL(", ").join(columns),
        sql.SQL(", ").join(sql.Placeholder() * len(values))
    )
    
    print(insert_query.as_string(psycopg.connect(**get_db_connection_params())))

    # insert the data into the table
    try:
      await execute_raw(insert_query, tuple(values))
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

async def create_page_visits_relation():
  create_query = """
    CREATE TABLE page_visits (
      id SERIAL PRIMARY KEY,
      page_path VARCHAR,
      session_id VARCHAR,
      visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  """
  try:
    await execute_raw(create_query)
  except Exception as e:
    print("Error creating page_visits table:", e)

async def ensure_page_visits_exists():
    from backend.routes.getDataFromDB.route_getListOfRelationsDB  import getListOfRelationsDB 

    result = await getListOfRelationsDB()
    result = result.get_json() if hasattr(result, 'get_json') else {}
    table_exists = "page_visits" in [row for row in result]

    print("Table page_visits exists check result:", table_exists)

    if not table_exists:
        await create_page_visits_relation()
