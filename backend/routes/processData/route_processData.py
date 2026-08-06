from flask import Blueprint, request, jsonify
from flasgger import swag_from
from .assignGeoPosToCountry import assign_geo_pos_to_country
from .aggregateRKIdata import aggregate_rki_data

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


@route_processData.route('/aggregateRKI', methods=['GET', 'POST'])
def aggregate_rki():
    """
    Aggregate RKI COVID-19 / SARS-CoV-2 metrics by Bundesland.
    ---
    parameters:
      - name: sourceTable
        in: query
        type: string
        required: false
        default: "aktuell_deutschland_sarscov2_infektionen"
        description: The name of the raw RKI table to aggregate.
      - name: targetTable
        in: query
        type: string
        required: false
        description: The target aggregated table name.
      - name: targetDate
        in: query
        type: string
        required: false
        description: Target date for aggregation (YYYY-MM-DD). Defaults to latest date in dataset.
    responses:
      200:
        description: Aggregation completed successfully
    """
    if request.method == 'POST':
        data = request.get_json() or {}
        source_table = data.get('sourceTable') or request.args.get('sourceTable') or "aktuell_deutschland_sarscov2_infektionen"
        target_table = data.get('targetTable') or request.args.get('targetTable')
        target_date = data.get('targetDate') or data.get('date') or request.args.get('targetDate') or request.args.get('date')
    else:
        source_table = request.args.get('sourceTable', 'aktuell_deutschland_sarscov2_infektionen')
        target_table = request.args.get('targetTable')
        target_date = request.args.get('targetDate') or request.args.get('date')

    try:
        result = aggregate_rki_data(
            source_table=source_table,
            target_table=target_table,
            targetDate=target_date
        )
        return jsonify(result), 200
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": f"Error aggregating RKI data: {str(e)}"}), 500
