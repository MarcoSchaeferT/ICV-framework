from flask import request, jsonify, Blueprint
from backend.routes.setFilesToDB.db_utils import query_raw
import time
from math import ceil
from pydantic import BaseModel, ValidationError
from typing import Optional, List, Union
from flasgger import swag_from
import re
import json as JSON
from psycopg import errors as psycopg_errors

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
  query_columns = f"SELECT column_name FROM information_schema.columns WHERE table_name = '{relationName}'"
  columns = await query_raw(query_columns)
  column_names = [col["column_name"] for col in columns]
  bundesland_filter = "bundesland, " if "bundesland" in column_names else ""
  latitude_filter = ", latitude" if "latitude" in column_names else ""  
  longitude_filter = ", longitude " if "longitude" in column_names else ""
  subregion_name = ", subregion1_name " if "subregion1_name" in column_names else ""
  country_name = ", country_name " if "country_name" in column_names else ""
  feature_type = await get_feature_column_type(relationName, feature)


  query = f"SELECT id, {bundesland_filter} geometry, {feature} {latitude_filter} {longitude_filter} {subregion_name} {country_name} FROM {relationName}"
  if filterBy and filterValue:
    where_clause = conditionBuilderEquals(filterBy, filterValue)
    query = f"SELECT id, {bundesland_filter} geometry, {feature} {latitude_filter} {longitude_filter} {subregion_name} {country_name} FROM {relationName} {where_clause}"
    print("queryWHERE", query)
    if feature:
      query += f"{conditionBuilderFeatureNotEmpty(feature, query, feature_type)}"
    if startDate and endDate:
      query += f"{conditionBuilderRange(startDate, endDate, 'date', query)}"
    if aggregation_level and "aggregation_level" in column_names:
      start_keyword = " WHERE " if "WHERE" not in query else " AND "
      query += f" {start_keyword} aggregation_level = '{aggregation_level}'"
    query += " ORDER BY id"
    print("**query", query)
  try:
    records_raw = await query_raw(query)
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
              "feature": record[str(feature)],
              "bundesland": record["bundesland"] if bundesland_filter != "" else "",
              "latitude": record["latitude"] if "latitude" in record else None,
              "longitude": record["longitude"] if "longitude" in record else None,
              "subregion_name": record["subregion1_name"] if "subregion1_name" in record else "",
              "country_name": record["country_name"] if "country_name" in record else ""
            }
            for record in records_raw
        ]
    except Exception as e:
      print("ERROR DB QUERY", e)
      data: str = "ERROR DB QUERY " + str(e)+" does not exist"
      return ("", data)

  end_processing_time = time.time()
  print(f"Processing time: {end_processing_time - start_processing_time} seconds")
  return (records_json, None)



async def getDBdata_singleColCount( relationName, feature, filterBy, filterValue) -> tuple[object, str | None]:
  start_time = time.time()
  
  where_clause = conditionBuilderEquals(filterBy, filterValue)
  query = f"SELECT {feature}, COUNT(*) AS {feature}_count FROM {relationName} {where_clause} GROUP BY {feature}"
  print("query", query)
 
  try:
    records_raw = await query_raw(query)
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
            "count": record[feature + "_count"]
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

  query = f"SELECT DISTINCT {feature} FROM {relationName} ORDER BY {feature}"
  result_key = feature
  if feature == "date":
    # Extract year from date if filterBy is 'date'
    query = f"SELECT DISTINCT EXTRACT(YEAR FROM {feature}) AS year FROM {relationName} ORDER BY year"
    result_key = "year"
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

async def getDBdata_HEADER(relationName):
  query = f"SELECT * FROM {relationName} LIMIT 1"
  first_record = await query_raw(query)
  return first_record



async def getDBdata_multiCol( relationName: str, feature: str, filterBy: Optional[List[str]], filterValue: Optional[List[str]], startDate: Optional[str], endDate: Optional[str], aggregation_level: Optional[str]= None) -> tuple[object, str | None]:

  start_time = time.time()
  query_columns = f"SELECT column_name FROM information_schema.columns WHERE table_name = '{relationName}'"
  columns = await query_raw(query_columns)
  column_names = [col["column_name"] for col in columns]
  bundesland_filter = "bundesland, " if "bundesland" in column_names else ""
  latitude_filter = ", latitude" if "latitude" in column_names else ""  
  longitude_filter = ", longitude " if "longitude" in column_names else ""
  subregion_name = ", subregion1_name " if "subregion1_name" in column_names else ""


  records_rawStore = []
  featureExists = True
  i = 0
  records_raw = []  
  while(featureExists):
    i += 1
    tmpFeature = feature + str(i)
    feature_type = await get_feature_column_type(relationName, tmpFeature)
    print("***tmpFeature", tmpFeature)
    query = f"SELECT * FROM {relationName} LIMIT 1"
    first_record = []
    try:
      first_record = await query_raw(query)
    except Exception as e:
      featureExists = False
    if not first_record or tmpFeature not in first_record[0].keys():
      featureExists = False
      print("feature_", tmpFeature, "does not exist")
    else:
      print("feature_", tmpFeature)
      query = f"SELECT {bundesland_filter} geometry, {tmpFeature} {latitude_filter} {longitude_filter} {subregion_name} FROM {relationName}"
      if filterBy and filterValue:
        where_clause = conditionBuilderEquals(filterBy, filterValue)
        query = f"SELECT {bundesland_filter} geometry, {tmpFeature} {latitude_filter} {longitude_filter} {subregion_name} FROM {relationName} {where_clause}"
      if tmpFeature:
        query += f"{conditionBuilderFeatureNotEmpty(tmpFeature, query, feature_type)}"
      if startDate and endDate:
        query += f"{conditionBuilderRange(startDate, endDate, 'date', query)}"
      if aggregation_level and "aggregation_level" in column_names:
        start_keyword = " WHERE " if "WHERE" not in query else " AND "
        query += f" {start_keyword} aggregation_level = '{aggregation_level}'"
      query += " ORDER BY id"
      print("**query", query)
      try:
        records_raw = await query_raw(query)
      except Exception as e:
        print("ERROR DB QUERY-", e)
        data = "ERROR DB QUERY " + str(e)
        return ("", data)
      print("records_raw", len(records_raw))
      records_rawStore.append(records_raw)

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
    i += 1
    tmpFeature = feature + str(i)
    try:
        feature_values = [record[str(tmpFeature)] for record in records_raw]
        records_json["features"].append(feature_values)
    except Exception as e:
      print("ERROR DB QUERY JSON CREATION", e)
      data = "ERROR DB QUERY JSON CREATION " + str(e) + " does not exist"
      return ("", data)

  end_processing_time = time.time()
  print(f"Processing time: {end_processing_time - start_processing_time} seconds")
  return (records_json, None)


async def getDBdata_allCols(relationName) -> tuple[object, str | None]:
  start_time = time.time()
  

  query = f"SELECT * FROM {relationName}"
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

def conditionBuilderEquals(filterBy, filterValue) -> str:
   if isinstance(filterBy, list) and isinstance(filterValue, list):
      conditions = []
      if len(filterBy) != len(filterValue):
        return "ERROR: filterBy and filterValue must have the same length"
      if filterBy[0] == "" or filterValue[0] == "":
        return ""
      for fb, fv in zip(filterBy, filterValue):
        if fv != "ALL" and fv != "" and fb != "":
          if fb == "date":
            # Extract year from date if filterBy is 'date'
            conditions.append(f"EXTRACT(YEAR FROM {fb}) = '{fv}'")
          else:
            conditions.append(f"{fb} = '{fv}'")
      where_clause = " AND ".join(conditions)
      if "=" not in where_clause:
        return ""
      return " WHERE "+ where_clause
   else:
      return ""

def conditionBuilderFeatureNotEmpty(feature, query, feature_type) -> str:
  start_keyword = " WHERE " if "WHERE" not in query else " AND "
  not_in_values = get_not_in_values(feature_type)

  return f" {start_keyword} {feature} IS NOT NULL AND {feature} NOT IN({', '.join(not_in_values)})"

def get_not_in_values(feature_type: str):
    feature_type = feature_type.lower()

    if feature_type in {"integer", "bigint", "smallint"}:
        # integer-like types
        return ["-9223372036854775808"]

    elif feature_type in {"decimal", "numeric", "real", "double precision"}:
        # floating-point or numeric types
        return ["'nan'", "'NaN'"]

    elif feature_type in {"varchar", "char", "text", "string"}:
        # textual types
        return ["'NULL'", "'nan'", "'NaN'"]

    elif feature_type in {"date", "timestamp", "datetime"}:
        # temporal types
        return ["'NULL'"]

    elif feature_type in {"boolean", "bool"}:
        # boolean types
        return ["false", "'NULL'"]

    else:
        # default fallback (unknown type)
        return ["'NULL'"]

def conditionBuilderRange(start, end, attribute, query) -> str:
  start_keyword = " WHERE " if "WHERE" not in query else " AND "
  return f" {start_keyword}{attribute} >= '{start}' AND date <= '{end}'"

async def get_feature_column_type(relationName: str, feature: str) -> str:
  query = (
    f"SELECT data_type FROM information_schema.columns "
    f"WHERE table_name = '{relationName}' AND column_name = '{feature}'"
  )
  result = await query_raw(query)
  if result and len(result) > 0:
    return result[0]["data_type"]
  return ""
