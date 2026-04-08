
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import dummyData from '../dummyData';

import {PrintDataLoadingERRORs, handleLoadDataERROR } from '../../../helpers';
import {useGetJSONData} from '../../../hooks/customFetchAndCache';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { use, useEffect, useMemo, useRef, useState } from 'react';
import { useInterfaceContext, interfaceContextI } from '@/contexts/InterfaceContext';
import { getGridCellIndex, getGridCellDims, polygonParser,getGeometryCenter } from '../maps/helpers';
import {
  metaDataT,
  alignFeature_to_Metadata,
} from '../metaDataHandler';
import { apiRoutes } from '@/app/api_routes';
import { useLocale ,useTranslations } from "next-intl";
import { Locale } from '@/i18n/routing';
import { t_richConfig, monthNames, dbDATA } from "../../../const_store";
import { LoadingSpinner } from '../maps/helpers';

/**
 * Props class for the LinechartComponent.
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
 * const props = new LinechartPorps(
 *   "COVID-19 Cases",
 *   apiRoutes.GET_DATASETS_METADATA,
 *   "de",
 *   useTranslations("covid_view_linechart")
 * );
 * <>
 *  <LinecharComponent ChartPorps={props} />
 * </>
 * ```
 */
class LinechartPorps {
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

type dbData = {
  geometry: string[];
  features: number[][];
};


type lineChartData = {
  name: string;
  feature: number;
}[];


const LinechartComponent = ({ChartPorps}: {ChartPorps: LinechartPorps}) => {

  let t = ChartPorps.translations;
  const locale = useLocale() as Locale; 


  let props = ChartPorps;
  let c = useInterfaceContext();
  
  let  isDataNotAvailable = false;
  console.log("LinechartComponent render", props.dataURL, c.curFeature, c.selectedFilter, c.selectedGridcellID);


  /********************
  * *** LOAD DATA *** *
  *********************/
  let collectDataLoadingEROORS: string[] = [];
  const params = useMemo(() => getParamsOfURL(props.dataURL), [props.dataURL]);
  const feature = useMemo(() => params['feature']?.replace(/[_*]/g, ''), [params]);
 

  const [isDataLoading, rawData] = useGetJSONData(props.dataURL);
  const [isLoading_Metadata, rawMetaData] = useGetJSONData(apiRoutes.getDatasetsMetadata({ LANGID: locale || "en" }));
  collectDataLoadingEROORS.push(handleLoadDataERROR(isDataLoading, rawData as unknown as dbDATA));
  collectDataLoadingEROORS.push(handleLoadDataERROR(isLoading_Metadata, rawMetaData as unknown as dbDATA));

  const data = rawData as unknown as dbDATA;
  const metaData = rawMetaData as unknown as metaDataT;

  const procData = useMemo(() => {
    if (data.response && data.response.features ) {
      let res =processData(data.response, c, feature + "_1", metaData);
      console.log("procData1", res);
      return res;
    } else {
      return data as unknown as lineChartData;
    }
  }, [data, c, feature, metaData, isDataLoading]);
 
  
  useEffect(() => {
    // reset month selection when feature changes
    if(c.curMonth == -1) {
     const curMonthNumber =  c.curFeature.split("_").length > 1 ? parseInt(c.curFeature.split("_")[1]) : -1;
    c.setCurMonth(curMonthNumber);
    }
    
  }, [c.curFeature]);


// Set the Y-axis domain based on the data range
const [NminY, NmaxY, ticks] = useMemo(() => {

    if(!(procData.length > 0)){
      return [0, 0, []];
    }
    const dataMin = Math.min(...procData.map((d) => d.feature));
    const dataMax = Math.max(...procData.map((d) => d.feature));
    //let [minY, maxY] = getGoodReadableRange(dataMin, dataMax);
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

// get the labels for the x and y axis
const [xLabel, yLabel] = useMemo(() => {
  if (
    isDataLoading ||
    isLoading_Metadata ||
    !metaData ||
    !feature
  ) {
    return ["Loading...", "Loading..."];
  }

  const { unit } = alignFeature_to_Metadata(1, feature + "_1", metaData);
  return ["", `${feature} [${unit}]`];
}, [isDataLoading, isLoading_Metadata, metaData, feature]);

  // set up tooltip style
  const nameMapping: Record<string, string> = {
    feature: yLabel,
  };
  if((data.response && data.response.length == 0 && data.error == undefined && c.curFeatureValue != "NA" && c.curFeatureValue != "undefined") || isDataLoading){
    isDataNotAvailable = false;
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  }else if (c.curFeatureValue == "NA" || c.curFeatureValue == "undefined" || data.error != undefined ) {
    isDataNotAvailable = true;
  }else {
    isDataNotAvailable = false;
  }

  if (props.isDummyMode) {
      return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
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
          <Line type="monotone" dataKey="pv" stroke="#8884d8" activeDot={{ r: 8 }} />
          <Line type="monotone" dataKey="uv" stroke="#82ca9d" />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div className="flex flex-col h-full w-full min-h-0"> 
      {/* Header Section */}

      <ChartHeader ErrorData={collectDataLoadingEROORS} props={ChartPorps} />
      
      {/* Chart Title */}
      {/* Chart Section dynamically filling available space */}
      <div className="flex-1 min-h-0 ">
      {isDataNotAvailable && (
        
          <div className="flex items-center justify-center h-full">
            <div className="text-red-500">No data available</div>
          </div>
          )}
           {!isDataNotAvailable && (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={procData}
            className='overflow-hidden'
            margin={{ top: 35, right: 20, bottom: 20, left: 20 }}
          >
            <Line type="monotone" dataKey="feature" stroke="#8884d8" strokeWidth={3} dot={false} />
            <CartesianGrid stroke="#ccc" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 14 }}
              label={{ value: xLabel, position: 'bottom', offset: 5, fontSize: 18 }}
              interval={0}
              angle={-45}
              textAnchor="end"/>
            <YAxis
              tick={{ fontSize: 14 }}
              label={{
                value: yLabel,
                angle: -90,
                position: "insideLeft",
                style: { textAnchor: "middle" },
                dx: -0,
                fontSize: 16
              }}
              ticks={ticks}
              tickFormatter={(tick) => tick.toLocaleString(locale, { maximumFractionDigits: 3 })}
              domain={[NminY, NmaxY]}
            />
            <Tooltip
              labelFormatter={(label: any) => String(label)}
              formatter={(value: any, name: any) => [
                `${(Math.round(Number(value) * 1000) / 1000).toLocaleString(locale, { maximumFractionDigits: 3 })}` ,
                nameMapping[String(name)] || String(name)
              ]}
            />
            {procData.length > 0 && c.curMonth > 0 && (
              <ReferenceLine
                x={procData[c.curMonth-1].name}
                stroke="#f97316"
                strokeWidth={2}
                strokeDasharray="4 4"
                label={{
                  value: procData[c.curMonth-1].feature.toLocaleString(locale, { maximumFractionDigits: 3 }),
                  position: "top",
                  fill: "#f97316",
                  fontSize: 14,
                }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}


const ChartHeader = ({ ErrorData, props }: { ErrorData: string[], props: LinechartPorps }) => {
  //const t = useTranslations("common");
  let c = useInterfaceContext();
  let debug = true;
  
  return (
    <>
    {debug ? (<PrintDataLoadingERRORs listOfERRORs={ErrorData} />): (<></>)}
    <div className="h-6">
      <div className="h-5">
        <SelectFilterElement interfacContext={c} props={props} />
      </div>
    </div>
    </>
  );
}


function processData(data: dbData, interfacContext: interfaceContextI, featureName: string, metaData: metaDataT) : lineChartData{
  
  // calcualte the average for each feature list
  let procData: lineChartData = [];
  let c = interfacContext;
  //console.log("processData", featureName, metaData);
  console.log("processData", data, c.selectedFilter, c.selectedGridcellID);

  let index = 0;
  let gridCellDims = {gridDimLat: 1, gridDimLng: 1};
  
  if(c.selectedFilter == "gridcell"){
      // calculate the average for each feature list
    //console.log("gridcell average", data);
    //console.log(c.selectedGridcellID);

    let proofCellID = c.selectedGridcellID;

    // if no gridcell is selected, take the first one
    if(proofCellID == -1){
      let polyString = data.geometry[0];
      let polygon = polygonParser(polyString);
      gridCellDims.gridDimLat == 1 && gridCellDims.gridDimLng == 1 ? gridCellDims = getGridCellDims(polygon) : gridCellDims;
      let centerPoint = getGeometryCenter(polygon);
      let gridCellIndex = getGridCellIndex({lat: centerPoint[0], lng: centerPoint[1]}, {lat: gridCellDims.gridDimLat, lng: gridCellDims.gridDimLng});
      proofCellID = gridCellIndex;
    }
  

    
    for (let i = 0; i < data.geometry.length; i++) {

      let polyString = data.geometry[i];
      let polygon = polygonParser(polyString);
      gridCellDims.gridDimLat == 1 && gridCellDims.gridDimLng == 1 ? gridCellDims = getGridCellDims(polygon) : gridCellDims;
      let centerPoint = getGeometryCenter(polygon);
      let gridCellIndex = getGridCellIndex({lat: centerPoint[0], lng: centerPoint[1]}, {lat: gridCellDims.gridDimLat, lng: gridCellDims.gridDimLng});

      if (gridCellIndex == proofCellID) {
        index = i;
        console.log("data.features", data.features, i);
        break;
      }
      index =  -1;
    }
    if (index == -1) {
      return []; // If no matching grid cell is found, return an empty array
    }
    // j is for example month (1-12) (e.g. feature_1, feature_2, ...)
    // values for one singe grid cell
    for (let j = 0; j < data.features.length; j++) {
      const {value, unit} = alignFeature_to_Metadata(data.features[j][index], featureName, metaData, true)
      procData.push({ name: monthNames[j], feature: value });
    }
  }
  else {
    // calculate the average for each feature list (the entir country)
    for (let i = 0; i < data.features.length; i++) {
      const average = data.features[i].reduce((sum, value) => sum + value, 0) / data.features[i].length;
      const {value, unit} = alignFeature_to_Metadata(average, featureName, metaData, true)
      procData.push({name: monthNames[i], feature: value });
    }
  }
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





const SelectFilterElement = ({ interfacContext, props }: { interfacContext: interfaceContextI, props: LinechartPorps }) => {
   let c = interfacContext;
   const locale = useLocale();
   const t = props.translations;
   const t_common = useTranslations("component_linechart.dropdown");
    let FilterOptions: Record<string, string> = { 
      "test1": "test1",
      "test2": "test2"
    };
   
    

if (typeof t.rich === "function") {
  FilterOptions = {
    [String(t.rich('dropdown.grid_cell', { ...t_richConfig }))]: "gridcell",
    [String(t.rich('dropdown.country_average', { ...t_richConfig }))]: "country",
  };
}
useEffect(() => {
  if(c.selectedFilter == ""){
    c.setSelectedFilter(FilterOptions[Object.keys(FilterOptions)[0]]);
  }
}, [c.selectedFilter, FilterOptions]);

    return (
      <>
      <div className='h-4 mt-1'>
        <div className="flex items-center space-x-2">
          <p className="text-sm  ml-19 font-medium text-gray-500 w-72">
            {String(t_common.rich('select_filter', { ...t_richConfig }))}:
          </p>
          <Select
            value={c.selectedFilter}
            onValueChange={(value) => {
              c.setSelectedFilter(value);
            }}
          >
            <SelectTrigger className="w-full mr-5 whitespace-normal wrap-break-word">
              <SelectValue placeholder={Object.keys(FilterOptions)[0]} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel></SelectLabel>
                {Object.keys(FilterOptions).map((key: string, index: number) => (
                  <SelectItem key={key} value={FilterOptions[key]}>
                    {key}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
              </div>
            </>
          );
}





export default LinechartComponent;
export { LinechartPorps };
