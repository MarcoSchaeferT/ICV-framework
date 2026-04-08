
import { BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Bar, Legend, Rectangle } from 'recharts';
import dummyData from '../dummyData';

import {PrintDataLoadingERRORs, handleLoadDataERROR } from '../../../helpers';
import {useGetJSONData} from '../../../hooks/customFetchAndCache';
import { use, useEffect, useMemo, useRef, useState } from 'react';
import { useInterfaceContext, interfaceContextI } from '../../contexts/InterfaceContext';
import {
  metaDataT,
  alignFeature_to_Metadata,
} from '../metaDataHandler';
import { apiRoutes } from '@/app/api_routes';
import { LoadingSpinner } from '../maps/helpers';
import  CovidDataStates from "../../dataTableClasses/CovidDataStates";
import { t_richConfig, dbDATA } from '@/app/const_store';
import { getGoodReadableRange } from '../maps/helpers';

/**
 * Props class for the BarchartComponent
 * 
 * @remarks
 * This class encapsulates all the properties required to render a bar chart using the BarchartComponent.
 * It includes configuration for the chart name, data source URL, localization, translations.
 * 
 * @property chartName - The name of the chart to be displayed.
 * @property dataURL - The URL from which to fetch the chart data. Can be a string.
 * @property locale - The locale to use for translations and formatting (e.g., "en", "de"). Defaults to "en".
 * @property translations - An object containing translation strings or functions, typically created using a translation hook. e.g.: useTranslations("covid_view_barchart")
 * @property isDummyMode - for demonstration purposes: loads dummy data for the chart if set to true.
 * 
 * @example
 * ```
 * const props = new BarchartPorps(
 *   "COVID-19 Cases",
 *   apiRoutes.GET_DATASETS_METADATA,
 *   "de",
 *   useTranslations("covid_view_barchart")
 * );
 * <>
 *  <BarchartComponent ChartPorps={props} />
 * </>
 * ```
 */
class BarchartPorps {
    chartName: string
    dataURL: string; // or you can use a more specific type like GeoJSON.FeatureCollection if you have the type definitions
    locale?: string; // default locale is "en" (e.g. "de", etc.)
    translations?: any // translations object (created e.g.: useTranslations("covid_view_barchart"))
    isDummyMode?: boolean;

    constructor(chartName: string, dataURL: string, locale?: string, translations?: any, isDummyMode?: boolean) {
        this.chartName = chartName;
        this.dataURL = dataURL || "";
        this.locale = locale || "en";
        this.translations = translations || {};
        this.isDummyMode = isDummyMode || false;
    }
}

type Data = {
  geometry: string[];
  features: number[][];
  bundesland?: string[];
};


interface dbDat extends dbDATA {
  response: Data;
}


type barChartData = {
  name: string;
  feature: number[];
  bundesland?: string;
}[];


const BarchartComponent = ({ChartPorps}: {ChartPorps: BarchartPorps}) => {

  
  let props = ChartPorps;
  let contextT = useInterfaceContext();
  let t = ChartPorps.translations;
  let locale = ChartPorps.locale;
  
  const isDataNotAvailable = useRef(false);
  const selectedBarId = useRef<number>(-1);
  const [isSorting, setIsSorting] = useState(false);
  const [isUpdated, setIsUpdated] = useState(false);


  /********************
  * *** LOAD DATA *** *
  *********************/
  let collectDataLoadingEROORS: string[] = [];
  const params = useMemo(() => getParamsOfURL(props.dataURL), [props.dataURL]);
  const feature = useMemo(() => params['feature']?.replace(/[_*]/g, ''), [params]);
 

  const [isDataLoading, rawData] = useGetJSONData(props.dataURL);
  const [isLoading_Metadata, rawMetaData] = useGetJSONData(apiRoutes.getDatasetsMetadata({ LANGID: locale || "en" }));

  collectDataLoadingEROORS.push(handleLoadDataERROR(isDataLoading, rawData as unknown as dbDat));
  collectDataLoadingEROORS.push(handleLoadDataERROR(isLoading_Metadata, rawMetaData as unknown as dbDat));

  const data = rawData as unknown as dbDat;
  const metaData = rawMetaData as unknown as metaDataT;

  const data_unsorted_per_feature = useRef({
    persistentData: null as barChartData | null,
    currentFeature: "",
    get: function () {
      return this.persistentData;
    },
    set: function (newData: barChartData | null) {
      this.persistentData = newData;
    },
    getFeatureName: function () {
      return this.currentFeature;
    },
    setFeatureName: function (featureName: string) {
      this.currentFeature = featureName;
    },
  });

  let procData = useMemo(() => {
    selectedBarId.current = -1; // Reset selected bar when sorting is toggled

    if (data.response && data.response.features) {
      let processed = processData(data, contextT, feature + "_1", metaData);
      if (isSorting) {
        return processed.sort((a, b) => Number(b.feature) - Number(a.feature));
      } else {
        return processed;
      }
    } else {

      let feature_condition = !data_unsorted_per_feature.current?.get() && feature !== ""  && feature !== data_unsorted_per_feature.current?.getFeatureName();
      let unsorted_data_length = data_unsorted_per_feature.current?.get()?.length || 0; 

      // this condition should be true only if the data has changed, order of the data is not important
      let data_change_condition = data_unsorted_per_feature !== null && data_unsorted_per_feature.current?.get() !==null  && data.response !== null && isDictSortedDesc(data.response)===false && (data.response as unknown as barChartData).length > 0 && unsorted_data_length > 0  && areDictsEqual(data.response, data_unsorted_per_feature.current?.get()) === false;

      data_unsorted_per_feature.current?.getFeatureName() !== ""
      if (!isDataLoading && !isLoading_Metadata && 
        (feature_condition || data_change_condition)) {

        data_unsorted_per_feature.current?.set(data.response as unknown as barChartData);
        data_unsorted_per_feature.current?.setFeatureName(feature);      } 

      if (isSorting) {
          return [...(data.response as unknown as barChartData)].sort((a, b) => Number(b.feature) - Number(a.feature));
      } else {
        const unsortedData = data_unsorted_per_feature.current?.get();
        if (Array.isArray(unsortedData)) {
          return unsortedData as unknown as barChartData;
        } else {
          return [];
        }
      }
    }
  }, [data, contextT, feature, metaData, isSorting, data_unsorted_per_feature, isDataLoading, isLoading_Metadata]);

  try {
    procData = procData;
  } catch (error) {
    console.log("Error slicing procData:", error);
  }


  useEffect(() => {
    let barID = CovidDataStates.mapperFunctions.mapper__MapTable__ID_to_ID(contextT.selectedStateID);

    if(isSorting === false){
      console.log("selectedStateID", contextT.selectedStateID, " barID", barID);
       selectedBarId.current = (barID-1);
      }
    else {
      const selectedState = CovidDataStates.mapperFunctions.mapper__MapTable__ID_to_State(contextT.selectedStateID);
      const idx = procData.findIndex((bar) => bar.bundesland === selectedState);
       selectedBarId.current =(idx >= 0 ? idx : -1);
    }
  }, [contextT.selectedStateID, isSorting, procData]);

  useEffect(() => {
      setIsUpdated(prev => !prev);
  }, [contextT.selectedStateID]);

  
console.log("procData", procData);
// Set the Y-axis domain based on the data range
const [NminY, NmaxY, ticks] = useMemo(() => {

    if(!(procData.length > 0)){
      return [0, 0, []];
    }
    let dataMin=0, dataMax = 0;
    let federal_state: string = "";
    try {
      dataMin = Math.min(...procData.map((d) => d.feature[0]));
      dataMax = Math.max(...procData.map((d) => d.feature[0]));
    } catch (error) {
      //console.error("Error calculating min/max:", error);
    }

    try {
      dataMin = Math.min(...procData.map((d) => Number(d.feature)));
      dataMax = Math.max(...procData.map((d) => Number(d.feature)));
      [dataMin, dataMax] = getGoodReadableRange(dataMin, dataMax);
    }
    catch (error) {
      //console.error("Error calculating min/max:", error);
    } 
    console.log("dataMin", ...procData.map((d) => Number(d.feature)), "dataMax", dataMax);

    let minY = Math.floor(dataMin ) ;
    let maxY = Math.ceil(dataMax )  ;
    const ticks = [];
    const range = maxY - minY;
    const stepCount = 4; // Number of steps for the Y-axis
    const step = range / stepCount;
      // Generate ticks for the Y-axis
    for (let val = minY; val <=maxY; val += step) {
      ticks.push(val); // avoid float imprecision
    }
    const NminY = Math.min(...ticks);
    const NmaxY = Math.max(...ticks);

    return [NminY, NmaxY, ticks];
}, [procData]);

let lenTickLabels = (NmaxY.toString().length+2)*6;

// get the labels for the x and y axis
let [xLabel, yLabel] = useMemo(() => {
  if (
    isDataLoading || 
    isLoading_Metadata || 
    !metaData || 
    !feature
  ) {
    return ["Loading...", "Loading..."];
  }else {
   return [t.rich('federal_state', {...t_richConfig}), feature];
  }

}, [isDataLoading, isLoading_Metadata, metaData, feature, t]);

  // set up tooltip style
  const nameMapping: Record<string, string> = {
    feature: yLabel
  };

  


  if (ChartPorps.isDummyMode) {
    return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            width={500}
            height={300}
            data={dummyData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="pv" fill="#8884d8" shape={<Rectangle fill="pink" stroke="blue" />} />
            <Bar dataKey="uv" fill="#82ca9d" shape={<Rectangle fill="gold" stroke="purple" />} />
          </BarChart>
        </ResponsiveContainer>
      );
  }

    if(procData.length == 0 && collectDataLoadingEROORS.some((error) => error == undefined) && contextT.curFeatureValue != "NA" && contextT.curFeatureValue != "undefined"){
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
         <ChartHeader ErrorData={collectDataLoadingEROORS} />
      </div>
    );
  }else if (contextT.curFeatureValue == "NA" || contextT.curFeatureValue == "undefined" || collectDataLoadingEROORS.some((error) => error !== undefined)) {
    isDataNotAvailable.current = true;
  }else {
    isDataNotAvailable.current = false;
  }

  return (
    <div className="flex flex-col h-full w-full min-h-0"> 
      <div className="flex items-center mt-1 ml-8">
        <button
          className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 text-sm"
          style={{ width: '70px'}}
          onClick={() => {
        setIsSorting((prev) => !prev);
         selectedBarId.current =(-1); // Reset selected bar when sorting is toggled
        }}
        >
          Sort
          <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="w-4 h-4 mr-1 ml-1 mb-1"
          style={{ display: 'inline' }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 10h18M3 14h12M3 18h6"
          />
        </svg>
        </button>
        
      </div>
      {/* Chart Section dynamically filling available space */}
      <div className="flex-1 min-h-0">
         <ChartHeader ErrorData={collectDataLoadingEROORS} />
      {isDataNotAvailable.current && (
          <div className="flex items-center justify-center h-full">
            <div className="text-red-500">No data available</div>
          </div>
          )}
          {!isDataNotAvailable.current && (
            <>
          <ResponsiveContainer>
          <BarChart
          data={procData}
          margin={{ top: 25, right: 20, bottom: 30, left: lenTickLabels }}
          >
          <CartesianGrid stroke="#ccc" />
          <XAxis
           dataKey="bundesland"
            tick={{ fontSize: 15 }}
            label={{ value: xLabel, position: 'bottom', offset: 5, fontSize: 18 }}
            interval={0}
            textAnchor="middle"
            ticks={Array.from({ length: Array.isArray(procData) ? procData.length : 14 }, (_, i) => 
              {
                return (procData[i]?.bundesland !== undefined && procData[i]?.bundesland !== null) ?
                  procData[i]?.bundesland ?? ""
                  : i+1;
              }
            )}
            tickFormatter={(tick) => String(CovidDataStates.mapperFunctions.Table__State_to_ID(tick))}
            />
          <YAxis
            tick={{ fontSize: 14 }}
            label={{
            value: yLabel,
            angle: -90,
            position: "insideLeft",
            style: { textAnchor: "middle" },
            dx: -(lenTickLabels-10),
            fontSize: 16
            }}
            ticks={ticks}
            tickFormatter={(tick) => tick.toLocaleString(locale, { maximumFractionDigits: 3 })}
            domain={[NminY, NmaxY]}
          />
          <Tooltip
            labelFormatter={(label: any) => {  
              return (
                <span style={{ backgroundColor: "white" }}>
                </span>
              );
            }}
            formatter={(value, name) => {
          
              if (name === "bundesland") {
                  return [
                    `${String(value)}`
                  ]
              }
              
              return [
              `${(Math.round(Number(value) * 1000) / 1000).toLocaleString(locale, { maximumFractionDigits: 3 })}`,
              nameMapping[String(name)] || String(name)
            ]}}

          />
         <Bar 
          dataKey="feature"
          onClick={(data: any, index: number) => {
            const payload = data && (data.payload ?? data);
            let mapID = null;
            if (isSorting === false) {
              mapID = CovidDataStates.mapperFunctions.mapper__TableMap__ID_to_ID(index+1);
            }
            else {
              const stateName = payload?.bundesland;
              mapID = CovidDataStates.mapperFunctions.mapper__TableMap__ID_to_ID(CovidDataStates.mapperFunctions.mapper__MapTable__State_to_ID(stateName));
            }
            console.log("mapID", mapID, index);
            contextT.setSelectedStateID(mapID)
            contextT.setMapSelectionObj
          }}
          shape={(props: any) => {
            const { x, y, width, height, fill } = props;
            return (
            <g>
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={selectedBarId.current === props.index ? "#ffc46c" : "grey"}
                stroke={selectedBarId.current === props.index ? "#ffc46c" : "grey"}
                strokeWidth={selectedBarId.current === props.index ? 2 : 0}
              />
              {/* Add a transparent rectangle to extend clickable hotmox */}
              <rect
                x={x}
                y={0}
                width={width}
                height={NmaxY}
                fill={"#6cffa4"}
                opacity={0.0}
              />
            </g>

            );
            }}
          />
          </BarChart>
        </ResponsiveContainer>
        </>
      )}
      </div>
    </div>
  );
}


const ChartHeader = ({ ErrorData }: { ErrorData: string[] }) => {
  //const t = useTranslations("common");
  let c = useInterfaceContext();
  let debug = true;
  
  return (
    <>
    {debug ? (<PrintDataLoadingERRORs listOfERRORs={ErrorData} />): (<></>)}
    </>
  );
}

function processData(data: dbDat, interfacContext: interfaceContextI, featureName: string, metaData: metaDataT) : barChartData{

  let procData: barChartData = [];
  procData = data.response.features.map(feature => ({ name: "", feature }));

  return procData;
}

function getParamsOfURL(url: string) {
  const urlParams = new URLSearchParams(url.split('?')[1]);
  const paramsDict: { [key: string]: string } = {};
  urlParams.forEach((value, key) => {
    paramsDict[key] = value;
  });
  return paramsDict;
}


function areDictsEqual(dict1: any, dict2: any): boolean {
  /**
 * Compares two dictionaries to determine if they are equal based on the `feature` property
 * of their values. The function assumes that the values of the dictionaries are objects containing
 * a `feature` property of type `number`.
 * **/

  const values1 = Object.values(dict1).map((x) => (x as { feature: number }).feature);
  const values2 = Object.values(dict2).map((x) => (x as { feature: number }).feature);

  if (values1.length !== values2.length) {
    return false;
  }

  for (let i = 0; i < values1.length; i++) {
    if (values1[i] !== values2[i]) {
      return false;
    }
  }

  return true;
}

function isDictSortedDesc(dict: any) {
  if (!dict || typeof dict !== 'object' || Object.keys(dict).length === 0) {
    return true; // Empty or non-object dictionaries are considered sorted
  }
/**
 * Checks if the values of a dictionary are sorted in descending order based on the `feature` property.
 */
  const keys = Object.values(dict).map(x => (x as { feature: number }).feature);
  for (let i = 0; i < keys.length - 1; i++) {
    if (keys[i] < keys[i + 1]) {
      return false;
    }
  }
  return true;
}

export default BarchartComponent;
export { BarchartPorps };
