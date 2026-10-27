"use client";

import React, { useRef, useEffect, useState } from 'react'
import { apiRoutes } from "@/app/api_routes";
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
import EnsoClimateChart from "./EnsoClimateChart";
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
/** Supported mosquito-vector species for the paired SEAS5 forecast tables.
 *
 * @example
 * ```ts
 * const vectorSpecies: SpeciesKey = "albopictus";
 * ```
 */
type SpeciesKey = "albopictus" | "aegypti";
/** Display labels for the supported forecast species. */
const SPECIES: Record<SpeciesKey, string> = {
  albopictus: "Aedes albopictus",
  aegypti: "Aedes aegypti",
};

/**
 * Initial grid-cell and database-row selection for the ENSO showcase.
 *
 * @remarks `gridCellId` identifies the client-side map cell while `dbRowId`
 * identifies its database row for the backend climate-forecast SVG request.
 */
const DEFAULT_ENSO_CELL = {
  dbRowId: 48292,
  gridCellId: 300625,
} as const;

/**
 * Resolves the consolidated SEAS5 habitat-probability relation for a species.
 *
 * @param species - Mosquito species key selected in the showcase.
 * @returns Relation containing the forecast and reference columns for that species.
 *
 * @example
 * ```ts
 * tableName("albopictus"); // "seas5_forecast_albopictus_habitat_probability"
 * ```
 */
function tableName(species: SpeciesKey): string {
  return `seas5_forecast_${species}_habitat_probability`;
}

/**
 * Formats a forecast column for the month selector and status badge.
 *
 * @param col - Forecast column in `forecast_<month>_<year>` form.
 * @param prefix - Localized label before the month.
 * @param monthLabel - Localized month name; otherwise capitalizes the schema abbreviation.
 * @returns Human-readable label, or the unchanged input for an invalid column.
 *
 * @example
 * ```ts
 * prettyFcLabel("forecast_aug_2026", "Forecast", "August"); // "Forecast: August 2026"
 * ```
 */
function prettyFcLabel(col: string, prefix = "Forecast", monthLabel?: string): string {
  const forecast = parseEnsoForecastColumn(col);
  if (!forecast) return col;
  const month = monthLabel ?? forecast.month[0].toUpperCase() + forecast.month.slice(1);
  return `${prefix}: ${month} ${forecast.year}`;
}

/**
 * Creates a chronological sort key from a forecast column.
 *
 * @param col - Candidate forecast column name.
 * @returns `[year, one-based month]`, or `[Infinity, Infinity]` for a non-forecast field.
 *
 * @example
 * ```ts
 * fcColSortKey("forecast_aug_2026"); // [2026, 8]
 * ```
 */
function fcColSortKey(col: string): [number, number] {
  const forecast = parseEnsoForecastColumn(col);
  return forecast
    ? [forecast.year, forecast.monthIndex]
    : [Infinity, Infinity];
}

/**
 * Renders the cell-linked ENSO habitat-suitability showcase route.
 *
 * @returns The localized selector, paired Leaflet maps, and cell-level climate chart.
 *
 * @remarks
 * Species selects a consolidated SEAS5 relation. Forecast columns are discovered
 * from that relation and sorted chronologically; the chosen month determines both
 * the forecast feature and its fixed-period reference feature. The forecast map
 * publishes viewport coordinates while the reference map receives them. The
 * `InterfaceContextProvider` seeds a corresponding grid-cell/database-row pair,
 * allowing the climate chart to request JSON for the selected cell.
 * `SGridPlotCard` supplies per-card loading state and Swapy layout behavior.
 * Column discovery currently uses an effect-scoped `fetch` with a cancellation
 * guard, so it does not participate in the shared JSON hook's cache or request
 * deduplication.
 *
 * @see {@link parseEnsoForecastColumn} for accepted forecast column names.
 * @see {@link referenceColumnForForecast} for month-paired reference fields.
 * @see {@link EnsoClimateChart} for the cell-level interactive chart.
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
  

  /** Returns a localized rich-text label as a string, using the supplied fallback when unavailable. */
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

  /** Combines the parsed forecast date with localized month and prefix labels. */
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

              {/*** Top Card: 4 Climatic Factors + Suitability ***/}
              <SGridPlotCard rowColSpan={[4, 6]} cardProps={climateFactorsCardProps}>
                <EnsoClimateChart
                  dataset={currentTableName}
                  activeMonth={parseEnsoForecastColumn(activeFcCol)?.monthIndex}
                  activeYear={parseEnsoForecastColumn(activeFcCol)?.year}
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
