"""Create the Flask API, register routes, and serve map and metadata assets.

Importing this module configures Flasgger, resolves packaged asset paths,
registers blueprints, and attempts to ensure both column metadata tables.
Gunicorn preloads it before forking, so database pools and Redis clients are
opened lazily in workers. Upload progress and response-cache invalidation
use Redis when available, with process-local fallbacks.
"""

from flask import Flask, Response
from flask import request
from flask import jsonify
from backend.upload_request import DirectUploadRequest
import time
import json
from backend.routes.setFilesToDB.db_utils import get_db_connection
from psycopg import sql as psycopg_sql
import os
import tarfile
import csv
csv.field_size_limit(100000000)
from pathlib import Path
from typing import Optional, Literal
from flasgger import Swagger, swag_from
from pydantic import Field, ValidationError
from backend.schemas import (
    BaseSchema,
    CellId,
    ImagePath,
    LangCode,
    MapName,
    UploadId,
)




# import routes
from backend.routes.setFilesToDB.route_setFilesToDB import route_setFilesToDB
from backend.routes.getDataFromDB.route_getDataFromDB  import route_getDataFromDB
from backend.routes.getDataFromDB.route_getColumnNamesDB  import route_getColumnNamesDB
from backend.routes.getDataFromDB.route_getListOfRelationsDB  import route_getListOfRelationsDB
from backend.routes.setEntryToTable.route_setEntryToTable import route_setEntryToTable
from backend.routes.columnMetadata.route_columnMetadata import route_columnMetadata, ensure_metadata_tables
from backend.routes.manageDB.route_manageDB import route_manageDB
from backend import metadata_utils
from backend.metadata_utils import getMetaDataPath, loadMetadataCSV
from backend.routes.processData.uncertaintyVis import (
    build_uncertainty_chart_data,
    render_uncertainty_svgs,
)
from backend.routes.processData.ensoSuitability import (
    build_ENSO_suitability_data,
    normalize_enso_locale,
    render_ENSO_suitability_svg,
)
from backend.routes.processData.svg_utils import SVG_RENDER_LOCK
from backend.routes.processData.route_processData import route_processData
from backend.cache import response_cache
from backend.routes.processData.enso_schema import is_enso_suitability_column
import json


app = Flask(__name__)
app.request_class = DirectUploadRequest
# register the blueprint

template = {
"swagger": "2.0",
"info": {
    "title": "ICV REST API",
    "description": "This API was developed using Python Flask, which provides an interface for getting data from an SQL data base via HTTP endpoints.",
    "version": "1.0"
}
}
app.config['SWAGGER'] = {
'title': 'ICV REST API',
'uiversion': 2,
'template': './resources/flasgger/swagger_ui.html'
}
Swagger(app, template=template)

testData = ["test", "test2", "test3"]

# Upload progress/error state lives in Redis (shared across Gunicorn workers),
# see backend/upload_state.py
from backend.upload_state import upload_state
class DataPaths:
    """Resolve packaged assets and temporary upload storage from this module.

    ``data_sets_save_location`` holds per-upload work directories; it is not
    a durable dataset catalog. PostgreSQL holds the imported relation data.
    """
    germany_map_states: Path
    germany_map_districts: Path
    world_map: Path
    capitals: Path
    data_sets_save_location: Path
    images: Path
    meta_data: Path
    usa_map: Path

    def __init__(self):
        """Resolve backend asset paths relative to this module."""
        self.germany_map_states = Path(__file__).parent / "assets" / "germany_states_midRes.geo.json.tgz"
        self.germany_map_districts = Path(__file__).parent / "assets" / "germany_districts.geo.json.tgz"
        self.world_map = Path(__file__).parent / "assets" / "worldmap_midRes.geo.json.tgz"
        self.capitals = Path(__file__).parent / "assets" / "capitals.geo.json.tgz"
        self.data_sets_save_location = Path(__file__).parent / "assets" / "uploads_tmp"
        self.images = Path(__file__).parent / "assets" / "images"
        self.meta_data: Path = Path(__file__).parent.parent / "messages" / "metaData.csv"
        self.usa_map = Path(__file__).parent / "assets" / "USA_map.geo.json.tgz"

dataPaths: DataPaths = DataPaths()
metadata_utils.init(dataPaths.meta_data)


# register the blueprint
app.register_blueprint(route_setFilesToDB, url_prefix='/api/setFilesToDB')
app.register_blueprint(route_getListOfRelationsDB, url_prefix='/api/getListOfRelationsDB')
app.register_blueprint(route_getColumnNamesDB, url_prefix='/api/getColumnNamesDB')
app.register_blueprint(route_getDataFromDB, url_prefix='/api/getDataFromDB')
app.register_blueprint(route_setEntryToTable, url_prefix='/api/setEntryToTable')
app.register_blueprint(route_columnMetadata, url_prefix='/api/columnMetadata')
app.register_blueprint(route_manageDB, url_prefix='/api/manageDB')
app.register_blueprint(route_processData, url_prefix='/api/processData')

# Create column_metadata_en/de tables if they don't exist.
ensure_metadata_tables()



@app.route("/api/python")
def hello_world():
    """Return the small HTML development landing response at ``/api/python``."""
    return "<p>Hello, World!</p><br> <p>back to homepage: <a  class='text-blue-600' href='http://localhost:3000/'>http://localhost:3000/</a></p>"

@app.route("/api/test", methods=["GET"])
def test():
    """Return the static JSON diagnostic payload at ``/api/test``."""
    if request.method == "GET":
        print("hello")
        #time.sleep(2)
        print(str(json.dumps(testData)))
        return json.dumps(testData)
    
# ────────────────────────────────────────────────
#  Pydantic Schemas for Asset & Diagnostic Routes
# ────────────────────────────────────────────────
class UploadStatusParams(BaseSchema):
    """Query parameters for polling upload progress and status.

    Example:
        ```python
        params = UploadStatusParams(id="550e8400-e29b-41d4-a716-446655440000")
        ```
    """
    id: UploadId


class GetMapDataParams(BaseSchema):
    """Query parameters for retrieving packaged GeoJSON maps.

    Example:
        ```python
        params = GetMapDataParams(mapName="germany_map_states")
        ```
    """
    mapName: MapName


class DatasetsMetadataParams(BaseSchema):
    """Query parameters for retrieving localized datasets metadata.

    Example:
        ```python
        params = DatasetsMetadataParams(LANGID="en", relationName="observations")
        ```
    """
    LANGID: LangCode = "en"
    relationName: Optional[str] = ""


class GetImageParams(BaseSchema):
    """Query parameters for reading a packaged JPEG image.

    Example:
        ```python
        params = GetImageParams(imagePath="sample.jpg")
        ```
    """
    imagePath: ImagePath


class CellChartDataParams(BaseSchema):
    """Query parameters for fetching cell-level chart data.

    Example:
        ```python
        params = CellChartDataParams(chart="enso", cellID=42)
        ```
    """
    chart: Literal["enso", "uncertainty"]
    cellID: CellId
    dataset: Optional[str] = "seas5_forecast_albopictus_habitat_probability"
    locale: Optional[str] = None


class UncertaintySvgParams(BaseSchema):
    """Query parameters for rendering cell-level SVG plots.

    Example:
        ```python
        params = UncertaintySvgParams(
            filename="climate_forecast_cell.svg",
            cellID=42,
            dataset="seas5_forecast_albopictus_habitat_probability",
        )
        ```
    """
    filename: str = Field(min_length=1)
    cellID: CellId
    dataset: Optional[str] = "seas5_forecast_albopictus_habitat_probability"
    month: Optional[str] = None
    locale: Optional[str] = None


@swag_from('API_docs/get_upload_status.yml')
@app.route("/api/uploadStatus", methods=["GET"])
def getUploadStatus():
    """Return shared progress and errors for one upload ID.

    The ``id`` query parameter is required; an absent ID receives HTTP 400.
    Status falls back to process-local state when Redis is unavailable;
    missing or expired IDs receive default values. See
    ``API_docs/get_upload_status.yml`` for the public response fields.
    """
    # Combined progress + error state for one upload, polled by the frontend.
    # Read-only: state is initialized by the setFilesToDB route and written
    # only by the backend during processing.
    try:
        params = UploadStatusParams.model_validate({"id": request.args.get("id")})
    except ValidationError:
        return jsonify({"error": "Missing 'id' query parameter"}), 400
    return jsonify(upload_state.get_status(params.id))


@swag_from('API_docs/get_map_data.yml')
@app.route("/api/getMapData", methods=["GET"])
def getMap():
    """Serve one packaged GeoJSON map selected by the ``mapName`` query field.

    Unknown names return HTTP 404; missing names return HTTP 400. Map names
    are resolved through a fixed local asset registry.
    """
    try:
        params = GetMapDataParams.model_validate({"mapName": request.args.get("mapName")})
    except ValidationError:
        return jsonify({"error": "No mapName provided!"}), 400

    # Mapping of map names to their respective paths
    map_paths = {
        "germany_map_states": dataPaths.germany_map_states,
        "germany_map_districts": dataPaths.germany_map_districts,
        "world_map": dataPaths.world_map,
        "usa_map": dataPaths.usa_map,
        "capitals": dataPaths.capitals
    }

    if params.mapName not in map_paths:
        return jsonify({"error": f"Map '{params.mapName}' not found!"}), 404

    try:
        data = load_TAR_GZ_JSON(map_paths[params.mapName])
        return jsonify(data)
    except Exception as e:
        print(f"Error reading map data for {params.mapName}:", e)
        return jsonify({"error": f"Error reading map data for {params.mapName}: {e}"}), 500


def load_TAR_GZ_JSON(path):
    """Decode the GeoJSON payload from a packaged ``.tgz`` map.

    Args:
        path: Archive path selected by the map asset registry.

    Returns:
        Parsed JSON content of the selected archive member.

    macOS metadata entries and directories are ignored. Both conventional
    ``.json`` and ``.geojson`` member names are supported.
    """
    with tarfile.open(path, "r:gz") as tar:
        members = [
            member
            for member in tar.getmembers()
            if member.isfile()
            and not Path(member.name).name.startswith("._")
            and member.name.lower().endswith((".json", ".geojson"))
        ]
        if not members:
            raise ValueError(f"No GeoJSON file found in {path}")

        file = tar.extractfile(members[0])
        if file is None:
            raise ValueError(f"Could not extract GeoJSON from {path}")
        data = json.loads(file.read().decode("utf-8"))

    return data

def _load_metadata_from_db(lang: str, relation_name: str = "") -> dict:
    """Query ``column_metadata_<lang>`` and return a dict keyed by ``column_name``.

    Args:
        lang: Two-letter metadata language code (``'en'`` or ``'de'``).
        relation_name: Optional relation filter; empty string loads all rows.

    Returns:
        Dictionary mapping each ``column_name`` to its metadata record.

    Example:
        ```python
        record = {
            "mean": {
                "valuename": "mean",
                "datatype": "float",
                "dimension": "probability",
                "description": "Habitat suitability",
                "availability": "1",
            }
        }
        ```
    """
    table = f"column_metadata_{lang}"
    data: dict[str, dict] = {}
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            if relation_name:
                query = psycopg_sql.SQL(
                    "SELECT column_name, datatype, dimension, description, availability "
                    "FROM {table} WHERE relation_name = %s ORDER BY id"
                ).format(table=psycopg_sql.Identifier(table))
                cur.execute(query, (relation_name,))
            else:
                query = psycopg_sql.SQL(
                    "SELECT column_name, datatype, dimension, description, availability "
                    "FROM {table} ORDER BY id"
                ).format(table=psycopg_sql.Identifier(table))
                cur.execute(query)
            for row in cur.fetchall():
                col_name, datatype, dimension, description, availability = row
                dim = dimension or ""
                is_suit = is_enso_suitability_column(col_name)
                if is_suit and not dim:
                    dim = "%"
                dt = datatype or ("float" if is_suit else "string")
                data[col_name] = {
                    "valuename": col_name,
                    "datatype": dt,
                    "dimension": dim,
                    "description": description or "",
                    "availability": str(availability) if availability is not None else "0",
                }
    return data


@swag_from('API_docs/get_datasets_metadata.yml')
@app.route("/api/get_datasets_metaData", methods=["GET"])
def getDatasetsMetadata():
    """Return localized column metadata, falling back from PostgreSQL to CSV.

    ``LANGID`` accepts ``en`` or ``de`` and defaults to ``en``. An optional
    ``relationName`` limits the database lookup. Invalid locales return 400;
    database errors trigger the maintained CSV fallback.
    """
    raw_lang: str = (request.args.get("LANGID") or "en").lower()
    raw_relation: str = request.args.get("relationName", "")

    try:
        params = DatasetsMetadataParams.model_validate({
            "LANGID": raw_lang,
            "relationName": raw_relation,
        })
    except ValidationError:
        return jsonify({"error": f"Invalid lang '{raw_lang}'. Use 'en' or 'de'."}), 400

    try:
        data = _load_metadata_from_db(params.LANGID, params.relationName)
        if not data:
            # Fallback to CSV if no DB rows found (graceful transition)
            data = loadMetadataCSV(params.LANGID)
    except Exception as e:
        print("Error reading metadata: get_datasets_metaData", e)
        # Fallback to CSV on DB error
        try:
            data = loadMetadataCSV(params.LANGID)
        except Exception as csv_err:
            data = {"error": f"Error reading metadata: {e} | CSV fallback also failed: {csv_err}"}
    return json.dumps(data)


@swag_from('API_docs/get_image.yml')
@app.route("/api/get_image", methods=["GET"])
def get_image():
    """Read an image from the configured image directory as JPEG bytes.

    The ``imagePath`` query field names the requested file. Missing files
    return HTTP 400 and read failures return HTTP 500.
    """
    try:
        params = GetImageParams.model_validate({"imagePath": request.args.get("imagePath")})
    except ValidationError:
        return jsonify({"error": "Invalid or missing image path"}), 400

    image_os_path = os.path.join(dataPaths.images, params.imagePath)
    print("image_path", image_os_path)
    if not os.path.exists(image_os_path):
        return jsonify({"error": "Invalid or missing image path"}), 400

    try:
        with open(image_os_path, "rb") as image_file:
            image_data = image_file.read()
        return image_data, 200, {"Content-Type": "image/jpeg"}
    except Exception as e:
        print("Error reading image file: load_image", e)
        return jsonify({"error": f"Error reading image file load_image: {e}"}), 500


@app.route("/api/get_cell_chart_data", methods=["GET"])
@swag_from('API_docs/get_cell_chart_data.yml')
def get_cell_chart_data():
    """Validate, cache, and return one cell's chart data as strict JSON."""
    try:
        params = CellChartDataParams.model_validate({
            "chart": request.args.get("chart"),
            "cellID": request.args.get("cellID"),
            "dataset": request.args.get(
                "dataset", "seas5_forecast_albopictus_habitat_probability"
            ),
            "locale": request.args.get("locale"),
        })
    except ValidationError as err:
        loc = err.errors()[0]["loc"][0] if err.errors() else "chart"
        return jsonify({"error": f"Invalid or missing {loc}"}), 400

    if params.chart == "enso":
        if params.dataset not in {
            "seas5_forecast_albopictus_habitat_probability",
            "seas5_forecast_aegypti_habitat_probability",
        }:
            return jsonify({"error": "Invalid dataset"}), 400
        locale = normalize_enso_locale(params.locale)
        cache_key = f"json:enso:v1:{locale}:{params.dataset}:{params.cellID}"
        scopes = (params.dataset,)
    else:
        dataset_template = "t_2024_monthly_mean_{month}_ocsvm_aegypti_predictions_2023_mod_sim"
        cache_key = f"json:uq:v1:{params.cellID}"
        scopes = tuple(dataset_template.format(month=m) for m in range(1, 13))
    try:
        data = response_cache.get(cache_key)
        if data is None:
            if params.chart == "enso":
                data = build_ENSO_suitability_data(
                    cell_id=params.cellID, dataset_template=params.dataset, locale=locale
                )
            else:
                data = build_uncertainty_chart_data(
                    row_id=params.cellID, dataset_template=dataset_template,
                    months_range=range(1, 13),
                )
            if data is not None:
                response_cache.set(
                    cache_key, data, scopes=scopes,
                    size_bytes=len(json.dumps(data, allow_nan=False)),
                )
    except Exception:
        app.logger.exception("Cell chart data generation failed")
        return jsonify({"error": "Cell chart data generation failed"}), 500
    if data is None:
        return jsonify({"error": f"No data found for cellID {params.cellID}"}), 404
    response = jsonify(data)
    response.headers["Cache-Control"] = "no-cache"
    return response


@app.route("/api/get_uncertainty_svg", methods=["GET"])
@swag_from('API_docs/get_uncertainty_svg.yml')
def get_uncertainty_svg():
    """Render an ENSO suitability or uncertainty SVG for one grid cell.

    ``cellID`` must be a nonnegative integer. ``filename`` selects the ENSO
    forecast plot (``climate_forecast_cell.svg``) or one of the seasonal
    uncertainty and calibration plots. ENSO requests also accept ``dataset``,
    ``month``, and ``locale``. Rendered bytes are cached by plot inputs and
    served as ``image/svg+xml`` without shared temporary files.

    Invalid cell IDs or filenames return HTTP 400, missing UQ data returns
    404, and rendering failures return 500. Successful responses use
    ``Cache-Control: no-cache``; the process cache may still serve the SVG.
    """
    uq_plot_types = {
        "seasonal_uncertainty_cell.svg": "uncertainty",
        "seasonal_calibration_cell.svg": "calibration",
    }
    raw_filename = request.args.get("filename", "")
    if raw_filename != "climate_forecast_cell.svg" and raw_filename not in uq_plot_types:
        return jsonify({"error": "Invalid or missing filename"}), 400

    try:
        params = UncertaintySvgParams.model_validate({
            "filename": raw_filename,
            "cellID": request.args.get("cellID"),
            "dataset": request.args.get(
                "dataset",
                "seas5_forecast_albopictus_habitat_probability",
            ),
            "month": request.args.get("month"),
            "locale": request.args.get("locale"),
        })
    except ValidationError as err:
        loc = err.errors()[0]["loc"][0] if err.errors() else "parameter"
        return jsonify({"error": f"Invalid or missing {loc}"}), 400

    try:
        if params.filename == "climate_forecast_cell.svg":
            dataset = params.dataset or "seas5_forecast_albopictus_habitat_probability"
            month = params.month
            locale = normalize_enso_locale(params.locale)
            normalized_month = month.lower() if month else "all"
            cache_key = f"svg:enso:v6:{locale}:{dataset}:{params.cellID}:{normalized_month}"
            svg_data = response_cache.get(cache_key)
            if svg_data is None:
                with SVG_RENDER_LOCK:
                    svg_data = response_cache.get(cache_key)
                    if svg_data is None:
                        svg_data = render_ENSO_suitability_svg(
                            cell_id=params.cellID,
                            dataset_template=dataset,
                            active_month=month,
                            locale=locale,
                        )
                        response_cache.set(
                            cache_key,
                            svg_data,
                            scopes=(dataset,),
                            size_bytes=len(svg_data),
                        )
        elif params.filename in uq_plot_types:
            plot_type = uq_plot_types[params.filename]
            dataset_template = "t_2024_monthly_mean_{month}_ocsvm_aegypti_predictions_2023_mod_sim"
            cache_key = f"svg:uq:v1:{params.cellID}:{plot_type}"
            svg_data = response_cache.get(cache_key)
            if svg_data is None:
                with SVG_RENDER_LOCK:
                    svg_data = response_cache.get(cache_key)
                    if svg_data is None:
                        rendered = render_uncertainty_svgs(
                            row_id=params.cellID,
                            dataset_template=dataset_template,
                            months_range=range(1, 13),
                        )
                        scopes = tuple(dataset_template.format(month=m) for m in range(1, 13))
                        for rendered_type, rendered_svg in rendered.items():
                            rendered_key = f"svg:uq:v1:{params.cellID}:{rendered_type}"
                            response_cache.set(
                                rendered_key,
                                rendered_svg,
                                scopes=scopes,
                                size_bytes=len(rendered_svg),
                            )
                        svg_data = rendered.get(plot_type)
            if svg_data is None:
                return jsonify({"error": f"No data found for cellID {params.cellID}"}), 404
        else:
            return jsonify({"error": "Invalid or missing filename"}), 400
    except Exception:
        app.logger.exception("SVG generation failed")
        return jsonify({"error": "SVG generation failed"}), 500

    response = Response(svg_data, mimetype="image/svg+xml")
    response.headers["Cache-Control"] = "no-cache"
    return response

@app.route('/health')
@swag_from('API_docs/health.yml')
def health():
    """Simple health check endpoint."""
    return {"status": "healthy"}, 200


# --- Cache management endpoints ---
@app.route("/api/cache/stats", methods=["GET"])
@swag_from('API_docs/cache_stats.yml')
def cache_stats():
    """Return current cache statistics (hits, misses, size, etc.)."""
    return jsonify(response_cache.stats())

@app.route("/api/cache/clear", methods=["POST"])
@swag_from('API_docs/cache_clear.yml')
def cache_clear():
    """Manually flush the entire response cache."""
    response_cache.clear()
    return jsonify({"success": True, "message": "Cache cleared"})
   


#print(app.url_map)
