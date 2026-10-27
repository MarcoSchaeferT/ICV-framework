"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
  type PieSectorShapeProps,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import { useLocale } from "next-intl";
import { apiRoutes } from "@/app/api_routes";
import { useGetJSONData } from "@/app/hooks/useFetchAndCache";
import { useChartDataset } from "@/components/contexts/ChartDatasetContext";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinnerAnimation, useLoadingTask } from "../maps/utils/loadingSpinner";
import { StandardTooltip } from "../maps/helpers";
import { categoricalColors2 } from "@/app/const_store";

/**
 * Supported chart renderers in the generic layout-template registry.
 *
 * @example
 * ```ts
 * import type { GenericChartKind } from "@/framework";
 *
 * const mosquitoTrendKind: GenericChartKind = "line";
 * ```
 */
export type GenericChartKind = "line" | "bar" | "pie";

/**
 * Localized metadata record used to populate chart axis selectors.
 *
 * @remarks
 * Axis choices are derived from `datatype`; `dimension` is displayed as a
 * unit label and `description` supplies explanatory tooltip text.
 *
 * @example
 * ```ts
 * const mosquitoCountColumn: ColumnMetadata = {
 *   column_name: "mosquito_amount",
 *   datatype: "int",
 *   dimension: "observations",
 *   description: "Aedes albopictus observations",
 * };
 * ```
 */
interface ColumnMetadata {
  /** Database column identifier. */
  column_name: string;
  /** Backend datatype used to determine eligible X and Y axes. */
  datatype: "string" | "float" | "int" | "date" | string;
  /** Physical or count unit, when available. */
  dimension?: string;
  /** Human-readable column description, when available. */
  description?: string;
  /** Backend availability marker; generic charts do not filter on it. */
  availability?: string | number;
}

/**
 * One metadata-derived option for a generic chart's X or Y selector.
 *
 * @example
 * ```ts
 * const mosquitoCountAxis: AxisOption = {
 *   value: "mosquito_amount",
 *   columnName: "mosquito_amount",
 *   datatype: "int",
 *   label: "mosquito_amount [observations]",
 *   description: "Aedes albopictus observations",
 * };
 * ```
 */
interface AxisOption {
  /** Backend field identifier stored as the select value. */
  value: string;
  /** Original database column name. */
  columnName: string;
  /** Datatype used to classify the axis. */
  datatype: string;
  /** Human-readable selector label, including unit where available. */
  label: string;
  /** Optional metadata explanation shown in tooltips. */
  description?: string;
}

/**
 * Recharts-ready point derived from one database row.
 *
 * @remarks `rowIndex` retains the source-row position for linked tooltip and
 * selection behavior after invalid values are omitted or points are sorted.
 *
 * @example
 * ```ts
 * const berlinObservation: GenericChartPoint = {
 *   x: "Berlin",
 *   y: 18,
 *   rowIndex: 0,
 * };
 * ```
 */
interface GenericChartPoint {
  /** Horizontal category, date, or numeric value. */
  x: string | number;
  /** Vertical numeric measure. */
  y: number;
  /** Original database-row index retained for linked interaction. */
  rowIndex: number;
}

/**
 * Recharts tooltip state plus the selected chart-axis metadata.
 *
 * @example
 * ```ts
 * const tooltip: GenericChartTooltipProps = {
 *   active: true,
 *   payload: [{ payload: { x: "Berlin", y: 18, rowIndex: 0 } }],
 *   chartName: "albopictus-observations",
 *   locale: "de",
 *   xOption: { value: "city", columnName: "city", datatype: "string", label: "City" },
 *   yOption: { value: "mosquito_amount", columnName: "mosquito_amount", datatype: "int", label: "Observations" },
 * };
 * ```
 */
interface GenericChartTooltipProps {
  /** Whether Recharts currently displays the tooltip. */
  active?: boolean;
  /** Hovered point wrapped in the Recharts tooltip payload. */
  payload?: ReadonlyArray<{ payload?: GenericChartPoint }>;
  /** Stable chart identifier used for linked tooltip behavior. */
  chartName: string;
  /** Locale used to format tooltip text. */
  locale: string;
  /** Selected horizontal-axis metadata, if configured. */
  xOption?: AxisOption;
  /** Selected vertical-axis metadata, if configured. */
  yOption?: AxisOption;
}

/**
 * Task-specific database payload used by generic multi-column charts.
 *
 * @remarks
 * The hook's general `dbDATA.response` contract is intentionally broad;
 * this local view narrows it to row objects. Rows may be truncated by the
 * backend when a positive row limit is supplied.
 *
 * @example
 * ```ts
 * const observations: MultiColumnResponse = {
 *   response: [{ species: "albopictus", mosquito_amount: 18 }],
 *   error: "",
 *   isTruncated: false,
 *   rowLimit: 100,
 * };
 * ```
 */
interface MultiColumnResponse {
  /** Records keyed by requested database column name. */
  response?: Record<string, unknown>[];
  /** Backend error message, if the request failed. */
  error?: string;
  /** Whether the backend stopped after the requested row limit. */
  isTruncated?: boolean;
  /** Effective row limit reported with a truncated response. */
  rowLimit?: number;
}

/** Default maximum rows requested by the generic chart layout. @defaultValue 100 */
export const DEFAULT_GENERIC_CHART_ROW_LIMIT = 100;
const PIE_COLORS = categoricalColors2.length > 0
  ? categoricalColors2
  : ["#279BBA", "#8884d8", "#82ca9d", "#ffc658"];

function optionLabel(column: ColumnMetadata, suffix = "") {
  const unit = column.dimension && column.dimension !== "NA" ? ` [${column.dimension}]` : "";
  return `${column.column_name}${suffix}${unit}`;
}

function formatTooltipValue(value: string | number | undefined, locale: string) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString(locale, { maximumFractionDigits: 3 })
    : String(value ?? "N/A");
}

function tooltipDescription(option: AxisOption) {
  const description = option.description?.trim();
  return description && description !== "NA" && description !== "N/A"
    ? description
    : option.columnName;
}

/** Shared tooltip content for generic line, bar, and pie charts. */
function GenericChartTooltip({
  active,
  payload,
  chartName,
  locale,
  xOption,
  yOption,
}: GenericChartTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point || !xOption || !yOption) return null;

  return (
    <StandardTooltip
      chartId={`${chartName}-tooltip`}
      compact
      value={formatTooltipValue(point.y, locale)}
      description={tooltipDescription(yOption)}
      secondarySection={{
        value: formatTooltipValue(point.x, locale),
        description: tooltipDescription(xOption),
      }}
      rows={[]}
    />
  );
}

/** Adds one lightweight highlight layer over only the active pie sector. */
function HoveredPieSector({ isActive, ...sectorProps }: PieSectorShapeProps) {
  return (
    <g>
      <Sector {...sectorProps} />
      {isActive ? (
        <Sector
          {...sectorProps}
          fill="rgba(255, 255, 255, 0.22)"
          stroke="#ffffff"
          strokeWidth={2}
          pointerEvents="none"
          style={{ filter: "drop-shadow(0 0 4px rgba(255, 255, 255, 0.75))" }}
        />
      ) : null}
    </g>
  );
}

function createXAxisOptions(metadata: ColumnMetadata[], kind: GenericChartKind): AxisOption[] {
  const allowedTypes = kind === "line"
    ? new Set(["string", "float", "int", "date"])
    : new Set(["string", "date"]);

  return metadata.flatMap((column) => {
    if (!allowedTypes.has(column.datatype)) return [];

    if (column.datatype === "date") {
      return [{
        value: column.column_name,
        columnName: column.column_name,
        datatype: column.datatype,
        label: optionLabel(column),
        description: column.description,
      }];
    }

    return [{
      value: column.column_name,
      columnName: column.column_name,
      datatype: column.datatype,
      label: optionLabel(column),
      description: column.description,
    }];
  });
}

function formatDateCategory(value: unknown) {
  const raw = String(value ?? "");
  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) {
    return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  const year = parsed.getFullYear().toString().padStart(4, "0");
  const month = (parsed.getMonth() + 1).toString().padStart(2, "0");
  const day = parsed.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Renders a metadata-backed axis selector for one generic chart card.
 *
 * @param props - Axis label, current column, available options, and change handler.
 * @returns A select control disabled when no compatible metadata column exists.
 *
 * @remarks X choices depend on the renderer kind while Y choices require a
 * numeric backend datatype. Each chart owns its own selection state.
 */
function AxisSelect({
  axis,
  value,
  options,
  onValueChange,
}: {
  axis: string;
  value: string;
  options: AxisOption[];
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{axis}:</span>
      <Select value={value} onValueChange={onValueChange} disabled={options.length === 0}>
        <SelectTrigger className="h-7 min-w-0 flex-1 bg-white/85 px-2 text-[11px] dark:bg-slate-900/85">
          <SelectValue placeholder={`Select ${axis} axis`} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>{axis} axis</SelectLabel>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex max-w-[28rem] flex-col">
                  <span>{option.label}</span>
                  {option.description && option.description !== "NA" && (
                    <span className="text-[10px] italic text-slate-500">{option.description}</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Renders a configurable line, bar, or pie chart for a shared dataset.
 *
 * @param props - Unique chart ID, renderer kind, and optional per-chart row limit.
 * @returns Axis controls and a chart or a loading/error/empty state.
 *
 * @remarks
 * When `rowLimit` is omitted, uses the value from {@link useChartDataset} (defaults to 100).
 * Passing `null` requests an unbounded result.
 *
 * Reads the selected relation from {@link ChartDatasetProvider} while keeping
 * X and Y axis choices local to this chart. Requests localized column metadata
 * and the selected columns through `useGetJSONData`, then registers loading
 * with the nearest `LoadingSpinnerProvider`. The chart must be rendered below
 * both providers, as `SGridPlotCard` does for card-level loading state.
 *
 * @example
 * ```tsx
 * import { GenericCartesianChart, ChartDatasetProvider } from "@/framework";
 * import { LoadingSpinnerProvider } from "@/components/plots/maps/utils/loadingSpinner";
 *
 * function MosquitoTrendCard() {
 *   return (
 *     <ChartDatasetProvider>
 *       <LoadingSpinnerProvider>
 *         <GenericCartesianChart chartName="albopictus-trend" kind="line" rowLimit={100} />
 *       </LoadingSpinnerProvider>
 *     </ChartDatasetProvider>
 *   );
 * }
 * ```
 */
export default function GenericCartesianChart({
  chartName,
  kind,
  rowLimit,
}: {
  chartName: string;
  kind: GenericChartKind;
  rowLimit?: number | null;
}) {
  const locale = useLocale();
  const metadataLocale = locale === "de" ? "de" : "en";
  const { selectedDataset, rowLimit: sharedRowLimit } = useChartDataset();
  const effectiveRowLimit = rowLimit === undefined ? sharedRowLimit : rowLimit;
  const [requestedX, setRequestedX] = useState("");
  const [requestedY, setRequestedY] = useState("");

  const metadataURL = selectedDataset
    ? apiRoutes.columnMetadata({ relationName: selectedDataset, lang: metadataLocale })
    : "";
  const [isMetadataLoading, rawMetadata] = useGetJSONData(metadataURL);

  const metadata = useMemo<ColumnMetadata[]>(() => {
    if (!Array.isArray(rawMetadata)) return [];
    return (rawMetadata as unknown as ColumnMetadata[]).filter((column) => {
      const columnName = column.column_name?.toLowerCase();
      // Generic layout-template charts intentionally ignore the metadata
      // availability flag so columns marked unavailable can still be tested.
      return columnName !== "id" && columnName !== "geometry";
    });
  }, [rawMetadata]);

  const xOptions = useMemo(() => createXAxisOptions(metadata, kind), [metadata, kind]);
  const yOptions = useMemo<AxisOption[]>(() => metadata
    .filter((column) => column.datatype === "float" || column.datatype === "int")
    .map((column) => ({
      value: column.column_name,
      columnName: column.column_name,
      datatype: column.datatype,
      label: optionLabel(column),
      description: column.description,
    })), [metadata]);

  const selectedY = yOptions.some((option) => option.value === requestedY)
    ? requestedY
    : (yOptions[0]?.value ?? "");
  const defaultXOption = xOptions.find((option) => option.columnName !== selectedY) ?? xOptions[0];
  const selectedX = xOptions.some((option) => option.value === requestedX)
    ? requestedX
    : (defaultXOption?.value ?? "");

  const selectedXOption = xOptions.find((option) => option.value === selectedX);
  const selectedYOption = yOptions.find((option) => option.value === selectedY);
  const xLabel = selectedXOption?.label ?? "";
  const yLabel = selectedYOption?.label ?? "";
  const selectedXColumnName = selectedXOption?.columnName ?? "";
  const selectedXDatatype = selectedXOption?.datatype ?? "";
  const requestedColumns = selectedXOption && selectedY
    ? Array.from(new Set([selectedXOption.columnName, selectedY]))
    : [];
  const dataURL = selectedDataset && requestedColumns.length > 0
    ? apiRoutes.fetchDbData({
        relationName: selectedDataset,
        features: requestedColumns,
        limit: effectiveRowLimit ?? -1,
      })
    : "";
  const [isDataLoading, rawData] = useGetJSONData(dataURL);
  const response = rawData as unknown as MultiColumnResponse;

  const { start: startLoading, stop: stopLoading } = useLoadingTask(`${chartName} data`);
  useEffect(() => {
    if (isMetadataLoading || isDataLoading) startLoading();
    else stopLoading();
  }, [isMetadataLoading, isDataLoading, startLoading, stopLoading]);

  const chartData = (() => {
    if (!selectedXColumnName || !Array.isArray(response.response)) return [];

    const points = response.response.flatMap((row, index) => {
      const rawX = row[selectedXColumnName];
      const y = Number(row[selectedY]);
      if (rawX === null || rawX === undefined || rawX === "" || !Number.isFinite(y)) return [];

      const x = selectedXDatatype === "date"
        ? formatDateCategory(rawX)
        : selectedXDatatype === "float" || selectedXDatatype === "int"
          ? Number(rawX)
          : String(rawX);

      if (typeof x === "number" && !Number.isFinite(x)) return [];
      return [{ x, y, rowIndex: index }];
    });

    if (kind === "line" && (selectedXDatatype === "float" || selectedXDatatype === "int")) {
      points.sort((left, right) => Number(left.x) - Number(right.x));
    } else if (kind === "line" && selectedXDatatype === "date") {
      points.sort((left, right) => String(left.x).localeCompare(String(right.x)));
    }

    return points;
  })();

  const isNumericX = selectedXDatatype === "float" || selectedXDatatype === "int";
  const hasConfiguration = Boolean(selectedDataset && selectedX && selectedY);
  const noMetadata = selectedDataset && !isMetadataLoading && metadata.length === 0;
  const metadataError = (rawMetadata as unknown as { error?: string })?.error;
  const missingAxisOptions = selectedDataset && !isMetadataLoading && metadata.length > 0
    && (xOptions.length === 0 || yOptions.length === 0);
  const tooltipContent = (
    <GenericChartTooltip
      chartName={chartName}
      locale={locale}
      xOption={selectedXOption}
      yOption={selectedYOption}
    />
  );

  return (
    <div className="relative flex size-full min-h-0 flex-col gap-1 p-1">
      <LoadingSpinnerAnimation />
      <div className="flex shrink-0 gap-2 rounded-md bg-slate-100/85 p-1 dark:bg-slate-800/85">
        <AxisSelect
          axis={kind === "pie" ? "Category" : "X"}
          value={selectedX}
          options={xOptions}
          onValueChange={setRequestedX}
        />
        <AxisSelect
          axis={kind === "pie" ? "Value" : "Y"}
          value={selectedY}
          options={yOptions}
          onValueChange={setRequestedY}
        />
      </div>

      {!isDataLoading && response.isTruncated && (
        <div className="flex shrink-0 items-center gap-1 rounded bg-amber-100 px-2 py-1 text-[11px] text-amber-900">
          <AlertTriangle className="size-3 shrink-0" />
          Showing the first {response.rowLimit?.toLocaleString(locale) ?? DEFAULT_GENERIC_CHART_ROW_LIMIT.toLocaleString(locale)} rows.
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        {!selectedDataset ? (
          <div className="flex size-full items-center justify-center text-sm text-slate-500">Select a dataset.</div>
        ) : metadataError ? (
          <div className="flex size-full items-center justify-center px-4 text-center text-sm text-red-600">{metadataError}</div>
        ) : noMetadata ? (
          <div className="flex size-full items-center justify-center px-4 text-center text-sm text-slate-500">
            No available chart columns are defined in this dataset&apos;s metadata.
          </div>
        ) : missingAxisOptions ? (
          <div className="flex size-full items-center justify-center px-4 text-center text-sm text-slate-500">
            {xOptions.length === 0
              ? `No available ${kind === "line" ? "supported" : "categorical"} ${kind === "pie" ? "category" : "X-axis"} column is defined in the metadata.`
              : `No available numeric ${kind === "pie" ? "value" : "Y-axis"} column is defined in the metadata.`}
          </div>
        ) : response.error ? (
          <div className="flex size-full items-center justify-center px-4 text-center text-sm text-red-600">{response.error}</div>
        ) : hasConfiguration && !isDataLoading && chartData.length === 0 ? (
          <div className="flex size-full items-center justify-center text-sm text-slate-500">No valid rows available.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {kind === "pie" ? (
              <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <Pie
                  data={chartData}
                  dataKey="y"
                  nameKey="x"
                  cx="50%"
                  cy="48%"
                  innerRadius="42%"
                  outerRadius="78%"
                  paddingAngle={chartData.length <= 25 ? 2 : 0}
                  shape={HoveredPieSector}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`${entry.rowIndex}-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                      style={{ cursor: "pointer" }}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={tooltipContent}
                  cursor={{ fill: "rgba(255, 255, 255, 0.08)" }}
                />
                {chartData.length <= 20 && <Legend verticalAlign="bottom" height={28} iconType="circle" />}
              </PieChart>
            ) : kind === "line" ? (
              <LineChart data={chartData} margin={{ top: 8, right: 18, left: 18, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="x"
                  type={isNumericX ? "number" : "category"}
                  domain={isNumericX ? ["dataMin", "dataMax"] : undefined}
                  tick={{ fontSize: 11 }}
                  minTickGap={20}
                  height={45}
                  label={{ value: xLabel, position: "bottom", offset: 5, fontSize: 14 }}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  width={70}
                  label={{
                    value: yLabel,
                    angle: -90,
                    position: "insideLeft",
                    style: { textAnchor: "middle" },
                    fontSize: 14,
                  }}
                />
                <Tooltip
                  content={tooltipContent}
                  cursor={{ stroke: "rgba(99, 102, 241, 0.45)", strokeWidth: 1 }}
                />
                <Line type="monotone" dataKey="y" name={yLabel} stroke="#8884d8" strokeWidth={2} dot={chartData.length < 250} />
              </LineChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 8, right: 18, left: 18, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="x"
                  type="category"
                  tick={{ fontSize: 11 }}
                  minTickGap={12}
                  height={45}
                  label={{ value: xLabel, position: "bottom", offset: 5, fontSize: 14 }}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  width={70}
                  label={{
                    value: yLabel,
                    angle: -90,
                    position: "insideLeft",
                    style: { textAnchor: "middle" },
                    fontSize: 14,
                  }}
                />
                <Tooltip
                  content={tooltipContent}
                  cursor={{ fill: "rgba(255, 255, 255, 0.08)" }}
                />
                <Bar dataKey="y" name={yLabel} fill="#279BBA" />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
