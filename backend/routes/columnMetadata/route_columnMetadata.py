"""
Routes for managing per-relation column metadata (English & German).

Tables:
  column_metadata_en  – English metadata rows
  column_metadata_de  – German  metadata rows

Endpoints:
  GET  /api/columnMetadata?relationName=<name>&lang=<en|de>
       → returns all metadata rows for that relation + language

  POST /api/columnMetadata   (JSON body)
       → upserts one metadata row (insert or update on conflict)

  PUT  /api/columnMetadata   (JSON body, list)
       → bulk-upserts a full set of rows for a relation + language
"""

from flask import request, jsonify, Blueprint
from backend.routes.setFilesToDB.db_utils import get_db_connection_params, SQL_DATATYPES
from backend.metadata_utils import loadMetadataCSV
import psycopg
from psycopg import sql

route_columnMetadata = Blueprint("columnMetadata", __name__)

VALID_LANGS = {"en", "de"}


def _table_name(lang: str) -> str:
    """Return the metadata table name for the given language."""
    return f"column_metadata_{lang}"


def _alter_column_type(cur, relation_name: str, column_name: str, datatype: str):
    """ALTER the column type in the actual data table if the datatype changed.

    Uses ``USING column::new_type`` so PostgreSQL can cast existing values.
    If the cast fails (e.g. non-numeric strings → float4) the caller's
    transaction will be rolled back by the context manager.
    """
    sql_type = SQL_DATATYPES.get(datatype)
    if sql_type is None:
        return  # unknown datatype – nothing to alter

    # Check whether the data table and column actually exist
    cur.execute(
        """SELECT data_type FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name   = %s
             AND column_name  = %s""",
        (relation_name, column_name),
    )
    row = cur.fetchone()
    if row is None:
        return  # table or column does not exist – skip

    current_type = row[0]  # e.g. "character varying", "double precision", …
    # Map current PG type names to our short names for comparison
    pg_type_map = {
        "character varying": "varchar",
        "double precision": "float4",
        "real": "float4",
        "integer": "int4",
        "date": "date",
    }
    normalised = pg_type_map.get(current_type, current_type)
    if normalised == sql_type:
        return  # already the correct type

    alter_query = sql.SQL(
        "ALTER TABLE {table} ALTER COLUMN {col} TYPE {new_type} USING {col}::{new_type}"
    ).format(
        table=sql.Identifier(relation_name),
        col=sql.Identifier(column_name),
        new_type=sql.SQL(sql_type),  # type: ignore
    )
    cur.execute(alter_query)


def _ensure_table(cur, lang: str):
    """Create the metadata table if it does not exist yet."""
    table = _table_name(lang)
    cur.execute(f"""
        CREATE TABLE IF NOT EXISTS "{table}" (
            id SERIAL PRIMARY KEY,
            relation_name VARCHAR NOT NULL,
            column_name   VARCHAR NOT NULL,
            datatype      VARCHAR NOT NULL DEFAULT 'string',
            dimension     VARCHAR,
            description   VARCHAR,
            availability  INT DEFAULT 0,
            UNIQUE(relation_name, column_name)
        )
    """)
    cur.execute(f"""
        CREATE INDEX IF NOT EXISTS "idx_{table}_relation"
        ON "{table}" USING btree (relation_name)
    """)


def ensure_metadata_tables():
    """Create column_metadata_en and column_metadata_de if they do not exist.

    Call this once at app startup so the tables are available without
    relying on Prisma migrations or a JS client.
    """
    conn_params = get_db_connection_params()
    try:
        with psycopg.connect(**conn_params) as conn:
            with conn.cursor() as cur:
                for lang in VALID_LANGS:
                    _ensure_table(cur, lang)
                conn.commit()
        print("Ensured column_metadata tables exist (en + de)")
    except Exception as e:
        print(f"WARNING: Could not ensure column_metadata tables: {e}")


def populate_column_metadata(relation_name: str, column_names: list[str]):
    """Auto-populate column_metadata_en and column_metadata_de for a new dataset.

    For each column, look up a matching entry in the CSV metadata files
    (en_metaData.csv / de_metaData.csv).  If a match is found the CSV values
    (datatype, dimension, description, availability) are used; otherwise the
    column is inserted with datatype='string' and empty description/dimension.
    """
    print(f"[populate_column_metadata] Starting for relation='{relation_name}', columns={column_names}")

    # Load CSV metadata for both languages
    csv_meta = {}
    from backend.routes.setFilesToDB.parseCSVdata import sanitize_names
    for lang in VALID_LANGS:
        csv_data = loadMetadataCSV(lang)
        # Build a sanitized-keyed lookup for matching
        csv_meta[lang] = {sanitize_names([k.strip()])[0]: v for k, v in csv_data.items()}
        print(f"[populate_column_metadata] CSV meta for '{lang}': {len(csv_meta[lang])} entries")

    conn_params = get_db_connection_params()
    try:
        with psycopg.connect(**conn_params) as conn:
            with conn.cursor() as cur:
                for lang in VALID_LANGS:
                    _ensure_table(cur, lang)
                    table = _table_name(lang)
                    for col_name in column_names:
                        sanitized_names = sanitize_names([col_name.strip()])
                        sanitized_col_name = sanitized_names[0]
                        match = csv_meta[lang].get(sanitized_col_name, {})

                        datatype = match.get("datatype", "string")
                        dimension = match.get("dimension", "")
                        description = match.get("description", "")
                        availability = int(match.get("availability", 0))

                        print(f"[populate_column_metadata] INSERT {lang}: relation='{relation_name}', col='{sanitized_col_name}', datatype='{datatype}'")
                        cur.execute(
                            sql.SQL("""
                            INSERT INTO {table}
                                (relation_name, column_name, datatype, dimension, description, availability)
                            VALUES (%s, %s, %s, %s, %s, %s)
                            ON CONFLICT (relation_name, column_name) DO NOTHING
                            """).format(table=sql.Identifier(table)),
                            (relation_name, sanitized_col_name, datatype, dimension, description, availability),
                        )
                conn.commit()
        print(f"[populate_column_metadata] SUCCESS for '{relation_name}' ({len(column_names)} columns)")
    except Exception as e:
        import traceback
        print(f"[populate_column_metadata] FAILED for '{relation_name}': {e}")
        traceback.print_exc()


# ────────────────────────────────────────────────
#  GET  – list metadata for a relation
# ────────────────────────────────────────────────
@route_columnMetadata.route("", methods=["GET"])
def get_column_metadata():
    """Return all metadata rows for a given relation and language."""
    relation_name = request.args.get("relationName", "")
    lang = request.args.get("lang", "en").lower()
    if lang not in VALID_LANGS:
        return jsonify({"error": f"Invalid lang '{lang}'. Use 'en' or 'de'."}), 400
    if not relation_name:
        return jsonify({"error": "Missing required query param 'relationName'."}), 400

    table = _table_name(lang)
    conn_params = get_db_connection_params()
    try:
        with psycopg.connect(**conn_params) as conn:
            with conn.cursor() as cur:
                _ensure_table(cur, lang)
                conn.commit()
                sql_query = sql.SQL("""
                    SELECT id, relation_name, column_name, datatype, dimension, description, availability
                    FROM {table}
                    WHERE relation_name = %s
                    ORDER BY id
                """).format(table=sql.Identifier(table))
                cur.execute(sql_query, (relation_name,))
                cols = [d[0] for d in cur.description] if cur.description else []
                rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ────────────────────────────────────────────────
#  POST – upsert a single metadata row
# ────────────────────────────────────────────────
@route_columnMetadata.route("", methods=["POST"])
def upsert_column_metadata():
    """Upsert a single metadata row (insert or update on conflict)."""
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "JSON body required."}), 400

    lang = body.get("lang", "en").lower()
    if lang not in VALID_LANGS:
        return jsonify({"error": f"Invalid lang '{lang}'."}), 400

    relation_name = body.get("relationName", "")
    column_name = body.get("columnName", "")
    if not relation_name or not column_name:
        return jsonify({"error": "relationName and columnName are required."}), 400

    datatype = body.get("datatype", "string")
    dimension = body.get("dimension", "")
    description = body.get("description", "")
    availability = int(body.get("availability", 0))

    table = _table_name(lang)
    conn_params = get_db_connection_params()
    try:
        with psycopg.connect(**conn_params) as conn:
            with conn.cursor() as cur:
                _ensure_table(cur, lang)
                cur.execute(
                    sql.SQL("""
                    INSERT INTO {table} (relation_name, column_name, datatype, dimension, description, availability)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (relation_name, column_name)
                    DO UPDATE SET datatype = EXCLUDED.datatype,
                                  dimension = EXCLUDED.dimension,
                                  description = EXCLUDED.description,
                                  availability = EXCLUDED.availability
                    RETURNING id
                    """).format(table=sql.Identifier(table)),
                    (relation_name, column_name, datatype, dimension, description, availability),
                )
                result = cur.fetchone()
                row_id = result[0] if result else None
                # Also update the actual data table column type
                _alter_column_type(cur, relation_name, column_name, datatype)
                conn.commit()
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ────────────────────────────────────────────────
#  PUT – bulk-upsert all rows for a relation
# ────────────────────────────────────────────────
@route_columnMetadata.route("", methods=["PUT"])
def bulk_upsert_column_metadata():
    """Bulk-upsert a full set of metadata rows for a relation and language."""
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "JSON body required."}), 400

    lang = body.get("lang", "en").lower()
    if lang not in VALID_LANGS:
        return jsonify({"error": f"Invalid lang '{lang}'."}), 400

    relation_name = body.get("relationName", "")
    columns = body.get("columns", [])
    if not relation_name:
        return jsonify({"error": "relationName is required."}), 400
    if not isinstance(columns, list):
        return jsonify({"error": "'columns' must be an array."}), 400

    table = _table_name(lang)
    conn_params = get_db_connection_params()
    try:
        with psycopg.connect(**conn_params) as conn:
            with conn.cursor() as cur:
                _ensure_table(cur, lang)
                # Delete existing rows for this relation so the PUT is a full replacement
                cur.execute(
                    sql.SQL("DELETE FROM {table} WHERE relation_name = %s").format(table=sql.Identifier(table)),
                    (relation_name,),
                )
                for col in columns:
                    column_name = col.get("columnName", "")
                    if not column_name:
                        continue
                    cur.execute(
                        sql.SQL("""
                        INSERT INTO {table} (relation_name, column_name, datatype, dimension, description, availability)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        """).format(table=sql.Identifier(table)),
                        (
                            relation_name,
                            column_name,
                            col.get("datatype", "string"),
                            col.get("dimension", ""),
                            col.get("description", ""),
                            int(col.get("availability", 0)),
                        ),
                    )
                    # Also update the actual data table column type
                    _alter_column_type(cur, relation_name, column_name, col.get("datatype", "string"))
                conn.commit()
        return jsonify({"success": True, "count": len(columns)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
