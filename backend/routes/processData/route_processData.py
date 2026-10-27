"""Expose explicit POST commands for spatial data processing."""

from datetime import date
from typing import Optional

from flask import Blueprint, request, jsonify
from flasgger import swag_from
from pydantic import Field, ValidationError, field_validator
from backend.schemas import BaseSchema, RelationName
from .assignGeoPosToCountry import assign_geo_pos_to_country
from .aggregateRKIdata import aggregate_rki_data

route_processData = Blueprint('route_processData', __name__)


class AssignCountriesParams(BaseSchema):
    """Parameters for assigning countries to spatial points in a relation.

    Example:
        ```python
        params = AssignCountriesParams(tableName="observations", reprocessAll=False)
        ```
    """
    tableName: RelationName
    reprocessAll: bool = Field(
        default=False,
        strict=True,
        description="Whether to reprocess already assigned rows.",
    )


class AggregateRkiParams(BaseSchema):
    """Parameters for aggregating RKI COVID-19 data by German federal state.

    Example:
        ```python
        params = AggregateRkiParams(
            sourceTable="aktuell_deutschland_sarscov2_infektionen",
            targetTable="rki_states",
            targetDate="2022-06-01",
        )
        ```
    """
    sourceTable: RelationName = "aktuell_deutschland_sarscov2_infektionen"
    targetTable: Optional[RelationName] = None
    targetDate: Optional[str] = None

    @field_validator("targetDate")
    @classmethod
    def _validate_target_date(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        if not isinstance(v, str):
            raise ValueError("targetDate must be an ISO date string when supplied.")
        try:
            if date.fromisoformat(v).isoformat() != v:
                raise ValueError
        except (ValueError, TypeError):
            raise ValueError("targetDate must use YYYY-MM-DD format.")
        return v


@swag_from('../../API_docs/process_assign_countries.yml')
@route_processData.route('/assignCountries', methods=['POST'])
def assign_countries():
    """Update a relation's country assignments from a JSON POST command."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "A JSON object is required."}), 400

    try:
        params = AssignCountriesParams.model_validate(data)
    except ValidationError as err:
        return jsonify({"error": str(err.errors()[0]["msg"] if err.errors() else err)}), 400

    try:
        updated_count = assign_geo_pos_to_country(
            params.tableName, skip_existing=not params.reprocessAll
        )
        return jsonify({
            "message": "Processing complete",
            "tableName": params.tableName,
            "updatedRows": updated_count,
        }), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@swag_from('../../API_docs/process_aggregate_rki.yml')
@route_processData.route('/aggregateRKI', methods=['POST'])
def aggregate_rki():
    """Create or refresh state-level RKI data from a JSON POST command."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "A JSON object is required."}), 400

    try:
        params = AggregateRkiParams.model_validate(data)
    except ValidationError as err:
        return jsonify({"error": str(err.errors()[0]["msg"] if err.errors() else err)}), 400

    try:
        result = aggregate_rki_data(
            source_table=params.sourceTable,
            target_table=params.targetTable,
            targetDate=params.targetDate,
        )
        return jsonify(result), 200
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Error aggregating RKI data: {exc}"}), 500

