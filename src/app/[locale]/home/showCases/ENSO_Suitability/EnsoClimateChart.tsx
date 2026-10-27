"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiRoutes } from "@/app/api_routes";
import { useInterfaceContext } from "@/components/contexts/InterfaceContext";
import { useLoadingTask, LoadingSpinnerAnimation } from "@/components/plots/maps/utils/loadingSpinner";
import { useLocale, useTranslations } from "next-intl";

type ReferencePoint = {
  month: number;
  mean: number | null;
  std: number | null;
  lower: number | null;
  upper: number | null;
};
type ForecastPoint = { year: number; month: number; value: number | null };
type Panel = {
  key: string;
  label: string;
  reference: ReferencePoint[];
  forecast: ForecastPoint[];
};
type EnsoChartData = {
  version: "enso-suitability-v1";
  cellID: number;
  dataset: string;
  coordinates: { latitude: number | null; longitude: number | null };
  months: { month: number; label: string }[];
  title: string;
  referenceLegend: string;
  forecastLegend: string;
  panels: Panel[];
};
type ChartRow = {
  month: number;
  label: string;
  mean: number | null;
  std: number | null;
  band: [number, number] | null;
  forecastByYear: Record<number, number | null>;
};
type RequestState = {
  url: string;
  loading: boolean;
  data?: EnsoChartData;
  error?: string;
};

function panelRows(panel: Panel, months: EnsoChartData["months"]): ChartRow[] {
  const reference = new Map(panel.reference.map((point) => [point.month, point]));
  const forecasts = new Map<number, Record<number, number | null>>();
  for (const point of panel.forecast) {
    const byYear = forecasts.get(point.month) ?? {};
    byYear[point.year] = point.value;
    forecasts.set(point.month, byYear);
  }
  return months.map(({ month, label }) => {
    const ref = reference.get(month);
    return {
      month,
      label,
      mean: ref?.mean ?? null,
      std: ref?.std ?? null,
      band: ref?.lower != null && ref.upper != null ? [ref.lower, ref.upper] : null,
      forecastByYear: forecasts.get(month) ?? {},
    };
  });
}

function formatValue(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumSignificantDigits: 5 }).format(value);
}

function EnsoPanel({
  panel,
  data,
  locale,
  activeMonth,
  activeYear,
}: {
  panel: Panel;
  data: EnsoChartData;
  locale: string;
  activeMonth?: number;
  activeYear?: number;
}) {
  const t = useTranslations("page_home.ShowCases.page_ENSO_Suitability");
  const rows = useMemo(() => panelRows(panel, data.months), [panel, data.months]);
  const years = useMemo(
    () => [...new Set(panel.forecast.map((point) => point.year))],
    [panel.forecast],
  );
  const monthLabels = useMemo(
    () => new Map(data.months.map(({ month, label }) => [month, label])),
    [data.months],
  );

  return (
    <section className="flex h-full min-w-0 flex-col" aria-label={panel.label}>
      <h3 className="shrink-0 px-2 ml-10 pb-1 text-center text-sm font-semibold text-slate-800 dark:text-slate-100">
        {panel.label}
      </h3>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
            <XAxis
              dataKey="month"
              tickFormatter={(month: number | string) => monthLabels.get(Number(month)) ?? String(month)}
              tick={{ fontSize: 11 }}
              interval={0}
              minTickGap={0}
              angle={-45}
              textAnchor="end"
              height={42}
            />
            <YAxis
              width={54}
              tick={{ fontSize: 11 }}
              tickFormatter={(value: number) => formatValue(value, locale)}
              domain={["auto", "auto"]}
            />
            <Tooltip
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as ChartRow | undefined;
                if (!active || !row) return null;
                return (
                  <div className="rounded-md border border-slate-200 bg-white p-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    <div className="mb-1 font-semibold">{row.label}</div>
                    {row.mean != null && (
                      <div style={{ color: "#2b5c8f" }}>
                        {data.referenceLegend}: {formatValue(row.mean, locale)}
                        {row.std != null && ` ± ${formatValue(row.std, locale)}`}
                      </div>
                    )}
                    {years.map((year) => {
                      const value = row.forecastByYear[year];
                      return value == null ? null : (
                        <div key={year} style={{ color: "#e04d39" }}>
                          {data.forecastLegend} {year}: {formatValue(value, locale)}
                          {activeMonth === row.month && activeYear === year && ` (${t("selected")})`}
                        </div>
                      );
                    })}
                  </div>
                );
              }}
            />
            <Area
              dataKey="band"
              type="linear"
              fill="#2b5c8f"
              fillOpacity={0.15}
              stroke="none"
              isAnimationActive={false}
              legendType="none"
            />
            <Line
              dataKey="mean"
              type="linear"
              stroke="#2b5c8f"
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
              legendType="none"
            />
            {years.map((year) => (
              <Line
                key={year}
                dataKey={(row: ChartRow) => row.forecastByYear[year] ?? null}
                name={`${data.forecastLegend} ${year}`}
                type="linear"
                stroke="#e04d39"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={{ r: 4, fill: "#e04d39" }}
                activeDot={{ r: 6 }}
                connectNulls={false}
                isAnimationActive={false}
                legendType="none"
              />
            ))}
            {activeMonth != null && (
              <ReferenceLine x={activeMonth} stroke="#8b0000" strokeDasharray="3 3" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

/** Load one selected cell as JSON and draw its five interactive ENSO panels. */
export default function EnsoClimateChart({
  dataset,
  activeMonth,
  activeYear,
}: {
  dataset: string;
  activeMonth?: number;
  activeYear?: number;
}) {
  const t = useTranslations("page_home.ShowCases.page_ENSO_Suitability");
  const locale = useLocale() === "de" ? "de" : "en";
  const { dbRowID_of_selectedGridcellID: cellID } = useInterfaceContext();
  const url = cellID >= 0
    ? apiRoutes.getCellChartData({ chart: "enso", cellID, dataset, locale })
    : "";
  const [state, setState] = useState<RequestState | null>(null);
  const current = state?.url === url ? state : null;
  const { start: startLoading, stop: stopLoading } = useLoadingTask("Climate Forecast Chart");

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    // This effect owns the request lifecycle; clear the previous cell while fetching.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ url, loading: true });
    (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (response.status === 404) {
          setState({ url, loading: false, error: "not-found" });
          return;
        }
        const body: any = await response.json().catch(() => null);
        if (!response.ok) {
          const errMsg = body?.error || `HTTP ${response.status}`;
          throw new Error(errMsg);
        }
        const data = body as EnsoChartData;
        if (data.version !== "enso-suitability-v1" || !Array.isArray(data.panels)) {
          throw new Error("Invalid ENSO chart response");
        }
        if (!controller.signal.aborted) setState({ url, loading: false, data });
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({
            url,
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    })();
    return () => controller.abort();
  }, [url]);

  useEffect(() => {
    if (url && (!current || current.loading)) startLoading();
    else stopLoading();
  }, [url, current, startLoading, stopLoading]);

  if (!url) {
    return <div className="flex size-full items-center justify-center text-sm text-slate-500">{t("selectCellPrompt")}</div>;
  }
  if (!current || current.loading) {
    return <div className="flex size-full items-center justify-center"><LoadingSpinnerAnimation /></div>;
  }
  if (current.error === "not-found") {
    return <div className="flex size-full items-center justify-center text-sm text-slate-500">{t("chartNoData")}</div>;
  }
  if (current.error || !current.data) {
    const detail = current.error && current.error !== "failed" ? current.error : "";
    return (
      <div className="flex flex-col size-full items-center justify-center p-2 text-center text-sm text-red-600">
        <span>{t("chartLoadError")}</span>
        {detail && <span className="text-xs text-slate-500 mt-1">{detail}</span>}
      </div>
    );
  }
  const data = current.data;
  return (
    <div className="flex size-full min-h-0 flex-col p-2">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-2 pb-2 text-xs text-slate-600 dark:text-slate-300">
        <span>{data.title}</span>
        <span>
          {data.coordinates.latitude != null && data.coordinates.longitude != null &&
            `Lat: ${formatValue(Math.round(data.coordinates.latitude * 100) / 100, locale)}°, Lng: ${formatValue(Math.round(data.coordinates.longitude * 100) / 100, locale)}°`}
        </span>
        <div className="flex gap-3">
          <span><span className="mr-1 inline-block h-0.5 w-4 align-middle" style={{ backgroundColor: "#2b5c8f" }} />{data.referenceLegend}</span>
          <span><span className="mr-1 inline-block h-0.5 w-4 align-middle" style={{ backgroundColor: "#e04d39" }} />{data.forecastLegend}</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-x-auto">
        <div className="grid h-full min-w-[1100px] grid-cols-5 gap-2">
          {data.panels.map((panel) => (
            <EnsoPanel
              key={panel.key}
              panel={panel}
              data={data}
              locale={locale}
              activeMonth={activeMonth}
              activeYear={activeYear}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
