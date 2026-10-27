"""Serve cached column names for a PostgreSQL relation."""

from flask import request, jsonify, Blueprint, make_response
from flasgger import swag_from
from pydantic import ValidationError
from backend.schemas import BaseSchema, RelationName
from backend.routes.setFilesToDB.db_utils import query_raw, db_error_response
from backend.cache import response_cache, make_cache_key
from psycopg import errors as psycopg_errors, sql


# Blueprint configuration
route_getColumnNamesDB = Blueprint('getColumnNamesDB', __name__)


class GetColumnNamesParams(BaseSchema):
    """Query parameters for retrieving column names of a relation.

    Example:
        ```python
        params = GetColumnNamesParams(relationName="observations")
        ```
    """
    relationName: RelationName


#***************#
# *** Route *** #
#***************#
@swag_from('../../API_docs/get_column_names_db.yml')
@route_getColumnNamesDB.route("", methods=["GET"])
async def getColumnNamesDB():
  """Return a relation's column names with an ``X-Cache`` hit/miss header.

  ``relationName`` is required. A missing table returns 404 and other
  database failures return 500. Because names are taken from a one-row
  ``SELECT *``, an empty relation currently returns an empty list. Results
  are cached under the relation scope.
  """
  columnNames  = []
  if request.method == "GET":
    raw_relation_name = request.args.get("relationName")
    if not raw_relation_name:
      return jsonify({"error": "Missing relationName parameter"}), 400

    try:
      params = GetColumnNamesParams.model_validate({"relationName": raw_relation_name})
    except ValidationError as err:
      return jsonify({"error": str(err.errors()[0]["msg"] if err.errors() else err)}), 400

    relationName = params.relationName

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
      return db_error_response(e)

    # --- Store in cache ---
    response_cache.set(cache_key, columnNames, scopes=(relationName,))

    resp = make_response(jsonify(columnNames))
    resp.headers["X-Cache"] = "MISS"
    return resp



