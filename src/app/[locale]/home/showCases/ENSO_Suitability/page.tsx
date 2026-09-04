"use client";

import { useRef, useEffect, useState } from 'react'
import { apiRoutes } from "@/app/api_routes";
import React from 'react';
import { InterfaceContextProvider, useInterfaceContext } from '@/components/contexts/InterfaceContext';
import SGridPlotCard from '@/components/layout/SwapyGridPlotCard';
import { CardPropsClass } from '@/components/layout/CardWrapper';
import LeafD3MapLayerComponent, { LeafD3MapLayerProps } from '@/components/plots/maps/LeafD3Map';
import MiniMapOverlay from '@/components/plots/maps/overlays/MiniMapOverlay';
import { createSwapy, Swapy } from 'swapy';
import { MDXContentProvider } from '@messages/markdown/MDXContentProvider';
import { ViewMainInfoComponent } from '@/components/ViewPageMainInfo';
import { Locale, useLocale, useTranslations } from "next-intl";
import { t_richConfig } from "@/app/const_store";
import { useUIContext } from '@/components/contexts/UIContext';
import { availableColorMapsNames } from '@/components/plots/maps/constants';
import { useLoadingTask, LoadingSpinnerAnimation } from '@/components/plots/maps/utils/loadingSpinner';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  parseEnsoForecastColumn,
  referenceColumnForForecast,
} from "./schema";

const isSWAPY = true;

// ── Forecast configuration ────────────────────────────────────────────────
type SpeciesKey = "albopictus" | "aegypti";
const SPECIES: Record<SpeciesKey, string> = {
  albopictus: "Aedes albopictus",
  aegypti: "Aedes aegypti",
};

/** Representative, data-complete 0.25° cell near Medellín, Colombia. */
const DEFAULT_ENSO_CELL = {
  dbRowId: 48292,
  gridCellId: 300625,
} as const;

/** One consolidated DB table per species (all 6 forecast months in it). */
function tableName(species: SpeciesKey): string {
  return `seas5_forecast_${species}_habitat_probability`;
}

/** Pretty label for a forecast column: forecast_aug_2026 -> "Forecast: Aug 2026". */
function prettyFcLabel(col: string, prefix = "Forecast", monthLabel?: string): string {
  const forecast = parseEnsoForecastColumn(col);
  if (!forecast) return col;
  const month = monthLabel ?? forecast.month[0].toUpperCase() + forecast.month.slice(1);
  return `${prefix}: ${month} ${forecast.year}`;
}

/** (year, month) sort key for a forecast column; last if it doesn't match. */
function fcColSortKey(col: string): [number, number] {
  const forecast = parseEnsoForecastColumn(col);
  return forecast
    ? [forecast.year, forecast.monthIndex]
    : [Infinity, Infinity];
}

/**
 * Returns the cell-linked ENSO Suitability visualization showcase.
 *
 * @remarks
 * Displays backend-rendered static climate forecast charts (4 climate factors +
 * habitat suitability) alongside side-by-side Forecast (Prediction) and Reference
 * maps for SEAS5 forecast data.
 */
export default function Home() {
  const t = useTranslations("page_home.ShowCases.page_ENSO_Suitability");
  const locale = useLocale() as Locale;
  let MDX = MDXContentProvider[locale];

  const UI_contextT = useUIContext();
  const layoutSizes = UI_contextT.layoutDims;

  // ── User selection state ──
  const [species, setSpecies] = useState<SpeciesKey>("albopictus");
  // forecast suitability columns found in the current table (chronological)
  const [fcColumns, setFcColumns] = useState<string[]>([]);
  const [fcIdx, setFcIdx] = useState<number>(0);
  const currentTableName = tableName(species);

  // Load the forecast columns of the current table (drives the month selector)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          apiRoutes.fetchDbColumnNames({ relationName: currentTableName })
        );
        if (!res.ok) return;
        const cols: string[] = await res.json();
        const fc = cols
          .filter((c) => parseEnsoForecastColumn(c) !== null)
          .sort((a, b) => {
            const [ya, ma] = fcColSortKey(a);
            const [yb, mb] = fcColSortKey(b);
            return ya - yb || ma - mb;
          });
        if (!cancelled) {
          setFcColumns(fc);
          setFcIdx((prev) => Math.min(prev, Math.max(0, fc.length - 1)));
        }
      } catch {
        // table missing / backend down — selector stays empty, maps self-select
      }
    })();
    return () => { cancelled = true; };
  }, [currentTableName]);

  const activeFcCol = fcColumns[fcIdx] ?? "";
  const activeRefCol = referenceColumnForForecast(activeFcCol);
  const activeMonthAbbr = parseEnsoForecastColumn(activeFcCol)?.month ?? "";

  // ── 1. Forecast Map Props (Left Map) ──
  let forecastMapProps = LeafD3MapLayerProps();
  forecastMapProps.chartName = 'map_Forecast';
  forecastMapProps.mapDataURL = apiRoutes.FETCH_MAP_DATA.WORLD_MAP;
  forecastMapProps.center = [6.4, -75.3];
  forecastMapProps.zoom = 3.1;
  forecastMapProps.isSetIntialContextDataFromComponent = true;
  forecastMapProps.mapUIsettings.areSettingsOpen = true;
  forecastMapProps.mapUIsettings.isLongitudeSlider = false;
  forecastMapProps.mapUIsettings.isLatitudeSlider = false;
  forecastMapProps.mapUIsettings.isZoomSlider = false;
  forecastMapProps.mapUIsettings.isLatLngZoomOverlay = true;
  forecastMapProps.mapUIsettings.isColorMapSelectionDropdown = true;
  forecastMapProps.mapUIsettings.isFeatureSelectionDropdown = false;
  forecastMapProps.mapUIsettings.isDatasetSelectionDropdown = false;
  forecastMapProps.mapUIsettings.isDistanceLegend = true;
  forecastMapProps.mapUIsettings.isColorMapLegend = true;
  forecastMapProps.mapUIsettings.isCountrySelectionDropdown = false;
  forecastMapProps.mapUIsettings.isDatePicker = false;
  forecastMapProps.mapUIsettings.isAutoHideSettingsToggle = false;
  forecastMapProps.mapUIsettings.isSettingsBlendAnimation = true;
  forecastMapProps.mapUIsettings.defaultDonutSize = 25;
  forecastMapProps.isStaticAutoFitFullSize = false;
  forecastMapProps.isApplyContextData = false;
  forecastMapProps.isApplyTransitions = true;
  forecastMapProps.isProjection_equirectangular = true;
  forecastMapProps.mapUIsettings.filterStringForAvailableDatasetInclude = "seas5";
  forecastMapProps.mapUIsettings.defaultDatasetName = currentTableName;
  forecastMapProps.mapUIsettings.defaultFeatureName = activeFcCol; // "" → map self-selects
  forecastMapProps.mapUIsettings.defaultFeatureColorMap = availableColorMapsNames.interpolateInferno;
  forecastMapProps.mapDataSets.isCityNames = false;
  forecastMapProps.mapUIsettings.defaultLayerOpacity = 0.8;
  // Overlay controls live on the forecast map; the reference map mirrors them.
  forecastMapProps.mapUIsettings.isPresenceData = false;
  forecastMapProps.mapUIsettings.isSequenceMetaData = false;
  forecastMapProps.isSyncMapCoordsOnTheFly_SETTER = true;
  forecastMapProps.isSyncMapCoordsOnTheFly_RECIEVER = false;
  forecastMapProps.mapStyles.backgroundColor = "rgb(215, 234, 245)";
  forecastMapProps.mapInteractions = { disableMouse: false, disableScroll: false };
  forecastMapProps.mapDataSets.isCityNames = true;

  // ── 2. Reference Map Props (Right Map) ──
  let referenceMapProps = LeafD3MapLayerProps();
  referenceMapProps.chartName = 'map_Reference';
  referenceMapProps.mapDataURL = apiRoutes.FETCH_MAP_DATA.WORLD_MAP;
  referenceMapProps.center = [14, 15.6];
  referenceMapProps.zoom = 2.2;
  referenceMapProps.isSetIntialContextDataFromComponent = false;
  referenceMapProps.mapUIsettings.isLongitudeSlider = false;
  referenceMapProps.mapUIsettings.isLatitudeSlider = false;
  referenceMapProps.mapUIsettings.isZoomSlider = false;
  referenceMapProps.mapUIsettings.isLatLngZoomOverlay = false;
  referenceMapProps.mapUIsettings.isColorMapSelectionDropdown = false;
  referenceMapProps.mapUIsettings.isFeatureSelectionDropdown = false;
  referenceMapProps.mapUIsettings.isDatasetSelectionDropdown = false;
  referenceMapProps.mapUIsettings.isDistanceLegend = true;
  referenceMapProps.mapUIsettings.isColorMapLegend = true;
  referenceMapProps.mapUIsettings.isCountrySelectionDropdown = false;
  referenceMapProps.mapUIsettings.isDatePicker = false;
  referenceMapProps.mapUIsettings.isAutoHideSettingsToggle = false;
  referenceMapProps.mapUIsettings.isSettingsBlendAnimation = true;
  referenceMapProps.mapUIsettings.defaultDonutSize = 25;
  referenceMapProps.isStaticAutoFitFullSize = false;
  referenceMapProps.isApplyContextData = false; // don't inherit forecast map's feature
  referenceMapProps.isApplyTransitions = true;
  referenceMapProps.isProjection_equirectangular = true;
  referenceMapProps.mapUIsettings.filterStringForAvailableDatasetInclude = "seas5";
  referenceMapProps.mapUIsettings.defaultDatasetName = currentTableName;
  referenceMapProps.mapUIsettings.defaultFeatureName = activeRefCol; // same calendar month as the active forecast column
  referenceMapProps.mapUIsettings.defaultFeatureColorMap = availableColorMapsNames.interpolateInferno;
  referenceMapProps.mapUIsettings.areSettingsOpen = false;
  referenceMapProps.mapDataSets.isCityNames = false;
  referenceMapProps.mapUIsettings.defaultLayerOpacity = 0.8;
  referenceMapProps.mapUIsettings.isPresenceData = false;
  referenceMapProps.mapUIsettings.isSequenceMetaData = false;
  referenceMapProps.mapDataSets.isCityNames = true;
  referenceMapProps.contextSync = {
    colorMap: true,
    layerOpacity: true,
    presenceData: true,
    sequenceMetaData: true,
  };
  referenceMapProps.isSyncMapCoordsOnTheFly_SETTER = false;
  referenceMapProps.isSyncMapCoordsOnTheFly_RECIEVER = true;
  referenceMapProps.mapStyles.backgroundColor = "rgb(215, 234, 245)";
  referenceMapProps.mapInteractions = { disableMouse: true, disableScroll: true, disableClick: false };
  

  const getTranslation = (key: string, fallback: string) => {
    try {
      if (t.has(key as any)) {
        return t.rich(key as any, { ...t_richConfig })?.toString() || fallback;
      }
    } catch {
      // Fallback if key is not yet loaded in next-intl dev cache
    }
    return fallback;
  };

  const formatForecastLabel = (column: string) => {
    const forecast = parseEnsoForecastColumn(column);
    const fallbackMonth = forecast
      ? forecast.month[0].toUpperCase() + forecast.month.slice(1)
      : "";
    const monthLabel = forecast
      ? getTranslation(`svg.months.${forecast.month}`, fallbackMonth)
      : undefined;
    return prettyFcLabel(
      column,
      getTranslation("forecast", "Forecast"),
      monthLabel,
    );
  };

  // ── Card Titles & Props ──
  let climateFactorsCardProps = CardPropsClass(
    "enso_climate_factors",
    getTranslation('climateFactorsPlot', 'Climatic Factors'),
    "", ""
  );
  climateFactorsCardProps.infoCard = { content: MDX.DummyContent, footer: undefined };

  let forecastMapCardProps = CardPropsClass(
    "enso_fc_map",
    getTranslation('forecastMap', 'Forecast Map'),
    "", ""
  );
  forecastMapCardProps.infoCard = { content: MDX.DummyContent, footer: undefined };

  let referenceMapCardProps = CardPropsClass(
    "enso_ref_map",
    getTranslation('referenceMap', 'Reference Map'),
    "", ""
  );
  referenceMapCardProps.infoCard = { content: MDX.DummyContent, footer: undefined };

  let mainInfoHeading = getTranslation('mainInfo.heading', 'ENSO Suitability');

  useInterfaceContext();

  // set up swapy (client side only)
  const swapyRef = useRef<Swapy | null>(null);
  const swapContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = swapContainerRef.current;
    if (isSWAPY && container) {
      swapyRef.current = createSwapy(container, {
        animation: 'dynamic',
        manualSwap: false,
        swapMode: 'hover',
        autoScrollOnDrag: true,
      });
      swapyRef.current?.enable(isSWAPY);

      return () => {
        swapyRef.current?.destroy();
      };
    }
  }, []);

  return (
    <>
      <main className="flex max-h-fit flex-col items-center justify-between" style={{ paddingTop: layoutSizes.gapSize }}>
        <InterfaceContextProvider
          initialSelectedGridcellID={DEFAULT_ENSO_CELL.gridCellId}
          initialDbRowIDOfSelectedGridcell={DEFAULT_ENSO_CELL.dbRowId}
        >
          <ViewMainInfoComponent heading={mainInfoHeading} mdxContent={MDX.pages.ShowCases.ENSO_Suitability} />

          <div
            className="flex min-h-0 w-full flex-col"
            style={{
              height: `calc(99.5dvh - ${layoutSizes.topNavbarHeight}px - ${layoutSizes.gapSize}px)`,
            }}
          >
            {/* ── Species & Forecast Month Controls ── */}
            <div
              className="mb-2 mt-[-7pt] flex w-full shrink-0 flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200/80 bg-white/70 px-4 py-2.5 shadow-xs backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/70 pointer-events-none"
              style={{
                marginLeft: `${layoutSizes.gapSize}px`,
                marginRight: `${layoutSizes.gapSize}px`,
                width: `calc(100% - ${layoutSizes.gapSize * 2}px )`,
              }}
            >
              <div className="flex flex-wrap items-center gap-6 pointer-events-auto">
                {/* Species Selector */}
                <div className="flex items-center gap-2 pointer-events-auto">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {getTranslation("species", "Species")}:
                  </span>
                  <Select value={species} onValueChange={(val) => setSpecies(val as SpeciesKey)}>
                    <SelectTrigger className="w-[200px] h-8 text-xs font-medium bg-white dark:bg-slate-800 pointer-events-auto">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel></SelectLabel>
                        {Object.entries(SPECIES).map(([key, name]) => (
                          <SelectItem key={key} value={key} className="text-xs">
                            {name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                {/* Forecast Month Selector */}
                <div className="flex items-center gap-2 pointer-events-auto">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {getTranslation("forecastMonth", "Forecast Month")}:
                  </span>
                  <Select
                    value={String(fcIdx)}
                    onValueChange={(val) => setFcIdx(Number(val))}
                    disabled={fcColumns.length === 0}
                  >
                    <SelectTrigger className="w-[220px] h-8 text-xs font-medium bg-white dark:bg-slate-800 pointer-events-auto">
                      <SelectValue
                        placeholder={
                          fcColumns.length === 0
                            ? getTranslation("noForecastMonths", "No forecast months available")
                            : undefined
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel></SelectLabel>
                        {fcColumns.length === 0 ? (
                          <SelectItem value="0" disabled className="text-xs">
                            {getTranslation("noForecastMonths", "No forecast months available")}
                          </SelectItem>
                        ) : (
                          fcColumns.map((col, i) => (
                            <SelectItem key={col} value={String(i)} className="text-xs">
                              {formatForecastLabel(col)}
                            </SelectItem>
                          ))
                        )}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Active Status Badge */}
              <div className="flex items-center gap-2 pointer-events-auto">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/60 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60">
                  {activeFcCol ? formatForecastLabel(activeFcCol) : currentTableName}
                </span>
              </div>
            </div>

            {/*** START: grid layout ***/}
            <div ref={swapContainerRef} className="grid min-h-0 w-full flex-1 grid-cols-6" style={{
              gridTemplateRows: "repeat(9, minmax(0, 1fr))",
              gap: `${layoutSizes.gapSize}px`,
              paddingRight: `${layoutSizes.gapSize}px`,
              paddingLeft: `${layoutSizes.gapSize}px`,
            }}>

              {/*** Top Card: 4 Climatic Factors + Suitability (Backend SVG) ***/}
              <SGridPlotCard rowColSpan={[4, 6]} cardProps={climateFactorsCardProps}>
                <ClimateForecastStaticChartComponent
                  fileName="climate_forecast_cell.svg"
                  dataset={currentTableName}
                  month={activeMonthAbbr}
                />
              </SGridPlotCard>

              {/*** Bottom Left Card: Forecast Map (Prediction) with Overview Minimap ***/}
              <SGridPlotCard rowColSpan={[5, 3]} cardProps={forecastMapCardProps}>
                {activeFcCol && (
                  <>
                    {/* Stable key preserves map viewport and zoom across dataset / month switches */}
                    <LeafD3MapLayerComponent key="fc-map" props={forecastMapProps} />
                    <MiniMapOverlay
                      mapProps={{ ...forecastMapProps, center: [12, 20] }}
                      height={115}
                      zoom={-0.9}
                      bottom={50}
                      left={4}
                      label={getTranslation("overview", "Overview")}
                    />
                  </>
                )}
              </SGridPlotCard>

              {/*** Bottom Right Card: Reference Map ***/}
              <SGridPlotCard rowColSpan={[5, 3]} cardProps={referenceMapCardProps}>
                {activeFcCol && (
                  <LeafD3MapLayerComponent key="ref-map" props={referenceMapProps} />
                )}
              </SGridPlotCard>

            </div>
          </div>
        </InterfaceContextProvider>
      </main>
    </>
  );
}

/**
 * Renders backend-generated static SVG/PNG charts for climate factors & forecasts for selected cell.
 */
function ClimateForecastStaticChartComponent({
  fileName,
  dataset,
  month,
}: {
  fileName: string;
  dataset?: string;
  month?: string;
}) {
  const t = useTranslations("page_home.ShowCases.page_ENSO_Suitability");
  const svgLocale = useLocale() === "de" ? "de" : "en";
  const contexT = useInterfaceContext();
  const rowID = contexT.dbRowID_of_selectedGridcellID;
  const requestedSrc = rowID !== -1
    ? apiRoutes.getUncertaintySvg({ filename: fileName, cellID: rowID, dataset, month, locale: svgLocale })
    : "";
  const [displayedSrc, setDisplayedSrc] = useState("");

  return (
    <StaticSvgChart
      key={requestedSrc || "empty"}
      requestedSrc={requestedSrc}
      displayedSrc={displayedSrc}
      onLoaded={setDisplayedSrc}
      alt={t("svg.alt")}
      emptyLabel={t("selectCellPrompt")}
    />
  );
}

function StaticSvgChart({
  requestedSrc,
  displayedSrc,
  onLoaded,
  alt,
  emptyLabel,
}: {
  requestedSrc: string;
  displayedSrc: string;
  onLoaded: (src: string) => void;
  alt: string;
  emptyLabel: string;
}) {
  const [isLoading, setIsLoading] = useState(
    Boolean(requestedSrc && requestedSrc !== displayedSrc),
  );
  const L_svgLoader = useLoadingTask('Climate Forecast Chart');
  const shownSrc = requestedSrc ? displayedSrc : "";

  useEffect(() => {
    if (isLoading) {
      L_svgLoader.start();
    } else {
      L_svgLoader.stop();
    }
  }, [isLoading, L_svgLoader]);

  return (
    <div className="relative w-full h-full">
      {shownSrc ? (
        // The SVG is generated dynamically by the backend and has no fixed size.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shownSrc}
          alt={alt}
          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '8px' }}
          className={isLoading ? "opacity-40 blur-[1px] transition-all duration-300" : "transition-all duration-300"}
        />
      ) : (
        <div className="flex items-center justify-center h-full text-slate-400 text-sm italic">
          {emptyLabel}
        </div>
      )}

      {isLoading && requestedSrc && (
        // Preload the new SVG while the previous one remains visible.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={requestedSrc}
          alt=""
          className="hidden"
          onLoad={() => {
            onLoaded(requestedSrc);
            setIsLoading(false);
          }}
          onError={() => setIsLoading(false)}
        />
      )}

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/30 backdrop-blur-[1px] z-10">
          <LoadingSpinnerAnimation />
        </div>
      )}
    </div>
  );
}
