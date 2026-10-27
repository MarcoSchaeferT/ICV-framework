"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLocale, useTranslations } from "next-intl";
import { apiRoutes } from "@/app/api_routes";
import { useInterfaceContext } from "@/components/contexts/InterfaceContext";
import { useLoadingTask, LoadingSpinnerAnimation } from "@/components/plots/maps/utils/loadingSpinner";

type TemporalPoint = {
  month: number;
  mean: number | null;
  sd: number | null;
  lower: number | null;
  upper: number | null;
  simulatedValue: number | null;
  cv: number | null;
  q05: number | null;
  q95: number | null;
};
type CalibrationPoint = { expected: number | null; observed: number | null };
type UncertaintyData = {
  version: "uncertainty-v1";
  cellID: number;
  coordinates: { latitude: number | null; longitude: number | null };
  temporal: TemporalPoint[];
  calibration: CalibrationPoint[];
  miscalibrationArea: number | null;
};
type RequestState = {
  url: string;
  loading: boolean;
  data?: UncertaintyData;
  error?: "not-found" | "failed" | string;
};
type ChartContext = { url: string; state: RequestState | null };

const UncertaintyChartContext = createContext<ChartContext | null>(null);

/** Fetch both uncertainty plots once per selected cell. */
export function UncertaintyDataProvider({ children }: { children: React.ReactNode }) {
  const { dbRowID_of_selectedGridcellID: cellID } = useInterfaceContext();
  const url = cellID >= 0
    ? apiRoutes.getCellChartData({ chart: "uncertainty", cellID })
    : "";
  const [state, setState] = useState<RequestState | null>(null);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    // Clear the previous cell while its replacement is fetched.
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
        const data = body as UncertaintyData;
        if (data.version !== "uncertainty-v1" ||
          !Array.isArray(data.temporal) || !Array.isArray(data.calibration)) {
          throw new Error("Invalid uncertainty chart response");
        }
        if (!controller.signal.aborted) setState({ url, loading: false, data });
      } catch (err: any) {
        if (!controller.signal.aborted) {
          setState({
            url,
            loading: false,
            error: err instanceof Error ? err.message : "failed",
          });
        }
      }
    })();
    return () => controller.abort();
  }, [url]);

  return (
    <UncertaintyChartContext.Provider value={{ url, state }}>
      {children}
    </UncertaintyChartContext.Provider>
  );
}

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumSignificantDigits: 4 }).format(value);
}

function formatCoordinate(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

function CoordinateLabel({ data, locale }: { data: UncertaintyData; locale: string }) {
  const { latitude, longitude } = data.coordinates;
  if (latitude == null || longitude == null) return null;
  return (
    <span className="text-xs text-slate-600 dark:text-slate-300">
      Lat: {formatCoordinate(latitude, locale)}°, Lng: {formatCoordinate(longitude, locale)}°
    </span>
  );
}

function VerticalAxisTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-8 shrink-0 items-center justify-center pb-[30px]" aria-hidden="true">
      <span className="-rotate-90 whitespace-nowrap text-xs font-medium text-slate-700 dark:text-slate-200">
        {children}
      </span>
    </div>
  );
}

function ChartLegend({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute bottom-11 right-5 z-10 flex max-w-[65%] flex-col gap-0.5 rounded-md border border-slate-200/80 bg-white/90 px-2 py-1 text-[10px] leading-tight text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200">
      {children}
    </div>
  );
}

function TemporalChart({ data, locale }: { data: UncertaintyData; locale: string }) {
  const t = useTranslations("page_home.ShowCases.page_Uncertainty_Vis");
  const monthLabels = useMemo(
    () => Array.from({ length: 12 }, (_, index) =>
      new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(2024, index, 1))),
    [locale],
  );
  const rows = useMemo(() => {
    const byMonth = new Map(data.temporal.map((point) => [point.month, point]));
    return Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const point = byMonth.get(month);
      return {
        month,
        label: monthLabels[index],
        mean: point?.mean ?? null,
        sd: point?.sd ?? null,
        simulatedValue: point?.simulatedValue ?? null,
        cv: point?.cv ?? null,
        q05: point?.q05 ?? null,
        q95: point?.q95 ?? null,
        band: point?.lower != null && point.upper != null
          ? [point.lower, point.upper] as [number, number] : null,
      };
    });
  }, [data.temporal, monthLabels]);

  return (
    <div className="flex size-full min-h-0 flex-col p-3">
      <div className="shrink-0 text-center"><CoordinateLabel data={data} locale={locale} /></div>
      <div className="relative flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1" role="img" aria-label={`${t("suitabilityAxis")} / ${t("monthAxis")}`}>
          <VerticalAxisTitle>{t("suitabilityAxis")}</VerticalAxisTitle>
          <div className="min-w-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 14, right: 18, bottom: 2, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
              <XAxis
                dataKey="month"
                tickFormatter={(month: number | string) => monthLabels[Number(month) - 1] ?? String(month)}
                tick={{ fontSize: 11 }}
                interval={0}
                height={32}
              />
              <YAxis
                domain={[-0.05, 1.05]}
                tick={{ fontSize: 11 }}
                width={48}
                tickFormatter={(value: number) => formatNumber(value, locale)}
              />
              <Tooltip
                content={({ active, payload }) => {
                  const row = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                  if (!active || !row) return null;
                  return (
                    <div className="rounded-md border border-slate-200 bg-white p-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
                      <div className="mb-1 font-semibold">{row.label}</div>
                      {row.mean != null && <div>{t("predictedMean")}: {formatNumber(row.mean, locale)}</div>}
                      {row.sd != null && <div>{t("standardDeviation")}: {formatNumber(row.sd, locale)}</div>}
                      {row.band && <div>{t("confidenceBand")}: {formatNumber(row.band[0], locale)} – {formatNumber(row.band[1], locale)}</div>}
                      {row.simulatedValue != null && <div>{t("simulatedValue")}: {formatNumber(row.simulatedValue, locale)}</div>}
                      {row.cv != null && <div>CV: {formatNumber(row.cv, locale)}</div>}
                      {row.q05 != null && <div>Q05: {formatNumber(row.q05, locale)}</div>}
                      {row.q95 != null && <div>Q95: {formatNumber(row.q95, locale)}</div>}
                    </div>
                  );
                }}
              />
              <Area dataKey="band" type="linear" fill="lightsteelblue" fillOpacity={0.6} stroke="none" isAnimationActive={false} />
              <Line dataKey="mean" type="linear" stroke="#1f77b4" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
              <Line dataKey="simulatedValue" type="linear" stroke="#ff7f0e" strokeOpacity={0} dot={{ r: 4, fill: "#ff7f0e", stroke: "#ff7f0e" }} activeDot={{ r: 6 }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
          </div>
        </div>
        <ChartLegend>
          <span className="flex items-center gap-1"><span className="h-0.5 w-4 shrink-0" style={{ backgroundColor: "#1f77b4" }} />{t("predictedMean")}</span>
          <span className="flex items-center gap-1"><span className="size-2 shrink-0 rounded-full bg-[#ff7f0e]" />{t("simulatedValue")}</span>
          <span className="flex items-center gap-1"><span className="h-2 w-4 shrink-0" style={{ backgroundColor: "lightsteelblue", opacity: 0.6 }} />{t("confidenceBand")}</span>
        </ChartLegend>
      </div>
      <div className="ml-20 mr-[18px] shrink-0 pb-1 text-center text-xs font-medium text-slate-700 dark:text-slate-200">{t("monthAxis")}</div>
      {/*<p className="shrink-0 pt-1 text-center text-[11px] text-slate-500 dark:text-slate-400">{t("simulatedNote")}</p>*/}
    </div>
  );
}

function CalibrationChart({ data, locale }: { data: UncertaintyData; locale: string }) {
  const t = useTranslations("page_home.ShowCases.page_Uncertainty_Vis");
  const rows = useMemo(() => data.calibration
    .filter((point): point is { expected: number; observed: number } =>
      point.expected != null && point.observed != null)
    .map(({ expected, observed }) => ({
      expected,
      observed,
      band: [Math.min(expected, observed), Math.max(expected, observed)] as [number, number],
    })), [data.calibration]);

  return (
    <div className="flex size-full min-h-0 flex-col p-3">
      <div className="shrink-0 text-center"><CoordinateLabel data={data} locale={locale} /></div>
      <div className="relative flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1" role="img" aria-label={`${t("observedProportion")} / ${t("expectedProportion")}`}>
          <VerticalAxisTitle>{t("observedProportion")}</VerticalAxisTitle>
          <div className="min-w-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 14, right: 18, bottom: 2, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
              <XAxis
                dataKey="expected"
                type="number"
                domain={[0, 1]}
                tick={{ fontSize: 11 }}
                tickFormatter={(value: number) => formatNumber(value, locale)}
                height={30}
              />
              <YAxis
                domain={[0, 1]}
                tick={{ fontSize: 11 }}
                tickFormatter={(value: number) => formatNumber(value, locale)}
                width={48}
              />
              <Tooltip
                content={({ active, payload }) => {
                  const row = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                  if (!active || !row) return null;
                  return (
                    <div className="rounded-md border border-slate-200 bg-white p-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
                      <div>{t("expectedProportion")}: {formatNumber(row.expected, locale)}</div>
                      <div>{t("observedProportion")}: {formatNumber(row.observed, locale)}</div>
                      <div>{t("deviation")}: {formatNumber(row.observed - row.expected, locale)}</div>
                    </div>
                  );
                }}
              />
              <Area dataKey="band" type="linear" fill="#1f77b4" fillOpacity={0.16} stroke="none" isAnimationActive={false} />
              <Line dataKey="expected" type="linear" stroke="#ff7f0e" strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              <Line dataKey="observed" type="linear" stroke="#1f77b4" strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
          </div>
        </div>
        <ChartLegend>
          <span className="flex items-center gap-1"><span className="w-4 shrink-0 border-t-2 border-dashed border-[#ff7f0e]" />{t("ideal")}</span>
          <span className="flex items-center gap-1"><span className="h-0.5 w-4 shrink-0 bg-[#1f77b4]" />{t("observedProportion")}</span>
          {data.miscalibrationArea != null &&
            <span>{t("miscalibrationArea")}: {formatNumber(data.miscalibrationArea, locale)}</span>}
        </ChartLegend>
      </div>
      <div className="ml-20 mr-[18px] shrink-0 pb-1 text-center text-xs font-medium text-slate-700 dark:text-slate-200">{t("expectedProportion")}</div>
      {/*<p className="shrink-0 pt-1 text-center text-[11px] text-slate-500 dark:text-slate-400">{t("simulatedNote")}</p>*/}
    </div>
  );
}

/** Render one of the two interactive uncertainty cards from their shared response. */
export function UncertaintyChart({ kind }: { kind: "temporal" | "calibration" }) {
  const t = useTranslations("page_home.ShowCases.page_Uncertainty_Vis");
  const locale = useLocale() === "de" ? "de" : "en";
  const context = useContext(UncertaintyChartContext);
  if (!context) throw new Error("UncertaintyChart requires UncertaintyDataProvider");
  const { url } = context;
  const state = context.state?.url === url ? context.state : null;
  const { start: startLoading, stop: stopLoading } = useLoadingTask(`Uncertainty ${kind}`);

  useEffect(() => {
    if (url && (!state || state.loading)) startLoading();
    else stopLoading();
  }, [url, state, startLoading, stopLoading]);

  if (!url) {
    return <div className="flex size-full items-center justify-center text-sm text-slate-500">{t("selectCellPrompt")}</div>;
  }
  if (!state || state.loading) {
    return <div className="relative size-full"><LoadingSpinnerAnimation /></div>;
  }
  if (state.error === "not-found") {
    return <div className="flex size-full items-center justify-center text-sm text-slate-500">{t("chartNoData")}</div>;
  }
  if (state.error || !state.data) {
    const detail = state.error && state.error !== "failed" ? state.error : "";
    return (
      <div className="flex flex-col size-full items-center justify-center p-2 text-center text-sm text-red-600">
        <span>{t("chartLoadError")}</span>
        {detail && <span className="text-xs text-slate-500 mt-1">{detail}</span>}
      </div>
    );
  }
  return kind === "temporal"
    ? <TemporalChart data={state.data} locale={locale} />
    : <CalibrationChart data={state.data} locale={locale} />;
}
