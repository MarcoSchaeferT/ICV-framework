import React, { useMemo, useEffect } from 'react';
import { Pie, PieChart, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import dummyData from '../dummyData';
import { useGetJSONData } from '@/app/hooks/useFetchAndCache';
import { useLoadingTask } from '../maps/utils/loadingSpinner';
import { useInterfaceContext } from '@/components/contexts/InterfaceContext';
import { categoricalColors2 } from '@/app/const_store';
import GenericCartesianChart from '../generic/GenericCartesianChart';

/**
 * Configuration contract for `PieChartComponent`.
 *
 * @remarks
 * The categorical pie chart presents discrete frequency or ratio distributions.
 * When `isDummyMode` is `true`, it renders demonstration data with built-in color maps and tooltips.
 * When `dataURL` is specified and `isDummyMode` is `false`, it queries the database through `useGetJSONData`
 * and registers task execution with `useLoadingTask` for coordinated card spinner rendering.
 *
 * @example
 * ```tsx
 * const props: PieChartProps = {
 *   chartName: "dengue-serotype-distribution",
 *   data: [
 *     { name: "DENV-1", value: 128 },
 *     { name: "DENV-2", value: 94 },
 *     { name: "DENV-3", value: 37 },
 *   ],
 *   locale: "en",
 *   isDummyMode: false,
 * };
 * ```
 */
export interface PieChartProps {
    /** Stable chart/container identifier. */
    chartName: string;
    /** Encoded backend database API URL. @default "" */
    dataURL?: string;
    /** Target feature name for data parsing. @default "" */
    feature?: string;
    /** Discrete category labels and numeric counts. @default [] */
    data?: { name: string; value: number; }[];
    /** Locale used for value formatting. @default "en" */
    locale?: string;
    /** `next-intl` translator for chart labels and tooltips. */
    translations?: any;
    /** Uses bundled demonstration data. @default false */
    isDummyMode?: boolean;
    /** Selects the reusable row-oriented chart adapter used by layout templates. */
    dataMode?: "linked" | "generic";
    /** Maximum number of generic dataset rows rendered before truncation. */
    rowLimit?: number | null;
}

/**
 * Creates a complete categorical pie-chart configuration object with defaults.
 *
 * @param chartName - Stable chart/container identifier.
 * @param data - Category labels and numeric values to visualize.
 * @param locale - Locale for number and label formatting.
 * @param translations - `next-intl` translator instance for the chart namespace.
 * @param isDummyMode - Whether to render bundled demonstration data.
 * @param dataURL - Encoded database API URL.
 * @param feature - Target feature identifier for extraction.
 * @returns Configuration object accepted by `PieChartComponent`.
 *
 * @default data []
 * @default locale "en"
 * @default translations {}
 * @default isDummyMode false
 * @default dataURL ""
 * @default feature ""
 *
 * @example
 * ```tsx
 * const chartConfig = PieChartProps(
 *   "serotype-piechart",
 *   [{ name: "DENV-1", value: 120 }, { name: "DENV-2", value: 85 }],
 *   "en",
 *   {},
 *   true
 * );
 * ```
 */
export function PieChartProps(
    chartName: string,
    data: { name: string; value: number; }[] = [],
    locale = "en",
    translations: any = {},
    isDummyMode = false,
    dataURL = "",
    feature = "",
    dataMode: "linked" | "generic" = "linked",
    rowLimit?: number | null,
): PieChartProps {
    return {
        chartName,
        data,
        locale,
        translations,
        isDummyMode,
        dataURL,
        feature,
        dataMode,
        rowLimit,
    };
}

/** Categorical palette imported from const_store for slice styling. */
const COLORS = categoricalColors2 && categoricalColors2.length > 0 ? categoricalColors2 : ['#4ecdc4', '#a8b8e8', '#5ac800', '#e040fb', '#40c4ff', '#7c4dff', '#ff80ab'];


/**
 * Categorical pie-chart visual component built with Recharts and responsive containers.
 *
 * @param props - Configuration properties containing dataset URLs, static records, or dummy mode flags.
 * @returns Responsive SVG pie chart element synchronized with dashboard loading tasks.
 *
 * @remarks
 * In accordance with ICV architectural rules, async network calls use `useGetJSONData` for LRU caching
 * and deduplication. Loading states register with `useLoadingTask` so `SGridPlotCard` wrappers display active spinners.
 *
 * @example
 * ```tsx
 * const props = PieChartProps("pie-1", [], "en", {}, true);
 * return <PieChartComponent ChartProps={props} />;
 * ```
 */
const LinkedPieChartComponent = ({ ChartProps }: { ChartProps: PieChartProps }) => {
  const props = ChartProps;
  useInterfaceContext();

  const dataURL = props.dataURL || "";
  const [isDataLoading, fetchedRawData] = useGetJSONData(props.isDummyMode ? "" : dataURL);
  const L_piechartData = useLoadingTask(props.chartName || 'PieChart Data');

  useEffect(() => {
    if (!props.isDummyMode && dataURL) {
      if (isDataLoading) {
        L_piechartData.start();
      } else {
        L_piechartData.stop();
      }
    }
  }, [isDataLoading, props.isDummyMode, dataURL, L_piechartData]);

  const chartData = useMemo(() => {
    if (props.isDummyMode) {
      return dummyData.map((item: any) => ({
        name: item.name || 'Category',
        value: typeof item.uv === 'number' ? item.uv : (item.value || 0),
      }));
    }

    if (props.data && props.data.length > 0) {
      return props.data;
    }

    if (fetchedRawData && (fetchedRawData as any).response) {
      const resp = (fetchedRawData as any).response;
      if (Array.isArray(resp)) {
        return resp.map((row: any, idx: number) => ({
          name: row.name || row.bundesland || `Item ${idx + 1}`,
          value: Number(row.feature || row.value || 0),
        }));
      }
    }

    return [];
  }, [props.isDummyMode, props.data, fetchedRawData]);

  if (props.isDummyMode) {
    return (
      <div className="flex flex-col h-full w-full min-h-0">
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="48%"
                innerRadius="45%"
                outerRadius="75%"
                paddingAngle={3}
                label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(val: any, name: any) => [
                  typeof val === 'number' ? val.toLocaleString() : val,
                  String(name),
                ]}
              />
              <Legend verticalAlign="bottom" height={32} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  const isDataNotAvailable = chartData.length === 0 && !isDataLoading;

  return (
    <div className="flex flex-col h-full w-full min-h-0">
      <div className="flex-1 min-h-0">
        {isDataNotAvailable ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="48%"
                innerRadius="45%"
                outerRadius="75%"
                paddingAngle={3}
                label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(val: any) => [
                  typeof val === 'number' ? val.toLocaleString() : val,
                  'Value',
                ]}
              />
              <Legend verticalAlign="bottom" height={32} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

const PieChartComponent = ({ ChartProps }: { ChartProps: PieChartProps }) => {
  if (ChartProps.dataMode === "generic") {
    return (
      <GenericCartesianChart
        chartName={ChartProps.chartName}
        kind="pie"
        rowLimit={ChartProps.rowLimit}
      />
    );
  }

  return <LinkedPieChartComponent ChartProps={ChartProps} />;
};

export default PieChartComponent;
