from flask import request, jsonify, Blueprint, make_response
from flasgger import swag_from
from backend.routes.setFilesToDB.db_utils import query_raw
from backend.cache import response_cache, make_cache_key
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

    # --- Cache lookup ---
    cache_key = make_cache_key("getColumnNamesDB", relationName)
    cached = response_cache.get(cache_key)
    if cached is not None:
      resp = make_response(jsonify(cached))
      resp.headers["X-Cache"] = "HIT"
      return resp

    try:
      query = sql.SQL("SELECT * FROM {} LIMIT 1").format(sql.Identifier(relationName))
      records = await query_raw(query)
      columnNames = list(records[0].keys()) if records else []
    except psycopg_errors.UndefinedTable:
      return jsonify({"error": f"Table '{relationName}' does not exist in the database."}), 404
    except Exception as e:
      return jsonify({"error": f"Database error: {str(e)}"}), 500

    # --- Store in cache ---
    response_cache.set(cache_key, columnNames, scopes=(relationName,))

    resp = make_response(jsonify(columnNames))
    resp.headers["X-Cache"] = "MISS"
    return resp


