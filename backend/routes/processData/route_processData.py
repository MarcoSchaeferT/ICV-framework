from flask import Blueprint, request, jsonify
from flasgger import swag_from
from .assignGeoPosToCountry import assign_geo_pos_to_country

route_processData = Blueprint('route_processData', __name__)

@route_processData.route('/assignCountries', methods=['GET', 'POST'])
def assign_countries():
    """
    Assign ISO codes to a table based on its geometry column.
    ---
    parameters:
      - name: tableName
        in: query
        type: string
        required: true
        description: The name of the table to process.
      - name: reprocessAll
        in: query
        type: boolean
        description: Whether to reprocess all rows.
    responses:
      200:
        description: Processing complete
    """
    if request.method == 'POST':
        data = request.get_json() or {}
        table_name = data.get('tableName') or request.args.get('tableName')
        reprocess_all = data.get('reprocessAll', False) or request.args.get('reprocessAll', 'false').lower() == 'true'
    else:
        table_name = request.args.get('tableName')
        reprocess_all = request.args.get('reprocessAll', 'false').lower() == 'true'

    if not table_name:
        return jsonify({"error": "Missing tableName parameter"}), 400
    
    try:
        updated_count = assign_geo_pos_to_country(table_name, skip_existing=not reprocess_all)
        return jsonify({
            "message": "Processing complete",
            "tableName": table_name,
            "updatedRows": updated_count
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
