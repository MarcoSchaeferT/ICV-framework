from flask import request, jsonify, Blueprint
from flasgger import swag_from
from backend.routes.setFilesToDB.db_utils import query_raw
from psycopg import errors as psycopg_errors, sql


# Blueprint configuration
route_getColumnNamesDB = Blueprint('getColumnNamesDB', __name__)

#***************#
# *** Route *** #
#***************#
@swag_from('../../API_docs/get_column_names_db.yml')
@route_getColumnNamesDB.route("", methods=["GET"])
async def getColumnNamesDB():
  columnNames  = []
  if request.method == "GET":
    relationName = request.args.get("relationName")
    if not relationName:
      return jsonify({"error": "Missing relationName parameter"}), 400
    try:
      query = sql.SQL("SELECT * FROM {} LIMIT 1").format(sql.Identifier(relationName))
      records = await query_raw(query)
      columnNames = list(records[0].keys()) if records else []
    except psycopg_errors.UndefinedTable:
      return jsonify({"error": f"Table '{relationName}' does not exist in the database."}), 404
    except Exception as e:
      return jsonify({"error": f"Database error: {str(e)}"}), 500
  return jsonify(columnNames)


