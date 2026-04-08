import psycopg
from backend.routes.setFilesToDB.db_utils import get_db_connection_params


async def resetTable(db_name: str):
    from backend.index import fileUploadErrors
    
    try:
        conn_params = get_db_connection_params()
        
        with psycopg.connect(**conn_params) as conn:
            with conn.cursor() as cur:
                # truncate/reset the table
                truncate_query = f'TRUNCATE TABLE "{db_name}" RESTART IDENTITY;'
                cur.execute(truncate_query)
                conn.commit()
    except Exception as e:
        return {"ERROR": "ERROR resetting table: " + str(e)}
    
    return None