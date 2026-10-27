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

from pathlib import Path
from typing import Optional
from flask import request, jsonify, Blueprint
from flasgger import swag_from
from pydantic import Field, ValidationError
from backend.schemas import BaseSchema, RelationName, LangCode
from backend.types import ColumnMetadataDict
from backend.cache import response_cache
from backend.routes.setFilesToDB.db_utils import (
    get_db_connection,
    get_db_connection_params,
    SQL_DATATYPES,
    db_error_response,
)
from backend.metadata_utils import loadMetadataCSV
from backend.routes.processData.enso_schema import (
    enso_column_metadata,
    is_enso_suitability_column,
)
import psycopg
from psycopg import sql

route_columnMetadata = Blueprint("columnMetadata", __name__)
BACKEND_DIR: Path = Path(__file__).parent.parent.parent
SWAGGER_YAML_PATH: Path = BACKEND_DIR / "API_docs"

VALID_LANGS = {"en", "de"}
_SQL_TO_METADATA_DATATYPE = {
    sql_type.lower(): datatype for datatype, sql_type in SQL_DATATYPES.items()
}


def _table_name(lang: str) -> str:
    """Return the localized metadata table identifier for ``lang`` (``'en'`` or ``'de'``)."""
    return f"column_metadata_{lang}"


def _alter_column_type(cur, relation_name: str, column_name: str, datatype: str):
    """Alter the physical PostgreSQL column type in ``relation_name`` when ``datatype`` changed.

    Uses ``ALTER TABLE ... ALTER COLUMN ... TYPE ... USING column::new_type`` so
    PostgreSQL casts existing values in place.

    Args:
        cur: Active database cursor within the caller's transaction.
        relation_name: Target data table name in schema ``public``.
        column_name: Target column name within ``relation_name``.
        datatype: Logical metadata datatype key (``'string'``, ``'float'``,
            ``'int'``, or ``'date'``) mapped via ``SQL_DATATYPES``.

    Raises:
        psycopg.Error: If the ``USING`` cast fails for existing row values
            (e.g. non-numeric strings cast to ``float4``), causing the caller's
            transaction context manager to roll back both the metadata upsert
            and the ``ALTER TABLE`` statement.
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
    """Create the localized ``column_metadata_<lang>`` table and relation index if absent.

    Args:
        cur: Active PostgreSQL cursor.
        lang: Two-letter language code (``'en'`` or ``'de'``).
    """
    table = _table_name(lang)
    cur.execute(sql.SQL("""
        CREATE TABLE IF NOT EXISTS {} (
            id SERIAL PRIMARY KEY,
            relation_name VARCHAR NOT NULL,
            column_name   VARCHAR NOT NULL,
            datatype      VARCHAR NOT NULL DEFAULT 'string',
            dimension     VARCHAR,
            description   VARCHAR,
            availability  INT DEFAULT 0,
            UNIQUE(relation_name, column_name)
        )
    """).format(sql.Identifier(table)))
    
    index_name = f"idx_{table}_relation"
    cur.execute(sql.SQL("""
        CREATE INDEX IF NOT EXISTS {}
        ON {} USING btree (relation_name)
    """).format(sql.Identifier(index_name), sql.Identifier(table)))



def ensure_metadata_tables():
    """Create column_metadata_en and column_metadata_de if they do not exist.

    Call this once at app startup so the tables are available without
    relying on an ORM migration or JavaScript client. Missing or invalid
    ``DATABASE_URL`` can raise before the connection attempt; connection and
    table-creation errors are logged without aborting startup.
    """
    conn_params = get_db_connection_params()
    try:
        # This runs while Gunicorn preloads the app in its master process. Use
        # one short-lived connection here so no pool threads exist before fork.
        with psycopg.connect(**conn_params) as conn:
            with conn.cursor() as cur:
                for lang in VALID_LANGS:
                    _ensure_table(cur, lang)
                conn.commit()
        print("Ensured column_metadata tables exist (en + de)")
    except Exception as e:
        print(f"WARNING: Could not ensure column_metadata tables: {e}")


def populate_column_metadata(
    relation_name: str,
    column_names: list[str],
    *,
    resolved_sql_types: dict[str, str] | None = None,
    replace_existing: bool = False,
):
    """Populate English and German column metadata rows for a dataset relation.

    Exact ENSO suitability columns use the rolling schema metadata from
    ``enso_column_metadata``. Other columns first look up the static language
    CSV (``loadMetadataCSV``) and fall back to the SQL type resolved during
    upload.

    Args:
        relation_name: Sanitized PostgreSQL relation name.
        column_names: Raw or sanitized column names to register.
        resolved_sql_types: Optional mapping from column name to PostgreSQL SQL
            type (e.g. ``'float4'``, ``'int4'``, ``'date'``, ``'varchar'``).
        replace_existing: When ``True``, deletes existing metadata rows for
            ``relation_name`` before inserting (used for full-snapshot uploads).
            Partial callers such as country assignment leave this ``False`` to
            preserve existing column metadata.
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

    resolved_types_by_column = {
        sanitize_names([name.strip()])[0]: sql_type
        for name, sql_type in (resolved_sql_types or {}).items()
    }

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                for lang in VALID_LANGS:
                    _ensure_table(cur, lang)
                    table = _table_name(lang)
                    if replace_existing:
                        # Full uploads replace the dataset snapshot, including
                        # metadata for columns no longer present in the file.
                        cur.execute(
                            sql.SQL(
                                "DELETE FROM {table} WHERE relation_name = %s"
                            ).format(table=sql.Identifier(table)),
                            (relation_name,),
                        )
                    for col_name in column_names:
                        sanitized_names = sanitize_names([col_name.strip()])
                        sanitized_col_name = sanitized_names[0]
                        match = csv_meta[lang].get(sanitized_col_name, {})
                        schema_metadata = enso_column_metadata(col_name, lang)

                        if schema_metadata:
                            datatype = str(schema_metadata["datatype"])
                            dimension = str(schema_metadata["dimension"])
                            description = str(schema_metadata["description"])
                            availability = int(schema_metadata["availability"])
                        elif match:
                            # A fitting metadata entry was found in the CSV
                            datatype = match.get("datatype", "string")
                            dimension = match.get("dimension", "")
                            description = match.get("description", "")
                            availability = int(match.get("availability", 0))
                        else:
                            sql_type = resolved_types_by_column.get(
                                sanitized_col_name, "varchar"
                            ).lower()
                            datatype = _SQL_TO_METADATA_DATATYPE.get(
                                sql_type, "string"
                            )
                            dimension = ""
                            description = ""
                            availability = 0

                        print(f"[populate_column_metadata] INSERT {lang}: relation='{relation_name}', col='{sanitized_col_name}', datatype='{datatype}', dimension='{dimension}'")
                        cur.execute(
                            sql.SQL("""
                            INSERT INTO {table}
                                (relation_name, column_name, datatype, dimension, description, availability)
                            VALUES (%s, %s, %s, %s, %s, %s)
                            ON CONFLICT (relation_name, column_name) DO UPDATE
                                SET datatype = EXCLUDED.datatype,
                                    dimension = EXCLUDED.dimension,
                                    description = EXCLUDED.description,
                                    availability = EXCLUDED.availability
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
#  Pydantic Request Schemas
# ────────────────────────────────────────────────
class ColumnMetadataQueryParams(BaseSchema):
    """Query parameters for fetching localized column metadata.

    Example:
        ```python
        params = ColumnMetadataQueryParams(relationName="observations", lang="en")
        ```
    """
    relationName: RelationName
    lang: LangCode = "en"


class ColumnMetadataUpsertPayload(BaseSchema):
    """Request payload for upserting metadata for a single column.

    Example:
        ```python
        payload = ColumnMetadataUpsertPayload(
            relationName="observations",
            columnName="temperature",
            lang="en",
            datatype="float",
            dimension="°C",
            description="Ambient temperature",
            availability=1,
        )
        ```
    """
    relationName: RelationName
    columnName: str = Field(min_length=1)
    """Target column name within the relation."""

    lang: LangCode = "en"
    datatype: str = "string"
    """Logical datatype key ('string', 'float', 'int', 'date')."""

    dimension: Optional[str] = ""
    """Physical unit or dimension string."""

    description: Optional[str] = ""
    """Human-readable description."""

    availability: int = 0
    """Availability flag (0 or 1)."""


class ColumnMetadataBulkItem(BaseSchema):
    """Single column metadata row in a bulk upsert request.

    Example:
        ```python
        item = ColumnMetadataBulkItem(
            columnName="temperature",
            datatype="float",
            dimension="°C",
            description="Ambient temperature",
            availability=1,
        )
        ```
    """
    columnName: str = Field(min_length=1)
    """Target column name within the relation."""

    datatype: str = "string"
    """Logical datatype key ('string', 'float', 'int', 'date')."""

    dimension: Optional[str] = ""
    """Physical unit or dimension string."""

    description: Optional[str] = ""
    """Human-readable description."""

    availability: int = 0
    """Availability flag (0 or 1)."""


class ColumnMetadataBulkUpsertPayload(BaseSchema):
    """Request payload for replacing all column metadata rows for a relation.

    Example:
        ```python
        payload = ColumnMetadataBulkUpsertPayload(
            relationName="observations",
            lang="en",
            columns=[
                ColumnMetadataBulkItem(columnName="temperature", datatype="float")
            ],
        )
        ```
    """
    relationName: RelationName
    lang: LangCode = "en"
    columns: list[ColumnMetadataBulkItem] = Field(
        default_factory=list, description="List of column metadata items."
    )


# ────────────────────────────────────────────────
#  GET  – list metadata for a relation
# ────────────────────────────────────────────────
@route_columnMetadata.route("", methods=["GET"])
@swag_from(f"{SWAGGER_YAML_PATH}/get_column_metadata.yml")
def get_column_metadata():
    """Return all column metadata rows for a given relation and language.

    Query Parameters:
        relationName (str): Required database relation name.
        lang (str): Metadata language code (``'en'`` or ``'de'``, default ``'en'``).

    Returns:
        Flask JSON response containing a list of metadata row dicts
        (``id``, ``relation_name``, ``column_name``, ``datatype``, ``dimension``,
        ``description``, ``availability``), or an ``{"error": ...}`` payload with
        HTTP 400 (invalid parameters) or HTTP 500 (database error).
    """
    raw_lang = request.args.get("lang", "en").lower()
    raw_relation_name = request.args.get("relationName", "")
    if raw_lang not in VALID_LANGS:
        return jsonify({"error": f"Invalid lang '{raw_lang}'. Use 'en' or 'de'."}), 400
    if not raw_relation_name:
        return jsonify({"error": "Missing required query param 'relationName'."}), 400

    try:
        query_params = ColumnMetadataQueryParams.model_validate({
            "relationName": raw_relation_name,
            "lang": raw_lang,
        })
    except ValidationError as err:
        return jsonify({"error": str(err.errors()[0]["msg"] if err.errors() else err)}), 400

    table = _table_name(query_params.lang)
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                sql_query = sql.SQL("""
                    SELECT id, relation_name, column_name, datatype, dimension, description, availability
                    FROM {table}
                    WHERE relation_name = %s
                    ORDER BY id
                """).format(table=sql.Identifier(table))
                cur.execute(sql_query, (query_params.relationName,))
                cols = [d[0] for d in cur.description] if cur.description else []
                rows = []
                for r in cur.fetchall():
                    row_dict = dict(zip(cols, r))
                    column_name = str(row_dict.get("column_name", ""))
                    if is_enso_suitability_column(column_name) and not row_dict.get("dimension"):
                        row_dict["dimension"] = "%"
                    rows.append(row_dict)
        return jsonify(rows)
    except Exception as e:
        return db_error_response(e)


# ────────────────────────────────────────────────
#  POST – upsert a single metadata row
# ────────────────────────────────────────────────
@route_columnMetadata.route("", methods=["POST"])
@swag_from(f"{SWAGGER_YAML_PATH}/upsert_column_metadata.yml")
def upsert_column_metadata():
    """Upsert a single column metadata row and align the underlying SQL column type.

    Expects a JSON body with ``relationName``, ``columnName``, and optional
    ``lang`` (``'en'`` or ``'de'``), ``datatype``, ``dimension``,
    ``description``, and ``availability``. Also executes ``_alter_column_type``
    within the same transaction and invalidates cached responses for the
    relation and global metadata endpoint.

    Returns:
        Flask JSON response ``{"success": True, "id": <row_id>}`` on HTTP 200,
        or ``{"error": ...}`` with HTTP 400 / 500 on validation or cast failure.
    """
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"error": "JSON body required."}), 400

    raw_lang = body.get("lang", "en")
    if isinstance(raw_lang, str) and raw_lang.lower() not in VALID_LANGS:
        return jsonify({"error": f"Invalid lang '{raw_lang}'."}), 400

    if not body.get("relationName") or not body.get("columnName"):
        return jsonify({"error": "relationName and columnName are required."}), 400

    try:
        payload = ColumnMetadataUpsertPayload.model_validate(body)
    except ValidationError as err:
        return jsonify({"error": str(err.errors()[0]["msg"] if err.errors() else err)}), 400

    table = _table_name(payload.lang)
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                _ensure_table(cur, payload.lang)
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
                    (
                        payload.relationName,
                        payload.columnName,
                        payload.datatype,
                        payload.dimension or "",
                        payload.description or "",
                        payload.availability,
                    ),
                )
                result = cur.fetchone()
                row_id = result[0] if result else None
                # Also update the actual data table column type
                _alter_column_type(cur, payload.relationName, payload.columnName, payload.datatype)
                conn.commit()
        response_cache.invalidate(payload.relationName)
        response_cache.invalidate("__all_relations__")
        return jsonify({"success": True, "id": row_id})
    except Exception as e:
        return db_error_response(e)


# ────────────────────────────────────────────────
#  PUT – bulk-upsert all rows for a relation
# ────────────────────────────────────────────────
@route_columnMetadata.route("", methods=["PUT"])
@swag_from(f"{SWAGGER_YAML_PATH}/bulk_upsert_column_metadata.yml")
def bulk_upsert_column_metadata():
    """Replace all metadata rows for a relation and language in a single transaction.

    Expects a JSON body containing ``relationName``, optional ``lang``
    (``'en'`` or ``'de'``), and a ``columns`` list of column metadata dicts.
    Deletes existing rows for ``relation_name`` in ``column_metadata_<lang>``,
    inserts the replacement rows, alters changed SQL column types in the
    underlying data table, and invalidates cached responses for the relation.

    Returns:
        Flask JSON response ``{"success": True, "count": <len(columns)>}`` on
        HTTP 200, or ``{"error": ...}`` with HTTP 400 / 500 on failure.
    """
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"error": "JSON body required."}), 400

    raw_lang = body.get("lang", "en")
    if isinstance(raw_lang, str) and raw_lang.lower() not in VALID_LANGS:
        return jsonify({"error": f"Invalid lang '{raw_lang}'."}), 400

    if not body.get("relationName"):
        return jsonify({"error": "relationName is required."}), 400
    if not isinstance(body.get("columns"), list):
        return jsonify({"error": "'columns' must be an array."}), 400

    try:
        payload = ColumnMetadataBulkUpsertPayload.model_validate(body)
    except ValidationError as err:
        return jsonify({"error": str(err.errors()[0]["msg"] if err.errors() else err)}), 400

    table = _table_name(payload.lang)
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                _ensure_table(cur, payload.lang)
                # Delete existing rows for this relation so the PUT is a full replacement
                cur.execute(
                    sql.SQL("DELETE FROM {table} WHERE relation_name = %s").format(table=sql.Identifier(table)),
                    (payload.relationName,),
                )
                for col in payload.columns:
                    cur.execute(
                        sql.SQL("""
                        INSERT INTO {table} (relation_name, column_name, datatype, dimension, description, availability)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        """).format(table=sql.Identifier(table)),
                        (
                            payload.relationName,
                            col.columnName,
                            col.datatype,
                            col.dimension or "",
                            col.description or "",
                            col.availability,
                        ),
                    )
                    # Also update the actual data table column type
                    _alter_column_type(cur, payload.relationName, col.columnName, col.datatype)
                conn.commit()
        response_cache.invalidate(payload.relationName)
        response_cache.invalidate("__all_relations__")
        return jsonify({"success": True, "count": len(payload.columns)})
    except Exception as e:
        return db_error_response(e)
