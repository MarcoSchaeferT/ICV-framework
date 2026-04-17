from flask import Flask, Response
from flask import request
from flask import jsonify
import time
import json
from backend.routes.setFilesToDB.db_utils import query_raw, execute_raw, get_db_connection_params
import psycopg
from psycopg import sql as psycopg_sql
import requests
import lzma
import os
import tarfile
import csv
csv.field_size_limit(100000000)
from pathlib import Path
from typing import Optional
from flasgger import Swagger, swag_from




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
from backend.routes.processData.uncertaintyVis import create_uncertainty_visualizations
from backend.routes.processData.route_processData import route_processData
import json


app = Flask(__name__)
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

# global variables
global progressVal
global metadata
global fileUploadErrors
# used by uploadFileToDB.py to set the progress value
progressVal = [1]
# used by uploadFileToDB.py -> createTable() -> loadMetadata() stores part of the metadata (valuename, datatype)
metadata = {}
fileUploadErrors: dict[str,str] = {"ERROR": "false"}
class DataPaths:
    germany_map: Path
    world_map: Path
    capitals: Path
    mos_data: Path
    data_sets: Path
    data_sets_save_location: Path
    images: Path
    meta_data: Path
    usa_map: Path
    usa_map: Path

    def __init__(self):
        self.germany_map = Path(__file__).parent / "assets" / "germany_midRes.geo.json.tgz"
        self.world_map = Path(__file__).parent / "assets" / "worldmap_lowRes.geo.json.tgz"
        self.capitals = Path(__file__).parent / "assets" / "capitals.geo.json.tgz"
        self.mos_data = Path(__file__).parent / "assets" / "aedes_aegypti_svm_output_2015.csv"
        self.data_sets_save_location = Path(__file__).parent / "assets" / "uploads_tmp"
        self.data_sets = self.data_sets_save_location
        self.images = Path(__file__).parent / "assets" / "images"
        self.meta_data: Path = Path(__file__).parent.parent / "messages" / "metaData.csv"
        self.usa_map = Path(__file__).parent / "assets" / "USA_map.geo.json.tgz"

dataPaths: DataPaths = DataPaths()
metadata_utils.init(dataPaths.meta_data)


dummyDBdata = [
    {
        "email": "alice@prisdma.io",
        "name": "Alice",
        "password": "password",
    },
    {
        "email": "tom@john.web.de",
        "name": "Tom",
        "password": "Jon4756",
    },
    {
        "email": "john@example.com",
        "name": "John",
        "password": "pass123",
    },
    {
        "email": "jane@example.com",
        "name": "Jane",
        "password": "secret",
    },
    {
        "email": "alex@example.com",
        "name": "Alex",
        "password": "qwerty",
    },
]

database_url = os.getenv("DATABASE_URL")
db_pw = os.getenv("DB_PASSWORD_SECRET")
print("DATABASE_URL", database_url)
print("POSTGRES_PASSWORD", db_pw)

# register the blueprint
app.register_blueprint(route_setFilesToDB, url_prefix='/api/setFilesToDB')
app.register_blueprint(route_getListOfRelationsDB, url_prefix='/api/getListOfRelationsDB')
app.register_blueprint(route_getColumnNamesDB, url_prefix='/api/getColumnNamesDB')
app.register_blueprint(route_getDataFromDB, url_prefix='/api/getDataFromDB')
app.register_blueprint(route_setEntryToTable, url_prefix='/api/setEntryToTable')
app.register_blueprint(route_columnMetadata, url_prefix='/api/columnMetadata')
app.register_blueprint(route_manageDB, url_prefix='/api/manageDB')
app.register_blueprint(route_processData, url_prefix='/api/processData')

# Create column_metadata_en/de tables if they don't exist (no Prisma needed)
ensure_metadata_tables()



@app.route("/api/python")
def hello_world():
    return "<p>Hello, World!</p><br> <p>back to homepage: <a  class='text-blue-600' href='http://localhost:3000/'>http://localhost:3000/</a></p>"

@app.route("/api/test", methods=["GET"])
def test():
    if request.method == "GET":
        print("hello")
        #time.sleep(2)
        print(str(json.dumps(testData)))
        return json.dumps(testData)
    
@swag_from('API_docs/get_upload_progress.yml')
@app.route("/api/getUploadProgress", methods=["GET", "POST"])
async def getUploadProgress():
    return jsonify({"progress": progressVal[0]})

@swag_from('API_docs/set_upload_progress.yml')
@app.route("/api/setUploadProgress", methods=["GET"])
async def setUploadProgress():
    if request.method == "GET":
        progressVal[0] = request.args.get("progressVal", type=int, default=progressVal)
        return jsonify({"progress": progressVal[0]})

@swag_from('API_docs/get_upload_error.yml')
@app.route("/api/getUploadError", methods=["GET", "POST"])
async def getUploadError() -> Response:
    global fileUploadErrors
    if request.method == "GET":
        fileUploadErrors["ERROR"] = "false"
    if "ERROR" in fileUploadErrors:
        return jsonify(fileUploadErrors)
    return jsonify({"ERROR": "false"})


# test route to database 
@app.route("/api/db", methods=["GET", "POST"])
async def db():
    async def main() -> None:
        print("Testing DB connection:")
        print("DATABASE_URL:", database_url)
        
        # Check if User table exists
        try:
            users_query = await query_raw("SELECT * FROM \"User\"")
        except Exception as e:
            # Table might not exist, create it
            await execute_raw("""
                CREATE TABLE IF NOT EXISTS "User" (
                    id SERIAL PRIMARY KEY,
                    email VARCHAR UNIQUE,
                    name VARCHAR,
                    password VARCHAR
                )
            """)
            users_query = []
        
        print("db" + str(users_query))
        for element in dummyDBdata:
            # Check if user exists
            found = await query_raw(f"SELECT * FROM \"User\" WHERE email = '{element['email']}'")
            if found and len(found) > 0:
                print("Email already exists: {}".format(element["email"]))
                continue
            else:
                await execute_raw(f"""
                    INSERT INTO "User" (email, name, password) 
                    VALUES ('{element["email"]}', '{element["name"]}', '{element["password"]}')
                """)
        
        # Get updated users list
        users_query = await query_raw("SELECT * FROM \"User\"")
        return jsonify(users_query)

    return await main()


@swag_from('API_docs/get_compressed_json.yml')
@app.route("/api/get_compressed_json", methods=["GET"])
async def get_compressed_json():
    url = ""
    data = []
    if request.method == "GET":
        url = request.args["url"]
        print("url", url)
    if url == "":
        return "ERROR: No URL provided!"
    try:
        response = requests.get(str(url))
        # Decompress the response content
        decompressed_data = lzma.decompress(response.content)

        # Decode the decompressed data as JSON
        json_data = decompressed_data.decode("utf-8")

        # Parse the JSON data
        data = json.loads(json_data)

        # print("data",data)
    except Exception as e:
        print("ERROR reading data: get_compressed_json", e)
        data = {"ERROR": "ERROR reading JSON file: get_compressed_json" + str(e)}

    return data


@swag_from('API_docs/get_germany_map.yml')
@app.route("/api/get_germany_map", methods=["GET"])
def getGermanyMap():
    try:
        data = load_TAR_GZ_JSON(dataPaths.germany_map)
    except Exception as e:
        print("ERROR reading data: get_germany_map", e)
        data = {"ERROR": "ERROR reading data: get_germany_map" + str(e)}

    return jsonify(data)

@swag_from('API_docs/get_usa_map.yml')
@app.route("/api/get_usa_map", methods=["GET"])
def getUSAdMap():
    data = []
    try:
        data = load_TAR_GZ_JSON(dataPaths.usa_map)
    except Exception as e:
        print("ERROR reading data: get_usa_map", e)
        data = {"ERROR": "ERROR reading CSV file: get_usa_map" + str(e)}

    return jsonify(data)

@swag_from('API_docs/get_world_map.yml')
@app.route("/api/get_world_map", methods=["GET"])
def getWorldMap():
    data = []
    try:
        data = load_TAR_GZ_JSON(dataPaths.world_map)
    except Exception as e:
        print("ERROR reading data: get_world_map", e)
        data = {"ERROR": "ERROR reading CSV file: get_world_map" + str(e)}

    return jsonify(data)

@swag_from('API_docs/get_capitals.yml')
@app.route("/api/get_capitals", methods=["GET"])
def getCapitals():
    data = []
    try:
        data = load_TAR_GZ_JSON(dataPaths.capitals)
    except Exception as e:
        print("ERROR reading data: get_capitals", e)
        data = {"ERROR": "ERROR reading CSV file: get_capitals" + str(e)}

    return jsonify(data)


def load_TAR_GZ_JSON(path):
    try:
        # Open the tar.gz file
        with tarfile.open(path, "r:gz") as tar:
            # Get the 2. member (since the first one is binary meta dadta from mac os causing decoding errors...)
            member = tar.getmembers()[1]
            file = tar.extractfile(member)
            content = file.read()
            json_data = content.decode("utf-8")
    except Exception as e:
        raise e
    # Parse the JSON data
    data = json.loads(json_data)
    return data

@swag_from('API_docs/get_list_of_datasets.yml')
@app.route("/api/get_list_of_datasets", methods=["GET"])
def getListOfDatasets():
    data = {}
    try:
        for filename in os.listdir(dataPaths.data_sets):
            if filename.endswith(".csv"):
                key = os.path.splitext(filename)[0]
                data[key] = os.path.join(dataPaths.data_sets, filename)
    except Exception as e:
        print("ERROR reading directory: get_list_of_datasets", e)
        data = {"ERROR": "ERROR reading directory: get_list_of_datasets" + str(e)}
    json_data = json.dumps(data)
    return json_data

def _load_metadata_from_db(lang: str, relation_name: str = "") -> dict:
    """Query column_metadata_{lang} and return a dict keyed by column_name.
        {
          "<column_name>": {
              "valuename": "...",
              "datatype":  "...",
              "dimension": "...",
              "description": "...",
              "availability": "..."
          },
          ...
        }
    """
    table = f"column_metadata_{lang}"
    conn_params = get_db_connection_params()
    data: dict[str, dict] = {}
    with psycopg.connect(**conn_params) as conn:
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
                data[col_name] = {
                    "valuename": col_name,
                    "datatype": datatype or "string",
                    "dimension": dimension or "",
                    "description": description or "",
                    "availability": str(availability) if availability is not None else "0",
                }
    return data


@swag_from('API_docs/get_datasets_metadata.yml')
@app.route("/api/get_datasets_metaData", methods=["GET"])
def getDatasetsMetadata():
    LANGID: str = request.args.get("LANGID", "en").lower()
    relation_name: str = request.args.get("relationName", "")
    if LANGID not in ("en", "de"):
        return jsonify({"ERROR": f"Invalid lang '{LANGID}'. Use 'en' or 'de'."}), 400
    try:
        data = _load_metadata_from_db(LANGID, relation_name)
        if not data:
            # Fallback to CSV if no DB rows found (graceful transition)
            data = loadMetadataCSV(LANGID)
    except Exception as e:
        print("ERROR reading metadata: get_datasets_metaData", e)
        # Fallback to CSV on DB error
        try:
            data = loadMetadataCSV(LANGID)
        except Exception as csv_err:
            data = {"ERROR": "ERROR reading metadata: " + str(e) + " | CSV fallback also failed: " + str(csv_err)}
    return json.dumps(data)


@swag_from('API_docs/get_image.yml')
@app.route("/api/get_image", methods=["GET"])
def get_image():
    image_os_path = ""
    if request.method == "GET":
        image_path = request.args["imagePath"]
        image_os_path = os.path.join(dataPaths.images, image_path)
        print("image_path", image_os_path)
    if not image_os_path or not os.path.exists(image_os_path):
        return jsonify({"ERROR": "Invalid or missing image path"}), 400

    try:
        with open(image_os_path, "rb") as image_file:
            image_data = image_file.read()
        return image_data, 200, {"Content-Type": "image/jpeg"}
    except Exception as e:
        print("ERROR reading image file: load_image", e)
        return jsonify({"ERROR": "ERROR reading image file: load_image" + str(e)}), 500


@app.route("/api/get_uncertainty_svg", methods=["GET"])
def get_uncertainty_svg():
    """Serve an SVG file from the uncertainty visualization output directory."""

    filename = ""
    cellID = -1
    if request.method == "GET":
        filename = request.args["filename"]
        cellID = int(request.args["cellID"])
        filename = str(cellID) + "_" + filename
    if not filename or not filename.endswith(".svg"):
        return jsonify({"ERROR": "Invalid or missing filename"}), 400

    svg_dir = Path(__file__).parent / "routes" / "processData" / "results_svg"
    svg_path = svg_dir / filename


    # Prevent path traversal
    if not svg_path.resolve().is_relative_to(svg_dir.resolve()):
        return jsonify({"ERROR": "Invalid path"}), 400

    if not svg_path.exists():
        # Derive which plot to generate from the requested filename
        original_filename = request.args["filename"]
        if "calibration" in original_filename:
            plot_type = "calibration"
        elif "uncertainty" in original_filename:
            plot_type = "uncertainty"
        else:
            plot_type = "both"

        create_uncertainty_visualizations(
            out_dir=None,
            grid_start=cellID,
            grid_end=cellID,
            dataset_template="t_2024_monthly_mean_{month}_ocsvm_aegypti_predictions_2023_mod_sim",
            months_range=range(1, 13),
            plot_type=plot_type,
        )
        # wait until the file is created (max 10 seconds)
        start_time = time.time()
        while not svg_path.exists() and time.time() - start_time < 10:
            time.sleep(1)
        if not svg_path.exists():
            return jsonify({"ERROR": f"File not found: {filename}"}), 404

    try:
        with open(svg_path, "rb") as f:
            svg_data = f.read()
        return svg_data, 200, {"Content-Type": "image/svg+xml"}
    except Exception as e:
        return jsonify({"ERROR": str(e)}), 500

@app.route('/health')
def health():
    """Simple health check endpoint."""
    return {"status": "healthy"}, 200

   


#print(app.url_map)