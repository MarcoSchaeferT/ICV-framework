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
        with psycopg.connect(**conn_params) as conn:
            with conn.cursor() as cur:
                # Check if table exists
                cur.execute("""
                    SELECT EXISTS (
                        SELECT 1 FROM pg_tables 
                        WHERE schemaname = 'public' 
                        AND tablename = %s
                    )
                """, (db_name,))
                result = cur.fetchone()
                checkExistsQuery = [{"exists": result[0]}]
                print("checkExistsQuery", checkExistsQuery)
                
                if checkExistsQuery[0]["exists"] is True:
                    print("Table already exists")
                    return {"ERROR": "Table already exists"}
                else:
                    columns_definition = []
                    for index, col in enumerate(sanitized_column_names):
                        # get the column type from the metadata
                        orignalCol = data.column_names[index]
                        column_type = getColumnSQLdataType(orignalCol.lower())
                        # if the column type is not found, default to VARCHAR
                        if column_type is None:
                            column_type = "VARCHAR"
                        columns_definition.append(f'"{col}" {column_type}')
                    columns_def_str = ", ".join(columns_definition)
                    create_query = f"""
                    CREATE TABLE "{db_name}" (
                        "id" SERIAL PRIMARY KEY,
                        {columns_def_str}
                    )
                    """
                    print("create_query", create_query)
                    try:
                        cur.execute(create_query)
                        conn.commit()
                    except Exception as e:
                        print("ERROR creating table", e)
                        return {"ERROR": "ERROR creating table: " + str(e)}
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