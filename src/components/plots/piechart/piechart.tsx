
"use client"
import { Pie, PieChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import dummyData from '../dummyData';

import {PrintDataLoadingErrors, handleLoadDataError } from '@/app/helpers';
import {useGetJSONData} from '@/app/hooks/useFetchAndCache';
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
import { useInterfaceContext, interfaceContextI } from '@/components/contexts/InterfaceContext';
import { getGridCellIndex, getGridCellDims, polygonParser,getGeometryCenter } from '../maps/helpers';
import {
  metaDataT,
  alignFeature_to_Metadata,
} from '../MetaDataHandler';
import { apiRoutes } from '@/app/api_routes';
import { useLocale ,useTranslations } from "next-intl";
import { Locale } from '@/i18n/routing';
import { t_richConfig, monthNames, dbDATA } from '@/app/const_store';
import { getGoodReadableRange } from '../maps/helpers';

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
 * const props = LinechartProps(
 *   "COVID-19 Cases",
 *   apiRoutes.GET_DATASETS_METADATA,
 *   "de",
 *   useTranslations("covid_view_linechart")
 * );
 * <>
 *  <PieChartComponent chartProps={props} />
 * </<>
 * ```
 */
export interface PieChartProps {
    chartName: string;
    data: { name: string; value: number; }[];
    locale?: string;
    translations?: any;
    isDummyMode?: boolean;
}

export function PieChartProps(
    chartName: string,
    data: { name: string; value: number; }[] = [],
    locale = "en",
    translations: any = {},
    isDummyMode = false
): PieChartProps {
    return {
        chartName,
        data,
        locale,
        translations,
        isDummyMode
    };
}




const PieChartComponent = ({ChartProps}: {ChartProps: PieChartProps}) => {

  let t = ChartProps.translations;


  let props = ChartProps;
  let c = useInterfaceContext();

  const isDataNotAvailable = useRef(false);
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  if (props.isDummyMode) {
      return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart width={400} height={400}>
          <Tooltip />
            <Pie data={dummyData} dataKey="uv" cx="50%" cy="50%" outerRadius={60} fill="#8884d8" />
            <Pie data={dummyData} dataKey="amt" cx="50%" cy="50%" innerRadius={70} outerRadius={90} fill="#82ca9d" label />
          </PieChart>
      </ResponsiveContainer>
    );
  }else{ // not dummy mode
    return (
      <div className="flex flex-col h-full w-full min-h-0"> 
        {/* Header Section */}

        {/* Chart Title */}
        {/* Chart Section dynamically filling available space */}
        <div className="flex-1 min-h-0 ">
        {isDataNotAvailable.current && (
            <div className="flex items-center justify-center h-full">
              <div className="text-red-500">No data available</div>
            </div>
            )}
            {!isDataNotAvailable.current && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart
            style={{ border: "none" }}
            
            >
          <Pie
            data={props.data}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius="70%"
            outerRadius="90%"
            label
          >
            {props.data.map((entry, index) => (
              <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>

              <Tooltip
                labelFormatter={(label: any) => String(label)}
                formatter={(value: any, name: any) => [
                  `${(Math.round(Number(value) * 1000) / 1000).toLocaleString("de", { maximumFractionDigits: 3 })}` ,
                  String(name)
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          )}
        </div>
      </div>
    );
  }
}





export default PieChartComponent;
