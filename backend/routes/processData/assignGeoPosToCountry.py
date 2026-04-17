import os
import json
import tarfile
import psycopg
from psycopg import sql
try:
    from shapely.geometry import shape
    from shapely import wkt
except ImportError:
    print("Error: 'shapely' library is required. Please install it with: pip install shapely")
    exit(1)
from dotenv import load_dotenv
from pathlib import Path
import sys

# Load environment variables
root_dir = Path(__file__).parent.parent.parent.parent
dotenv_path = root_dir / ".env"
load_dotenv(dotenv_path=dotenv_path)

def get_db_connection_params() -> dict:
    database_url = os.getenv("DATABASE_URL", "")
    if not database_url:
        raise ValueError("DATABASE_URL not set.")
    
    # Simple parser for the DATABASE_URL pattern
    url = database_url.split("://")[1]
    auth, rest = url.split("@")
    user, password = auth.split(":")
    host_port, database = rest.split("/")
    
    host = host_port.split(":")[0] if ":" in host_port else host_port
    port = host_port.split(":")[1] if ":" in host_port else "5432"
    
    # Local resolution
    if os.getenv("IS_DOCKER", "false").lower() != "true" and host == "icv-database":
        host = "localhost"
    
    return {
        "host": host,
        "port": int(port),
        "user": user,
        "password": password,
        "dbname": database.split("?")[0]
    }

def load_world_map(path: Path):
    with tarfile.open(path, "r:gz") as tar:
        members = [m for m in tar.getmembers() if not m.name.split('/')[-1].startswith('._') and m.name.endswith('.json')]
        member = members[0]
        file = tar.extractfile(member)
        return json.loads(file.read().decode("utf-8"))

def parse_geometry(geo_str):
    """Attempts to parse geometry as GeoJSON, falling back to WKT."""
    if not geo_str: return None
    geo_str = geo_str.strip()
    try:
        # Try GeoJSON
        if geo_str.startswith('{'):
            return shape(json.loads(geo_str))
        # Try WKT
        return wkt.loads(geo_str)
    except Exception:
        return None

def assign_geo_pos_to_country(table_name: str, skip_existing: bool = True):
    backend_dir = Path(__file__).parent.parent.parent
    world_map_path = backend_dir / "assets" / "worldmap_lowRes.geo.json.tgz"
    
    print(f"Loading world map...")
    world_data = load_world_map(world_map_path)
    countries = []
    polygons = []
    for feature in world_data['features']:
        geom = shape(feature['geometry'])
        polygons.append(geom)
        countries.append({
            'iso_a3': feature['properties'].get('iso_a3'),
            'admin': feature['properties'].get('admin'),
            'geom': geom
        })

    try:
        from shapely.strtree import STRtree
        tree = STRtree(polygons)
        use_tree = True
        
        # Test STRTree output type to handle Shapely 1.8 vs 2.0+
        test_pt = polygons[0].representative_point()
        res = tree.query(test_pt)
        returns_indices = False
        if len(res) > 0 and type(res[0]).__name__ in ('int', 'int32', 'int64', 'long'):
             returns_indices = True
        geom_to_country = {id(c['geom']): c for c in countries}
    except Exception as e:
        print(f"STRTree initialization failed: {e}. Falling back to simple iteration.")
        use_tree = False

    params = get_db_connection_params()
    total_updated = 0
    with psycopg.connect(**params) as conn:
        with conn.cursor() as cur:
            cur.execute(sql.SQL("ALTER TABLE {t} ADD COLUMN IF NOT EXISTS iso_a3 VARCHAR(3)").format(t=sql.Identifier(table_name)))
            cur.execute(sql.SQL("ALTER TABLE {t} ADD COLUMN IF NOT EXISTS admin VARCHAR(255)").format(t=sql.Identifier(table_name)))
            conn.commit()

            condition = "WHERE iso_a3 IS NULL OR iso_a3 = ''" if skip_existing else ""
            
            # Use server-side cursor equivalent (fetchmany) to avoid loading all rows into RAM
            cur.execute(sql.SQL("SELECT id, geometry FROM {t} {c}").format(
                t=sql.Identifier(table_name), 
                c=sql.SQL(condition)
            ))
            
            while True:
                rows = cur.fetchmany(5000)
                if not rows:
                    break
                
                updates = []
                for row_id, geo_str in rows:
                    row_geom = parse_geometry(geo_str)
                    if not row_geom:
                        continue
                    
                    point_to_check = row_geom.representative_point() if row_geom.geom_type != 'Point' else row_geom
                    
                    matched_country = None
                    if use_tree:
                        matches = tree.query(point_to_check)
                        for match in matches:
                            c = countries[match] if returns_indices else geom_to_country.get(id(match))
                            if c and c['geom'].contains(point_to_check):
                                matched_country = c
                                break
                    else:
                        for c in countries:
                            if c['geom'].contains(point_to_check):
                                matched_country = c
                                break
                                
                    if matched_country:
                        updates.append((matched_country['iso_a3'], matched_country['admin'], row_id))

                if updates:
                    with conn.cursor() as update_cur:
                        update_cur.executemany(sql.SQL("UPDATE {t} SET iso_a3 = %s, admin = %s WHERE id = %s").format(t=sql.Identifier(table_name)), updates)
                    conn.commit()
                    total_updated += len(updates)
                    
            return total_updated

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python assignGeoPosToCountry.py <table_name>")
        sys.exit(1)
    assign_geo_pos_to_country(sys.argv[1], skip_existing="--all" not in sys.argv)
