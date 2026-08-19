import os
import uuid
import psycopg
from psycopg import errors as psycopg_errors, sql
from contextlib import contextmanager
from typing import Callable, Optional, Sequence, Union


SQL_DATATYPES = {
    "string": "varchar",
    "float": "float4",
    "int": "int4",
    "date": "date"
}


def get_db_connection_params() -> dict:
    """Parse DATABASE_URL into connection parameters"""
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


@contextmanager
def get_db_connection():
    """Context manager for database connections"""
    conn = psycopg.connect(**get_db_connection_params())
    try:
        yield conn
    finally:
        conn.close()


async def query_raw(query: Union[str, sql.SQL, sql.Composed], params: Optional[Union[tuple, dict]] = None) -> list[dict]:
    """Execute a SELECT through a server-side cursor and return dictionaries.

    A named cursor prevents libpq from buffering the complete result before
    Python starts consuming it.  The returned list intentionally preserves the
    existing API contract, while peak driver memory stays bounded by
    ``fetch_size``.
    """
    conn_params = get_db_connection_params()
    try:
        with psycopg.connect(**conn_params) as conn:
            cursor_name = f"icv_stream_{uuid.uuid4().hex}"
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
    retaining a compact JSON-friendly result.
    """
    conn_params = get_db_connection_params()
    result = {name: [] for name in column_names}
    try:
        with psycopg.connect(**conn_params) as conn:
            cursor_name = f"icv_columns_{uuid.uuid4().hex}"
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
    """Execute a raw query without returning results"""
    conn_params = get_db_connection_params()
    try:
        with psycopg.connect(**conn_params) as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
                conn.commit()
    except psycopg_errors.UndefinedTable as e:
        print(f"Table does not exist: {e}")
        raise
    except psycopg_errors.Error as e:
        print(f"Database error in execute_raw: {e}")
        raise

