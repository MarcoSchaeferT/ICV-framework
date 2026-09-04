import json
import os
import sys
import tarfile
import uuid
from functools import lru_cache
from pathlib import Path
from typing import Callable, Optional

import numpy as np
import psycopg
import shapely
from dotenv import load_dotenv
from psycopg import sql
from shapely import wkt
from shapely.geometry import shape
from shapely.strtree import STRtree


# Load environment variables for standalone/script usage.
root_dir = Path(__file__).parent.parent.parent.parent
dotenv_path = root_dir / ".env"
load_dotenv(dotenv_path=dotenv_path)

_BATCH_SIZE = 10_000
_TEMP_UPDATE_TABLE = "country_assignment_updates"

# Polygons with more than this many vertices are skipped during country
# assignment — they are typically county/municipality boundaries that
# blow up memory when parsed into Shapely C-level geometry objects.
_MAX_VERTEX_COUNT = 10
# Fast pre-filter: a polygon with 10 vertices is at most ~300 chars of
# WKT.  Strings longer than this threshold are guaranteed to exceed the
# vertex limit and are skipped without parsing.
_MAX_GEOM_STR_LEN = 1_000


def get_db_connection_params() -> dict:
    database_url = os.getenv("DATABASE_URL", "")
    if not database_url:
        raise ValueError("DATABASE_URL not set.")

    url = database_url.split("://", 1)[1]
    auth, rest = url.rsplit("@", 1)
    user, password = auth.split(":", 1)
    host_port, database = rest.split("/", 1)

    host, separator, port = host_port.rpartition(":")
    if not separator:
        host = host_port
        port = "5432"

    if os.getenv("IS_DOCKER", "false").lower() != "true" and host == "davis-db":
        host = "localhost"

    return {
        "host": host,
        "port": int(port),
        "user": user,
        "password": password,
        "dbname": database.split("?", 1)[0],
    }


def load_world_map(path: Path):
    with tarfile.open(path, "r:gz") as tar:
        members = [
            member
            for member in tar.getmembers()
            if not member.name.split("/")[-1].startswith("._")
            and member.name.endswith(".json")
        ]
        if not members:
            raise ValueError(f"No GeoJSON file found in {path}")
        file = tar.extractfile(members[0])
        if file is None:
            raise ValueError(f"Could not extract GeoJSON from {path}")
        return json.loads(file.read().decode("utf-8"))


@lru_cache(maxsize=1)
def _load_country_index():
    """Load the immutable country map and spatial index once per worker."""
    backend_dir = Path(__file__).parent.parent.parent
    world_map_path = backend_dir / "assets" / "worldmap_lowRes.geo.json.tgz"
    world_data = load_world_map(world_map_path)

    polygons = []
    iso_codes = []
    admin_names = []
    for feature in world_data["features"]:
        polygons.append(shape(feature["geometry"]))
        iso_codes.append(feature["properties"].get("iso_a3"))
        admin_names.append(feature["properties"].get("admin"))

    tree = STRtree(polygons)
    geometry_indices = {id(geometry): index for index, geometry in enumerate(polygons)}
    return tree, polygons, iso_codes, admin_names, geometry_indices


def parse_geometry(geo_str):
    """Parse one geometry for the compatibility fallback path."""
    if not geo_str:
        return None
    geo_str = str(geo_str).strip()
    try:
        if geo_str.startswith("{"):
            return shape(json.loads(geo_str))
        return wkt.loads(geo_str)
    except Exception:
        return None


def _vectorized_updates(rows, tree, iso_codes, admin_names):
    """Assign a database batch using Shapely 2 vector operations."""
    geometries = np.empty(len(rows), dtype=object)
    geometries[:] = None
    wkt_positions: list[int] = []
    wkt_values: list[str] = []
    geojson_positions: list[int] = []
    geojson_values: list[str] = []

    for position, (_, geometry_value) in enumerate(rows):
        if not geometry_value:
            continue
        geometry_text = str(geometry_value).strip()
        if not geometry_text:
            continue
        if len(geometry_text) > _MAX_GEOM_STR_LEN:
            continue
        if geometry_text.startswith("{"):
            geojson_positions.append(position)
            geojson_values.append(geometry_text)
        else:
            wkt_positions.append(position)
            wkt_values.append(geometry_text)

    if wkt_values:
        geometries[np.asarray(wkt_positions)] = shapely.from_wkt(
            wkt_values, on_invalid="ignore"
        )
    if geojson_values:
        geometries[np.asarray(geojson_positions)] = shapely.from_geojson(
            geojson_values, on_invalid="ignore"
        )

    valid_mask = ~shapely.is_missing(geometries) & ~shapely.is_empty(geometries)
    valid_mask &= shapely.get_num_coordinates(geometries) <= _MAX_VERTEX_COUNT
    valid_positions = np.flatnonzero(valid_mask)
    if valid_positions.size == 0:
        return []

    representative_points = shapely.point_on_surface(geometries[valid_positions])
    matches = tree.query(representative_points, predicate="within")

    updates = []
    assigned_positions = set()
    for point_position, country_position in matches.T:
        row_position = int(valid_positions[int(point_position)])
        if row_position in assigned_positions:
            continue
        assigned_positions.add(row_position)
        row_id = rows[row_position][0]
        country_index = int(country_position)
        updates.append(
            (row_id, iso_codes[country_index], admin_names[country_index])
        )
    return updates


def _scalar_updates(
    rows, tree, polygons, iso_codes, admin_names, geometry_indices
):
    """Compatibility path for Shapely versions without vectorized parsers."""
    updates = []
    for row_id, geometry_value in rows:
        row_geometry = parse_geometry(geometry_value)
        if row_geometry is None:
            continue
        if shapely.get_num_coordinates(row_geometry) > _MAX_VERTEX_COUNT:
            continue
        point = (
            row_geometry.representative_point()
            if row_geometry.geom_type != "Point"
            else row_geometry
        )
        for match in tree.query(point):
            if isinstance(match, (int, np.integer)):
                country_index = int(match)
            else:
                country_index = geometry_indices.get(id(match))
                if country_index is None:
                    continue
            if polygons[country_index].contains(point):
                updates.append(
                    (row_id, iso_codes[country_index], admin_names[country_index])
                )
                break
    return updates


def _country_updates(rows, country_index):
    tree, polygons, iso_codes, admin_names, geometry_indices = country_index
    if hasattr(shapely, "from_wkt") and hasattr(tree, "query"):
        try:
            return _vectorized_updates(rows, tree, iso_codes, admin_names)
        except Exception as vector_error:
            print(
                "WARNING: Vectorized country assignment failed for one batch; "
                f"using the compatibility path: {vector_error}"
            )
    return _scalar_updates(
        rows, tree, polygons, iso_codes, admin_names, geometry_indices
    )


def _apply_updates(writer_conn, table_name: str, updates) -> int:
    """COPY one result batch and apply it with a single set-based UPDATE."""
    if not updates:
        return 0

    with writer_conn.cursor() as cur:
        cur.execute(sql.SQL("TRUNCATE TABLE {}").format(sql.Identifier(_TEMP_UPDATE_TABLE)))
        copy_query = sql.SQL("COPY {} (id, iso_a3, admin) FROM STDIN").format(
            sql.Identifier(_TEMP_UPDATE_TABLE)
        )
        with cur.copy(copy_query) as copy:
            for update in updates:
                copy.write_row(update)
        cur.execute(
            sql.SQL(
                """
                UPDATE {target} AS target
                SET iso_a3 = updates.iso_a3,
                    admin = updates.admin
                FROM {updates} AS updates
                WHERE target.id = updates.id
                """
            ).format(
                target=sql.Identifier(table_name),
                updates=sql.Identifier(_TEMP_UPDATE_TABLE),
            )
        )
        updated_count = cur.rowcount
    writer_conn.commit()
    return updated_count


def assign_geo_pos_to_country(
    table_name: str,
    skip_existing: bool = True,
    progress_callback: Optional[Callable[[int, int], None]] = None,
    total_rows: Optional[int] = None,
):
    print("Loading cached world map index...")
    country_index = _load_country_index()
    params = get_db_connection_params()
    condition = "WHERE iso_a3 IS NULL OR iso_a3 = ''" if skip_existing else ""
    condition_sql = sql.SQL(condition)
    total_updated = 0
    processed_rows = 0

    with psycopg.connect(**params) as writer_conn:
        with writer_conn.cursor() as cur:
            cur.execute(
                sql.SQL(
                    "ALTER TABLE {table} ADD COLUMN IF NOT EXISTS iso_a3 VARCHAR(3)"
                ).format(table=sql.Identifier(table_name))
            )
            cur.execute(
                sql.SQL(
                    "ALTER TABLE {table} ADD COLUMN IF NOT EXISTS admin VARCHAR(255)"
                ).format(table=sql.Identifier(table_name))
            )
            cur.execute(
                sql.SQL(
                    """
                    CREATE TEMP TABLE {updates}
                    ON COMMIT PRESERVE ROWS
                    AS SELECT id, iso_a3, admin
                    FROM {target}
                    WITH NO DATA
                    """
                ).format(
                    updates=sql.Identifier(_TEMP_UPDATE_TABLE),
                    target=sql.Identifier(table_name),
                )
            )
            writer_conn.commit()

            if total_rows is None:
                cur.execute(
                    sql.SQL("SELECT COUNT(*) FROM {table} {condition}").format(
                        table=sql.Identifier(table_name),
                        condition=condition_sql,
                    )
                )
                count_row = cur.fetchone()
                total_rows = int(count_row[0]) if count_row else 0
            else:
                total_rows = max(0, int(total_rows))
            writer_conn.commit()

        try:
            from backend.routes.columnMetadata.route_columnMetadata import (
                populate_column_metadata,
            )

            populate_column_metadata(table_name, ["iso_a3", "admin"])
        except Exception as metadata_error:
            print(
                f"WARNING: Could not update column metadata for {table_name} "
                f"(iso_a3, admin): {metadata_error}"
            )

        # Keep the large result set on PostgreSQL and fetch only one batch at a
        # time. A separate writer connection allows each update batch to commit
        # without closing or materializing the server-side read cursor.
        with psycopg.connect(**params) as reader_conn:
            cursor_name = f"country_assignment_{uuid.uuid4().hex}"
            with reader_conn.cursor(name=cursor_name) as read_cur:
                read_cur.execute(
                    sql.SQL("SELECT id, geometry FROM {table} {condition}").format(
                        table=sql.Identifier(table_name),
                        condition=condition_sql,
                    )
                )
                while rows := read_cur.fetchmany(_BATCH_SIZE):
                    updates = _country_updates(rows, country_index)
                    total_updated += _apply_updates(writer_conn, table_name, updates)
                    processed_rows += len(rows)
                    if progress_callback:
                        progress_callback(processed_rows, total_rows)

    return total_updated


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python assignGeoPosToCountry.py <table_name>")
        sys.exit(1)
    assign_geo_pos_to_country(sys.argv[1], skip_existing="--all" not in sys.argv)
