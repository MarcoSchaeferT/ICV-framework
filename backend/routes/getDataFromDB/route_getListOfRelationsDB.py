from flask import request, jsonify, Blueprint, Response
from flasgger import swag_from
from backend.routes.setFilesToDB.db_utils import query_raw


# Blueprint configuration
route_getListOfRelationsDB = Blueprint('getListOfRelationsDB', __name__)

#***************#
# *** Route *** #
#***************#
@swag_from('../../API_docs/get_list_of_relations_db.yml')
@route_getListOfRelationsDB.route("", methods=["GET"])
async def getListOfRelationsDB() -> Response:
  query = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
  relations = await query_raw(query)
  relations_dict = {relation['table_name']: relation['table_name'] for relation in relations}

  relations_dict.pop('Test', None)
  relations_dict.pop('User', None)
  return jsonify(relations_dict)
