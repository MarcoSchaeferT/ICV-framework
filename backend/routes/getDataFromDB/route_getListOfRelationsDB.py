"""Expose names of public PostgreSQL relations for dataset selectors."""

from flask import jsonify, Blueprint, Response
from flasgger import swag_from
from backend.routes.setFilesToDB.db_utils import query_raw


# Blueprint configuration
route_getListOfRelationsDB = Blueprint('getListOfRelationsDB', __name__)

# Public-schema relations used by the application or database extensions, not datasets.
# Keep this list here so every consumer of the relation endpoint sees the same set.
HIDDEN_RELATIONS = frozenset({
  'Test',
  'User',
  'column_metadata_de',
  'column_metadata_en',
  'pg_stat_statements',
  'pg_stat_statements_info',
})

#***************#
# *** Route *** #
#***************#
@swag_from('../../API_docs/get_list_of_relations_db.yml')
@route_getListOfRelationsDB.route("", methods=["GET"])
async def getListOfRelationsDB() -> Response:
  """Return a name-to-name JSON map of public relations.

  Application and extension relations in ``HIDDEN_RELATIONS`` are omitted.
  This is a dataset-discovery filter, not an authorization check for other
  endpoints that accept a relation name.
  """
  query = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
  relations = await query_raw(query)
  relations_dict = {
    relation['table_name']: relation['table_name']
    for relation in relations
    if relation['table_name'] not in HIDDEN_RELATIONS
  }
  return jsonify(relations_dict)
