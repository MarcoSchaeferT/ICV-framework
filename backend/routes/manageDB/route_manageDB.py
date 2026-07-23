"""ManageDB blueprint – list and delete database relations."""

from flask import request, jsonify, Blueprint, Response
from backend.routes.setFilesToDB.db_utils import query_raw, execute_raw
from backend.cache import response_cache, make_cache_key
from psycopg import sql

# Blueprint configuration
route_manageDB = Blueprint('manageDB', __name__)

# Tables that must never be deleted via this endpoint
PROTECTED_TABLES = frozenset({
    "User",
    "Test",
    "column_metadata_en",
    "column_metadata_de",
})


@route_manageDB.route("", methods=["GET"])
async def list_relations() -> Response:
    """Return every public-schema relation with its approximate row count."""
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
    relations = await query_raw(query)

    # Filter out protected / internal tables
    result = [
        r for r in relations
        if r["table_name"] not in PROTECTED_TABLES
           and not r["table_name"].startswith("_prisma")
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


@route_manageDB.route("", methods=["DELETE"])
async def delete_relation() -> Response:
    """Drop a relation by name.  Protected tables cannot be deleted."""
    relation_name: str | None = request.args.get("relationName")

    if not relation_name:
        return jsonify({"error": "Missing required query parameter 'relationName'."}), 400

    if relation_name in PROTECTED_TABLES:
        return jsonify({"error": f"Table '{relation_name}' is protected and cannot be deleted."}), 403

    # Use sql.Identifier for safe drop table command
    try:
        drop_query = sql.SQL("DROP TABLE IF EXISTS {} CASCADE").format(
            sql.Identifier(relation_name)
        )
        await execute_raw(drop_query)
    except Exception as e:
        return jsonify({"error": f"Failed to drop table: {e}"}), 500

    # Invalidate cache entries for the deleted table — the Redis epoch bump
    # inside invalidate() makes ALL workers drop their entries, not just the
    # one that handled this request. (getListOfRelationsDB is uncached, so
    # no extra invalidation is needed for the relations list.)
    evicted = response_cache.invalidate(relation_name)
    print(f"[CACHE] Invalidated {evicted} local entries for table '{relation_name}'")

    return jsonify({"success": True, "deleted": relation_name})

