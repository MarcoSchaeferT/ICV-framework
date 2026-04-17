from pathlib import Path
import csv
import psycopg
csv.field_size_limit(100000000)
from typing import List, Dict
import os
# custom modules
from backend.routes.setFilesToDB.parseCSVdata import ParsedData
from backend.routes.setFilesToDB.db_utils import get_db_connection_params, SQL_DATATYPES


async def createTable(data: ParsedData) -> dict:
    try:
        conn_params = get_db_connection_params()
    except Exception as e:
        print("ERROR getting connection params", e)
        return {"ERROR": "connecting to database: " + str(e)}
       

    db_name = data.db_name
    sanitized_column_names = data.sanitized_column_names

    try:
        from psycopg import sql
        with psycopg.connect(**conn_params) as conn:
            with conn.cursor() as cur:
                # Check if table exists (already using parameterization)
                cur.execute("""
                    SELECT EXISTS (
                        SELECT 1 FROM pg_tables 
                        WHERE schemaname = 'public' 
                        AND tablename = %s
                    )
                """, (db_name,))
                result = cur.fetchone()
                exists = result[0] if result else False
                print("Table exists check:", exists)
                
                if exists:
                    print(f"Table '{db_name}' already exists")
                    return {"ERROR": "Table already exists"}
                else:
                    columns_sql = []
                    for index, col in enumerate(sanitized_column_names):
                        # get the column type from the metadata
                        orignalCol = data.column_names[index]
                        column_type = getColumnSQLdataType(orignalCol.lower())
                        # if the column type is not found, default to VARCHAR
                        if column_type is None:
                            column_type = "VARCHAR"
                        
                        # Use sql.Identifier for column name and sql.SQL for type
                        columns_sql.append(
                            sql.SQL("{} {}").format(
                                sql.Identifier(col),
                                sql.SQL(column_type)
                            )
                        )
                    
                    # Construct and execute CREATE TABLE query safely
                    create_query = sql.SQL("CREATE TABLE {} (id SERIAL PRIMARY KEY, {})").format(
                        sql.Identifier(db_name),
                        sql.SQL(", ").join(columns_sql)
                    )
                    
                    print("create_query", create_query.as_string(conn))
                    try:
                        cur.execute(create_query)
                        conn.commit()
                    except Exception as e:
                        print(f"ERROR creating table '{db_name}': {e}")
                        return {"ERROR": f"ERROR creating table: {str(e)}"}

    except Exception as e:
        print("ERROR in createTable", e)
        return {"ERROR": "ERROR in createTable: " + str(e)}

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


def getColumnSQLdataType(orignalCol: str) -> str:
    from backend.index import metadata
    if not metadata:
        metadata = loadMetadata()
    # default to VARCHAR (e.g. if the column type is not found)
    column_type = "varchar"
    raw_column_type = "string"
    orignalCol = orignalCol.lower()
    if orignalCol in metadata:
        raw_column_type = metadata[orignalCol]
        column_type = SQL_DATATYPES[raw_column_type]
    return column_type