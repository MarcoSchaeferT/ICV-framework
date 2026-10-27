
import { BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Bar, Legend, Rectangle } from 'recharts';
import dummyData from '../dummyData';

import stateMappersGermany, { PrintDataLoadingErrors, handleLoadDataError } from '@/app/helpers';
import { getCovidStateMapId } from '@/app/covidStates';
import {useGetJSONData} from '@/app/hooks/useFetchAndCache';
import { useEffect, useMemo, useState } from 'react';
import { useInterfaceContext } from '@/components/contexts/InterfaceContext';
import { metaDataT } from '../MetaDataHandler';
import { apiRoutes } from '@/app/api_routes';
import { useLoadingTask, LoadingSpinnerAnimation } from '../maps/utils/loadingSpinner';
import { t_richConfig, dbDATA } from '@/app/const_store';
import { getGoodReadableRange, StandardTooltip } from '../maps/helpers';
import GenericCartesianChart from '../generic/GenericCartesianChart';

/**
 * Configuration contract for `BarchartComponent`.
 * 
 * @remarks
 * The component retrieves database data and localized metadata through `useGetJSONData`, then participates in linked
 * selection through `InterfaceContext`.
 * 
 * @example
 * ```tsx
 * import { apiRoutes, type BarchartProps } from "@/framework";
 *
 * // Replace the relation name with one available in your deployment.
 * const props: BarchartProps = {
 *   chartName: "regional-incidence-barchart",
 *   dataURL: apiRoutes.fetchDbData({
 *     relationName: "dengue_serotypes",
 *     feature: "cases",
 *   }),
 *   locale: "en",
 *   isDummyMode: false,
 * };
 * ```
 */
export interface BarchartProps {
    /** Stable chart/container identifier. */
    chartName: string;
    /** URL produced by `apiRoutes.fetchDbData`. */
    dataURL: string;
    /** Locale used for value and metadata formatting. @defaultValue "en" */
    locale?: string;
    /** `next-intl` translator for chart labels and tooltips. */
    translations?: any;
    /** Uses bundled demonstration data instead of the backend. @defaultValue false */
    isDummyMode?: boolean;
    /** Selects the reusable row-oriented chart adapter used by layout templates. */
    dataMode?: "linked" | "generic";
    /** Maximum number of generic dataset rows rendered before truncation. */
    rowLimit?: number | null;
}

/**
 * Creates a complete bar-chart configuration.
 *
 * @param chartName - Stable chart/container identifier.
 * @param dataURL - Encoded database API URL.
 * @param locale - Locale for labels and number formatting.
 * @param translations - `next-intl` translator for the chart namespace.
 * @param isDummyMode - Uses bundled demonstration data.
 * @param dataMode - `linked` uses the Vis. Interface selection; `generic` uses the shared dataset chart.
 * @param rowLimit - Optional maximum rows for generic mode.
 * @returns Configuration accepted by `BarchartComponent`.
 */
export function BarchartProps(
    chartName: string,
    dataURL = "",
    locale = "en",
    translations: any = {},
    isDummyMode = false,
    dataMode: "linked" | "generic" = "linked",
    rowLimit?: number | null,
): BarchartProps {
    return {
        chartName,
        dataURL,
        locale,
        translations,
        isDummyMode,
        dataMode,
        rowLimit,
    };
}

/**
 * Array-oriented database payload consumed by the state bar-chart adapter.
 *
 * @example
 * ```ts
 * const stateCounts: Data = {
 *   geometry: ["Berlin", "Brandenburg"],
 *   features: [[120], [96]],
 *   bundesland: ["Berlin", "Brandenburg"],
 * };
 * ```
 */
type Data = {
  /** Source geometry or region identifiers in response order. */
  geometry: string[];
  /** Feature value arrays aligned with `geometry`. */
  features: number[][];
  /** Optional federal-state names aligned with the response rows. */
  bundesland?: string[];
};


/**
 * Standard database wrapper narrowed to the bar-chart payload.
 *
 * @example
 * ```ts
 * const cases: dbDat = {
 *   relationName: "aktuell_deutschland_sarscov2_infektionen_aggregated",
 *   header: ["bundesland", "accucases"],
 *   response: { geometry: ["Berlin"], features: [[120]], bundesland: ["Berlin"] },
 *   error: "",
 * };
 * ```
 */
interface dbDat extends dbDATA {
  /** Array-oriented state records consumed by the bar-chart adapter. */
  response: Data;
}


/**
 * Recharts-ready state/category records derived from backend arrays.
 *
 * @example
 * ```ts
 * const casesByState: barChartData = [
 *   { name: "Berlin", feature: [120], bundesland: "Berlin" },
 *   { name: "Brandenburg", feature: [96], bundesland: "Brandenburg" },
 * ];
 * ```
 */
type barChartData = {
  name: string;
  feature: number[];
  bundesland?: string;
}[];


/**
 * Custom tooltip component for Barchart using shared StandardTooltip
 */
const CustomBarchartTooltip = ({ active, payload, label, locale, yLabel, featureDescription, t }: any) => {
  if (!active || !payload || !payload.length) return null;

  const dataPoint = payload[0]?.payload || {};
  const rawVal = payload[0]?.value ?? dataPoint?.feature;
  const numVal = Number(rawVal);
  const formattedVal = !isNaN(numVal)
    ? numVal.toLocaleString(locale || "en", { maximumFractionDigits: 3 })
    : String(rawVal ?? "N/A");

  const stateName = dataPoint.bundesland || String(label || "");
  const countryLabel = t && typeof t.rich === "function" ? String(t.rich('tooltip.country', { ...t_richConfig })) : "Bundesland";
  const featureLabel = t && typeof t.rich === "function" ? String(t.rich('tooltip.feature', { ...t_richConfig })) : "Merkmal";

  const rows = [
    { label: countryLabel, value: stateName },
    { label: featureLabel, value: yLabel || "Value" }
  ];

  return (
    <StandardTooltip
      value={formattedVal}
      description={featureDescription}
      rows={rows}
    />
  );
};


/**
 * Renders the legacy bar chart synchronized with shared Vis. Interface selections.
 *
 * @param props - Bar-chart configuration including the data URL and translator.
 * @returns A responsive chart with loading, metadata, and selection feedback.
 *
 * @remarks JSON data and localized metadata are fetched through
 * `useGetJSONData`; `useLoadingTask` scopes pending work to the containing
 * Vis. Interface card. Bar selection updates linked state in `InterfaceContext`.
 */
const LinkedBarchartComponent = ({chartProps}: {chartProps: BarchartProps}) => {

  
  let props = chartProps;
  let contextT = useInterfaceContext();
  let t = chartProps.translations;
  let locale = chartProps.locale;
  
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  const [isDataLoading, rawData] = useGetJSONData(props.dataURL);
  const [isLoading_Metadata, rawMetaData] = useGetJSONData(apiRoutes.getDatasetsMetadata({ LANGID: locale || "en" }));

  const L_barchartData = useLoadingTask('Barchart Data');

  useEffect(() => {
    if (isDataLoading || isLoading_Metadata) {
      L_barchartData.start();
    } else {
      L_barchartData.stop();
    }
  }, [isDataLoading, isLoading_Metadata, L_barchartData]);

  /********************
  * *** LOAD DATA *** *
  *********************/
  let collectDataLoadingErrors: (string | undefined)[] = [];
  const params = useMemo(() => getParamsOfURL(props.dataURL), [props.dataURL]);
  const feature = useMemo(() => params['feature']?.replace(/[_*]/g, ''), [params]);

  collectDataLoadingErrors.push(handleLoadDataError(isDataLoading, rawData as unknown as dbDat));
  collectDataLoadingErrors.push(handleLoadDataError(isLoading_Metadata, rawMetaData as unknown as dbDat));

  const data = rawData as unknown as dbDat;
  const metaData = rawMetaData as unknown as metaDataT;

  const procData = useMemo(() => {
    if (data.response && data.response.features) {
      return processData(data).sort((a, b) => Number(b.feature) - Number(a.feature));
    }
    const list = Array.isArray(data?.response) ? data.response as barChartData : [];
    return [...list].sort((a, b) => Number(b.feature) - Number(a.feature));
  }, [data]);

  const selectedBarId = useMemo(() => {
    const selectedState = stateMappersGermany.Map__ID_to_State(contextT.selectedStateID);
    return procData.findIndex((bar) => bar.bundesland === selectedState);
  }, [contextT.selectedStateID, procData]);

  
console.log("procData", procData);
// Set the Y-axis domain based on the data range
const [NminY, NmaxY, ticks] = useMemo(() => {

    if(!(procData.length > 0)){
      return [0, 0, []];
    }
    let dataMin=0, dataMax = 0;
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

    let minY = Math.floor(dataMin);
    let maxY = Math.ceil(dataMax);
    if (minY === maxY) {
      if (maxY === 0) {
        maxY = 1;
      } else {
        maxY = minY + 1;
      }
    }

    const ticks = [];
    const range = maxY - minY;
    const stepCount = 4; // Number of steps for the Y-axis
    const step = range / stepCount;

    if (step <= 0) {
      return [0, 1, [0, 0.25, 0.5, 0.75, 1]];
    }

    // Generate ticks for the Y-axis
    for (let val = minY; val <= maxY + (step / 10); val += step) {
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

  const featureDescription = useMemo(() => {
    if (!metaData) return "";
    const curFeat = contextT.curFeature || feature;
    return metaData[curFeat]?.description || metaData[feature]?.description || "";
  }, [metaData, contextT.curFeature, feature]);

  


  if (chartProps.isDummyMode) {
    return (
      <div className="size-full min-h-0 flex flex-col flex-1">
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
      </div>
    );
  }

    if(procData.length == 0 && collectDataLoadingErrors.some((error) => error == undefined) && contextT.curFeatureValue != "NA" && contextT.curFeatureValue != "undefined"){
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinnerAnimation />
         <ChartHeader ErrorData={collectDataLoadingErrors} />
      </div>
    );
  }

  const isDataNotAvailable = contextT.curFeatureValue == "NA" ||
    contextT.curFeatureValue == "undefined" ||
    collectDataLoadingErrors.some((error) => error !== undefined);

  return (
    <div className="flex flex-col h-full w-full min-h-0 relative"> 
      <LoadingSpinnerAnimation />
      {/* Chart Section dynamically filling available space */}
      <div className="flex-1 min-h-0 mt-1">
         <ChartHeader ErrorData={collectDataLoadingErrors} />
      {isDataNotAvailable && (
          <div className="flex items-center justify-center h-full">
            <div className="text-red-500">No data available</div>
          </div>
          )}
          {!isDataNotAvailable && (
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
            tickFormatter={(tick) => stateMappersGermany.Table__State_to_Abbr(tick)}
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
            content={<CustomBarchartTooltip locale={locale} yLabel={yLabel} featureDescription={featureDescription} t={t} />}
            cursor={{ fill: "rgba(255, 255, 255, 0.08)" }}
          />
         <Bar 
          dataKey="feature"
          onMouseEnter={(_data: any, index: number) => {
            setHoveredBarIndex(index);
          }}
          onMouseLeave={() => {
            setHoveredBarIndex(null);
          }}
          onClick={(data: any, index: number) => {
            const payload = data && (data.payload ?? data);
            const mapID = getCovidStateMapId(payload ?? {});
            console.log("mapID", mapID, index);
            if (mapID !== -1) contextT.setSelectedStateID(mapID);
          }}
          shape={(props: any) => {
            const { x, y, width, height } = props;
            const isSelected = selectedBarId === props.index;
            const isHovered = hoveredBarIndex === props.index;

            let fill = "grey";
            if (isSelected) {
              fill = "#ffc46c";
            } else if (isHovered) {
              fill = "#d1d5db";
            }

            let stroke = isSelected ? "#ffc46c" : isHovered ? "#9ca3af" : "none";
            let strokeWidth = isSelected ? 2 : isHovered ? 1.5 : 0;

            return (
            <g className="cursor-pointer">
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                style={{ transition: 'fill 0.15s ease, stroke 0.15s ease' }}
              />
              {/* Add a transparent rectangle to extend clickable hotbox */}
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


/** Shows distinct data-loading errors above a linked bar chart. */
const ChartHeader = ({ ErrorData }: { ErrorData: (string | undefined)[] }) => {
  return <PrintDataLoadingErrors listOfErrors={ErrorData} />;
}

function processData(data: dbDat): barChartData {
  return data.response.features.map(feature => ({ name: "", feature }));
}

function getParamsOfURL(url: string) {
  const urlParams = new URLSearchParams(url.split('?')[1]);
  const paramsDict: { [key: string]: string } = {};
  urlParams.forEach((value, key) => {
    paramsDict[key] = value;
  });
  return paramsDict;
}


/**
 * Chooses the generic or linked bar-chart implementation.
 *
 * @param props - Chart configuration; `dataMode` controls the implementation.
 * @returns A generic row-oriented chart or a linked Vis. Interface bar chart.
 *
 * @remarks Defaults to `dataMode = "linked"` when omitted. Generic mode reads the relation from `ChartDatasetProvider`;
 * linked mode follows `InterfaceContext` and the supplied `dataURL`.
 */
const BarchartComponent = ({ chartProps }: { chartProps: BarchartProps }) => {
  if (chartProps.dataMode === "generic") {
    return (
      <GenericCartesianChart
        chartName={chartProps.chartName}
        kind="bar"
        rowLimit={chartProps.rowLimit}
      />
    );
  }

  return <LinkedBarchartComponent chartProps={chartProps} />;
};

/** Default export supporting linked and generic categorical bar-chart modes. */
export default BarchartComponent;
