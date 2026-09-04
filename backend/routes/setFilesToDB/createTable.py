from pathlib import Path
import csv
import io
import re
import psycopg
csv.field_size_limit(100000000)
from typing import List, Dict, Optional
import os
# custom modules
from backend.routes.setFilesToDB.parseCSVdata import ParsedData, stream_csv_rows
from backend.routes.setFilesToDB.db_utils import get_db_connection_params, SQL_DATATYPES
from backend.routes.processData.enso_schema import is_enso_numeric_column


# ---------------------------------------------------------------------------
# Data-type inference for columns missing from metadata
# ---------------------------------------------------------------------------

# Date patterns (ISO 8601 and common variants)
_DATE_PATTERNS: list[re.Pattern] = [
    re.compile(r"^\d{4}-\d{2}-\d{2}$"),                    # 2024-01-15
    re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}"),         # 2024-01-15T10:30...
    re.compile(r"^\d{2}/\d{2}/\d{4}$"),                     # 01/15/2024 or 15/01/2024
    re.compile(r"^\d{2}\.\d{2}\.\d{4}$"),                   # 15.01.2024
    re.compile(r"^\d{4}/\d{2}/\d{2}$"),                     # 2024/01/15
]


def _looks_like_date(value: str) -> bool:
    """Return True if *value* matches a common date format."""
    return any(p.match(value) for p in _DATE_PATTERNS)


def _classify_value(value: str) -> str:
    """Classify a single non-empty string value as int, float, date, or string."""
    stripped = value.strip()
    if not stripped:
        return "empty"

    # --- Integer ---
    try:
        int(stripped)
        return "int"
    except ValueError:
        pass

    # --- Float ---
    try:
        float(stripped)
        return "float"
    except ValueError:
        pass

    # --- Date ---
    if _looks_like_date(stripped):
        return "date"

    return "string"


def _resolve_type(counts: dict[str, int]) -> str:
    """Given per-type vote counts for a column, decide on the dominant type.

    Rules (applied in order):
    1. If *every* non-empty value is an integer → ``int``
    2. If *every* non-empty value is numeric (int or float) → ``float``
       (ints are promotable to floats)
    3. If ≥ 80 % of non-empty values look like dates → ``date``
    4. Otherwise → ``string``
    """
    total = sum(v for k, v in counts.items() if k != "empty")
    if total == 0:
        return "string"

    n_int = counts.get("int", 0)
    n_float = counts.get("float", 0)
    n_date = counts.get("date", 0)

    if n_int == total:
        return "int"
    if (n_int + n_float) == total:
        return "float"
    if n_date / total >= 0.8:
        return "date"
    return "string"


# How many rows to sample for inference (first N rows of the file).
_INFERENCE_SAMPLE_SIZE = 1000


def infer_column_types(data: ParsedData) -> dict[str, str]:
    """Sample the first *_INFERENCE_SAMPLE_SIZE* rows of the CSV file and
    return an inferred SQL type for every column that is **not** already
    covered by the metadata.

    Returns
    -------
    dict[str, str]
        Mapping of *original* (lowercased) column name → SQL type string
        (e.g. ``"float4"``, ``"int4"``, ``"date"``, ``"varchar"``).
    """
    from backend.index import metadata

    # Determine which columns need inference
    columns_to_infer: list[str] = []
    for col in data.column_names:
        if col.lower() not in (metadata or {}):
            columns_to_infer.append(col)

    if not columns_to_infer or data.file_path is None:
        return {}

    # Accumulate per-column type votes
    votes: dict[str, dict[str, int]] = {col: {} for col in columns_to_infer}

    rows_sampled = 0
    for row, _ in stream_csv_rows(data.file_path):
        for col in columns_to_infer:
            value = row.get(col, "")
            classification = _classify_value(value)
            votes[col][classification] = votes[col].get(classification, 0) + 1
        rows_sampled += 1
        if rows_sampled >= _INFERENCE_SAMPLE_SIZE:
            break

    # Resolve each column's type and map to SQL
    inferred: dict[str, str] = {}
    for col in columns_to_infer:
        raw_type = _resolve_type(votes[col])
        sql_type = SQL_DATATYPES.get(raw_type, "varchar")
        inferred[col.lower()] = sql_type
        # Keep console output ASCII-safe: local Windows development commonly
        # uses a charmap/code-page stdout that cannot encode the Unicode arrow.
        print(f"  [infer] '{col}' -> {raw_type} -> SQL {sql_type}  (votes: {votes[col]})")

    return inferred


def prepare_column_types(data: ParsedData) -> tuple[dict[str, str], list[str]]:
    """Infer and resolve SQL types once for the complete upload pipeline."""
    if data.inferred_types is None:
        data.inferred_types = infer_column_types(data)
    if not data.column_sql_types:
        data.column_sql_types = [
            getColumnSQLdataType(column.lower(), data.inferred_types)
            for column in data.column_names
        ]
    return data.inferred_types, data.column_sql_types


# ---------------------------------------------------------------------------
# Table creation
# ---------------------------------------------------------------------------

async def createTable(data: ParsedData) -> dict:
    """Replace the dataset table with a schema derived from the uploaded file.

    ``DROP`` and ``CREATE`` run in the same transaction.  If creation fails,
    PostgreSQL rolls the drop back and keeps the previous table intact.
    """
    try:
        conn_params = get_db_connection_params()
    except Exception as e:
        print("ERROR getting connection params", e)
        return {"ERROR": "connecting to database: " + str(e)}
       

    db_name = data.db_name
    sanitized_column_names = data.sanitized_column_names

    # Infer types for columns not present in the metadata CSV.
    # This samples the first N rows of actual data so the SQL schema is more
    # accurate than a blanket VARCHAR default.
    _, column_sql_types = prepare_column_types(data)

    try:
        from psycopg import sql

        columns_sql = []
        for index, col in enumerate(sanitized_column_names):
            column_type = column_sql_types[index] or "VARCHAR"
            columns_sql.append(
                sql.SQL("{} {}").format(
                    sql.Identifier(col),
                    sql.SQL(column_type),
                )
            )

        drop_query = sql.SQL("DROP TABLE IF EXISTS {}").format(
            sql.Identifier(db_name)
        )
        create_query = sql.SQL(
            "CREATE TABLE {} (id SERIAL PRIMARY KEY, {})"
        ).format(
            sql.Identifier(db_name),
            sql.SQL(", ").join(columns_sql),
        )

        with psycopg.connect(**conn_params) as conn:
            with conn.cursor() as cur:
                cur.execute(drop_query)
                cur.execute(create_query)

    except Exception as e:
        print(f"ERROR replacing table '{db_name}': {e}")
        return {"ERROR": "ERROR replacing table: " + str(e)}

    return None



def loadMetadata() -> List[Dict[str, str]]:
    from backend.index import metadata
    from backend.index import getMetaDataPath

    LANGID: str = ""
    if not metadata:
        print("loading metadata")
        metaDataPath: Path = getMetaDataPath(LANGID)
        print("metaDataPath", metaDataPath)
        with open(metaDataPath) as f:
            reader = csv.DictReader(f)
            for row in reader:
                metadata[row["valuename"].lower()] = row["datatype"]

    return metadata


def getColumnSQLdataType(orignalCol: str, inferred_types: Optional[dict[str, str]] = None) -> str:
    """Return the SQL column type for *orignalCol*.

    Lookup order:
    1. Static metadata (CSV / in-memory cache).
    2. ``inferred_types`` dict (populated by ``infer_column_types``).
    3. Fallback: ``varchar``.
    """
    from backend.index import metadata
    if not metadata:
        metadata = loadMetadata()

    orignalCol = orignalCol.lower()

    # 1. Metadata lookup
    if orignalCol in metadata:
        raw_column_type = metadata[orignalCol]
        return SQL_DATATYPES.get(raw_column_type, "varchar")

    # Exact ENSO suitability and climate columns remain numeric even when a
    # sparse upload sample cannot infer their type.
    if is_enso_numeric_column(orignalCol):
        return SQL_DATATYPES.get("float", "float4")

    # 2. Inferred type lookup
    if inferred_types and orignalCol in inferred_types:
        return inferred_types[orignalCol]

    # 3. Fallback
    return "varchar"
