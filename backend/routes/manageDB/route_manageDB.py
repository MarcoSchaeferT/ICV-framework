"""ManageDB blueprint – list and delete database relations."""

from pathlib import Path
from flask import request, jsonify, Blueprint, Response
from flasgger import swag_from
from pydantic import ValidationError
from backend.schemas import BaseSchema, RelationName
from backend.routes.setFilesToDB.db_utils import query_raw, execute_raw, db_error_response
from backend.cache import response_cache
from psycopg import sql

# Blueprint configuration
route_manageDB = Blueprint('manageDB', __name__)
BACKEND_DIR: Path = Path(__file__).parent.parent.parent
SWAGGER_YAML_PATH: Path = BACKEND_DIR / "API_docs"

# Tables that must never be deleted via this endpoint
PROTECTED_TABLES = frozenset({
    "User",
    "Test",
    "column_metadata_en",
    "column_metadata_de",
})


class DeleteRelationParams(BaseSchema):
    """Query parameters for deleting a database relation.

    Example:
        ```python
        params = DeleteRelationParams(relationName="old_dataset")
        ```
    """
    relationName: RelationName


@swag_from(f"{SWAGGER_YAML_PATH}/manage_db_list.yml")
@route_manageDB.route("", methods=["GET"])
async def list_relations() -> Response:
    """List unprotected public tables with approximate row counts.

    The route includes regular and partitioned tables. When PostgreSQL's
    estimate is zero, it tries ``COUNT(*)`` and uses zero if that query fails.
    """
    query = """
        SELECT
            c.relname                                    AS table_name,
            GREATEST(COALESCE(c.reltuples, 0), 0)::bigint AS row_count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
        ORDER BY c.relname
    """
    try:
        relations = await query_raw(query)
    except Exception as e:
        return db_error_response(e, "Failed to list relations")

    # Filter out protected / internal tables
    result = [
        r for r in relations
        if r["table_name"] not in PROTECTED_TABLES
    ]

    # For tables where pg_class statistics are stale (row_count == 0 but may
    # actually contain rows), get the real count.  This only fires for the
    # small number of never-ANALYZE'd tables, so it won't be slow.
    for r in result:
        if r["row_count"] <= 0:
            try:
                # Use sql.Identifier for safe table name injection
                count_query = sql.SQL("SELECT COUNT(*) AS cnt FROM {}").format(
                    sql.Identifier(r["table_name"])
                )
                count_result = await query_raw(count_query)
                r["row_count"] = count_result[0]["cnt"] if count_result else 0
            except Exception:
                r["row_count"] = 0

    return jsonify(result)


@swag_from(f"{SWAGGER_YAML_PATH}/manage_db_delete.yml")
@route_manageDB.route("", methods=["DELETE"])
async def delete_relation() -> Response:
    """Drop an unprotected relation and its dependent objects with CASCADE.

    The route then removes localized column metadata and invalidates cached
    relation data. Missing ``relationName`` returns 400; protected names
    return 403. The ``DROP TABLE IF EXISTS`` statement accepts an absent table.
    """
    raw_relation_name: str | None = request.args.get("relationName")

    if not raw_relation_name:
        return jsonify({"error": "Missing required query parameter 'relationName'."}), 400

    try:
        params = DeleteRelationParams.model_validate({"relationName": raw_relation_name})
    except ValidationError as err:
        return jsonify({"error": str(err.errors()[0]["msg"] if err.errors() else err)}), 400

    relation_name = params.relationName

    if relation_name in PROTECTED_TABLES:
        return jsonify({"error": f"Table '{relation_name}' is protected and cannot be deleted."}), 403

    # Use sql.Identifier for safe drop table command
    try:
        drop_query = sql.SQL("DROP TABLE IF EXISTS {} CASCADE").format(
            sql.Identifier(relation_name)
        )
        await execute_raw(drop_query)

        # Clean up corresponding metadata entries for the deleted relation
        await execute_raw("DELETE FROM column_metadata_en WHERE relation_name = %s", (relation_name,))
        await execute_raw("DELETE FROM column_metadata_de WHERE relation_name = %s", (relation_name,))
    except Exception as e:
        return db_error_response(e, "Failed to drop table")

    # Invalidate cache entries for the deleted table — the Redis epoch bump
    # inside invalidate() makes ALL workers drop their entries, not just the
    # one that handled this request. (getListOfRelationsDB is uncached, so
    # no extra invalidation is needed for the relations list.)
    evicted = response_cache.invalidate(relation_name)
    print(f"[CACHE] Invalidated {evicted} local entries for table '{relation_name}'")

    return jsonify({"success": True, "deleted": relation_name})


