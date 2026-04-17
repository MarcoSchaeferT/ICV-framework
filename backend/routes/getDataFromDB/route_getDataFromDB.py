from flask import request, jsonify, Blueprint
from backend.routes.setFilesToDB.db_utils import query_raw
import time
from math import ceil
from pydantic import BaseModel, ValidationError
from typing import Optional, List, Union
from flasgger import swag_from
import re
import json as JSON
from psycopg import errors as psycopg_errors, sql

# Blueprint configuration
route_getDataFromDB = Blueprint('getDataFromDB', __name__)

#***************#
# *** Route *** #
#***************#
class RequestParams(BaseModel):
  relationName: str
  feature: str
  filterBy: Optional[str] = None
  filterValue: Optional[str] = None
  startDate: Optional[str] = None
  endDate: Optional[str] = None
  task: Optional[str] = None
  aggregation_level: Optional[str] = None

class ResponseJson(BaseModel):
  relationName: str
  header: list[str]
  response: object
  error: str | None = None

@swag_from('../../API_docs/get_data_from_db.yml')
@route_getDataFromDB.route("", methods=["GET"])
async def getDataFromDB():
  response_json = ResponseJson(
        relationName="",
        header=list(""),
        response=None,
        error=None
      )
  
  if request.method == "GET":
      try:
        params = RequestParams(
          relationName=request.args["relationName"],
          feature=request.args["feature"],
          filterBy=request.args.get("filterBy"),
          filterValue=request.args.get("filterValue"),
          startDate=request.args.get("startDate"),
          endDate=request.args.get("endDate"),
          # aggregation_level is optional, used for filtering data by aggregation level (e.g., country (aggregation_level=0), (aggregation_level=1))
          aggregation_level=request.args.get("aggregation_level"),
          task=request.args.get("task")
        )
      except ValidationError as e:
        response_json.error =  "ERROR: Invalid request parameters, details:" + str(e.errors())
        return response_json.model_dump()

      print("***params", params)
      relationName: str = params.relationName
      feature: str = params.feature
      filterBy: List[str] = consumeARGSvalues(params.filterBy)
      filterValue: List[str] = consumeARGSvalues(params.filterValue)
      startDate: Optional[str] = params.startDate
      endDate: Optional[str] = params.endDate
      aggregation_level: Optional[str] = params.aggregation_level

      isFeatureScan = False
      if feature.endswith("*"):
        feature = feature[:-1]
        isFeatureScan = True

      print("filterBy", filterBy)
      print("filterValue", filterValue)
      print("relationName",relationName)

      # get the first record to check if the relation exists
      try:
        relationHeader = await getDBdata_HEADER(relationName)
      except psycopg_errors.UndefinedTable as e:
        response_json.relationName = relationName
        response_json.error = f"Table '{relationName}' does not exist in the database. Please check the table name or upload the dataset first."
        return response_json.model_dump()
      except Exception as e:
        response_json.relationName = relationName
        response_json.error = f"Database error: {str(e)}"
        return response_json.model_dump()
      
      response_json.relationName = relationName
      if not relationHeader or len(relationHeader) == 0:
        errMsg = f"Table '{relationName}' exists but contains no data."
        response_json.error = errMsg
        return response_json.model_dump()
      response_json.header = list(relationHeader[0].keys())

      # if feature is not provided, get the middle feature
      if not feature:
        feature = list(relationHeader[0].keys())[ceil(len(relationHeader[0].keys())/2)-1]
        print("feature", feature)

      # get the records from the database
      if isFeatureScan:
        [response_json.response, response_json.error] = await getDBdata_multiCol(relationName, feature, filterBy, filterValue, startDate, endDate, aggregation_level)
      elif feature == "ALL":
         [response_json.response, response_json.error] = await getDBdata_allCols(relationName)
      else:
        match params.task:
          case "getUniqueEntries":
             [response_json.response, response_json.error] = await getDBdata_singleColUnique(relationName, feature)
          case "getMinMax":
             [response_json.response, response_json.error] = await getDBdata_singleColMinMax(relationName, feature)
          case "getCount":
             [response_json.response, response_json.error] = await getDBdata_singleColCount(relationName, feature, filterBy, filterValue)
          case _:
             [response_json.response, response_json.error] = await getDBdata_singleCol(relationName, feature, filterBy, filterValue, startDate, endDate, aggregation_level)
             if response_json.error:
                response_json.error = "ERROR: task-> "+str(params.task)+ " unknown -OR- " + response_json.error

      return response_json.model_dump()
  # If the request method is not GET, return an error or appropriate response
  return {"ERROR": "Invalid request method."}



async def getDBdata_singleCol( relationName: str, feature: str, filterBy: Optional[List[str]], filterValue: Optional[List[str]], startDate: Optional[str], endDate: Optional[str], aggregation_level: Optional[str] = None) -> tuple[object, str | None]:
  start_time = time.time()
  
  # 1. Get column names to set up filters
  query_columns = sql.SQL("SELECT column_name FROM information_schema.columns WHERE table_name = %s")
  columns = await query_raw(query_columns, (relationName,))
  column_names = [col["column_name"] for col in columns]
  
  # 2. Build safe selection list
  select_items = [sql.Identifier("id"), sql.Identifier("geometry"), sql.Identifier(feature)]
  
  if "bundesland" in column_names: select_items.append(sql.Identifier("bundesland"))
  if "latitude" in column_names: select_items.append(sql.Identifier("latitude"))
  if "longitude" in column_names: select_items.append(sql.Identifier("longitude"))
  if "subregion1_name" in column_names: select_items.append(sql.Identifier("subregion1_name"))
  if "country_name" in column_names: select_items.append(sql.Identifier("country_name"))
  
  feature_type = await get_feature_column_type(relationName, feature)

  # 3. Build WHERE clause
  conditions = []
  params = []
  
  # Equality filters
  where_sql, filter_params = conditionBuilderEquals(filterBy, filterValue)
  if where_sql:
    
     pass

  # Let's simplify: build conditions list manually
  if filterBy and filterValue and filterBy[0] != "" and filterValue[0] != "":
      for fb, fv in zip(filterBy, filterValue):
          if fv != "ALL" and fv != "" and fb != "":
              if fb == "date":
                  conditions.append(sql.SQL("EXTRACT(YEAR FROM {}) = %s").format(sql.Identifier(fb)))
                  params.append(fv)
              else:
                  conditions.append(sql.SQL("{} = %s").format(sql.Identifier(fb)))
                  params.append(fv)
  
  if feature:
      conditions.append(conditionBuilderFeatureNotEmpty(feature, feature_type, params))
      
  if startDate and endDate:
      conditions.append(conditionBuilderRange(startDate, endDate, 'date', params))

  if aggregation_level and "aggregation_level" in column_names:

      conditions.append(sql.SQL("aggregation_level = %s"))
      params.append(aggregation_level)

  # 4. Construct final query
  query = sql.SQL("SELECT {} FROM {}").format(
      sql.SQL(", ").join(select_items),
      sql.Identifier(relationName)
  )
  
  if conditions:
      query += sql.SQL(" WHERE ") + sql.SQL(" AND ").join(conditions)
      
  query += sql.SQL(" ORDER BY id")
  
  print("**query", query)
  try:
    records_raw = await query_raw(query, params)
  except Exception as e:
    print("ERROR DB QUERY", e)
    data = "ERROR DB QUERY " + str(e)
    return ("", data)

  end_time = time.time()
  print(f"Query execution time: {end_time - start_time} seconds")
  
  start_processing_time = time.time()
  records_json = []
  if len(records_raw) == 0:
     records_json = [{
            "geometry": "POLYGON ((-2.370000000000005 47.53, -2.060000000000002 47.53, -2.060000000000002 47.22, -2.370000000000005 47.22, -2.370000000000005 47.53))",
            "feature": 0,
            "latitude": 0,
            "longitude": 0
        }]
  else:
    try:
        records_json = [
            {
              "id": record["id"],
              "geometry": record["geometry"],
              "feature": record[feature],
              "bundesland": record.get("bundesland", ""),
              "latitude": record.get("latitude"),
              "longitude": record.get("longitude"),
              "subregion_name": record.get("subregion1_name", ""),
              "country_name": record.get("country_name", "")
            }
            for record in records_raw
        ]
    except Exception as e:
      print("ERROR DB QUERY-PROCESSING", e)
      data: str = "ERROR DB QUERY " + str(e)
      return ("", data)

  end_processing_time = time.time()
  print(f"Processing time: {end_processing_time - start_processing_time} seconds")
  return (records_json, None)




async def getDBdata_singleColCount( relationName, feature, filterBy, filterValue) -> tuple[object, str | None]:
  start_time = time.time()
  
  where_clause, params = conditionBuilderEquals(filterBy, filterValue)
  query = sql.SQL("SELECT {}, COUNT(*) AS count FROM {} {} GROUP BY {}").format(
      sql.Identifier(feature),
      sql.Identifier(relationName),
      where_clause if where_clause else sql.SQL(""),
      sql.Identifier(feature)
  )
  print("query", query)
 
  try:
    records_raw = await query_raw(query, params)
  except Exception as e:
    print("ERROR DB QUERY", e)
    data = "ERROR DB QUERY " + str(e)
    return ("", data)

  end_time = time.time()

  print(f"Query execution time: {end_time - start_time} seconds")
  start_processing_time = time.time()

  records_json = []
  try:
    records_json = [
        {
            "feature": record[feature],
            "count": record["count"]
        }
        for record in records_raw
    ]
  except Exception as e:
    print("ERROR DB QUERY", e)
    data = "ERROR DB QUERY " + str(e)+" does not exist"
    return ("", data)

  end_processing_time = time.time()
  print(f"Processing time: {end_processing_time - start_processing_time} seconds")
  return (records_json, None)




async def getDBdata_singleColUnique( relationName, feature) -> tuple[object, str | None]:

  result_key = feature
  if feature == "date":
    # Extract year from date if feature is 'date'
    query = sql.SQL("SELECT DISTINCT EXTRACT(YEAR FROM {}) AS year FROM {} ORDER BY year").format(
        sql.Identifier(feature),
        sql.Identifier(relationName)
    )
    result_key = "year"
  else:
    query = sql.SQL("SELECT DISTINCT {} FROM {} ORDER BY {}").format(
        sql.Identifier(feature),
        sql.Identifier(relationName),
        sql.Identifier(feature)
    )
    
  try:
    records_raw = await query_raw(query)
  except Exception as e:
        print("ERROR DB QUERY", e)
        data = "ERROR DB QUERY " + str(e)
        return ("", data)

  records_json = []
  try:
      records_json = [
          {
            "feature": record[result_key]
          }
          for record in records_raw
      ]
  except Exception as e:
    print("ERROR DB QUERY", e)
    data = "ERROR DB QUERY " + str(e)+" does not exist"
    return ("", data)

  return (records_json, None)


async def getDBdata_singleColMinMax(relationName, feature) -> tuple[object, str | None]:
  query = sql.SQL("SELECT MIN({}) AS min_val, MAX({}) AS max_val FROM {}").format(
      sql.Identifier(feature),
      sql.Identifier(feature),
      sql.Identifier(relationName)
  )
  try:
    records_raw = await query_raw(query)
    if records_raw and len(records_raw) > 0:
        return (records_raw[0], None)
    return (None, "No data found")
  except Exception as e:
    print("ERROR DB QUERY", e)
    return (None, str(e))


async def getDBdata_HEADER(relationName):
  query = sql.SQL("SELECT * FROM {} LIMIT 1").format(sql.Identifier(relationName))
  first_record = await query_raw(query)
  return first_record




async def getDBdata_multiCol( relationName: str, feature: str, filterBy: Optional[List[str]], filterValue: Optional[List[str]], startDate: Optional[str], endDate: Optional[str], aggregation_level: Optional[str]= None) -> tuple[object, str | None]:

  start_time = time.time()
  query_columns_query = sql.SQL("SELECT column_name FROM information_schema.columns WHERE table_name = %s")
  columns = await query_raw(query_columns_query, (relationName,))
  column_names = [col["column_name"] for col in columns]

  records_rawStore = []
  featureExists = True
  i = 0
  while(featureExists):
    i += 1
    tmpFeature = feature + str(i)
    if tmpFeature not in column_names:
      featureExists = False
      print("feature_", tmpFeature, "does not exist")
      break
      
    print("feature_", tmpFeature)
    feature_type = await get_feature_column_type(relationName, tmpFeature)
    
    # Selection list
    select_items = [sql.Identifier("geometry"), sql.Identifier(tmpFeature)]
    if "bundesland" in column_names: select_items.append(sql.Identifier("bundesland"))
    if "latitude" in column_names: select_items.append(sql.Identifier("latitude"))
    if "longitude" in column_names: select_items.append(sql.Identifier("longitude"))
    if "subregion1_name" in column_names: select_items.append(sql.Identifier("subregion1_name"))

    # Build conditions
    conditions = []
    params = []
    
    if filterBy and filterValue and filterBy[0] != "" and filterValue[0] != "":
      for fb, fv in zip(filterBy, filterValue):
          if fv != "ALL" and fv != "" and fb != "":
              if fb == "date":
                  conditions.append(sql.SQL("EXTRACT(YEAR FROM {}) = %s").format(sql.Identifier(fb)))
                  params.append(fv)
              else:
                  conditions.append(sql.SQL("{} = %s").format(sql.Identifier(fb)))
                  params.append(fv)
    
    conditions.append(conditionBuilderFeatureNotEmpty(tmpFeature, feature_type, params))
    
    if startDate and endDate:
      conditions.append(conditionBuilderRange(startDate, endDate, 'date', params))
      
    if aggregation_level and "aggregation_level" in column_names:

      conditions.append(sql.SQL("aggregation_level = %s"))
      params.append(aggregation_level)

    # Build and run query
    query = sql.SQL("SELECT {} FROM {}").format(
        sql.SQL(", ").join(select_items),
        sql.Identifier(relationName)
    )
    if conditions:
        query += sql.SQL(" WHERE ") + sql.SQL(" AND ").join(conditions)
    query += sql.SQL(" ORDER BY id")
    
    print("**query", query)
    try:
      records_raw = await query_raw(query, params)
      records_rawStore.append(records_raw)
    except Exception as e:
      print("ERROR DB QUERY-", e)
      data = "ERROR DB QUERY " + str(e)
      return ("", data)

  end_time = time.time()
  print(f"Query execution time: {end_time - start_time} seconds")
  
  start_processing_time = time.time()
  records_json = {}
  if len(records_rawStore) == 0:
    records_json["geometry"] = ['POLYGON ((-2.370000000000005 47.53, -2.060000000000002 47.53, -2.060000000000002 47.22, -2.370000000000005 47.22, -2.370000000000005 47.53))']
    records_json["features"] = []
    return (records_json, None)

  records_json["geometry"] = [record["geometry"] for record in records_rawStore[0]]
  records_json["features"] = []
  
  for i, records_raw in enumerate(records_rawStore):
    num = i + 1
    tmpFeatureName = feature + str(num)
    try:
        feature_values = [record[tmpFeatureName] for record in records_raw]
        records_json["features"].append(feature_values)
    except Exception as e:
      print("ERROR DB QUERY JSON CREATION", e)
      data = "ERROR DB QUERY JSON CREATION " + str(e)
      return ("", data)

  end_processing_time = time.time()
  print(f"Processing time: {end_processing_time - start_processing_time} seconds")
  return (records_json, None)



async def getDBdata_allCols(relationName) -> tuple[object, str | None]:
  start_time = time.time()
  
  query = sql.SQL("SELECT * FROM {}").format(sql.Identifier(relationName))
  records_raw  = None
  print("query", query)
  try:
    records_raw = await query_raw(query)
  except Exception as e:
        print("ERROR DB QUERY-", e)
        data = "ERROR DB QUERY " + str(e)
        return ("", data)
  print("records_raw", len(records_raw))
  

  end_time = time.time()

########################################################
  print(f"Query execution time: {end_time - start_time} seconds")
  start_processing_time = time.time()

  records_json = {}
  records_json = [dict(record) for record in records_raw]
  print("records_json", len(records_json))


  end_processing_time = time.time()
  print(f"Processing time: {end_processing_time - start_processing_time} seconds")
  return (records_json, None)




def consumeARGSvalues(argsValues) -> list[str]:
  if argsValues is None:
    return [""]
  print("consumeARGSvalues", argsValues)
  consumedValues: list[str] = []
  tmpSplit = re.split(r'\',\s*\'', argsValues)

  if len(tmpSplit) == 0 or argsValues == "":
     consumedValues.append("")
     return consumedValues
  for value in tmpSplit:
    consumedValues.append(value.replace("'", ""))
  return consumedValues

def conditionBuilderEquals(filterBy: List[str], filterValue: List[str]) -> tuple[Optional[sql.Composed], Optional[list]]:
   if isinstance(filterBy, list) and isinstance(filterValue, list):
      if len(filterBy) != len(filterValue):
        return None, None
      if filterBy[0] == "" or filterValue[0] == "":
        return None, None
      
      conditions = []
      params = []
      for fb, fv in zip(filterBy, filterValue):
        if fv != "ALL" and fv != "" and fb != "":
          if fb == "date":
            # Extract year from date if filterBy is 'date'
            conditions.append(sql.SQL("EXTRACT(YEAR FROM {}) = %s").format(sql.Identifier(fb)))
            params.append(fv)
          else:
            conditions.append(sql.SQL("{} = %s").format(sql.Identifier(fb)))
            params.append(fv)
      
      if not conditions:
        return None, None
      
      where_clause = sql.SQL(" WHERE ") + sql.SQL(" AND ").join(conditions)
      return where_clause, params
   return None, None

def conditionBuilderFeatureNotEmpty(feature: str, feature_type: str, params: list) -> sql.Composed:
  not_in_values = get_not_in_values(feature_type)
  placeholders = sql.SQL(", ").join(sql.Placeholder() * len(not_in_values))
  params.extend(not_in_values)
  
  return sql.SQL(" {} IS NOT NULL AND {} NOT IN ({})").format(
      sql.Identifier(feature),
      sql.Identifier(feature),
      placeholders
  )


def get_not_in_values(feature_type: str) -> list:
    feature_type = feature_type.lower() if feature_type else ""

    if feature_type in {"integer", "bigint", "smallint"}:
        return [-9223372036854775808]
    elif feature_type in {"decimal", "numeric", "real", "double precision"}:
        return ["nan", "NaN"]
    elif feature_type in {"varchar", "char", "text", "string"}:
        return ["NULL", "nan", "NaN"]
    elif feature_type in {"date", "timestamp", "datetime"}:
        return ["NULL"]
    elif feature_type in {"boolean", "bool"}:
        return ["false", "NULL"]
    else:
        return ["NULL"]

def conditionBuilderRange(start: str, end: str, attribute: str, params: list) -> sql.Composed:
  params.extend([start, end])
  return sql.SQL(" {} >= %s AND {} <= %s ").format(
      sql.Identifier(attribute),
      sql.Identifier(attribute)
  )


async def get_feature_column_type(relationName: str, feature: str) -> str:
  query = (
    sql.SQL("SELECT data_type FROM information_schema.columns ") +
    sql.SQL("WHERE table_name = %s AND column_name = %s")
  )
  result = await query_raw(query, (relationName, feature))
  if result and len(result) > 0:
    return result[0]["data_type"]
  return ""

