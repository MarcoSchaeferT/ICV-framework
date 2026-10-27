"""Provide pooled PostgreSQL connections and raw query helpers.

Connection pools are process-local and recreated after Gunicorn forks.
"""

import os
import atexit
import threading
import uuid
import psycopg
from psycopg import errors as psycopg_errors, sql
from psycopg_pool import ConnectionPool, PoolTimeout
from contextlib import contextmanager
from typing import Callable, Optional, Sequence, Union


def is_connection_error(e: Exception) -> bool:
    """Return True if an exception indicates the database server is stopped or unreachable."""
    if isinstance(e, (psycopg.OperationalError, psycopg_errors.ConnectionFailure, psycopg_errors.CannotConnectNow, PoolTimeout)):
        return True

    msg = str(e).lower()
    return any(term in msg for term in [
        "connection refused",
        "could not connect",
        "connection to server",
        "operation not permitted",
        "connection is bad",
        "the database system is starting up",
        "the database system is shutting down",
        "timed out",
        "timeout",
        "closed the connection unexpectedly",
    ])


def format_db_error(e: Exception, context: str = "") -> str:
    """Format an exception into a standardized, user-facing database error message."""
    if is_connection_error(e):
        return f"Database connection error: The database server is currently not running or unreachable. Details: {e}"
    prefix = f"{context}: " if context else "Database query error: "
    return f"{prefix}{e}"


def db_error_response(e: Exception, context: str = ""):
    """Return a Flask jsonify error response with 503 for connection errors and 500 otherwise."""
    from flask import jsonify
    status_code = 503 if is_connection_error(e) else 500
    return jsonify({"error": format_db_error(e, context)}), status_code


SQL_DATATYPES = {
    "string": "varchar",
    "float": "float4",
    "int": "int4",
    "date": "date"
}

_connection_pool: ConnectionPool | None = None
_connection_pool_pid: int | None = None
_connection_pool_lock = threading.Lock()


def get_db_connection_params() -> dict:
    """Parse the configured PostgreSQL URL for psycopg connections.

    Host-run development maps ``icv-database`` to ``localhost``; container runs
    keep the Compose service hostname. The parser accepts the URL shape used
    by this project and raises ``ValueError`` when ``DATABASE_URL`` is absent.
    """
    database_url = os.getenv("DATABASE_URL", "")
    
    if not database_url:
        raise ValueError("DATABASE_URL environment variable is not set. Check your .env file and ensure python-dotenv is installed.")
    
    # Format: postgresql://user:password@host:port/database
    if database_url.startswith("postgresql://"):
        database_url = database_url[13:]  # Remove 'postgresql://'
    elif database_url.startswith("postgres://"):
        database_url = database_url[11:]  # Remove 'postgres://'
    
    # Split user:password@host:port/database
    auth, rest = database_url.split("@")
    user, password = auth.split(":")
    host_port, database = rest.split("/")
    
    if ":" in host_port:
        host, port = host_port.split(":")
    else:
        host = host_port
        port = "5432"
    
    # When running locally (not in Docker), resolve icv-database to localhost
    is_docker = os.getenv("IS_DOCKER", "false").lower() == "true"
    if not is_docker and host == "icv-database":
        host = "localhost"
    
    return {
        "host": host,
        "port": int(port),
        "user": user,
        "password": password,
        "dbname": database.split("?")[0]  # Remove query params if any
    }


def _positive_env_int(name: str, default: int) -> int:
    """Read a positive integer environment setting or return its fallback."""
    value = os.getenv(name, "").strip()
    return int(value) if value.isdigit() and int(value) > 0 else default


def get_db_connection_pool() -> ConnectionPool:
    """Return the thread-safe pool belonging to the current worker process.

    A Gunicorn worker that inherited a pool during preload closes that copy
    and opens its own pool. Size and timeout come from ``DB_POOL_*`` settings.
    """
    global _connection_pool, _connection_pool_pid

    process_id = os.getpid()
    if _connection_pool is not None and _connection_pool_pid == process_id:
        return _connection_pool

    with _connection_pool_lock:
        if _connection_pool is not None and _connection_pool_pid == process_id:
            return _connection_pool

        # Gunicorn preloads modules before forking. Never reuse a pool inherited
        # from the master process; each worker owns at most four connections.
        if _connection_pool is not None:
            _connection_pool.close()

        min_size = _positive_env_int("DB_POOL_MIN_SIZE", 1)
        max_size = max(min_size, _positive_env_int("DB_POOL_MAX_SIZE", 4))
        timeout = _positive_env_int("DB_POOL_TIMEOUT_SECONDS", 30)
        _connection_pool = ConnectionPool(
            kwargs=get_db_connection_params(),
            min_size=min_size,
            max_size=max_size,
            timeout=timeout,
            name=f"icv-database-{process_id}",
            open=True,
        )
        _connection_pool_pid = process_id
        return _connection_pool


def close_db_connection_pool() -> None:
    """Close connections owned by the current process."""
    global _connection_pool, _connection_pool_pid
    with _connection_pool_lock:
        if _connection_pool is not None and _connection_pool_pid == os.getpid():
            _connection_pool.close()
        _connection_pool = None
        _connection_pool_pid = None


atexit.register(close_db_connection_pool)


@contextmanager
def get_db_connection():
    """Borrow a connection and return it cleanly to the process-local pool."""
    with get_db_connection_pool().connection() as conn:
        yield conn


async def query_raw(query: Union[str, sql.SQL, sql.Composed], params: Optional[Union[tuple, dict]] = None) -> list[dict]:
    """Execute a SELECT through a server-side cursor and return dictionaries.

    A named cursor prevents libpq from buffering the complete result before
    Python starts consuming it.  The returned list intentionally preserves the
    existing API contract, while driver fetches use 10,000-row batches. The
    final list still contains every returned row,
    so callers must bound large results or use ``query_columnar``.

    ``params`` binds values; callers compose dynamic table and column names
    with ``psycopg.sql.Identifier``. Database errors propagate to the caller.
    """
    try:
        with get_db_connection() as conn:
            cursor_name = f"icv:_stream_{uuid.uuid4().hex}"
            with conn.cursor(name=cursor_name) as cur:
                cur.execute(query, params)
                if cur.description:
                    columns = [desc[0] for desc in cur.description]
                    records: list[dict] = []
                    while True:
                        rows = cur.fetchmany(10_000)
                        if not rows:
                            break
                        records.extend(dict(zip(columns, row)) for row in rows)
                    return records
                return []
    except psycopg_errors.UndefinedTable as e:
        # Re-raise so callers can distinguish "table missing" from "table empty"
        print(f"Table does not exist: {e}")
        raise
    except psycopg_errors.Error as e:
        # Other database errors
        print(f"Database error in query_raw: {e}")
        raise


async def query_columnar(
    query: Union[str, sql.SQL, sql.Composed],
    column_names: Sequence[str],
    params: Optional[Union[tuple, dict]] = None,
    fetch_size: int = 10_000,
    row_mapper: Optional[Callable[[tuple], Sequence]] = None,
) -> dict[str, list]:
    """Stream a SELECT into column arrays without per-row dictionaries.

    This is the preferred path for large visualization datasets.  It avoids
    both ``fetchall()`` and hundreds of thousands of Python dictionaries while
    retaining a compact JSON-friendly result. Each key in ``column_names``
    receives one value per row, in the supplied order. ``row_mapper`` may
    transform each raw tuple before values are appended. The returned arrays
    still grow with the full result set; they are not a bounded page.
    """
    result = {name: [] for name in column_names}
    try:
        with get_db_connection() as conn:
            cursor_name = f"icv:_columns_{uuid.uuid4().hex}"
            with conn.cursor(name=cursor_name) as cur:
                cur.execute(query, params)
                if not cur.description:
                    return result

                while True:
                    rows = cur.fetchmany(fetch_size)
                    if not rows:
                        break
                    for raw_row in rows:
                        row = row_mapper(raw_row) if row_mapper else raw_row
                        for index, name in enumerate(column_names):
                            result[name].append(row[index])
                return result
    except psycopg_errors.UndefinedTable as e:
        print(f"Table does not exist: {e}")
        raise
    except psycopg_errors.Error as e:
        print(f"Database error in query_columnar: {e}")
        raise


async def execute_raw(query: Union[str, sql.SQL, sql.Composed], params: Optional[Union[tuple, dict]] = None) -> None:
    """Execute and commit one statement without returning rows.

    Values are bound through ``params``; dynamic identifiers must be composed
    by the caller. PostgreSQL errors propagate after the connection context
    rolls back the failed transaction.
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
                conn.commit()
    except psycopg_errors.UndefinedTable as e:
        print(f"Table does not exist: {e}")
        raise
    except psycopg_errors.Error as e:
        print(f"Database error in execute_raw: {e}")
        raise

