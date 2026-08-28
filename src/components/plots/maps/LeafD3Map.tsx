"use client";
import React, { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot, Root } from "react-dom/client";
import {useLoadingTask, LoadingSpinnerAnimation} from './utils/loadingSpinner';

// ─── Shared hooks & utils (extracted from nested component definitions) ───
import {
    useLeafletInit,
    useMapPosition,
    useMapResize,
    useMapDistance,
    useMapTransition,
    useGridDataParser,
    useCanvasGridLayer,
    useGridLayer,
    useLayerUpdateDebounce,
    useTooltipCleanup,
    useDynamicSettingsTop,
} from './hooks';
import { clampCoordinates, resetTimeout as sharedResetTimeout, removeReusedTooltip } from './utils/mapUtils';
import MapContentChild from './MapContentChild';
import { RANGE_LAT, RANGE_LONG, MAX_ZOOM, MIN_ZOOM, ZOOM_STEP, CALCER } from './constants';

import {
    getMinMaxFeature,
    getGridCellIndex,
    pointParser,
    getGridOffset,
    snapToGrid,
    roundLatLng,
    getCountryCenterFromMapData,
    getContrastTextColorForBgColor,
    getOceanMaskGeoJSON,
    renderStandardTooltipHTML,
    getGoodReadableRange,
    getActiveStringFilters,
    passesStringFilters,
    isDatasetIncluded,
    type MapStringFilter,
} from './helpers';
import stateMappersGermany from '@/app/helpers';
import {
    metaDataT,
    alignFeature_to_Metadata,
} from '../MetaDataHandler';
import {availableColorMaps, getPresenceDataColor} from './constants';
import * as d3 from 'd3';
import {useInterfaceContext} from '@/components/contexts/InterfaceContext';
import { apiRoutes } from '@/app/api_routes';
import { PrintDataLoadingErrors, handleLoadDataError } from '@/app/helpers';
import { useGetJSONData } from '@/app/hooks/useFetchAndCache';
import SizeHook from '@/app/hooks/useResizeObserver';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox";
import { useLocale ,useTranslations } from "next-intl";
import { t_richConfig, country_names, country_names_de, dbDATA, categoricalColors, categoryCoordsMap, GERMAN_STATE_ALIASES } from '@/app/const_store';
import { Locale } from '@/i18n/routing';
import useChartResizer from '@/app/hooks/useChartResizer';
import * as GEOjson from 'geojson';
import {HoverCardTooltip} from '@/components/layout/InfoCards';
import ColorMapLegend from './overlays/ColorMapLegend';
import LatLngZoomLegend from './overlays/LatLngZoomLegend';
import { DonutTooltip, PolylineTooltip, getLabelPolyline } from './overlays/DonutTooltip';
import {MDXContentProvider} from '@messages/markdown/MDXContentProvider';
import type { MapGridResponseV1 } from './types';

// Icons
import {Settings,
    X} from "iconoir-react";
import  {MosquitoIcon} from '@messages/reactIcons'

// Leaflet
import {
     Circle,
     FeatureGroup,
     LayerGroup,
     LayersControl,
     MapContainer,
     Marker, Popup,
     Rectangle,
     TileLayer,
     useMap,
     useMapEvents,
    SVGOverlay} from 'react-leaflet';
import LeafletMapComponent, {LeafletComponentProps} from './BaseMap';
import type { LeafletMouseEvent } from 'leaflet';

import { format, set, setDate, addMonths, isAfter } from "date-fns";
import { Calendar as CalendarIcon, CheckCircle2Icon, PopcornIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type * as Leaflet from "leaflet";
import { metadata } from '@/app/[locale]/layout';

/** Pre-configured Leaflet base-map props used as a starting template by every `LeafD3MapLayerComponent` instance. */
let leafProps = LeafletComponentProps("LeafletMap1", apiRoutes.FETCH_MAP_DATA.WORLD_MAP, "exampleVar");
leafProps.center = [-20, 25.8];
leafProps.zoom = 1.5;

type FetchDbDataParams = Parameters<typeof apiRoutes.fetchDbData>[0];

function buildMapDatasetURL(params: FetchDbDataParams, compactGrid: boolean): string {
    return apiRoutes.fetchDbData({
        ...params,
        responseFormat: compactGrid ? 'map-grid-v1' : undefined,
    });
}

function getRelationNameFromDatasetURL(url: string): string {
    if (!url) return "";
    try {
        return new URL(url, "http://localhost").searchParams.get("relationName") || "";
    } catch {
        return "";
    }
}

/**
 * Duration in milliseconds for the animated `flyTo` transition when the map
 * navigates to a newly selected country or region.
 *
 * @remarks
 * This value is shared with `useMapTransition` and controls both the Leaflet
 * `flyTo` animation and the grid-layer transition guard that suppresses
 * redundant canvas redraws during the tween.
 */
const mapFlyTransitionTime = 1800;

/** Horizontal pixel offset between overlay legends and the map container edge. */
const legendDistanceToMapBorderX = 5;
/** Vertical pixel offset between overlay legends and the map container edge. */
const legendDistanceToMapBorderY = 5;
/** Approximate pixel height of the Leaflet attribution logo, used to offset the color-map legend. */
const leafletLogoHeight = 14;
/** ISO-3 column used by the epidemiology dataset for country filtering. */
const COVID_COUNTRY_FILTER_COLUMN = "iso_3166_1_alpha_3";

// Default dates moved to state within the component


export { passesStringFilters, isDatasetIncluded };
export type { MapStringFilter };

/**
 * Full configuration interface for a single ICV `LeafD3MapLayerComponent`
 * instance.
 *
 * Combines map viewport settings, UI control visibility, data-layer
 * toggles, interaction guards, and visual styling into one cohesive
 * props contract. Use the companion factory function
 * {@link LeafD3MapLayerProps} to create a fully-defaulted instance.
 *
 * @remarks
 * The component supports three heterogeneous data streams rendered as
 * independent visual layers:
 * 1. **Grid data** – rasterised environmental / model-prediction cells
 *    drawn via a Leaflet `L.GridLayer` (canvas tiles).
 * 2. **Presence data** – point observations (e.g. mosquito sightings or
 *    COVID-19 case aggregates) rendered as D3 circles / image overlays.
 * 3. **Sequence metadata** – per-country donut charts showing
 *    taxonomic or serotype distributions (e.g. Dengue DENV-1–4).
 *
 * Client and server state are decoupled via `InterfaceContext`; set
 * `isApplyContextData` to subscribe to global context changes and
 * `isSetIntialContextDataFromComponent` to seed the context from this
 * component's defaults on mount.
 *
 * @example
 * ```tsx
 * import { LeafD3MapLayerProps } from './LeafD3Map';
 *
 * const config: LeafD3MapLayerProps = {
 *   chartName: "albopictus-habitat-map",
 *   mapDataURL: "/api/map/world",
 *   dataURL: "/api/data/grid",
 *   center: [51.16, 10.45],
 *   zoom: 5,
 *   mapUIsettings: {
 *     areSettingsOpen: true,
 *     isLongitudeSlider: true,
 *     isLatitudeSlider: true,
 *     isZoomSlider: true,
 *     isColorMapSelectionDropdown: true,
 *     isFeatureSelectionDropdown: true,
 *     isDatasetSelectionDropdown: true,
 *     isCountrySelectionDropdown: false,
 *     isCountrySelectionDropdownMapBased: false,
 *     isDoNotApplyCountryFromContext: false,
 *     isDatePicker: false,
 *     isDistanceLegend: true,
 *     isColorMapLegend: true,
 *     filterStringForAvailableDatasetInclude: "albopictus",
 *     filterStringForAvailableDatasetExclude: "?",
 *     filterStringForAvailableFeature: "",
 *     defaultDatasetName: "t_2024_monthly_mean_7_ocsvm_albopictus",
 *     defaultFeatureName: "prob_7",
 *     defaultDatasetURL: "",
 *     defaultFeatureColorMap: "interpolateInferno",
 *     isPresenceData: true,
 *     isPresenceDataChecked: true,
 *     presenceDataColor: "rgb(239, 23, 23)",
 *     isSequenceMetaData: false,
 *     isSequenceMetaDataChecked: false,
 *     defaultDonutSize: 50,
 *     defaultLayerOpacity: 0.85,
 *   },
 *   mapInteractions: { disableMouse: false, disableScroll: false, disableClick: false },
 *   mapDataSets: { isGridData: true, isPresenceData: true, isSequenceMetaData: false },
 *   mapStyles: {
 *     strokeWidth: 1.5,
 *     strokeColor: "#000000",
 *     fillColor: "#ffffff",
 *     fillOpacity: 0.0,
 *     backgroundColor: "#ffffff",
 *   },
 *   isApplyContextData: true,
 *   isStaticAutoFitFullSize: false,
 * };
 * ```
 *
 * @see {@link LeafD3MapLayerProps} (factory function)
 * @see {@link LeafD3MapLayerComponent} for the primary map component consumer.
 * @see {@link useInterfaceContext} for multi-view state context synchronization.
 * @see {@link useGridLayer} for spatial canvas tile layer rendering.
 * @see {@link useGetJSONData} for API payload fetching and LRU caching.
 * @see {@link useGridDataParser} for geometry indexing.
 */
export interface LeafD3MapLayerProps {
    /** Unique DOM id for the root `<svg>` / chart container. Must be page-unique when multiple maps coexist. */
    chartName: string;
    /** URL (or GeoJSON object) for the base political boundary map (e.g. world countries). */
    mapDataURL: any;
    /** URL (or raw data) for the primary analytical dataset rendered as the grid layer. */
    dataURL: any;
    /** Initial map centre as `[latitude, longitude]`. */
    center: [number, number];
    /** Initial zoom level. Clamped to `[MIN_ZOOM, MAX_ZOOM]` at runtime. */
    zoom: number;

    /**
     * UI control visibility and defaults for the settings panel overlay.
     *
     * @remarks
     * All boolean `is*` flags toggle the **visibility** of the respective
     * control widget. The `default*` strings set the initial value for
     * dropdowns and are reconciled with the global `InterfaceContext`
     * on mount.
     */
    mapUIsettings: {
        /**
         * Whether the settings panel starts expanded.
         * @default true
         */
        areSettingsOpen?: boolean;
        /**
         * Enable a CSS opacity+scale transition when toggling the settings panel.
         * @default false
         */
        isSettingsBlendAnimation?: boolean;
        /**
         * If `true`, the settings-toggle gear icon auto-hides after the panel closes.
         * @default false
         */
        isAutoHideSettingsToggle?: boolean;
        /** Show the longitude range slider. */
        isLongitudeSlider: boolean;
        /** Show the latitude range slider. */
        isLatitudeSlider: boolean;
        /** Show the zoom range slider. */
        isZoomSlider: boolean;
        /**
         * Show the lat/lng/zoom numeric overlay in the lower-left corner.
         * @default true
         */
        isLatLngZoomOverlay?: boolean;
        /** Show the color-map palette dropdown (e.g. Inferno, Viridis, RdBu). */
        isColorMapSelectionDropdown: boolean;
        /** Show the feature / variable selection dropdown. */
        isFeatureSelectionDropdown: boolean;
        /** Show the dataset selection dropdown. */
        isDatasetSelectionDropdown: boolean;
        /** Show the country selection dropdown (plain text list). */
        isCountrySelectionDropdown: boolean;
        /**
         * When `true`, selecting a country from the dropdown also flies the map
         * viewport to the selected country's bounding box.
         */
        isCountrySelectionDropdownMapBased: boolean;
        /**
         * When `true`, the component ignores `selectedCountry` updates from
         * `InterfaceContext`. Useful when two maps share a context but need
         * independent country selections.
         */
        isDoNotApplyCountryFromContext: boolean;
        /** Show the date-range picker (calendar popover). */
        isDatePicker: boolean;
        /** Show the distance scale-bar legend in the lower-left corner. */
        isDistanceLegend: boolean;
        /** Show the continuous colour-map legend in the lower-right corner. */
        isColorMapLegend: boolean;
        /**
         * Include filter for dataset keys. Only datasets whose key contains at
         * least one of these substrings are shown in the dropdown.
         * An empty string or empty array means "show all".
         */
        filterStringForAvailableDatasetInclude: MapStringFilter;
        /**
         * Exclude filter for dataset keys. Datasets whose key contains at least
         * one of these substrings are hidden from the dropdown.
         * An empty string or empty array disables the filter.
         * @default "?"
         */
        filterStringForAvailableDatasetExclude: MapStringFilter;
        /**
         * If set, only features (column names) containing at least one of these
         * substrings are shown in the feature dropdown. Useful for monthly
         * prediction columns like `"prob_"` or `"mean_"`.
         * An empty string or empty array means "show all".
         */
        filterStringForAvailableFeature: MapStringFilter;
        /** Database relation name of the initially selected dataset. */
        defaultDatasetName: string;
        /** Column name of the initially selected feature / variable. */
        defaultFeatureName: string;
        /**
         * Activates the COVID-19 epidemiology view mode. In this mode the map
         * reads aggregated RKI data for Germany, renders SVG circles instead of
         * a raster grid, and supports country/sub-region aggregation toggles.
         * @default false
         */
        inCovidDataView?: boolean;
        /** Fully-resolved API URL for the default dataset (auto-populated by the factory). */
        defaultDatasetURL: string;
        /**
         * D3 interpolator key used as the default color map.
         * @default "interpolateInferno"
         */
        defaultFeatureColorMap: string;
        /** Enable the presence-data layer toggle checkbox in the UI. */
        isPresenceData: boolean;
        /** Whether the presence-data layer is initially checked (active). */
        isPresenceDataChecked: boolean;
        /**
         * CSS colour string for presence-data point markers.
         * Falls back to `"rgb(239, 23, 23)"` (red) when empty.
         */
        presenceDataColor: string;
        /** Enable the sequence-metadata (donut chart) layer toggle in the UI. */
        isSequenceMetaData: boolean;
        /** Whether the sequence-metadata layer is initially checked (active). */
        isSequenceMetaDataChecked: boolean;
        /**
         * Base diameter (in pixels) of per-country donut charts.
         * Actual rendered size is scaled by a `d3.scaleSqrt` based on sample count.
         * @default 50
         */
        defaultDonutSize: number;
        /**
         * Opacity of the data overlay layer (grid tiles, presence dots).
         * Range: `[0, 1]`.
         * @default 0.85
         */
        defaultLayerOpacity: number;
        /**
         * Request country-level aggregation (`aggregation_level=0`) from the API.
         * Mutually exclusive with `isSubregionLevelData` unless both are active
         * (in which case no aggregation filter is appended).
         */
        isCountryLevelData?: boolean;
        /**
         * Request sub-region-level aggregation (`aggregation_level=1`) from the API.
         * Auto-toggled at runtime when zoom crosses `zoomBreakpoint` in COVID view.
         */
        isSubregionLevelData?: boolean;
        /**
         * Show country-level / sub-region-level checkboxes for data filtering.
         * Only meaningful in COVID epidemiology view.
         */
        dataFilteringCheckboxes?: boolean;
    };

    /**
     * Guards to selectively disable user interaction with the Leaflet map.
     *
     * @remarks
     * Useful for "thumbnail" or "preview" map instances embedded inside
     * showcase cards where pan/zoom should be locked.
     */
    mapInteractions: {
        /** Disable mouse dragging (pan). @default false */
        disableMouse?: boolean;
        /** Disable scroll-wheel zoom. @default false */
        disableScroll?: boolean;
        /** Disable click-to-select on polygons and grid cells. @default false */
        disableClick?: boolean;
    };

    /**
     * Feature flags controlling which data layers the component should
     * fetch and render.
     */
    mapDataSets: {
        /** Fetch and render the rasterised grid data layer (canvas tiles). */
        isGridData: boolean;
        /** Fetch and render point-based presence / occurrence data. */
        isPresenceData: boolean;
        /** Fetch and render per-country sequence-metadata donut charts. */
        isSequenceMetaData: boolean;
        /**
         * Fetch and render capital city name labels at high zoom levels.
         * @default true
         */
        isCityNames?: boolean;
    };

    /**
     * Leaflet `PathOptions`-compatible styling for country polygons
     * and the map background.
     */
    mapStyles: {
        /** Stroke width in pixels for country borders. @default 1.5 */
        strokeWidth: number;
        /** Hex colour for country border strokes. @default "#000000" */
        strokeColor: string;
        /** Hex colour for country polygon fills. @default "#ffffff" */
        fillColor: string;
        /** Fill opacity for country polygons. Range `[0, 1]`. @default 0.0 */
        fillOpacity: number;
        /** CSS background colour of the map container (ocean areas). @default "#ffffff" */
        backgroundColor: string;
        /**
         * Show the standard grid-data tooltip on mouse hover.
         * @default true
         */
        isTooltopVisible?: boolean;
        /**
         * Show a pin-style marker at the cursor position instead of the tooltip.
         * @default false
         */
        isMapMarkerTooltipVisible?: boolean;
    };

    /**
     * Subscribe to shared `InterfaceContext` state changes (dataset URL,
     * selected feature, color map, date range, country selection, etc.).
     *
     * @remarks
     * When `true`, the component synchronises its local state with the
     * global context on every relevant context change. This is the
     * primary mechanism for coordinated multi-view dashboards.
     */
    isApplyContextData: boolean;

    /**
     * If `true`, the component writes its initial local state (dataset URL,
     * feature, color map, layer opacity, etc.) into `InterfaceContext` on mount.
     * Use this on the "primary" map in a multi-view layout to seed defaults.
     */
    isSetIntialContextDataFromComponent?: boolean;

    /**
     * When `true`, this map instance broadcasts its current
     * `{ latitude, longitude, zoom }` to `InterfaceContext.mapCoords`
     * (debounced at 1 s) so other RECEIVER maps can mirror the viewport.
     */
    isSyncMapCoordsOnTheFly_SETTER?: boolean;

    /**
     * When `true`, this map instance listens to `InterfaceContext.mapCoords`
     * and updates its viewport to match the SETTER map.
     */
    isSyncMapCoordsOnTheFly_RECIEVER?: boolean;

    /**
     * Enable animated `flyTo` transitions when the global
     * `mapSelectionObj` changes (e.g. user clicks a country in another
     * view).
     */
    isApplyTransitions?: boolean;

    /**
     * Automatically fit the map viewport to the full extent of the loaded
     * GeoJSON boundaries on first render. Overrides `center` / `zoom`.
     */
    isStaticAutoFitFullSize: boolean;

    /**
     * Use a D3 equirectangular projection for distance calculations
     * instead of the default Leaflet Web-Mercator projection.
     */
    isProjection_equirectangular?: boolean;
}

/** Success banner shown after presence data has finished loading. */
function DataLoadSuccessAlert({ locationCount }: { locationCount: number }) {
    return (
        <div
            role="alert"
            className="flex items-start gap-3 rounded-md border border-green-300 bg-green-50 p-4 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-100"
        >
            <CheckCircle2Icon className="mt-1 h-5 w-5 text-green-500" />
            <div className="flex flex-col">
                <span className="font-semibold"></span>
                <span className="text-sm text-green-700 dark:text-green-300">
                    {locationCount > 0
                        ? `Data loaded for ${locationCount} locations.`
                        : "Data loaded. No new data points for the selection."}
                </span>
            </div>
        </div>
    );
}

/**
 * Factory function that creates a fully-defaulted {@link LeafD3MapLayerProps}
 * object.
 *
 * Every nested settings group is shallow-merged with sensible ICV defaults,
 * so callers only need to specify the overrides they care about.
 *
 * @param chartName                        - Unique chart / DOM id.
 *                                           @default `"D3mapLayer"`
 * @param mapDataURL                       - URL for the base GeoJSON boundaries.
 *                                           @default `apiRoutes.FETCH_MAP_DATA.WORLD_MAP`
 * @param dataURL                          - Optional data-layer URL override.
 * @param mapUIsettings                    - Partial UI settings merged onto defaults.
 * @param mapInteractions                  - Partial interaction guards merged onto defaults.
 * @param mapDataSets                      - Partial data-layer toggles merged onto defaults.
 * @param center                           - Initial `[lat, lng]` viewport centre.
 *                                           @default `[9.7, 52]`
 * @param zoom                             - Initial zoom level. @default `2`
 * @param mapStyles                        - Partial polygon / background styles merged onto defaults.
 * @param isStaticAutoFitFullSize          - Auto-fit viewport to GeoJSON bounds on mount.
 *                                           @default `false`
 * @param isApplySelectionsAndTransitions  - Subscribe to global `InterfaceContext`.
 *                                           @default `true`
 * @param isApplyTransitions               - Enable `flyTo` transitions on selection change.
 *                                           @default `false`
 * @param isProjection_equirectangular     - Use equirectangular projection for distance calcs.
 *                                           @default `false`
 * @param isSyncMapCoordsOnTheFly_SETTER   - Broadcast viewport coords to context.
 *                                           @default `false`
 * @param isSyncMapCoordsOnTheFly_RECIEVER - Mirror viewport coords from context.
 *                                           @default `false`
 * @param isSetContextData                 - Seed `InterfaceContext` from this component on mount.
 *                                           @default `false`
 * @returns A complete, ready-to-render `LeafD3MapLayerProps` object.
 *
 * @example
 * ```tsx
 * const props = LeafD3MapLayerProps(
 *   "dengue-map",
 *   apiRoutes.FETCH_MAP_DATA.WORLD_MAP,
 *   undefined,
 *   {
 *     defaultDatasetName: "dengue_serotype_counts",
 *     defaultFeatureName: "country",
 *     isSequenceMetaData: true,
 *     isSequenceMetaDataChecked: true,
 *     defaultDonutSize: 60,
 *   },
 *   {},
 *   { isSequenceMetaData: true },
 *   [10.0, 8.0],
 *   3,
 * );
 *
 * <LeafD3MapLayerComponent props={props} />
 * ```
 *
 * @see {@link LeafD3MapLayerProps} (interface)
 */
export function LeafD3MapLayerProps(
    chartName = "D3mapLayer",
    mapDataURL = apiRoutes.FETCH_MAP_DATA.WORLD_MAP,
    dataURL?: string,
    mapUIsettings: any = {},
    mapInteractions: any = {},
    mapDataSets: any = {},
    center: [number, number] = [9.7, 52],
    zoom = 2,
    mapStyles: any = {},
    isStaticAutoFitFullSize = false,
    isApplySelectionsAndTransitions = true,
    isApplyTransitions = false,
    isProjection_equirectangular = false,
    isSyncMapCoordsOnTheFly_SETTER = false,
    isSyncMapCoordsOnTheFly_RECIEVER = false,
    isSetContextData = false
): LeafD3MapLayerProps {
    return {
        chartName,
        mapDataURL,
        dataURL,
        center,
        zoom,
        mapUIsettings: {
            areSettingsOpen: true,
            isSettingsBlendAnimation: false,
            isAutoHideSettingsToggle: false,
            isLongitudeSlider: true,
            isLatitudeSlider: true,
            isZoomSlider: true,
            isLatLngZoomOverlay: true,
            isColorMapSelectionDropdown: true,
            isFeatureSelectionDropdown: true,
            isCountrySelectionDropdown: true,
            isCountrySelectionDropdownMapBased: false,
            isDoNotApplyCountryFromContext: false,
            isDatePicker: true,
            isDatasetSelectionDropdown: true,
            isDistanceLegend: true,
            isColorMapLegend: true,
            filterStringForAvailableDatasetInclude: "",
            filterStringForAvailableDatasetExclude: "?",
            filterStringForAvailableFeature: "",
            isPresenceData: false,
            isPresenceDataChecked: false,
            presenceDataColor: "",
            isSequenceMetaData: false,
            isSequenceMetaDataChecked: false,
            defaultDonutSize: 50,
            defaultDatasetName: "",
            inCovidDataView: false,
            defaultFeatureName: "",
            defaultFeatureColorMap: "",
            defaultLayerOpacity: 0.85,
            ...mapUIsettings,
            defaultDatasetURL: mapUIsettings.defaultDatasetName
                ? buildMapDatasetURL(
                    { relationName: mapUIsettings.defaultDatasetName, feature: mapUIsettings.defaultFeatureName || "" },
                    mapDataSets.isGridData !== false && !mapUIsettings.inCovidDataView,
                )
                : "",
        },
        mapInteractions: {
            disableMouse: false,
            disableScroll: false,
            disableClick: false,
            ...mapInteractions,
        },
        mapDataSets: {
            isGridData: true,
            isPresenceData: true,
            isSequenceMetaData: true,
            isCityNames: true,
            ...mapDataSets,
        },
        mapStyles: {
            strokeWidth: 1.5,
            strokeColor: "#000000",
            fillColor: "#ffffffff",
            fillOpacity: 0.0,
            backgroundColor: "#ffffff",
            isTooltopVisible: true,
            isMapMarkerTooltipVisible: false,
            ...mapStyles,
        },
        isStaticAutoFitFullSize,
        isApplyContextData: isApplySelectionsAndTransitions,
        isSetIntialContextDataFromComponent: isSetContextData,
        isSyncMapCoordsOnTheFly_SETTER,
        isSyncMapCoordsOnTheFly_RECIEVER,
        isApplyTransitions,
        isProjection_equirectangular
    };
}
/**
 * Primary ICV map component that composites a Leaflet base map with
 * D3-powered analytical overlays.
 *
 * Renders up to four visual layers on a single Leaflet map instance:
 * 1. **Country polygons** – GeoJSON boundaries with hover/click interaction.
 * 2. **Grid data tiles** – equirectangular canvas tiles coloured by a
 *    sequential D3 colour map (e.g. habitat-suitability predictions).
 * 3. **Presence data** – point observations drawn as circles or canvas dots.
 * 4. **Sequence metadata** – D3 donut/pie charts anchored to country centroids.
 *
 * State is synchronised across multiple map instances via `InterfaceContext`
 * (see `isApplyContextData` / `isSyncMapCoordsOnTheFly_SETTER`).
 *
 * @param props - Fully-defaulted configuration created by the
 *                {@link LeafD3MapLayerProps} factory function.
 *
 * @remarks
 * - The component contains several nested "hook-functions" (`MapDrawLayer_*`,
 *   `MapMouseEvents`) that are called unconditionally at the top level of
 *   the render function. They use `useEffect` internally and **must not**
 *   be called conditionally to comply with the Rules of Hooks.
 * - During animated `flyTo` transitions, the `gridLayerTransitionRef` guard
 *   suppresses canvas tile redraws to avoid 60 synchronous repaints/s.
 *   A single clean repaint fires in `onTransitionEnd`.
 * - All data fetching is handled by the `useGetJSONData` hook which
 *   integrates SWR-style caching.
 *
 * @example
 * ```tsx
 * import LeafD3MapLayerComponent, { LeafD3MapLayerProps } from './LeafD3Map';
 *
 * const mapProps = LeafD3MapLayerProps(
 *   "habitat-suitability",
 *   undefined,
 *   undefined,
 *   {
 *     defaultDatasetName: "t_2024_monthly_mean_7_ocsvm_albopictus_predictions_2023_mod",
 *     defaultFeatureName: "prob_7",
 *     defaultFeatureColorMap: "interpolateInferno",
 *     isPresenceData: true,
 *     isPresenceDataChecked: true,
 *   },
 * );
 *
 * export default function HabitatPage() {
 *   return (
 *     <div className="w-full h-[600px]">
 *       <LeafD3MapLayerComponent props={mapProps} />
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link LeafD3MapLayerProps} (interface & factory)
 */
const LeafD3MapLayerComponent = ({props}: {props: LeafD3MapLayerProps}) => {



    leafProps.zoom = props.zoom;
    leafProps.center = props.center;
    leafProps.isProjection_equirectangular = props.isProjection_equirectangular;

    // If UI settings enable presence data or sequence metadata, ensure dataset capability flags are enabled
    if (props.mapUIsettings.isPresenceData) {
        props.mapDataSets.isPresenceData = true;
    }
    if (props.mapUIsettings.isSequenceMetaData) {
        props.mapDataSets.isSequenceMetaData = true;
    }


   

    const defaultColorMap = props.mapUIsettings.defaultFeatureColorMap || "interpolateInferno"; // default color map for the map layer

    const t = useTranslations("component_D3MapLayerComponent");
    const locale = useLocale() as Locale; 

    const MDX = MDXContentProvider[locale].MapUI || MDXContentProvider["en"].MapUI;

    let selected_country_names = locale === "de" ? country_names_de : country_names;


    // legend difenition
    // general
    const id_scaleBar = "scale-bar"+props.chartName;
    const id_colorMap = "color-map"+props.chartName;
        let mapSvg = document.getElementById(props.chartName) as HTMLElement;
        let mapSvgHeight = mapSvg ? mapSvg.clientHeight : 0;
        let mapSvgWidth = mapSvg ? mapSvg.clientWidth : 0;
        let barWidth = 10;

    // color map
        const colMapHeight = 160;
        const colMapWidth = 60;
        const colMapDims = useMemo(() => ({
            width: colMapWidth,
            height: colMapHeight,
            posX: mapSvgWidth - colMapWidth - legendDistanceToMapBorderX,
            posY: mapSvgHeight - colMapHeight - legendDistanceToMapBorderY-leafletLogoHeight
        }), [mapSvgWidth, mapSvgHeight, colMapWidth, colMapHeight]);
    // distance legend
        const scaleLegHeight = 35;
        const scaleLegWidth = 118;
        const scaleLegDims = useMemo(() => ({
            width: scaleLegWidth,
            height: scaleLegHeight,
            posX: legendDistanceToMapBorderX,
            posY: legendDistanceToMapBorderY
        }), [scaleLegWidth, scaleLegHeight]);

        // country  countours

       
const strokeWidth = props.mapStyles?.strokeWidth ?? 1.5;
const baseStyle: Leaflet.PathOptions = {
            color: props.mapStyles?.strokeColor ?? "#000000",
            fillColor: props.mapStyles?.fillColor ?? "#ffffff",
            fillOpacity: props.mapStyles?.fillOpacity ?? 1,
            weight: strokeWidth,
            fill: true,
            lineJoin: "round",
            lineCap: "round",
        };

        const hoverStyle: Leaflet.PathOptions = {
            ...baseStyle,
            //fillColor: "rgb(29, 73, 217)",
            color: "rgb(24, 245, 216)",
            //fillOpacity: 0.5,
            weight: strokeWidth + 3,
            lineJoin: "round",
            lineCap: "round",
        };

        const activeStyle: Leaflet.PathOptions = {
            ...baseStyle,
            color: "rgb(234, 255, 0)",
            //fillOpacity: 0.3,
            weight: strokeWidth + 3,
            lineJoin: "round",
            lineCap: "round",

            //dashArray: "6 6",
        };



        if(props.mapUIsettings.isDistanceLegend === false){
            scaleLegDims.width = 0; // hide distance legend
        }

        const geoLayerRef = useRef<L.GeoJSON | null>(null);
        const oceanMaskLayerRef = useRef<L.GeoJSON | null>(null);
        const SVG_ref = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | undefined>(undefined);
        const SVGLayer_ref = useRef<L.SVG  | null>(null);
        const SVG_tooltip_ref = useRef<HTMLDivElement | null>(null);
        const piesMerged = useRef<d3.Selection<SVGGElement, any, SVGGElement, unknown> | undefined>(undefined);
        const root = useRef<Root | undefined>(undefined);
        useEffect(() => {
            if (SVG_tooltip_ref.current && root.current == undefined) {
                root.current = createRoot(SVG_tooltip_ref.current!);
            }
        }, [SVG_tooltip_ref.current]);
    

    // *** Leaflet *** //
    /***************************************************************/

    // ─── Shared hook: SSR-safe Leaflet init (replaces nested useEffect + import) ───
    const L = useLeafletInit();

    const [map, setMap] = useState<L.Map | null>(null);
    const mapRefVal = useRef<L.Map | null>(null);
    const mapRef = useMemo(() => {
        return {
            get current() {
                return mapRefVal.current;
            },
            set current(value: L.Map | null) {
                mapRefVal.current = value;
                setMap(value);
            }
        };
    }, []);


    // map settings
    useEffect(() => {
        if (!map) return;
        if (props.mapInteractions.disableMouse) {
            map.dragging.disable();
        }
        if (props.mapInteractions.disableScroll) {
            map.scrollWheelZoom.disable();
        }

    }, [map, props.mapInteractions.disableMouse, props.mapInteractions.disableScroll]);

    /******************************************************** Leaflet */

    // initialize component variables
    let contextT = useInterfaceContext();
    let collectDataLoadingErrors =  useRef<React.ReactNode[]>([]);
    let chart:string = props.chartName;

     
    const mapUIsettings = { ...props.mapUIsettings };
    const useCompactGridResponse = props.mapDataSets.isGridData && !mapUIsettings.inCovidDataView;
    const resolvedDefaultDatasetURL = mapUIsettings.defaultDatasetURL || (
        mapUIsettings.defaultDatasetName
            ? buildMapDatasetURL({
                relationName: mapUIsettings.defaultDatasetName,
                feature: mapUIsettings.defaultFeatureName,
                aggregation_level: mapUIsettings.inCovidDataView ? (mapUIsettings.isCountryLevelData ? 0 : mapUIsettings.isSubregionLevelData ? 1 : undefined) : undefined,
                startDate: mapUIsettings.inCovidDataView && contextT.dateRange?.from && contextT.dateRange?.to
                    ? format(contextT.dateRange.from, "yyyy-MM-dd")
                    : undefined,
                endDate: mapUIsettings.inCovidDataView && contextT.dateRange?.from && contextT.dateRange?.to
                    ? format(contextT.dateRange.to, "yyyy-MM-dd")
                    : undefined,
            }, useCompactGridResponse)
            : ""
    );
    mapUIsettings.defaultDatasetURL = resolvedDefaultDatasetURL;

    // *** Types *** //

    /**
     * Parsed visual-data record for a single grid cell.
     *
     * @remarks
     * The `geometry` array contains the polygon vertices as
     * `[latitude, longitude]` pairs (equirectangular grid cells are
     * typically rectangles with 5 vertices including the closing point).
     * `visDatIdx` is the flat index into the original response array;
     * `rowID` maps back to the database primary key for drill-down.
     */
    type visDataT = {
        /** Polygon vertices as `[lat, lng]` tuples. */
        geometry?: [number, number][];
        /** Compact north-west anchor for uniform grid cells. */
        topLeft?: [number, number];
        /** Exact projection-aware bounds `[north, south, west, east]`. */
        bounds?: [number, number, number, number];
        /** Four source corners as flat `[lat0,lng0,...,lat3,lng3]`. */
        corners?: [number, number, number, number, number, number, number, number];
        /** Numeric feature value for this cell (e.g. habitat-suitability probability). */
        feature: number;
        /** Index within the parsed visual-data `Map`. */
        visDatIdx?: number;
        /** Database row id, used for linking click events back to raw records. */
        rowID?: number;
    }

    /**
     * Raw presence / occurrence record as returned by the ICV backend.
     *
     * In the standard (non-COVID) flow the `geometry` field is a WKT
     * `POINT(lng lat)` string parsed by `pointParser()`. In COVID view,
     * `latitude` / `longitude` are used directly.
     */
    type presDBdataT = {
        /** WKT geometry string (e.g. `"POINT(13.4 52.5)"`). */
        geometry: string
        /** String-encoded feature value (cast to `number` at render time). */
        feature: string
        /** Optional parsed coordinate tuples. */
        longLat?: [number, number][]
        /** Decimal longitude (used in COVID epidemiology view). */
        longitude?: number
        /** Decimal latitude (used in COVID epidemiology view). */
        latitude?: number
        /** Sub-region / state name (e.g. `"Bayern"`). */
        subregion_name?: string
        /** Country name (e.g. `"Germany"`). */
        country_name?: string
        /** Date string (YYYY-MM-DD). */
        date?: string
    }

    /**
     * Shape returned by `getUniqueEntries` API tasks –
     * a single string value per unique entry.
     */
    type UniquesDB_entriesT = {
        /** Unique value string (species name, year, serotype, etc.). */
        feature: string
    }

    /** Typed wrapper around a database response containing unique-entry rows. */
    interface UniquesDB_entriesI extends dbDATA {
        response: UniquesDB_entriesT[]
    }

    /** Typed wrapper around a database response containing presence-data rows. */
    interface presDBdataI extends dbDATA {
        response: presDBdataT[]
    }

    /**
     * Internal representation of the most recent map mouse event,
     * used to coordinate tooltip rendering across synced map instances.
     */
    interface  mapMouseEvents {
        /** Event category. */
        type?: string; // "hover" | "click"
        /** Cursor position as `[lng, lat]`. */
        position?: [number, number];
        /** Raw Leaflet mouse event (shared via `InterfaceContext.mouseEvent`). */
        event?: L.LeafletMouseEvent | null;
        /** `Date.now()` timestamp of the last context broadcast (16 ms throttle). */
        lastSetTime?: number;
    }

    /** GeoJSON properties for a world-capital feature (localised titles). */
    interface CapitalProperties {
        /** Localised capital-city name. */
        title: {
            en:string;
            de:string;
        };
    }

    /** GeoJSON `Point` geometry narrowed to a 2D coordinate tuple. */
    type CapitalGeometry = GEOjson.Point & { coordinates: [number, number] };

    /** A single capital-city GeoJSON feature. */
    type CapitalFeature = GEOjson.Feature<CapitalGeometry, CapitalProperties>;

    /** GeoJSON `FeatureCollection` of world-capital points. */
    interface CapitalsFeatureCollection extends GEOjson.FeatureCollection<CapitalGeometry, CapitalProperties> {
        features: CapitalFeature[];
    }

    const inheritedDatasetURL = props.isApplyContextData ? contextT.curDatasetURL : "";
    const initialDatasetURL = inheritedDatasetURL || resolvedDefaultDatasetURL;
    const initialFeature = (props.isApplyContextData ? contextT.curFeature : "") || props.mapUIsettings.defaultFeatureName || "";
    const initialColorMap = (props.isApplyContextData ? contextT.curColorMap : "") || props.mapUIsettings.defaultFeatureColorMap || defaultColorMap;
    const initialRelationName = getRelationNameFromDatasetURL(initialDatasetURL) || props.mapUIsettings.defaultDatasetName || "";

    const [[latitude, longitude, zoom], setCoordinates] = useState<[number, number, number]>(
        [leafProps.center?.[0] ?? 0, leafProps.center?.[1] ?? 0, leafProps.zoom ?? 1]
    );
    const [isTransitioning, setIsTransitioning] = useState(false);
    const isZoomingRef = useRef(false);
    const zoomDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const coordsRef = useRef([latitude, longitude, zoom]);
    coordsRef.current = [latitude, longitude, zoom];
    const [isUpdate, setisUpdate] = useState(false);
    const [curColorMapType, setColorMapType] = useState<string>(initialColorMap);
    const [layerOpacity, setLayerOpacity] = useState(
        props.isApplyContextData ? contextT.curLayerOpacity : props.mapUIsettings.defaultLayerOpacity || contextT.curLayerOpacity
    );
    const [selectedFilter, setSelectedFilter] = useState<string>("")
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to?: Date | undefined; } | undefined>(contextT.dateRange);
    const [selectedFeature, setSelectedFeature] = useState<string>(initialFeature);
    const [selectedCountry, setSelectedCountry] = useState<string>("");
    const [isSettingsOpen, setIsSettingsOpen] = useState(true);
    const [isSettingsOpenFixed, setIsSettingsOpenFixed] = useState(props.mapUIsettings.areSettingsOpen ?? true);
    const { containerRef: settingsContainerRef, settingsTop: settingsButtonTop } = useDynamicSettingsTop();
    const curMouseEvent = useRef<string>("null");
    const screenDistanceOneKM = useRef<number>(0);
    const curDatasetname = useRef<string>(initialRelationName);
    const [selectedDatasetKey, setSelectedDatasetKey] = useState<string>(initialRelationName);
    const curPropertyNames = useRef<string>("");
    const hoverCountry = useRef<string>("0");
    const toolTipRef = useRef<any>(null);
    const cursorMarkerRef = useRef<L.Marker | null>(null);
    const isHoverCountry = useRef<boolean>(false);
    const activeLayerRef = useRef<L.Path | null>(null);
    const [showSuccessCountryDropdown, setShowSuccessCountryDropdown] = useState(false);
    const [showSuccessTimerangeDropdown, setShowSuccesTimerangeDropdown] = useState(false);
    const highlightedCountryRef = useRef<L.GeoJSON | null>(null);

    const [min_date, setMinDate] = useState<Date>(new Date("2020-01-01"));
    const [max_date, setMaxDate] = useState<Date>(new Date("2022-02-14"));

    const disabledMatcher = useMemo(() => [
        { before: min_date },
        { after: max_date },
    ], [min_date, max_date]);

    // mosquito data (grid data)
    const [selectedDatasetURL, setSelectedDataset] = useState<string>(initialDatasetURL);

    // ── Loading task hooks (replace old isLoadingSpinner ref) ──
    const L_dataLoading = useLoadingTask('Data');
    const L_contextSync = useLoadingTask('Context Sync');
    const L_presenceLayer = useLoadingTask('Presence Layer');
    const L_presenceLayerCovid = useLoadingTask('Presence Layer Covid');
    const L_debounceLoading = useLoadingTask('Debounce Render');

    const renderCount = useRef(0);
    const curMapMouseEvents = useRef<mapMouseEvents>({ type: "null", position: [0, 0], event: null, lastSetTime: 0 });
    // ── Grid-layer transition guard ──────────────────────────────────────────
    // Set to true in onTransitionStart so createTile() returns blank canvases
    // during the D3 tween (avoids 60 synchronous redraws/s). Set to false +
    // trigger redraw in onTransitionEnd for a single clean repaint.
    const gridLayerTransitionRef = useRef<boolean>(false);
    const gridLayerRedrawRef = useRef<() => void>(() => {});


    // data loading
    const [isLoading_mapData, rawMapData] = useGetJSONData(props.mapDataURL);
    const [isLoadingDatalist, dataList] = useGetJSONData(apiRoutes.GET_LIST_OF_DATASETS)
    const [isLoading_Metadata, rawMetaData] = useGetJSONData(apiRoutes.getDatasetsMetadata({ LANGID: locale }));
    const [isLoadingCapitals, rawCapitalsData] = useGetJSONData(
        apiRoutes.FETCH_MAP_DATA.CAPITALS,
        props.mapDataSets.isCityNames,
    );


     // column names from database
    const columnNamesURL = useMemo(() => {
        if (props.mapUIsettings.defaultDatasetName) {
            return apiRoutes.fetchDbColumnNames({ relationName: props.mapUIsettings.defaultDatasetName });
        }
        return "";
    }, [props.mapUIsettings.defaultDatasetName]);
    const [isLoading_ColumnNames, rawColumnNames] = useGetJSONData(columnNamesURL, props.mapDataSets.isGridData || props.mapUIsettings.inCovidDataView);

    const dateColumn = useMemo(() => {
        if (!mapUIsettings.isDatePicker || !Array.isArray(rawColumnNames)) return "";
        if (rawColumnNames.includes("date")) return "date";
        if (rawColumnNames.includes("datenstand")) return "datenstand";
        return "";
    }, [mapUIsettings.isDatePicker, rawColumnNames]);
    const minMaxDateURL = useMemo(() => {
        if (!dateColumn || !curDatasetname.current) return "";
        return apiRoutes.fetchDbData({
            relationName: curDatasetname.current,
            feature: dateColumn,
            task: "getMinMax",
        });
    }, [dateColumn, selectedDatasetURL]);
    const [, rawMinMaxDate] = useGetJSONData(minMaxDateURL, Boolean(minMaxDateURL));

    /* eslint-disable react-hooks/set-state-in-effect -- Date bounds intentionally mirror the completed server response. */
    useEffect(() => {
        const values = (rawMinMaxDate as dbDATA | undefined)?.response;
        if (!values?.min_val || !values?.max_val) return;

        const parsedMin = new Date(values.min_val);
        const parsedMax = new Date(values.max_val);
        const cutoffMax = new Date("2022-02-14");
        if (!isNaN(parsedMin.getTime())) setMinDate(parsedMin);
        if (!isNaN(parsedMax.getTime())) setMaxDate(parsedMax > cutoffMax ? cutoffMax : parsedMax);
    }, [rawMinMaxDate]);
    /* eslint-enable react-hooks/set-state-in-effect */

    // Wait for column names and metadata to load and set default feature name if not already set
    /* eslint-disable react-hooks/set-state-in-effect -- The first available server column initializes controlled feature state. */
    useEffect(() => {
        if (!isLoading_ColumnNames && !isLoading_Metadata && rawColumnNames && Array.isArray(rawColumnNames) && rawColumnNames.length > 0 && props.mapUIsettings.defaultFeatureName === "") {
            let selectedColumnName = "";
            const filteredRawColumnNames = rawColumnNames.filter((name: string) => name !== "id");
            if (filteredRawColumnNames.length === 0) return;

            const metaData = rawMetaData as unknown as metaDataT | undefined;
            // First pass: look for a column that is in metadata and has availability set to 1
            for (const columnName of filteredRawColumnNames) {
                if (metaData && metaData[columnName as keyof typeof metaData]) {
                    const columnMeta = metaData[columnName as keyof typeof metaData];
                    if (columnMeta.availability === "1" || columnMeta.availability === undefined) {
                        selectedColumnName = columnName;
                        break;
                    }
                }
            }

            // Final fallback: use the first column of the filtered names
            if (selectedColumnName === "") {
                selectedColumnName = filteredRawColumnNames[0];
            }

            props.mapUIsettings.defaultFeatureName = selectedColumnName;
            setSelectedFeature(selectedColumnName);
        }
    }, [isLoading_ColumnNames, isLoading_Metadata, rawColumnNames, rawMetaData]);
    /* eslint-enable react-hooks/set-state-in-effect */

    

    // COVID layers are rendered from the date- and aggregation-filtered
    // presence request below. Fetching selectedDatasetURL here as well used to
    // download and parse the complete epidemiology table even though the
    // result was never drawn as a grid.
    const [isLoading_MosquitoData, rawMosquitoData] = useGetJSONData(selectedDatasetURL, props.mapDataSets.isGridData);
    
   
    
    const [gridData, setGridData] = useState<Map<number, visDataT>>(new Map<number, visDataT>());
    const gridcellSizeLatLng = useRef<{ lng: number; lat: number }>({ lng: 0, lat: 0 });
    const curGridCell = useRef<[number, number]>([0, 0]);
    const curGridCellFeature = useRef<number>(0);
    const curGridCellID = useRef<number>(0);
    const curGridCellRowID = useRef<number>(0);


    // presence data
    const [isPresData, setIsPresData] = useState(props.mapUIsettings.isPresenceDataChecked || mapUIsettings.inCovidDataView || false);
    const [presData, setPresData] = useState<{geometry: [number, number], feature: string, latLng?: [number, number], country_name?: string, subregion_name?: string;}[]>([]);
    const defaultPresenceDataURL = mapUIsettings.inCovidDataView
        ? resolvedDefaultDatasetURL
        : apiRoutes.fetchDbData({ relationName: contextT.curPresenceDatasetName, feature: "pointtype", filterBy: "pointtype", filterValue: "point, exact location" });
    const [presenceDataURL, setPresenceDataURL] = useState<string>(defaultPresenceDataURL);
    const shouldLoadPresenceData = props.mapDataSets.isPresenceData && isPresData;
    const shouldLoadPresenceDropdowns = (props.mapUIsettings.isPresenceData || props.mapDataSets.isPresenceData) && !props.mapUIsettings.inCovidDataView;
    const [isLoadingPresenceData, rawPresenceData] = useGetJSONData(presenceDataURL, shouldLoadPresenceData);
    const [isLoadingP_species, rawP_species] = useGetJSONData( apiRoutes.fetchDbData({ relationName: contextT.curPresenceDatasetName, feature: "species", task: "getUniqueEntries" }), shouldLoadPresenceDropdowns);
    const [isLoadingP_years, rawP_years] = useGetJSONData( apiRoutes.fetchDbData({ relationName: contextT.curPresenceDatasetName, feature: "year", task: "getUniqueEntries" }), shouldLoadPresenceDropdowns);
    const effectiveTargetDate = dateRange?.to
        ? format(dateRange.to, "yyyy-MM-dd")
        : dateRange?.from
        ? format(dateRange.from, "yyyy-MM-dd")
        : contextT.targetDate;

    const rkiDataURL = mapUIsettings.inCovidDataView
        ? apiRoutes.fetchDbData({
              relationName: "aktuell_deutschland_sarscov2_infektionen_aggregated",
              feature: "ALL",
              targetDate: effectiveTargetDate,
              startDate: (dateRange?.from && dateRange?.to) ? format(dateRange.from, "yyyy-MM-dd") : undefined,
              endDate: (dateRange?.from && dateRange?.to) ? format(dateRange.to, "yyyy-MM-dd") : undefined,
          })
        : "";
    const [isLoadingCOVIDData, rawRkiData] = useGetJSONData(rkiDataURL, mapUIsettings.inCovidDataView);
    const [curSpecies, setCurSpecies] = useState<string>("ALL")
    const [curYear, setCurYear] = useState<string>("ALL")
    const prev_presenceDrawHash = useRef<number>(0);
    const presenceDrawHash = useRef<number>(0);

    // memoize sorted presence data and per-country max to avoid re-sorting on every render
    const sortedPresDataMemo = useMemo(() => {
        return [...presData].sort((a, b) => Number(a.feature) - Number(b.feature));
    }, [presData]);

    const maxFeaturePerCountryMemo = useMemo(() => {
        return sortedPresDataMemo.reduce((maxByCountry, d) => {
            if (d.country_name) {
                maxByCountry[d.country_name] = Math.max(maxByCountry[d.country_name] || -Infinity, Number(d.feature));
            }
            return maxByCountry;
        }, {} as Record<string, number>);
    }, [sortedPresDataMemo]);

    // sequence metadata
    const sequenceColumnForDonut = contextT.donutChartSelectedColumnName || "species";
    const geoAssignmentColumn = contextT.geoAssignmentColumnNameForDonut || "country";
    const [isSequenceMetaData, setIsSequenceMetaData] = useState(
        props.mapUIsettings.isSequenceMetaDataChecked || (props.isApplyContextData && contextT.isSequenceMetaData) || false
    );
    const [sequenceMetaDataURL, setSequenceMetaDataURL] = useState<string>(
        (props.isApplyContextData ? contextT.curDonutChartDataURL : "") ||
        apiRoutes.fetchDbData({ relationName: contextT.curDonutChartDatasetName, feature: geoAssignmentColumn, task: "getCount" })
    );
    const [cur_Sorgansim, setCur_SOrgansim] = useState<string>(
        props.isApplyContextData ? contextT.curSOrgansim : "ALL"
    )
    const [cur_SYear, setCur_SYear] = useState<string>(
        props.isApplyContextData ? contextT.curSyear : "ALL"
    )

    const shouldLoadSequenceData = props.mapDataSets.isSequenceMetaData && isSequenceMetaData;
    const shouldLoadSequenceDropdowns = props.mapUIsettings.isSequenceMetaData;
    const [isLoading_sequenceMetadata, rawSequenceMetaData] = useGetJSONData(sequenceMetaDataURL, shouldLoadSequenceData);
    const [isLoadingS_organism, rawS_organsim] = useGetJSONData( apiRoutes.fetchDbData({ relationName: contextT.curDonutChartDatasetName, feature: sequenceColumnForDonut, task: "getUniqueEntries" }), shouldLoadSequenceDropdowns);
    const [isLoadingS_years, rawS_years] = useGetJSONData( apiRoutes.fetchDbData({ relationName: contextT.curDonutChartDatasetName, feature: "date", task: "getUniqueEntries" }), shouldLoadSequenceDropdowns);
    const sequenceBreakdownURL = useMemo(() => apiRoutes.fetchDbData({
        relationName: contextT.curDonutChartDatasetName,
        feature: geoAssignmentColumn,
        task: "getGroupedCount",
        groupBy: sequenceColumnForDonut,
        filterBy: `'${sequenceColumnForDonut}','date'`,
        filterValue: `'${cur_Sorgansim}','${cur_SYear}'`,
    }), [contextT.curDonutChartDatasetName, geoAssignmentColumn, sequenceColumnForDonut, cur_Sorgansim, cur_SYear]);
    const [isLoadingSequenceBreakdown, rawSequenceBreakdown] = useGetJSONData(
        sequenceBreakdownURL,
        shouldLoadSequenceData,
    );

    const [pieSize, setPieSize] = useState<number>(
        props.isApplyContextData ? contextT.pieSize_sequenceMetaData : props.mapUIsettings.defaultDonutSize || 40
    );
    const [isCountryLevelData, setIsCountryLevelData] = useState(props.mapUIsettings.isCountryLevelData);
    const [isSubregionLevelData, setIsSubregionLevelData] = useState(props.mapUIsettings.isSubregionLevelData);

    /**
     * Clears the country selection and reloads the full (unfiltered) presence
     * dataset for all countries.
     *
     * @remarks
     * Invoked by the "Reset" button in the country-selection dropdown. It
     * rebuilds the API URL without a `filterBy` / `filterValue` clause,
     * updates both local and `InterfaceContext` state, removes the
     * highlighted country polygon, and shows a transient success toast.
     */
    const handleResetToAllCountries = useCallback(() => {
        setSelectedCountry("");
        contextT.setSelectedCountry("");

        if (mapUIsettings.inCovidDataView) {
            let url = apiRoutes.fetchDbData({
                relationName: curDatasetname.current,
                feature: contextT.curFeature || selectedFeature || mapUIsettings.defaultFeatureName,
                startDate: contextT.dateRange?.from ? format(contextT.dateRange.from, "yyyy-MM-dd") : undefined,
                endDate: contextT.dateRange?.to ? format(contextT.dateRange.to, "yyyy-MM-dd") : undefined,
                aggregation_level: isCountryLevelData ? 0 : isSubregionLevelData ? 1 : undefined,
            });
            console.log("handleResetToAllCountries", url);

            contextT.setCurDatasetURL(url);
            contextT.setCurPresenceDatasetURL(url);
            contextT.setIsPresenceData(true);
            setIsPresData(true);
            setPresenceDataURL(url);
            setShowSuccessCountryDropdown(true);

            setTimeout(() => {
                setShowSuccessCountryDropdown(false);
            }, 5000);
        }

        if (map && highlightedCountryRef.current) {
            map.removeLayer(highlightedCountryRef.current);
            highlightedCountryRef.current = null;
        }
    }, [mapUIsettings.inCovidDataView, contextT.dateRange, contextT.curFeature, selectedFeature, mapUIsettings.defaultFeatureName, isCountryLevelData, isSubregionLevelData, map])

    const handleResetToAllCountriesRef = useRef(handleResetToAllCountries);
    useEffect(() => {
        handleResetToAllCountriesRef.current = handleResetToAllCountries;
    }, [handleResetToAllCountries]); 
    // collect data loading errors
    collectDataLoadingErrors.current = [];
    collectDataLoadingErrors.current.push(handleLoadDataError(isLoading_mapData, rawMapData as unknown as dbDATA));
    collectDataLoadingErrors.current.push(handleLoadDataError(isLoading_MosquitoData, rawMosquitoData as unknown as dbDATA));
    collectDataLoadingErrors.current.push(handleLoadDataError(isLoadingDatalist, dataList as unknown as dbDATA));
    collectDataLoadingErrors.current.push(handleLoadDataError(isLoading_Metadata, rawMetaData as unknown as dbDATA));
    collectDataLoadingErrors.current.push(handleLoadDataError(isLoadingPresenceData, rawPresenceData as unknown as dbDATA));
    collectDataLoadingErrors.current.push(handleLoadDataError(isLoadingP_species, rawP_species as unknown as dbDATA));
    collectDataLoadingErrors.current.push(handleLoadDataError(isLoadingP_years, rawP_years as unknown as dbDATA));
    collectDataLoadingErrors.current.push(handleLoadDataError(isLoading_sequenceMetadata, rawSequenceMetaData as unknown as dbDATA));
    collectDataLoadingErrors.current.push(handleLoadDataError(isLoadingS_organism, rawS_organsim as unknown as dbDATA));
    collectDataLoadingErrors.current.push(handleLoadDataError(isLoadingS_years, rawS_years as unknown as dbDATA));
    collectDataLoadingErrors.current.push(handleLoadDataError(isLoadingCapitals, rawCapitalsData as unknown as dbDATA));
    collectDataLoadingErrors.current.push(handleLoadDataError(isLoading_ColumnNames, rawColumnNames as unknown as dbDATA));


    // Clear loading spinner when all main datasets finish loading
    useEffect(() => {
        const isCOVIDLoading = mapUIsettings.inCovidDataView && isLoadingCOVIDData;
        if (!isLoading_mapData &&
            !isLoading_MosquitoData && 
            !isLoadingPresenceData && 
            !isCOVIDLoading &&
            !isLoading_sequenceMetadata &&
            !isLoadingDatalist && 
            !isLoading_Metadata && 
            !isLoadingP_species && 
            !isLoadingP_years && 
            !isLoadingS_organism && 
            !isLoadingS_years && 
            !isLoadingCapitals && 
            !isLoading_ColumnNames) {
            L_dataLoading.stop();
        } else {
            L_dataLoading.start();
        }
    }, [isLoading_mapData,
        isLoading_MosquitoData, 
        isLoadingPresenceData, 
        isLoadingCOVIDData,
        mapUIsettings.inCovidDataView,
        isLoading_sequenceMetadata, 
        isLoadingDatalist, 
        isLoading_Metadata, 
        isLoadingP_species, 
        isLoadingP_years, 
        isLoadingS_organism, 
        isLoadingS_years, 
        isLoadingCapitals, 
        isLoading_ColumnNames]);

    // assign data types
    let presenceDat= rawPresenceData as unknown as presDBdataI;
    let sequenceMetaData = rawSequenceMetaData as unknown as presDBdataI;
    let mosquitoData = rawMosquitoData as unknown as Omit<presDBdataI, 'response'> & {
        response: presDBdataT[] | MapGridResponseV1;
    };
    let P_species = rawP_species as unknown as UniquesDB_entriesI;
    let P_years = rawP_years as unknown as UniquesDB_entriesI;
    let S_organism = rawS_organsim as unknown as UniquesDB_entriesI;
    let S_years = rawS_years as unknown as UniquesDB_entriesI;
    let capitalsData = rawCapitalsData as unknown as CapitalsFeatureCollection;
   
    let listOfDataSets = dataList as unknown as { [key: string]: string };
    const metaData = rawMetaData as unknown as metaDataT;
    const colNames = useMemo(() => {
        if (mapUIsettings.inCovidDataView && Array.isArray(rawColumnNames)) {
            return rawColumnNames.filter((name: string) => name !== "id");
        }
        const responseHasRows = Array.isArray(mosquitoData.response)
            ? mosquitoData.response.length > 1
            : Number(mosquitoData.response?.rowCount || 0) > 0;
        if(mosquitoData.response !== undefined && mosquitoData.header && mosquitoData.error == null && responseHasRows) {
            return mosquitoData.header.filter((name: string) => name !== "id");
        }
        else {
            return [] as string[];
        }
    }, [mapUIsettings.inCovidDataView, mosquitoData, rawColumnNames]);
    const mapData = useMemo<GEOjson.FeatureCollection>(() => {
        const incoming = (rawMapData as unknown as GEOjson.FeatureCollection | null) ?? null;

        if (isLoading_mapData || !incoming || !Array.isArray(incoming.features)) {
            return {
                type: "FeatureCollection",
                features: [],
            };
        }

        // filter out features with undefined, null, Alaska, or Hawaii country names
        const filteredFeatures = incoming.features.filter((feature: any) => {
            const country =
                feature?.properties?.name ??
                feature?.properties?.NAME;
            if (country === "Alaska" || country === "Hawaii") {
                console.warn(
                    "Country name is undefined, null, Alaska, or Hawaii for feature:",
                    feature
                );
                return false;
            }
            return true;
        });

        return {
            ...incoming,
            features: filteredFeatures,
        };
    }, [isLoading_mapData, rawMapData]);
    // 'zoomBreakpoint' defines the zoom level threshold for switching between country-level and subregion-level data.
    // zoom < zoomBreakpoint => country-level (aggregation_level=0)
    // zoom >= zoomBreakpoint => subregion-level (aggregation_level=1)
    const zoomBreakpoint = 3;

    renderCount.current += 1;

 const oceanGeoJSON = useMemo(() => {
    if(isLoading_mapData || !mapData){
        return null;
    }
    return getOceanMaskGeoJSON(mapData);
 }, [mapData]); 



 useEffect(() => {
    console.log("setDateRange ", contextT.dateRange?.to);
 }, [contextT.dateRange]);

 
    /**
     * Synchronises local component state with the shared `InterfaceContext`.
     *
     * Called inside a `useEffect` that depends on `isApplyContextData`.
     * Each field is compared individually and only updated when the
     * context value has actually changed, preventing feedback loops
     * between SETTER and RECEIVER map instances.
     *
     * @remarks
     * In COVID view, the incoming `presenceDatasetURL` from the context
     * is sanitised to strip the sender's `aggregation_level` and
     * re-apply the correct level for **this** map's current zoom.
     */
    const applyGlobalContext = useCallback(() => {
        if(curColorMapType != contextT.curColorMap){
            setColorMapType(contextT.curColorMap);
        }
        if(selectedDatasetURL !== contextT.curDatasetURL && contextT.curDatasetURL != ""){
            const relationName = getRelationNameFromDatasetURL(contextT.curDatasetURL);
            if (relationName) {
                curDatasetname.current = relationName;
                setSelectedDatasetKey(relationName);
            }
            setSelectedDataset(contextT.curDatasetURL);
        }
        if(isPresData != contextT.isPresenceData && contextT.isPresenceData !== undefined){
            
            setIsPresData(contextT.isPresenceData);
           
        }
        if(isSequenceMetaData != contextT.isSequenceMetaData && contextT.isSequenceMetaData !== undefined){
            setIsSequenceMetaData(contextT.isSequenceMetaData);
        }
        if(pieSize != contextT.pieSize_sequenceMetaData && contextT.pieSize_sequenceMetaData !== undefined){
            setPieSize(contextT.pieSize_sequenceMetaData);
        }
        if(cur_SYear != contextT.curSyear && contextT.curSyear !== undefined){
            setCur_SYear(contextT.curSyear);
        }
        if(cur_Sorgansim != contextT.curSOrgansim && contextT.curSOrgansim !== undefined){
            setCur_SOrgansim(contextT.curSOrgansim);
        }
        if(layerOpacity != contextT.curLayerOpacity){
            setTimeout(() => {
                setLayerOpacity(contextT.curLayerOpacity);
            }, 50);
        }
        if (sequenceMetaDataURL !== contextT.curDonutChartDataURL &&
            contextT.curDonutChartDataURL !== undefined &&
            contextT.curDonutChartDataURL !== "") {
            setSequenceMetaDataURL(contextT.curDonutChartDataURL);
        }
        if (presenceDataURL !== contextT.curPresenceDatasetURL &&
            contextT.curPresenceDatasetURL !== undefined &&
            contextT.curPresenceDatasetURL !== "") {
            // In COVID view, the receiving map must enforce its own
            // aggregation_level based on its local zoom, not the sender's.
            if (mapUIsettings.inCovidDataView) {
                let incomingURL = contextT.curPresenceDatasetURL;
                // Strip any aggregation_level the sender may have baked in
                incomingURL = incomingURL.replace(/&aggregation_level=[01]/g, "");
                // Re-apply the correct level for *this* map's zoom
                const localAbove = zoom >= zoomBreakpoint;
                incomingURL += localAbove ? "&aggregation_level=1" : "&aggregation_level=0";
                setPresenceDataURL(incomingURL);
            } else {
                setPresenceDataURL(contextT.curPresenceDatasetURL);
            }
        }

        if(selectedFeature != contextT.curFeature && contextT.curFeature != "") {
            setSelectedFeature(contextT.curFeature);
        }
            

        setSelectedFilter(contextT.selectedFilter);
        if (props.mapUIsettings.isDoNotApplyCountryFromContext === false)
            setSelectedCountry(contextT.selectedCountry);
            setDateRange(contextT.dateRange);

         L_contextSync.stop();
    }, [
        contextT.curColorMap,
        contextT.curDatasetURL,
        contextT.isPresenceData,
        contextT.isSequenceMetaData,
        contextT.pieSize_sequenceMetaData,
        contextT.curLayerOpacity,
        contextT.curDonutChartDataURL,
        contextT.curPresenceDatasetURL,
        contextT.curFeature,
        contextT.selectedFilter,
        contextT.selectedCountry,
        contextT.dateRange,
        contextT.curFeature,
        curColorMapType,
        curDatasetname.current,
        isPresData,
        isSequenceMetaData,
        cur_SYear,
        layerOpacity,
        sequenceMetaDataURL,
        presenceDataURL,
        selectedFeature,
        selectedFilter,
        selectedCountry,
        dateRange,
        selectedDatasetURL,
        isCountryLevelData,
        isSubregionLevelData,
        props.mapUIsettings.isDoNotApplyCountryFromContext
    ]);


    // synchronize selected feature with month selection
    const syncSelectedFeatureWithMonthSelection = useCallback(() => {
        if (contextT.curMonth <= 0 || contextT.curMonth > 12) return;
        const monthlyFeature = getActiveStringFilters(props.mapUIsettings.filterStringForAvailableFeature)
            .map((filter) => `${filter}_${contextT.curMonth}`)
            .find((feature) => colNames.includes(feature));
        if (monthlyFeature) {
            if (selectedFeature !== monthlyFeature) {
                setSelectedFeature(monthlyFeature);
                const url = buildMapDatasetURL(
                    { relationName: curDatasetname.current, feature: monthlyFeature },
                    useCompactGridResponse,
                );
                setSelectedDataset(url);
            }
        } else {
            // Handle monthly-split tables (e.g. t_2024_monthly_mean_4_ocsvm_albopictus_predictions_2023_mod)
            // where the month is encoded in the table name, not the feature column
            const monthlyMatch = curDatasetname.current.match(/^(t_\d+_monthly_mean_)\d+(_.*)/);
            if (monthlyMatch) {
                const newDatasetName = `${monthlyMatch[1]}${contextT.curMonth}${monthlyMatch[2]}`;
                if (newDatasetName !== curDatasetname.current) {
                    curDatasetname.current = newDatasetName;
                    setSelectedDatasetKey(newDatasetName);
                    const url = buildMapDatasetURL(
                        { relationName: newDatasetName, feature: selectedFeature },
                        useCompactGridResponse,
                    );
                    setSelectedDataset(url);
                }
            }
        }
    }, [contextT.curMonth, colNames, selectedFeature, props.mapUIsettings.filterStringForAvailableFeature]);

    /* eslint-disable react-hooks/set-state-in-effect -- Month changes intentionally synchronize the selected dataset or feature. */
    useEffect(() => {
        syncSelectedFeatureWithMonthSelection();
    }, [syncSelectedFeatureWithMonthSelection]);
    /* eslint-enable react-hooks/set-state-in-effect */

    /* eslint-disable react-hooks/set-state-in-effect -- This receiver intentionally mirrors shared context into local map state. */
    useEffect(() => {
        if(props.isApplyContextData === true) {
            // Only show loading spinner if data-related context values changed
            const needsLoading = 
                selectedDatasetURL !== contextT.curDatasetURL ||
                selectedFeature !== contextT.curFeature ||
                presenceDataURL !== contextT.curPresenceDatasetURL ||
                sequenceMetaDataURL !== contextT.curDonutChartDataURL;
            if (needsLoading) {
                L_contextSync.start();
            }
            applyGlobalContext();
        }
    }, [props.isApplyContextData, applyGlobalContext,
        contextT.curDatasetURL, contextT.curFeature, 
        contextT.curPresenceDatasetURL, contextT.curDonutChartDataURL,
        contextT.curColorMap, contextT.isPresenceData, contextT.isSequenceMetaData,
        contextT.pieSize_sequenceMetaData, contextT.curLayerOpacity,
        contextT.selectedFilter, contextT.selectedCountry, contextT.dateRange,
        contextT.curSyear, contextT.curSOrgansim]);
    /* eslint-enable react-hooks/set-state-in-effect */

    // if isSetIntialContextDataFromComponent is true set context values from component
    useEffect(() => {
        if (props.isSetIntialContextDataFromComponent === true) {
            // Set all relevant context values from component state
            contextT.setIsPresenceData(isPresData);
            contextT.setIsSequenceMetaData(isSequenceMetaData);
            contextT.setCurDatasetURL(selectedDatasetURL);
            contextT.setCurPresenceDatasetURL(presenceDataURL);
            contextT.setCurDonutChartDataURL(sequenceMetaDataURL);
            contextT.setCurFeature(selectedFeature);
            contextT.setCurColorMap(curColorMapType);
            contextT.setPieSize_sequenceMetaData(pieSize);
            contextT.setCurSyear(cur_SYear);
            contextT.setCurSOrgansim(cur_Sorgansim);
            contextT.setCurLayerOpacity(layerOpacity);
            contextT.setSelectedFilter(selectedFilter);
            contextT.setSelectedCountry(selectedCountry);
            //contextT.setDateRange(dateRange);
            // Optionally log for debugging
            console.log("SET context from component:", {
                isPresData,
                isSequenceMetaData,
                selectedDatasetURL,
                presenceDataURL,
                sequenceMetaDataURL,
                selectedFeature,
                curColorMapType,
                pieSize,
                cur_SYear,
                cur_Sorgansim,
                layerOpacity,
                selectedFilter,
                selectedCountry,
               // dateRange
            });
        }
    }, [props.isSetIntialContextDataFromComponent, selectedDatasetURL, selectedFeature, curColorMapType]);


    useEffect(() => {
        if (props.isSyncMapCoordsOnTheFly_RECIEVER === true) {
            if (gridLayerTransitionRef.current) return;
            updateCoordinates(contextT.mapCoords.latitude, contextT.mapCoords.longitude, contextT.mapCoords.zoom);
            console.log("updateCoordinates:", latitude, longitude, zoom);
        }
    }, [props.isSyncMapCoordsOnTheFly_RECIEVER, contextT.mapCoords]);

    useEffect(() => {
        if(props.isSyncMapCoordsOnTheFly_SETTER === true) {
            if(contextT.mapCoords.latitude === 0 && contextT.mapCoords.longitude === 0 && contextT.mapCoords.zoom === 0) {
                contextT.setMapCoords({
                    latitude: latitude,
                    longitude: longitude,
                    zoom: zoom
                });
            }
        }
    }, [props.isSyncMapCoordsOnTheFly_SETTER, contextT.mapCoords, latitude, longitude, zoom]);

    const sortedKeys = Object.keys(listOfDataSets).sort();
    listOfDataSets = sortedKeys.reduce((acc, key) => {
            acc[key] = listOfDataSets[key];
            return acc;
        }, {} as { [key: string]: string });
    if(!props.isApplyContextData && !isLoadingDatalist && selectedDatasetURL === "" && Object.keys(listOfDataSets).length > 0) {

        let filterStr = props.mapUIsettings.defaultDatasetName !== "" ? props.mapUIsettings.defaultDatasetName : ""; 
        let key = Object.keys(listOfDataSets).find(key => filterStr === "" || key.includes(filterStr)) ||  "-1";
        if(key === "-1" || filterStr === "") {
            key = Object.keys(listOfDataSets).find(k => isDatasetIncluded(k, props.mapUIsettings.filterStringForAvailableDatasetInclude, props.mapUIsettings.filterStringForAvailableDatasetExclude)) || Object.keys(listOfDataSets)[0];
        }
        console.log("key:", key, "filterStr:", filterStr, "listOfDataSets:", listOfDataSets);
        curDatasetname.current = listOfDataSets[key];
        const initialFeature = props.mapUIsettings.defaultFeatureName ||
            (props.isApplyContextData ? contextT.curFeature : "");
        let url = buildMapDatasetURL(
            { relationName: listOfDataSets[key], feature: initialFeature },
            useCompactGridResponse,
        );
        setSelectedDataset(url);
        // Find the first dataset key that contains the filter string, or fallback to the first key
    }

     const seq_countryList = useMemo(() => {
        if (sequenceMetaData.response) {
            return sequenceMetaData.response.map((d: any) => d.feature);
        }
        return [];
    }, [sequenceMetaData]);   
   
    /**
     * Resolves a raw country name (which may be in English, German, or ISO
     * format) to the correctly localised display name for the current locale.
     *
     * @param rawCountryName  - Country name as received from the API (may be
     *                          English, German, or an ISO 3166-1 alpha-3 code).
     * @param currentLocale   - Active UI locale (`"en"` or `"de"`).
     * @returns The localised country name, or the raw input unchanged if no
     *          match is found.
     */
    function getLocalizedCountryName(rawCountryName: string | undefined, currentLocale: string): string {
        if (!rawCountryName) return "";
        const list = currentLocale === "de" ? country_names_de : country_names;
        const norm = rawCountryName.trim().toLowerCase();
        
        const found = list.find(([iso, name]) => 
            name.toLowerCase() === norm || iso.toLowerCase() === norm
        );
        if (found) return found[1];
        
        if (currentLocale === "de") {
            const enMatch = country_names.find(([iso, name]) => name.toLowerCase() === norm);
            if (enMatch) {
                const deMatch = country_names_de.find(([iso]) => iso === enMatch[0]);
                if (deMatch) return deMatch[1];
            }
        }
        return rawCountryName;
    }

    /**
     * Translates a sub-region / federal-state name to its German alias
     * when the current locale is `"de"` (e.g. `"Bavaria"` → `"Bayern"`).
     *
     * @param subName        - Raw sub-region name from the API.
     * @param currentLocale  - Active UI locale.
     * @returns The localised sub-region name, or the raw input unchanged.
     */
    function getLocalizedSubregionName(subName: string | undefined, currentLocale: string): string {
        if (!subName || subName === "NULL") return "";
        if (currentLocale === "de") {
            const subLower = subName.trim().toLowerCase();
            return GERMAN_STATE_ALIASES[subLower] || subName;
        }
        return subName;
    }

    /**
     * Extracts a numeric feature value from a raw RKI (Robert Koch Institute)
     * COVID-19 record by trying a prioritised list of column-name synonyms.
     *
     * @remarks
     * RKI datasets use German column names (`accucases`, `newdeaths`, etc.)
     * while the ICV frontend normalises to English (`cumulative_confirmed`,
     * `new_deceased`). This function bridges the two naming conventions via
     * a static lookup table with ordered fallback keys.
     *
     * @param rkiRecord    - A single row from the RKI API response.
     * @param featureName  - The ICV-normalised feature name to resolve.
     * @returns The numeric value if found, or `undefined` if no matching
     *          column exists or the value is non-numeric.
     */
    function getRkiFeatureValue(rkiRecord: any, featureName: string): number | undefined {
        if (!rkiRecord) return undefined;
        const featureMap: Record<string, string[]> = {
            cumulative_confirmed: ["accucases", "newcases"],
            new_confirmed: ["newcases", "accucasesperweek"],
            cases: ["accucases", "newcases"],
            cumulative_deceased: ["accudeaths", "newdeaths"],
            accudeaths: ["accudeaths", "newdeaths"],
            deaths: ["accudeaths", "newdeaths"],
            new_deceased: ["newdeaths", "accudeathsperweek"],
            newdeaths: ["newdeaths", "accudeathsperweek"],
            accucasesperweek: ["accucasesperweek", "accucases"],
            accudeathsperweek: ["accudeathsperweek", "accudeaths"],
            cumulative_recovered: ["accurecovered", "newrecovered"],
            new_recovered: ["newrecovered"],
        };
        const keysToTry = [...(featureMap[featureName] || [featureName]), featureName, "feature"];
        for (const key of keysToTry) {
            if (rkiRecord[key] != null) {
                const num = Number(rkiRecord[key]);
                if (!isNaN(num)) return num;
            }
        }
        return undefined;
    }

    /**
     * Replaces the feature value of a Germany presence-data entry with the
     * corresponding aggregated value from the RKI (Robert Koch Institute)
     * dataset.
     *
     * At country level (`isCountryLevel === true`), the function sums all
     * matching RKI records into a single national total. At sub-region
     * level it performs a fuzzy match on the state name (normalised via
     * `GERMAN_STATE_ALIASES`) and picks the first matching record.
     *
     * @param item           - Original presence-data record to enrich.
     * @param rkiResp        - Full RKI API response array.
     * @param activeFeature  - The currently selected ICV feature name.
     * @param isCountryLevel - When `true`, aggregate all sub-regions into
     *                         a single country-wide total.
     * @returns A shallow clone of `item` with an updated `feature` value.
     *          Non-German entries or entries without a matching RKI record
     *          are returned unchanged.
     */
    function processRkiGermanyDataReplacement(
        item: presDBdataT,
        rkiResp: any[],
        activeFeature: string,
        isCountryLevel?: boolean
    ): presDBdataT {
        const isDE = item.country_name === "Germany" || item.country_name === "Deutschland" || (item as any).iso_a3 === "DEU" || (item as any).country_code === "DE";
        if (!isDE || !Array.isArray(rkiResp) || rkiResp.length === 0) return { ...item };

        const newItem = { ...item };

        const datesInRki = Array.from(
            new Set(
                rkiResp
                    .map((r: any) => String(r.datenstand || r.date || "").slice(0, 10))
                    .filter((d: string) => d.length === 10)
            )
        ).sort();

        const hasRange = datesInRki.length > 1;
        const minDate = hasRange ? datesInRki[0] : undefined;
        const maxDate = datesInRki.length > 0 ? datesInRki[datesInRki.length - 1] : undefined;

        const endRecords = maxDate
            ? rkiResp.filter((r: any) => String(r.datenstand || r.date || "").slice(0, 10) === maxDate)
            : rkiResp;
        const startRecords = (hasRange && minDate)
            ? rkiResp.filter((r: any) => String(r.datenstand || r.date || "").slice(0, 10) === minDate)
            : [];

        if (isCountryLevel) {
            let totalEnd = 0, foundEnd = false;
            endRecords.forEach((r: any) => {
                const val = getRkiFeatureValue(r, activeFeature);
                if (val !== undefined) { totalEnd += val; foundEnd = true; }
            });

            if (foundEnd) {
                let totalStart = 0, foundStart = false;
                if (hasRange) {
                    startRecords.forEach((r: any) => {
                        const val = getRkiFeatureValue(r, activeFeature);
                        if (val !== undefined) { totalStart += val; foundStart = true; }
                    });
                }
                const rangeVal = (hasRange && foundStart) ? Math.max(0, totalEnd - totalStart) : totalEnd;
                newItem.feature = String(rangeVal);
            }
        } else {
            const rawSub = (newItem.subregion_name || (newItem as any).subregion1_name || (newItem as any).name || "").trim();
            const normName = GERMAN_STATE_ALIASES[rawSub.toLowerCase()] || rawSub;
            const normLower = normName.toLowerCase();

            const findStateRec = (records: any[]) => {
                // Priority 1: Exact state ID match via stateMappersGermany
                const tableId = stateMappersGermany.Table__State_to_ID(normName);
                const mapId = stateMappersGermany.Map__State_to_ID(normName);
                const expectedTableId = tableId !== -1 ? tableId : (mapId !== -1 ? stateMappersGermany.mapper__MapTable__ID_to_ID(mapId) : -1);

                if (expectedTableId !== -1) {
                    const matchById = records.find((r: any) => r && Number(r.idbundesland) === expectedTableId);
                    if (matchById) return matchById;
                }

                // Priority 2: Exact string match (case-insensitive)
                const matchByExactName = records.find((r: any) => {
                    if (!r) return false;
                    const b = (r.bundesland || "").trim().toLowerCase();
                    return b === normLower || b === rawSub.toLowerCase();
                });
                if (matchByExactName) return matchByExactName;

                // Priority 3: Fallback alias/substring match ONLY if exact match fails
                return records.find((r: any) => {
                    if (!r) return false;
                    const b = (r.bundesland || "").trim().toLowerCase();
                    if (!b) return false;
                    if (normLower === "sachsen" && (b === "sachsen-anhalt" || b === "niedersachsen")) return false;
                    if (rawSub.toLowerCase() === "sachsen" && (b === "sachsen-anhalt" || b === "niedersachsen")) return false;
                    return b.includes(normLower) || normLower.includes(b);
                });
            };

            const recEnd = findStateRec(endRecords);
            if (recEnd) {
                const valEnd = getRkiFeatureValue(recEnd, activeFeature);
                if (valEnd !== undefined) {
                    let valStart: number | undefined = undefined;
                    if (hasRange) {
                        const recStart = findStateRec(startRecords);
                        if (recStart) {
                            valStart = getRkiFeatureValue(recStart, activeFeature);
                        }
                    }
                    const rangeVal = (hasRange && valStart !== undefined) ? Math.max(0, valEnd - valStart) : valEnd;
                    newItem.feature = String(rangeVal);
                }
            }
        }
        return newItem;
    }

    /* eslint-disable react-hooks/set-state-in-effect -- Parsed fetch results intentionally replace the rendered presence layer. */
    useEffect(() => {
        const isRkiLoading = mapUIsettings.inCovidDataView && isLoadingCOVIDData;
        if (!isLoadingPresenceData && !isRkiLoading && props.mapDataSets.isPresenceData && presenceDat?.response) {
            let presDat: { geometry: [number, number]; feature: string; country_name?: string; subregion_name?: string }[] = [];
            let groupedPresData: presDBdataT[] = [];
            const rkiResp = (rawRkiData as unknown as dbDATA)?.response;
            const activeFeature = selectedFeature || contextT.curFeature || props.mapUIsettings.defaultFeatureName;

            try {
                presenceDat.response.forEach((d: presDBdataT) => {
                    let item = mapUIsettings.inCovidDataView
                        ? processRkiGermanyDataReplacement(d, rkiResp, activeFeature, isCountryLevelData)
                        : { ...d };

                    if (item.geometry || (item.latitude && item.longitude && !isNaN(item.latitude) && !isNaN(item.longitude))) {
                        if (item.latitude && item.longitude && !isNaN(item.latitude) && !isNaN(item.longitude)) {
                            if (mapUIsettings.inCovidDataView == true) {
                                preprocessPresenceDataForLatLng(item, groupedPresData);
                            } else {
                                presDat.push({ geometry: [item.latitude, item.longitude], feature: item.feature });
                            }
                        } else {
                            const coords = pointParser(item.geometry);
                            if (!isNaN(coords[0]) && !isNaN(coords[1])) {
                                presDat.push({ geometry: coords, feature: item.feature });
                            }
                        }
                    }
                });
                if (groupedPresData.length > 0) {
                    for (const item of groupedPresData) {
                        if (item.latitude && item.longitude && !isNaN(item.latitude) && !isNaN(item.longitude)) {
                            presDat.push({
                                geometry: [item.latitude, item.longitude],
                                feature: item.feature,
                                subregion_name: item.subregion_name,
                                country_name: item.country_name,
                            });
                        }
                    }
                }
            } catch (e) {
                let errorMsg = { ERROR: "ERROR: while parsing the data set. csv format is required." + e };
                let res = <div>{String(errorMsg["ERROR"])}</div>;
                console.log("Error:", errorMsg);
                collectDataLoadingErrors.current.push(res);
            }
            setPresData(presDat);
        }
    }, [presenceDat, isLoadingPresenceData, rawRkiData, isLoadingCOVIDData, selectedFeature, contextT.curFeature, contextT.targetDate, dateRange, props.mapUIsettings.defaultFeatureName, isCountryLevelData]);
    /* eslint-enable react-hooks/set-state-in-effect */

    // ------------------------------------------------------------------
    // Zoom-dependent auto-switch between country-level and subregion-level
    // ------------------------------------------------------------------
    // Track the previous zoom "side" of the threshold so we only re-fetch
    // when the user actually crosses the boundary.
    const prevZoomAboveThreshold = useRef<boolean | null>(null);

    /* eslint-disable react-hooks/set-state-in-effect -- Crossing the zoom threshold intentionally switches aggregation state. */
    useEffect(() => {
        if (!mapUIsettings.inCovidDataView) return;

        const isAboveThreshold = zoom >= zoomBreakpoint;

        // Skip if the side hasn't changed (or on first mount we initialise)
        if (prevZoomAboveThreshold.current === isAboveThreshold) return;
        prevZoomAboveThreshold.current = isAboveThreshold;

        // Determine the new data-level flags
        const newCountryLevel = !isAboveThreshold;
        const newSubregionLevel = isAboveThreshold;

        // Only act if the flags actually need to change
        if (newCountryLevel === isCountryLevelData && newSubregionLevel === isSubregionLevelData) return;

        // Update local + context state
        setIsCountryLevelData(newCountryLevel);
        setIsSubregionLevelData(newSubregionLevel);
        contextT.setIsCountryLevelData(newCountryLevel);
        contextT.setIsSubregionLevelData(newSubregionLevel);

        // Re-build the local presence data URL with the correct aggregation level.
        // Do not push this URL to context, so each map keeps its own
        // zoom-appropriate aggregation level independently.
        let url = presenceDataURL;
        // Strip any existing aggregation_level parameter.
        url = url.replace(/&aggregation_level=[01]/g, "");
        // Append the correct one.
        url += newCountryLevel ? "&aggregation_level=0" : "&aggregation_level=1";
        setPresenceDataURL(url);

        console.log(
            `[Zoom-switch] zoom=${zoom}, threshold=${zoomBreakpoint}, ` +
            `country=${newCountryLevel}, subregion=${newSubregionLevel}`
        );
    }, [zoom, mapUIsettings.inCovidDataView, isCountryLevelData, isSubregionLevelData, presenceDataURL]);
    /* eslint-enable react-hooks/set-state-in-effect */

     // *** useRef *** //
    const divRef = useRef<HTMLDivElement | null>(null);
    const ischanged = useRef(false);
    let layerUpdateHandlerTime = useRef<ReturnType<typeof setTimeout> | null>(null);


    
  const DonutColors = useMemo(() => {
        const colors: Record<string, string> = {};
        const entries = Array.isArray(S_organism?.response)
            ? [...S_organism.response]
                .filter((item: any) => typeof item?.feature === "string" && item.feature !== "")
                .sort((a: any, b: any) => a.feature.localeCompare(b.feature))
            : [];
        entries.forEach((item: any, index: number) => {
            colors[item.feature] = categoricalColors[index % categoricalColors.length] || "#808080";
        });
        return colors;
    }, [S_organism]);

// Derive country counts for the selected countries
const countryCounts = useMemo<{ [key: string]: any }>(() => {
    if (
        !shouldLoadSequenceData ||
        isLoading_sequenceMetadata ||
        isLoadingSequenceBreakdown ||
        isLoading_mapData
    ) return {};

    const totals = Array.isArray(sequenceMetaData?.response) ? sequenceMetaData.response : [];
    const breakdownResponse = rawSequenceBreakdown as unknown as dbDATA;
    const breakdown = Array.isArray(breakdownResponse?.response) ? breakdownResponse.response : [];
    const counts: { [key: string]: any } = {};

    totals.forEach((item: any) => {
        let countryCenter = getCountryCenterFromMapData(mapData, item.feature);
        if (countryCenter && countryCenter.lat === 0 && countryCenter.lng === 0) {
            const fallback = categoryCoordsMap[item.feature];
            if (fallback) countryCenter = { lat: fallback[0], lng: fallback[1] };
        }
        if (countryCenter && (countryCenter.lat !== 0 || countryCenter.lng !== 0)) {
            counts[item.feature] = {
                count: item.count,
                center: countryCenter,
                counts: [],
                labels: [],
            };
        }
    });

    breakdown.forEach((item: any) => {
        const country = counts[item.feature];
        if (!country) return;
        country.counts.push(Number(item.count));
        country.labels.push(item.category);
    });

    return counts;
}, [
    shouldLoadSequenceData,
    sequenceMetaData,
    rawSequenceBreakdown,
    isLoading_sequenceMetadata,
    isLoadingSequenceBreakdown,
    isLoading_mapData,
    mapData,
]);


  

    const sequenceMedatdata_colorMap = useMemo(() => {
        if (!sequenceMetaData || !isSequenceMetaData) return null;
        let colorMap = d3.scaleSequential(d3.interpolateCividis);
        // Convert countryCounts object to array of { feature: number }
        const countryCountsArr = Object.values(countryCounts)
            .map((obj: any) => ({ feature: obj.count }))
            .filter((obj: any) => typeof obj.feature === "number" && !isNaN(obj.feature));
        let [mi, ma] = getMinMaxFeature(countryCountsArr);
        colorMap.domain([mi, ma]);
        console.log("sequenceMetaData domain:", colorMap, mi ,ma);
        return colorMap;
    }, [countryCounts, sequenceMetaData, isSequenceMetaData]);



// ─── Shared hook: parse raw polygon data → Map<gridCellIndex, VisDataT> ───
    const {
        gridData: parsedGridData,
        parseErrors,
        featureRange: gridFeatureRange,
        cellSize: parsedGridCellSize,
    } = useGridDataParser({
        isLoading: isLoading_MosquitoData || (mapUIsettings.inCovidDataView ?? false),
        rawData: mosquitoData,
        gridcellSizeRef: gridcellSizeLatLng,
    });

    /* eslint-disable react-hooks/set-state-in-effect -- Successful parser output replaces the retained render grid. */
    useEffect(() => {
        if (parsedGridData.size > 0) {
            setGridData(parsedGridData);
        }
        if (parseErrors.length > 0) {
            parseErrors.forEach(e => collectDataLoadingErrors.current.push(<div>{e}</div>));
        }
    }, [parsedGridData, parseErrors]);
    /* eslint-enable react-hooks/set-state-in-effect */



    // *** functions *** //

    // Debounce timer for broadcasting coordinates to other synced maps via context.
    // This prevents rapid zoom (wheel) or pan events from flooding the context
    // while still keeping the local map responsive.
    const mapCoordsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const MAP_COORDS_DEBOUNCE_MS = 250;

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (mapCoordsDebounceRef.current) clearTimeout(mapCoordsDebounceRef.current);
        };
    }, []);

    /**
     * Sets the map viewport to the given coordinates after clamping them
     * to valid world bounds.
     *
     * When this component is configured as a SETTER (`isSyncMapCoordsOnTheFly_SETTER`),
     * the coordinates are also debounced (250 ms) and broadcast to
     * `InterfaceContext.mapCoords` so that RECEIVER maps can mirror the viewport.
     *
     * @param latitude  - Target latitude (will be clamped to `[-90, 90]`).
     * @param longitude - Target longitude (will be clamped to `[-180, 180]`).
     * @param zoom      - Target zoom level (clamped to `[MIN_ZOOM, MAX_ZOOM]`).
     */
    function updateCoordinates(latitude: number, longitude: number, zoom: number) {
        const [clampedLat, clampedLng, clampedZoom] = clampCoordinates(latitude, longitude, zoom);

        if(props.isSyncMapCoordsOnTheFly_SETTER === true) {
            // Debounce the context broadcast so rapid zoom / pan events
            // are batched before other maps react.
            if (mapCoordsDebounceRef.current) clearTimeout(mapCoordsDebounceRef.current);
            mapCoordsDebounceRef.current = setTimeout(() => {
                contextT.setMapCoords({
                    latitude: clampedLat,
                    longitude: clampedLng,
                    zoom: clampedZoom
                });
            }, MAP_COORDS_DEBOUNCE_MS);
        }
        // update the local state immediately so this map stays responsive
        setCoordinates([clampedLat, clampedLng, clampedZoom]);
    }

    /**
     * Unified country-selection handler used by both GeoJSON polygon click
     * events and the country-selection dropdown.
     *
     * Performs the following steps:
     * 1. Resolves `countryIdentifier` (ISO alpha-3, English name, or
     *    localised name) to the matching GeoJSON feature.
     * 2. In COVID data view, builds a filtered API URL scoped to the
     *    selected country and updates `InterfaceContext` + local state
     *    (dataset URL, date range, country code).
     * 3. Applies `activeStyle` to the selected polygon and resets all
     *    other polygons to `baseStyle`.
     * 4. Sets `mapSelectionObj` on the context to trigger the
     *    `useMapTransition` hook for a `flyTo` animation.
     *
     * @param countryIdentifier - ISO 3166-1 alpha-3 code, GeoJSON `name`,
     *                            or `NAME` property of the target country.
     *
     * @remarks
     * When `mapInteractions.disableClick` is `true` the function returns
     * immediately. A 5 s success toast is shown after the selection via
     * `setShowSuccessCountryDropdown`.
     */
    function selectCountry(countryIdentifier: string) {
        if (!map) return;

        // 1. Find the matching GeoJSON feature in mapData
        const matchingFeature = mapData?.features?.find(
            (f: any) =>
                f.properties?.iso_a3 === countryIdentifier ||
                f.properties?.name === countryIdentifier ||
                f.properties?.NAME === countryIdentifier
        );
        if (!matchingFeature) return;

        const countryName = matchingFeature.properties?.name ?? "";
        const countryCode = matchingFeature.properties?.iso_a3 ?? countryIdentifier;

        // 2. COVID data view: build API URL and update state
        if (mapUIsettings.inCovidDataView) {
            d3.selectAll(".leaflet-popup-pane").each(function () {
                d3.select(this).selectAll(".custom-popup").remove();
            });
            circlesSelectionRef.current = null;

            let featureName = contextT.curFeature || selectedFeature;
            if (!featureName) {
                featureName = mapUIsettings.defaultFeatureName;
                contextT.setCurFeature(featureName);
            }

            const datasetName =
                curDatasetname.current ||
                props.mapUIsettings.defaultDatasetName ||
                contextT.curPresenceDatasetName ||
                (mapUIsettings.inCovidDataView ? "epidemiology_geography_whole_df_w_geometry" : "");

            if (!curDatasetname.current && datasetName) {
                curDatasetname.current = datasetName;
            }

            const url = apiRoutes.fetchDbData({
                relationName: datasetName,
                feature: featureName,
                filterBy: COVID_COUNTRY_FILTER_COLUMN,
                filterValue: countryCode,
                startDate: (dateRange?.from && dateRange?.to) ? format(dateRange.from, "yyyy-MM-dd") : undefined,
                endDate: (dateRange?.from && dateRange?.to) ? format(dateRange.to, "yyyy-MM-dd") : undefined,
                aggregation_level: isCountryLevelData ? 0 : isSubregionLevelData ? 1 : undefined,
            });

            if (dateRange?.from && dateRange?.to) {
                setDateRange({ from: dateRange.from, to: dateRange.to });
                contextT.setDateRange({ from: dateRange.from, to: dateRange.to });
            }

            contextT.setCurPresenceDatasetName(datasetName);
            contextT.setCurDatasetURL(url);
            contextT.setCurPresenceDatasetURL(url);
            contextT.setIsPresenceData(true);
            setIsPresData(true);
            setPresenceDataURL(url);
            setShowSuccessCountryDropdown(true);

            setTimeout(() => {
                setShowSuccessCountryDropdown(false);
            }, 3000);
        }

        setSelectedCountry(countryIdentifier);
        if (props.mapUIsettings.isDoNotApplyCountryFromContext === false) {
            contextT.setSelectedCountry(countryCode);
        }

        // 3. Zoom/move to country bounds ONLY when explicitly configured (e.g. map-based country selection dropdown)
        if (props.mapUIsettings.isCountrySelectionDropdownMapBased && matchingFeature && L && map) {
            const bounds = L.geoJSON(matchingFeature as any).getBounds();
            if (bounds && bounds.isValid()) {
                map.fitBounds(bounds, { maxZoom: 8, padding: [20, 20] });
            }
        }

        contextT.setMapSelectionObj(matchingFeature as GEOjson.Feature);

        // 4. Highlight the selected polygon with activeStyle
        // Reset all layers to baseStyle first
        geoLayerRef.current?.eachLayer((layer) => {
            (layer as Leaflet.Path).setStyle({ ...baseStyle });
        });
        curPropertyNames.current = countryName;

        // Find the actual Leaflet path layer and apply activeStyle
        let targetPathLayer: Leaflet.Path | null = null;
        if (geoLayerRef.current) {
            geoLayerRef.current.eachLayer((layer) => {
                const featureProps = (layer as any)?.feature?.properties ?? {};
                if (
                    featureProps?.iso_a3 === countryCode ||
                    featureProps?.name === countryName ||
                    featureProps?.NAME === countryName
                ) {
                    targetPathLayer = layer as Leaflet.Path;
                }
            });
        }

        if (targetPathLayer) {
            activeLayerRef.current = targetPathLayer;
            (targetPathLayer as Leaflet.Path).setStyle({ ...activeStyle });
            if (typeof (targetPathLayer as Leaflet.Path).bringToFront === "function") {
                (targetPathLayer as Leaflet.Path).bringToFront();
            }
        } else {
            // Fallback: use applyActiveStyleToSelection if the layer wasn't found
            applyActiveStyleToSelection(matchingFeature as GEOjson.Feature);
        }
    }

    /**
     * Groups presence-data records by geographic coordinate, aggregating
     * feature values for duplicate `[latitude, longitude]` pairs.
     *
     * When a record with the same coordinates already exists in
     * `groupedPresData`, its feature value is updated via
     * {@link updateFeatureValueForLatLng}. Otherwise a new entry is
     * appended.
     *
     * @param d              - A single presence-data record to merge.
     * @param groupedPresData - Accumulator array of already-grouped records
     *                          (mutated in place).
     * @returns The same `groupedPresData` reference, now containing the
     *          merged entry (returned for chaining convenience).
     *
     * @remarks
     * Used exclusively in the COVID epidemiology data pipeline where
     * multiple daily records share the same sub-region centroid and need
     * to be collapsed into a single visual point.
     *
     * @see {@link updateFeatureValueForLatLng}
     */
    function preprocessPresenceDataForLatLng(d: presDBdataT, groupedPresData: presDBdataT[]): presDBdataT[]{
        // Aggregate feature values for a specific latitude-longitude pair

        const latLngElem_index = groupedPresData.findIndex(el => el.longitude === d.longitude && el.latitude === d.latitude);
        if (latLngElem_index !== -1){  
            updateFeatureValueForLatLng(groupedPresData, d, latLngElem_index);
        }
        else {
            // add new entry if not found
            groupedPresData.push({
                geometry: d.geometry,
                feature: d.feature,
                latitude: d.latitude,
                longitude: d.longitude,
                subregion_name: d.subregion_name,
                country_name: d.country_name
            });
        }
        return groupedPresData;   
    }

    /**
     * Merges a daily feature value into an existing grouped presence-data
     * record at the given `[latitude, longitude]`.
     *
     * The aggregation strategy depends on the active feature type:
     * - **Cumulative metrics** (prefix `cumulative_` or `accu`) – the
     *   maximum value is retained (idempotent for overlapping date ranges).
     * - **Incremental metrics** (e.g. `new_confirmed`, `new_deceased`,
     *   `new_recovered`) – values are summed across the date range.
     *
     * @param groupedPresData   - Accumulator array of grouped presence
     *                            records (mutated in place).
     * @param d                 - The incoming daily record whose feature
     *                            value is to be merged.
     * @param latLngElem_index  - Index hint (unused internally; the
     *                            match is re-verified by coordinate).
     *
     * @remarks
     * `selectedFeature` and `mapUIsettings.defaultFeatureName` are
     * captured from the enclosing component scope; they are **not**
     * passed as parameters.
     */
    function updateFeatureValueForLatLng(groupedPresData: { geometry: string; feature: string; longitude?: number; latitude?: number; }[], d: { geometry: string; feature: string; longitude?: number; latitude?: number; }, latLngElem_index: number) {
        // Update the feature value for the existing latitude-longitude location
    
        const longLatGroup = groupedPresData.find(el => el.longitude === d.longitude && el.latitude === d.latitude);
        if (longLatGroup) {
            longLatGroup.latitude = d.latitude;
            longLatGroup.longitude = d.longitude;
            longLatGroup.geometry = d.geometry;
    
            const feat = selectedFeature || mapUIsettings.defaultFeatureName || "";
            const isCumulative = feat.startsWith("cumulative_") || feat.startsWith("accu");

            if (isCumulative) {
                // For cumulative metrics over a date range, take the MAX value
                longLatGroup.feature = String(Math.max(Number(longLatGroup.feature), Number(d.feature)));
            } else {
                // For incremental metrics (e.g. new_recovered, new_confirmed, new_deceased), sum daily values
                longLatGroup.feature = String(Number(longLatGroup.feature) + Number(d.feature));
            }
    
            groupedPresData[latLngElem_index] = longLatGroup;
        }
    }
   
   /*************************
  * *** DETECT RESIZE *** *
  **************************/
  let {dimensions, setSizes, element, sizeRef } = useChartResizer(props.chartName);
  dimensions = dimensions || { width: 0, height: 0 };


  useEffect(() => {
    // remove existing scale bar
   d3.select("#"+id_scaleBar).remove();
   d3.select("#"+id_colorMap).remove();
}, [dimensions, id_scaleBar, id_colorMap]);




  /*********************************
   * *** Layer Update Handler **** *
   *********************************/
// Grid-layer (useGridLayer) no longer needs debounce – Leaflet handles
// zoom transitions natively via CSS3. Only presence-data and sequence-
// metadata layers still require a debounced redraw.
useLayerUpdateDebounce({
    curMouseEventRef: curMouseEvent,
    timerRef: layerUpdateHandlerTime,
    startLoading: L_debounceLoading.start,
    stopLoading: L_debounceLoading.stop,
    setIsUpdate: setisUpdate,
    interactionMap: map,
    onDebounceComplete: () => {
        presenceDrawHash.current += 1;
        console.log(" presenceDrawHash.current", presenceDrawHash.current)
        setIsSettingsOpen(true);
    },
    deps: [dimensions, map, latitude, longitude, zoom, layerOpacity, rawMosquitoData, curColorMapType],
});


// ─── Shared hook: sync React state → Leaflet map view (replaces nested RenderMap_onPosUpdate) ───
useMapPosition({ map, latitude, longitude, zoom });


// Apply active style to selected map feature/country
useEffect(() => {
    applyActiveStyleToSelection(contextT.mapSelectionObj);
}, [contextT.mapSelectionObj]);

 /**
  * Iterates over all GeoJSON polygon layers and applies `activeStyle` to
  * the layer whose `name` / `NAME` / `admin` property matches the given
  * `selection` feature, resetting every other layer to `baseStyle`.
  *
  * @param selection - The GeoJSON feature representing the selected
  *                    country, or `null` / `undefined` to clear.
  *
  * @remarks
  * Called from the `useEffect` that watches `contextT.mapSelectionObj`
  * to synchronise highlighting across coordinated map instances.
  */
 function applyActiveStyleToSelection(selection?: GEOjson.Feature | null) {
        if (!geoLayerRef.current) return;
        const targetIdentifiers = new Set(
            [
                selection?.properties?.name,
                selection?.properties?.NAME,
                selection?.properties?.admin,
            ].filter((value): value is string => typeof value === "string" && value.length > 0)
        );
        let matchedName = "";
        geoLayerRef.current.eachLayer((layer) => {
            const pathLayer = layer as Leaflet.Path;
            if (!pathLayer || typeof (pathLayer as any).setStyle !== "function") return;
            const featureProps = (layer as any)?.feature?.properties ?? {};
            const layerIdentifiers = [
                featureProps?.name,
                featureProps?.NAME,
                featureProps?.admin,
            ].filter((value): value is string => typeof value === "string" && value.length > 0);
            const isMatch =
                targetIdentifiers.size > 0 &&
                layerIdentifiers.some((id) => targetIdentifiers.has(id));
                const exactMatch = isMatch
                    ? layerIdentifiers.find((id) => targetIdentifiers.has(id)) ?? ""
                    : "";
                if (exactMatch) {
                    console.debug("Exact match:", exactMatch);
                }
            if (isMatch) {
                pathLayer.setStyle({ ...activeStyle });
                if (typeof pathLayer.bringToFront === "function") {
                    pathLayer.bringToFront();
                }
                matchedName = layerIdentifiers[0] ?? "";
            } else {
                pathLayer.setStyle({ ...baseStyle });
            }
        });
        curPropertyNames.current = matchedName || "";
    };


/**
 * Hook-function that renders (or re-renders) the GeoJSON country
 * polygon layer and an inverted ocean mask on the Leaflet map.
 *
 * @remarks
 * Called unconditionally at the component's top-level render to comply
 * with the Rules of Hooks. The internal `useEffect` gates execution on
 * `map`, `L`, and `isLoading_mapData`.
 *
 * Registers click, mousemove, and mouseout handlers on every polygon
 * for country selection, hover highlighting, and tooltip clearing.
 *
 * @param mapData      - The parsed GeoJSON `FeatureCollection` of world country boundaries.
 * @param map          - The active Leaflet map instance (may be `null` during SSR).
 * @param oceanGeoJSON - Inverted polygon used to mask ocean areas. `null` while loading.
 */
function MapDrawLayer_CountryPolygons(mapData: GEOjson.FeatureCollection, map: L.Map | null, oceanGeoJSON: GEOjson.FeatureCollection | null) {

    useEffect(() => {
        if (!map || !L || isLoading_mapData) return;

        if (!mapData?.features?.length) {
            if (geoLayerRef.current && map.hasLayer(geoLayerRef.current)) {
                geoLayerRef.current.remove();
                geoLayerRef.current = null;
            }
            if (oceanMaskLayerRef.current && map.hasLayer(oceanMaskLayerRef.current)) {
                oceanMaskLayerRef.current.remove();
                oceanMaskLayerRef.current = null;
            }
            return;
        }

        if (geoLayerRef.current && map.hasLayer(geoLayerRef.current)) {
            geoLayerRef.current.off();
            map.removeLayer(geoLayerRef.current);
            geoLayerRef.current = null;
        }

        if (oceanMaskLayerRef.current && map.hasLayer(oceanMaskLayerRef.current)) {
            oceanMaskLayerRef.current.off();
            map.removeLayer(oceanMaskLayerRef.current);
            oceanMaskLayerRef.current = null;
        }

        

       

        const resetLayerStyles = () => {
            geoLayerRef.current?.eachLayer((layer) => {
                (layer as L.Path).setStyle({ ...baseStyle });
            });
        };

        const clearPresenceOverlays = () => {
            d3.selectAll('[class^="svg-circles-container_"]').each(function () {
                d3.select(this).selectAll("g.pres-point").remove();
            });
            d3.selectAll(".leaflet-popup-pane").each(function () {
                d3.select(this).selectAll(".custom-popup").remove();
            });
            circlesSelectionRef.current = null;
        };

        const nextLayer = L.geoJSON(mapData, {
            style: baseStyle,
            interactive: true,
            onEachFeature: (feature: GeoJSON.Feature, leafletLayer: L.Layer) => {
                const pathLayer = leafletLayer as L.Path;

                // Click – delegates to the common selectCountry function
                const handleClick = () => {
                    if (props.mapInteractions.disableClick) return;
                    const countryCode = feature.properties?.iso_a3 ?? feature.properties?.name ?? "";
                    selectCountry(countryCode);
                };

                // Hover
                const handleMouseMove = (event: L.LeafletMouseEvent) => {
                    pathLayer.bringToFront();
                    const translated =
                        feature.properties?.[`NAME_${locale}`] ??
                        feature.properties?.[`name_${locale}`] ??
                        "";
                    hoverCountry.current = translated;
                    contextT.mouseEvent.current.country = translated;

                    // Only apply hover style to non-active countries
                    if (curPropertyNames.current !== feature.properties?.name) {
                        pathLayer.setStyle({ ...hoverStyle });
                        const el = (pathLayer as any).getElement?.();
                        if (el) el.classList.add("leaflet-path-hover");
                    }
                };

                const handleMouseOut = () => {
                    // Restore appropriate style: activeStyle for the selected country, baseStyle for others
                    if (curPropertyNames.current === feature.properties?.name) {
                        pathLayer.setStyle({ ...activeStyle });
                    } else {
                        pathLayer.setStyle({ ...baseStyle });
                    }
                    // Remove glow class (transitions handle the slow fade-out)
                    const el = (pathLayer as any).getElement?.();
                    if (el) el.classList.remove("leaflet-path-hover");
                    hoverCountry.current = "";
                    isHoverCountry.current = false;
                    removeAllTooltips();
                    const svg = d3.select(map.getContainer()).select("svg");
                    svg.selectAll("rect.hover-grid-cell").remove();
                    svg.selectAll("rect.selected-grid-cell").remove();
                    contextT.mouseEvent.current.country = "NA";
                    // Always bring the active (clicked) layer back to front
                    if (activeLayerRef.current && typeof activeLayerRef.current.bringToFront === "function") {
                        activeLayerRef.current.bringToFront();
                    }
                };

                leafletLayer.on({
                    click: handleClick,
                    mousemove: handleMouseMove,
                    mouseout: handleMouseOut,
                });
            },
        });

        geoLayerRef.current = nextLayer;
        nextLayer.addTo(map);

        // Render inverted ocean polygon OVER countries
        if (oceanGeoJSON != null && oceanGeoJSON.features.length > 0) {
            const oceanLayer = L.geoJSON(oceanGeoJSON, {
                style: {
                    fillColor: props.mapStyles?.backgroundColor, // matches user map.tsx background color
                    fillOpacity: 1,
                   color: baseStyle.color,
                   weight: strokeWidth,
                   fill: true,      
                },
                interactive: false,
            });
            oceanMaskLayerRef.current = oceanLayer;
            oceanLayer.addTo(map);
            // bring ocean mask to front so it hides background where land shouldn't be
            oceanLayer.bringToFront();
        }

        if (props.isStaticAutoFitFullSize && nextLayer.getLayers().length) {
            const bounds = nextLayer.getBounds();
            map.fitBounds(bounds, { padding: [100, 100] });
            setCoordinates([bounds.getCenter().lat, bounds.getCenter().lng, map.getZoom()]);
        }

        return () => {
            nextLayer.off();
            if (map.hasLayer(nextLayer)) {
                map.removeLayer(nextLayer);
            }
            if (geoLayerRef.current === nextLayer) {
                geoLayerRef.current = null;
            }
            if (oceanMaskLayerRef.current) {
                oceanMaskLayerRef.current.off();
                if (map.hasLayer(oceanMaskLayerRef.current)) {
                    map.removeLayer(oceanMaskLayerRef.current);
                }
                oceanMaskLayerRef.current = null;
            }
        };
    }, [
        map,
        L,
        mapData,
        isLoading_mapData,
        strokeWidth,
        locale,
        mapUIsettings.inCovidDataView,
        mapUIsettings.defaultFeatureName,
        selectedFeature,
        dateRange?.from,
        dateRange?.to,
        contextT.curFeature,
        oceanGeoJSON,
        isCountryLevelData,
        isSubregionLevelData
    ]);

    return null;
}

  

// ─── Shared hook: fly-to transition (replaces nested MapTransition) ───
useMapTransition({
    map,
    L,
    isEnabled: !!props.isApplyTransitions,
    selectionObj: contextT.mapSelectionObj,
    latitude,
    longitude,
    zoom,
    duration: mapFlyTransitionTime,
    updateCoordinates,
    resolveCenter: (selObj) => {
        // World variant: try to resolve center from mapData first
        const center = getCountryCenterFromMapData(mapData, selObj?.properties?.name);
        if (center && center.lat !== 0 && center.lng !== 0) return center;
        return null; // fall back to geometry bounds (handled by the hook)
    },
    onTransitionStart: () => {
        setIsSettingsOpen(false);
        setIsTransitioning(true);
        gridLayerTransitionRef.current = true;
    },
    onTransitionEnd: () => {
        // Restore UI and trigger exactly one grid-layer redraw after transition.
        setIsTransitioning(false);
        gridLayerTransitionRef.current = false;
        gridLayerRedrawRef.current();
        setIsSettingsOpen(true);
    },
});


// ─── Shared hook: invalidateSize on resize (replaces nested MapWatchRezies) ───
useMapResize({ map, dimensions });


/**
 * Hook-function that renders world-capital city markers and localised
 * text labels on the Leaflet map.
 *
 * @remarks
 * Labels are only displayed when `zoom >= 3.9` (controlled by the
 * `isCapitalLabel` state). Each label is rendered as a `L.divIcon`
 * attached to an invisible `L.marker`.
 *
 * @param capitalsData - GeoJSON `FeatureCollection` of capital-city points.
 * @param map          - The active Leaflet map instance.
 */
function MapDrawLayer_Captials(capitalsData: CapitalsFeatureCollection, map: L.Map | null) {
    const capitalsLayerRef = useRef<L.LayerGroup | null>(null);

    useEffect(() => {
        if (!map || !L || isLoadingCapitals || !props.mapDataSets.isCityNames) return;
        const features = capitalsData?.features ?? [];
        if (!features.length) return;

        if (capitalsLayerRef.current && map.hasLayer(capitalsLayerRef.current)) {
            map.removeLayer(capitalsLayerRef.current);
        }

        const layerGroup = L.layerGroup();

        features.forEach((feature) => {
            const coords = (feature.geometry as GEOjson.Point)?.coordinates;
            if (!Array.isArray(coords) || coords.length < 2) return;

            const [lng, lat] = coords;

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

            let capitalName = feature.properties.title[locale] || feature.properties.title.en ||
                "";

            const marker = L.circleMarker([lat, lng], {
                radius: 3,
                color: "#000",
                weight: 1,
                fillColor: "#000",
                fillOpacity: 1,
            });

            if (capitalName && isCapitalLabel) {
                // simple html-escape to avoid injecting arbitrary html
                const escapeHtml = (str: string) =>
                    String(str)
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/"/g, "&quot;")
                        .replace(/'/g, "&#039;");

                const labelHtml = `<div style="
                    pointer-events: none;
                    white-space: nowrap;
                    font-size: 12px;
                    padding: 2px 6px;
                    background: rgba(255, 255, 255, 0.36);
                    border-radius: 6px;
                    border: 1px solid rgba(0,0,0,0.08);
                    box-shadow: 0 1px 2px rgba(0,0,0,0.06);
                ">${escapeHtml(capitalName)}</div>`;

               /* const labelHtml = `<div style="
                    pointer-events: none;
                    white-space: nowrap;
                    font-size: 12px;
                    padding: 2px 6px;
                    background: rgba(255,255,255,0.9);
                    border-radius: 6px;
                    border: 1px solid rgba(0,0,0,0.08);
                    box-shadow: 0 1px 2px rgba(0,0,0,0.06);
                ">${escapeHtml(capitalName)}</div>`;
                */
               
                const labelIcon = L.divIcon({
                    html: labelHtml,
                    className: "capital-label-divicon",
                    iconSize: undefined,
                    // anchor slightly above the point
                    iconAnchor: [-8, 12],
                });

                // create a non-interactive marker that holds the label (removed together with layerGroup)
                const labelMarker = L.marker([lat, lng], { icon: labelIcon, interactive: false });
                layerGroup.addLayer(labelMarker);
            }

            layerGroup.addLayer(marker);
        });

        layerGroup.addTo(map);
        capitalsLayerRef.current = layerGroup;

        return () => {
            if (capitalsLayerRef.current && map.hasLayer(capitalsLayerRef.current)) {
                map.removeLayer(capitalsLayerRef.current);
            }
            capitalsLayerRef.current = null;
        };
    }, [map, L, capitalsData, isLoadingCapitals, isCapitalLabel]);

    return null;
}

const isCapitalLabel = zoom >= 3.9;


/**
 * Creates a throttled wrapper around `func` that ensures at most one
 * invocation per `delay` milliseconds (leading-edge).
 *
 * @param func  - The function to throttle.
 * @param delay - Minimum interval between invocations (ms).
 * @returns A throttled function with the same signature.
 */
const throttle = (func: Function, delay: number) => {
    let lastCall = 0;
    return (...args: any[]) => {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            func(...args);
        }
    };
};

/**
 * Throttled Leaflet `mousemove` handler responsible for grid-cell hit-
 * testing, tooltip rendering, feature-value lookup, and selected-cell
 * highlighting.
 *
 * @remarks
 * Wrapped in a 16 ms throttle (≈ 60 fps) to avoid layout thrashing.
 * In non-COVID view, calls {@link addToolTip} to render the hover
 * tooltip. In COVID view the tooltip is handled by the SVG circle
 * `mouseover` handler inside `MapDrawLayer_CovidPresenceData`.
 */
const HandleMouseMoveX = useCallback(
    throttle((event: L.LeafletMouseEvent, map: L.Map, gridData: any) => {

    let debug = false;

    if (!map || !L?.geoJSON || !gridData) {
        console.error("Map instance is not available.");
        return;
    }

        
        removeAllTooltips();
        
        if (!mapUIsettings.inCovidDataView) {
            addToolTip();
        }
      
    
        /**
         * Renders the grid-cell hover tooltip (or pin marker) at the
         * current cursor position, showing the feature value, unit,
         * and cell coordinates.
         */
        function addToolTip() {
        let unit = "";
        let value: any = "";
        if(Number.isNaN(curGridCellFeature.current)) {
            value = "NA";
            unit = "";
        }
        else{
            ({ value, unit } = alignFeature_to_Metadata(curGridCellFeature.current, selectedFeature, metaData));
        }

        // Build color legend bar HTML
        let colorBarHtml = "";
        if (value !== "NA" && metaData[selectedFeature] !== undefined) {
            let minGoodVal = alignFeature_to_Metadata(minVal, selectedFeature, metaData).value;
            let maxGoodVal = alignFeature_to_Metadata(maxVal, selectedFeature, metaData).value;
            [minGoodVal, maxGoodVal] = getGoodReadableRange(minGoodVal, maxGoodVal);

            const cMap = d3.scaleSequential(availableColorMaps[curColorMapType as keyof typeof availableColorMaps]);
            cMap.domain([minGoodVal, maxGoodVal]);
            if (curColorMapType === "interpolateRdBu") {
                const cUnit = alignFeature_to_Metadata(minVal, selectedFeature, metaData).unit;
                if ((minGoodVal < 0 && maxGoodVal > 0) || (cUnit === "K" || cUnit === "°C")) {
                    const m = Math.max(Math.abs(minGoodVal), Math.abs(maxGoodVal));
                    minGoodVal = -m;
                    maxGoodVal = m;
                }
                cMap.domain([maxGoodVal, minGoodVal]);
            }

            // Build gradient stops
            const numStops = 12;
            const stops: string[] = [];
            for (let i = 0; i <= numStops; i++) {
                const t = i / numStops;
                const v = minGoodVal + t * (maxGoodVal - minGoodVal);
                const col = cMap(v);
                stops.push(`${col} ${(t * 100).toFixed(1)}%`);
            }

            // Compute arrow position (clamped 0-100%)
            const range = maxGoodVal - minGoodVal;
            const pct = range !== 0 ? Math.max(0, Math.min(100, ((value - minGoodVal) / range) * 100)) : 50;

            colorBarHtml = `
                <div style="position:relative; margin:8px 0 2px 0; padding-top:14px;">
                    <div style="position:absolute; left:${pct.toFixed(1)}%; top:0; transform:translateX(-50%); color:#fff; font-size:11px; line-height:1; text-shadow:0 1px 2px rgba(0,0,0,0.4);">▼</div>
                    <div style="height:8px; border-radius:4px; background:linear-gradient(to right, ${stops.join(", ")}); border:1px solid rgba(255,255,255,0.25);"></div>
                    <div style="display:flex; justify-content:space-between; margin-top:2px; font-size:9px; color:rgba(199,210,254,0.8);">
                        <span>${minGoodVal.toLocaleString(locale, { maximumFractionDigits: 1 })}</span>
                        <span>${maxGoodVal.toLocaleString(locale, { maximumFractionDigits: 1 })}</span>
                    </div>
                </div>
            `;
        }

        // Remove existing tooltip completely before re-adding
        if (map && toolTipRef.current && map.hasLayer(toolTipRef.current)) {
            map.removeLayer(toolTipRef.current);
        }
        
        toolTipRef.current.setLatLng(event.latlng);
        
        if( props.mapStyles.isTooltopVisible==true) {
           
        
        toolTipRef.current.setContent(
            renderStandardTooltipHTML({
                value: value.toLocaleString(locale),
                unit: unit,
                description: metaData[selectedFeature] !== undefined ? metaData[selectedFeature].description : "N/A",
                colorBarHtml: colorBarHtml,
                rows: [
                    { label: String(t.rich("tooltip.country")), value: getLocalizedCountryName(contextT.mouseEvent.current.country, locale) },
                    {
                        label: String(t.rich("tooltip.latLong")),
                        value: `${curGridCell.current[0].toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${curGridCell.current[1].toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    },
                ],
                chartId: "toolTip" + chart,
            })
        );
        }if (props.mapStyles.isMapMarkerTooltipVisible==true) {
            // Use a real L.marker with a custom SVG divIcon so the pin tip sits
            if (L && map) {
                const pinSvg = `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
                        <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z"
                              fill="#4f46e5" stroke="#fff" stroke-width="1.5"/>
                        <circle cx="12" cy="12" r="5" fill="#fff" opacity="0.9"/>
                    </svg>`;
                const icon = L.divIcon({
                    html: pinSvg,
                    className: '',           // suppress Leaflet's default white box
                    iconSize: [24, 36],
                    iconAnchor: [12, 36],    // tip of the pin (bottom-centre)
                });
                if (!cursorMarkerRef.current) {
                    cursorMarkerRef.current = L.marker(event.latlng, {
                        icon,
                        interactive: false,
                        zIndexOffset: 9000,
                    }).addTo(map);
                } else {
                    cursorMarkerRef.current.setIcon(icon);
                    cursorMarkerRef.current.setLatLng(event.latlng);
                    if (!map.hasLayer(cursorMarkerRef.current)) {
                        cursorMarkerRef.current.addTo(map);
                    }
                }
            }
            return; // skip tooltip for the marker-only case
        }

        if (map) {
            map.openTooltip(toolTipRef.current);
        }
        }
        if (isLoading_MosquitoData) return;
        const gridCellDims = {
            lat: gridcellSizeLatLng.current.lat,
            lng: gridcellSizeLatLng.current.lng,
        };
        if (
            !Number.isFinite(gridCellDims.lat) || gridCellDims.lat <= 0 ||
            !Number.isFinite(gridCellDims.lng) || gridCellDims.lng <= 0 ||
            !Number.isFinite(event.latlng.lat) || !Number.isFinite(event.latlng.lng)
        ) return;
        let mapVal = gridData.entries().next();
        if (!mapVal || mapVal.done) return; // Ensure visData is not empty

        const [firstKey, firstVisData] = mapVal.value;
        const firstTopLeft = firstVisData.corners
            ? [
                Math.max(firstVisData.corners[0], firstVisData.corners[2], firstVisData.corners[4], firstVisData.corners[6]),
                Math.min(firstVisData.corners[1], firstVisData.corners[3], firstVisData.corners[5], firstVisData.corners[7]),
            ] as [number, number]
            : firstVisData.bounds
                ? [firstVisData.bounds[0], firstVisData.bounds[2]] as [number, number]
                : firstVisData.topLeft || firstVisData.geometry?.[0];
        if (!firstTopLeft || !firstTopLeft.every(Number.isFinite)) return;
        let gridOffset = getGridOffset(
            firstTopLeft[0],
            firstTopLeft[1],
            gridcellSizeLatLng.current.lat,
            gridcellSizeLatLng.current.lng
        );
        let coords = {lat: event.latlng.lat, lng: event.latlng.lng};
        let curSnapped = snapToGrid(coords, gridCellDims, gridOffset);

        // Compute the top-left corner of the current grid cell
        let rPoint = roundLatLng(curSnapped.topLeft); 

        let gridLat = rPoint.lat;
        let gridLng = rPoint.lng;
        if (!Number.isFinite(gridLat) || !Number.isFinite(gridLng)) return;

        // avoid unnecessary updates
        if (curGridCell.current[0] === gridLat && curGridCell.current[1] === gridLng) {
            return; // No change in grid cell
        }
        //console.log("drawTooltip...")
        curGridCell.current = [curSnapped.center.lat, curSnapped.center.lng];

        let curGridCoords = {lat: gridLat, lng: gridLng};
        curGridCellID.current = getGridCellIndex(curGridCoords, gridCellDims)-1;
        curGridCellFeature.current = NaN; // Use NaN to indicate an invalid or uninitialized state

        // get gridCell Data
        let curGridCellDat = gridData.get(curGridCellID.current)
        curGridCellFeature.current = curGridCellDat?.feature ?? NaN;

        // get rowID
        let rowID = curGridCellDat?.rowID ?? NaN;
        curGridCellRowID.current = rowID-1;

        // Compute the bottom-right corner of the grid cell
        const gridLatBottom = gridLat +  gridcellSizeLatLng.current.lat;
        const gridLngRight = gridLng +  gridcellSizeLatLng.current.lng;

        // Convert grid coordinates to layer points for correct placement
        const topLeft = map.latLngToLayerPoint([gridLat , gridLng]);
        const bottomRight = map.latLngToLayerPoint([gridLatBottom , gridLngRight]);

        // Compute width and height in pixels
        const width = Math.abs(bottomRight.x - topLeft.x);
        const height = Math.abs(bottomRight.y - topLeft.y);

        // Select the SVG layer inside the map container
        const svg = d3.select(map.getContainer()).select("svg");


        // Update or create the hover highlight rect (reuse to avoid DOM churn)
        let hoverRect = svg.select<SVGRectElement>("rect.hover-grid-cell");
        if (hoverRect.empty()) {
            hoverRect = svg.append<SVGRectElement>("rect")
                .attr("class", "hover-grid-cell");
        }
        hoverRect
            .attr("x", topLeft.x)
            .attr("y", topLeft.y)
            .attr("width", width)
            .attr("height", height)
            .attr("fill", "red")
            .attr("opacity", 0.5)
            .attr("stroke", "black")
            .attr("stroke-width", 1);

        // second call of draw function: keeps rectnagel alive during haover changes
        DrawSelectedGridCell(contextT.selectedGridcellID);

        let textFields = d3.selectAll(".grid-cell-text");
        if (textFields.size() > 30) {
            textFields.remove();
        }
        // Draw the grid cell text
        if(debug) {
            console.log("mapVal", mapVal);    
        svg.append("text")
            .attr("class", "grid-cell-text")
            .attr("x", topLeft.x + width / 2)
            .attr("y", topLeft.y + width / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", "white")
            .attr("font-size", "12px")
            
            .text(`${curGridCellID.current} [idx: ${curGridCellDat?.visDatIdx ?? "N/A"}]`);
        }

    }, 16), [map, L, gridData, isLoading_MosquitoData, metaData, selectedFeature, locale, t, contextT.selectedGridcellID, curColorMapType]);
 // first call of draw function: keeps rectangle correctly projected during zooming/panning   
DrawSelectedGridCell(contextT.selectedGridcellID);

const circlesSelectionRef = useRef<d3.Selection<any, any, any, any> | null>(null);

/**
 * Re-projects all COVID SVG `<circle>` elements to their current
 * Leaflet layer-point positions after a `moveend` or `zoomend` event.
 *
 * @remarks
 * Uses a cached D3 selection (`circlesSelectionRef`) to avoid
 * querying the DOM on every call. The cache is invalidated whenever
 * the underlying presence data changes.
 */
function updateCirclesOnMapMove() {
    if (!map) return;
    // Cache the selection instead of querying DOM every time
    if (!circlesSelectionRef.current) {
        circlesSelectionRef.current = d3.selectAll('.svg-circles-container_' + props.chartName + ' circle');
    }
    
    circlesSelectionRef.current
        .each(function () {
            const circle = d3.select(this);
            const lat = parseFloat(circle.attr('data-lat') || '0');
            const lng = parseFloat(circle.attr('data-lng') || '0');

            const point = map.latLngToLayerPoint([lat, lng])

            circle
            .attr('cx', point.x)
            .attr('cy', point.y);
        });
}

/**
 * Hook-function that registers Leaflet map interaction listeners
 * (`moveend`, `zoomend`, `mousemove`, `mouseout`) and wires them
 * to `HandleMouseMoveX`, `updateCoordinates`, and the COVID circle
 * re-projection helper.
 *
 * @param isUpdate - Monotonic toggle that forces the `useEffect`
 *                   dependency array to re-evaluate, re-attaching
 *                   listeners after a data reload.
 *
 * @remarks
 * Listeners are cleaned up on every re-run via the `useEffect`
 * return function. The `circlesSelectionRef` cache is invalidated
 * at the top of each cycle so stale DOM selections are never reused.
 */
function MapMouseEvents(isUpdate: boolean) {
    let debug = false;
    useEffect(() => {
        // Invalidate cached circle selection when map data changes
        circlesSelectionRef.current = null;
        
        if (!map) return;
        if (true) {
            const handleMouseEvent = () => {
                if (gridLayerTransitionRef.current) return;
                let curCenter = map.getCenter();
                let curZoom = map.getZoom();
                curCenter.lat = Math.round(curCenter.lat * CALCER) / CALCER;
                curCenter.lng = Math.round(curCenter.lng * CALCER) / CALCER;
                curZoom = Math.round(curZoom * 100) / 100;

                const [currentLat, currentLng, currentZoom] = coordsRef.current;
                if (curCenter) {
                    if (curCenter.lng !== currentLng || curCenter.lat !== currentLat || curZoom !== currentZoom) {
                        updateCoordinates(curCenter.lat, curCenter.lng, curZoom);
                    }
                }
            };

              const handleMouseMove = (event: L.LeafletMouseEvent) => {

               
           
                if (event.originalEvent.buttons === 1) { // 1 means left mouse button is pressed
                    setIsSettingsOpen((prev) => prev ? false : prev);
                    curMouseEvent.current = "drag";
                } else {
                    curMouseEvent.current = "mousemove";
                }
                //console.log("setMouseEvent:", curMouseEvent.current, event);
                    if (
                    typeof curMapMouseEvents.current.lastSetTime === "number" &&
                    Date.now() - curMapMouseEvents.current.lastSetTime > 16
                ) {
                    //console.log("time:",  Date.now() - curMapMouseEvents.current.lastSetTime );
                    contextT.mouseEvent.current.type = curMouseEvent.current;
                    contextT.mouseEvent.current.event = event;
                    contextT.mouseEvent.current.position = [event.latlng.lng, event.latlng.lat];
                    contextT.notifyMouseEvent();
                 
                    curMapMouseEvents.current.lastSetTime = Date.now();

        }
            };
            const handleMouseClick = (event: L.LeafletMouseEvent) => {
                if(props.mapInteractions.disableClick) {
                    return; // Ignore click events if interaction is disabled
                }
                // Handle click event here
                contextT.setSelectedGridcellID( curGridCellID.current);
                contextT.setDbRowID_of_selectedGridcellID(curGridCellRowID.current);
                if(!mapUIsettings.inCovidDataView) {
                    contextT.setCurFeatureValue(Number.isNaN(curGridCellFeature.current) ? "NA" : curGridCellFeature.current.toString());
                }

                // Dummy GeoJSON map selection object
                const dummyFeature = {
                    type: "Feature",
                    properties: {
                        name: "",
                    },
                    geometry: {
                        type: "Polygon",
                        coordinates: [
                            [
                                [-10.0, 10.0],
                                [-10.0, 20.0],
                                [0.0, 20.0],
                                [0.0, 10.0],
                                [-10.0, 10.0]
                            ]
                        ]
                    }
                };
                if(hoverCountry.current  == "") {
                    // set the dummy feature with empty country name to allow
                    // selction of grid cells that are not in a country
                    // important for e.g. line chart component
                    // to show the history for a feature of one grid cell
                    contextT.setMapSelectionObj(dummyFeature);

                    if (mapUIsettings.inCovidDataView) {
                        handleResetToAllCountriesRef.current();
                    }
                }

                // Draw the selected grid cell (non-filled yellow rectangle)
               
            };
            const handleZoomStart = () => {
                isZoomingRef.current = true;
                curMouseEvent.current = "wheel";
                if (zoomDebounceRef.current) {
                    clearTimeout(zoomDebounceRef.current);
                    zoomDebounceRef.current = null;
                }
            };

            const scheduleZoomSettled = () => {
                if (zoomDebounceRef.current) {
                    clearTimeout(zoomDebounceRef.current);
                }
                zoomDebounceRef.current = setTimeout(() => {
                    zoomDebounceRef.current = null;
                    isZoomingRef.current = false;
                }, 150);
            };
            const handleZoomEnd = () => {
                handleMouseEvent();
                scheduleZoomSettled();
            };
            const handleMoveStart = () => {
                if (!isZoomingRef.current || !zoomDebounceRef.current) return;
                clearTimeout(zoomDebounceRef.current);
                zoomDebounceRef.current = null;
            };
            const handleMoveEnd = () => {
                handleMouseEvent();
                if (isZoomingRef.current) scheduleZoomSettled();
            };

            map.on("click", (event: L.LeafletMouseEvent) => handleMouseClick(event));
            map.on("movestart", handleMoveStart);
            map.on("moveend", handleMoveEnd);
            map.on("zoomstart", handleZoomStart);
            map.on("zoomend", handleZoomEnd);
            map.on("mousemove", handleMouseMove);

            if (mapUIsettings.inCovidDataView) {
                map.on('zoomend', updateCirclesOnMapMove);
                map.on('moveend', updateCirclesOnMapMove);
            }

            // Cleanup function to remove event listeners when component unmounts
            return () => {
                if (zoomDebounceRef.current) {
                    clearTimeout(zoomDebounceRef.current);
                }
                map.off("zoomstart", handleZoomStart);
                map.off("zoomend", handleZoomEnd);
                map.off("movestart", handleMoveStart);
                map.off("moveend", handleMoveEnd);
                map.off("mousemove", handleMouseMove);
                map.off("click", handleMouseClick);
                if (mapUIsettings.inCovidDataView) {
                    map.off('zoomend', updateCirclesOnMapMove);
                    map.off('moveend', updateCirclesOnMapMove);
                }
            };
        }
    }, [map] );
    return null;
}

// This effect handles the wheel event to close settings when zooming
useEffect(() => {
    if (!map) return;
    const container = map.getContainer();
    const handleWheel = () => {
        setIsSettingsOpen((prev) => prev ? false : prev);
        curMouseEvent.current = "wheel";
    };
    container.addEventListener("wheel", handleWheel);

    return () => {
        container.removeEventListener("wheel", handleWheel);
    };
}, [map]);

    const removeAllTooltips = useCallback(() => {
        removeReusedTooltip(map, L, toolTipRef);
        // Also remove the cursor marker when tooltips are cleared (e.g. mouse leave)
        if (cursorMarkerRef.current && map && map.hasLayer(cursorMarkerRef.current)) {
            map.removeLayer(cursorMarkerRef.current);
        }
    }, [map, L]);

    // ─── Shared hook: hide tooltip when cursor leaves the map container ───
    const handleTooltipMouseLeave = useCallback(() => {
        // Clear the shared tooltip state and notify linked maps once.
        contextT.mouseEvent.current.event = undefined;
        contextT.mouseEvent.current.type = 'mouseout';
        contextT.mouseEvent.current.position = [0, 0];
        contextT.notifyMouseEvent();
    }, [contextT.mouseEvent, contextT.notifyMouseEvent]);
    const { isMouseInsideRef } = useTooltipCleanup({ map, L, toolTipRef, onMouseLeave: handleTooltipMouseLeave });

    // Synchronize linked-map tooltips only when a source map publishes a new
    // mouse event. The previous implementation kept one requestAnimationFrame
    // loop per map alive forever and compared incompatible values (LatLng vs.
    // tuple), causing the same event to be processed up to 60 times per second.
    useEffect(() => {
        if (!map) return;

        const handleSharedMouseEvent = () => {
            const mouseData = contextT.mouseEvent.current;
            const sharedPosition = mouseData.position;
            const localPosition = curMapMouseEvents.current.position;
            const positionChanged = Boolean(sharedPosition) && (
                !localPosition ||
                sharedPosition![0] !== localPosition[0] ||
                sharedPosition![1] !== localPosition[1]
            );
            const typeChanged = mouseData.type !== curMapMouseEvents.current.type;

            if (!positionChanged && !typeChanged) return;

            curMapMouseEvents.current.type = mouseData.type;
            curMapMouseEvents.current.position = sharedPosition
                ? [sharedPosition[0], sharedPosition[1]]
                : undefined;

            if (mouseData.type === 'mouseout') {
                removeAllTooltips();
                return;
            }
            if (mouseData.event) {
                if (!(mouseData.event.originalEvent as MouseEvent)?.buttons) {
                    HandleMouseMoveX(mouseData.event, map, gridData);
                }
            }
        };

        return contextT.subscribeMouseEvent(handleSharedMouseEvent);
    }, [HandleMouseMoveX, contextT.mouseEvent, contextT.subscribeMouseEvent, gridData, map, removeAllTooltips]);

    // ─── Shared hook: screen distance calculation (replaces nested MapDistanceProvider) ───
    useMapDistance({
        map,
        longitude,
        latitude,
        zoom,
        dimensions,
        screenDistanceOneKMRef: screenDistanceOneKM,
        projectionFactory: d3.geoEquirectangular,
    });

/**
 * Draws a non-filled yellow-stroke rectangle highlighting the currently
 * selected grid cell on the Leaflet SVG overlay.
 *
 * @remarks
 * Called both from inside `HandleMouseMoveX` (to survive cursor
 * movements) and at the component's top-level render (to survive
 * zoom / pan reprojections).
 *
 * @param GridCellID - Index into the `gridData` Map. A value of `-1`
 *                     clears any existing highlight.
 */
function DrawSelectedGridCell(GridCellID: number) {
        
        if (!map) return;
        // Remove previous grid cell highlight
        const svg = d3.select(map.getContainer()).select("svg");
        svg.selectAll("rect.selected-grid-cell").remove();
        if (GridCellID !== -1) {
            // Find the selected grid cell's coordinates
            let selectedGridData = gridData.get(GridCellID);
            if (selectedGridData && (selectedGridData.corners || selectedGridData.bounds || selectedGridData.topLeft || selectedGridData.geometry)) {
                let north: number;
                let south: number;
                let west: number;
                let east: number;
                if (selectedGridData.corners) {
                    const corners = selectedGridData.corners;
                    north = Math.max(corners[0], corners[2], corners[4], corners[6]);
                    south = Math.min(corners[0], corners[2], corners[4], corners[6]);
                    west = Math.min(corners[1], corners[3], corners[5], corners[7]);
                    east = Math.max(corners[1], corners[3], corners[5], corners[7]);
                } else if (selectedGridData.bounds) {
                    [north, south, west, east] = selectedGridData.bounds;
                } else if (selectedGridData.topLeft) {
                    [north, west] = selectedGridData.topLeft;
                    south = north - gridcellSizeLatLng.current.lat;
                    east = west + gridcellSizeLatLng.current.lng;
                } else {
                    const geometry = selectedGridData.geometry!;
                    const selectedLatitudes = geometry.map(([lat]) => lat);
                    const selectedLongitudes = geometry.map(([, lng]) => lng);
                    north = Math.max(...selectedLatitudes);
                    south = Math.min(...selectedLatitudes);
                    west = Math.min(...selectedLongitudes);
                    east = Math.max(...selectedLongitudes);
                }

                const selectedTopLeft = map.latLngToLayerPoint([north, west]);
                const selectedBottomRight = map.latLngToLayerPoint([south, east]);
                
                const selectedWidth = Math.abs(selectedBottomRight.x - selectedTopLeft.x);
                const selectedHeight = Math.abs(selectedBottomRight.y - selectedTopLeft.y);
               
                
                // Draw the selected grid cell as a non-filled rectangle with yellow stroke
                svg.append("rect")
                    .attr("class", "selected-grid-cell")
                    .attr("x", Math.min(selectedTopLeft.x, selectedBottomRight.x))
                    .attr("y", Math.min(selectedTopLeft.y, selectedBottomRight.y))
                    .attr("width", selectedWidth)
                    .attr("height", selectedHeight)
                    .attr("fill", "none")
                    .attr("stroke", "yellow")
                    .attr("stroke-width", 3);
            }
        }
}


// ─── Hook invocations (nested functions still called as hooks, shared ones replaced above) ───
MapDrawLayer_CountryPolygons(mapData, map, oceanGeoJSON);
MapDrawLayer_Captials(capitalsData, map);
// useMapPosition is called above via shared hook
// MapTransition is now handled by useMapTransition() hook above
MapMouseEvents(isUpdate);
// useMapResize is called above via shared hook
// useMapDistance is called above via shared hook
MapDrawLayer_SequenceMetadata(countryCounts);
// MapDrawLayer_Grid is now handled by useCanvasGridLayer() hook below


/** Handles the longitude range-slider `onChange`, forwarding the new value to {@link updateCoordinates}. */
const handleInputChange1 = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateCoordinates(latitude, Number(event.target.value), zoom);
    curMouseEvent.current = "slider";
};
/** Handles the latitude range-slider `onChange`, forwarding the new value to {@link updateCoordinates}. */
const handleInputChange2 = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateCoordinates( Number(event.target.value), longitude, zoom);
    curMouseEvent.current = "slider";
};

/** Handles the zoom range-slider `onChange`, forwarding the new value to {@link updateCoordinates}. */
const handleInputChangeZoom = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateCoordinates(latitude, longitude, Number(event.target.value));
    curMouseEvent.current = "slider";
};

    /**
     * Handles the layer-opacity slider `onChange`. Clamps the value to
     * `[0, 1]` and propagates to both local state and `InterfaceContext`.
     */
    const handleLayerOpacityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(0, Math.min(1, Number(event.target.value)));
    curMouseEvent.current = "opacity";
    setLayerOpacity(value);
    contextT.setCurLayerOpacity(value);
};

const [minVal, maxVal] = useMemo(() => {
    if (mapUIsettings.inCovidDataView) {
        if (!presData || presData.length === 0) {
            return [0, 0];
        }
        return getMinMaxFeature(
            presData.map(d => ({
                feature: Number(d.feature)
            }))
        );
    } else {
        const loading = isLoading_MosquitoData;
        const hasError = mosquitoData && mosquitoData.error !== null;
        if (loading || hasError || parsedGridData.size === 0) {
            return [0, 0];
        }
        return gridFeatureRange;
    }
}, [mosquitoData, isLoading_MosquitoData, presData, mapUIsettings.inCovidDataView, parsedGridData, gridFeatureRange]);

const isColorMapLegendReady = mapUIsettings.inCovidDataView
    ? (!isLoadingCOVIDData && !isLoadingPresenceData && presData.length > 0)
    : (props.mapDataSets.isGridData !== false && !isLoading_MosquitoData && mosquitoData?.error == null);


const radiusScale = useMemo(() => {
    return d3.scaleSqrt()
        .domain([minVal, maxVal])
        .range([1, 5]);
}, [minVal, maxVal]);

const colorMap = useMemo(() => {
    const c = d3.scaleSequential(availableColorMaps[curColorMapType as keyof typeof availableColorMaps]);
    
    let minG = alignFeature_to_Metadata(minVal, selectedFeature, metaData).value;
    let maxG = alignFeature_to_Metadata(maxVal, selectedFeature, metaData).value;
    [minG, maxG] = getGoodReadableRange(minG, maxG);

    c.domain([minG, maxG]);
    if (curColorMapType === "interpolateRdBu") {
        const u = alignFeature_to_Metadata(minVal, selectedFeature, metaData).unit;
        if ((minG < 0 && maxG > 0) || u === "K" || u === "°C") {
            const m = Math.max(Math.abs(minG), Math.abs(maxG));
            minG = -m;
            maxG = m;
        }
        c.domain([maxG, minG]);
    }
    
    return (v: number) => {
        const aligned = alignFeature_to_Metadata(v, selectedFeature, metaData).value;
        return c(aligned);
    };
}, [curColorMapType, minVal, maxVal, selectedFeature, metaData]);


/**
 * Cancels a pending `setTimeout` stored in the provided ref and resets
 * the ref to `null`.
 *
 * @param ref - Mutable ref holding a timeout id. Defaults to
 *              `layerUpdateHandlerTime` (the layer-update debounce timer).
 */
function resetTimeout( ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null> = layerUpdateHandlerTime) {
    if(ref.current) {
        clearTimeout(ref.current);
    }
}

/**
 * Performs a cross-fade transition between two `L.ImageOverlay` layers.
 *
 * The previous overlay is faded out over `timer` ms, then removed.
 * A new overlay is created from `imageUrl`, added to the map at the
 * current viewport bounds, and faded in over the same duration.
 *
 * @param map          - The active Leaflet map instance.
 * @param imageUrl     - Base-64 data-URL of the new canvas snapshot.
 * @param timer        - Transition duration in milliseconds.
 * @param layerOpacity - Target opacity for the incoming overlay.
 * @param overlayRef   - Mutable ref holding the current overlay instance;
 *                       updated in place to point at the new overlay.
 *
 * @remarks
 * If the map container has zero pixel size (e.g. before the first
 * `invalidateSize`), `map.getBounds()` throws. The function guards
 * against this with a try-catch and silently skips the render cycle.
 */
function LayerTransition(
            map: L.Map,
            imageUrl: string,
            timer: number,
            layerOpacity: number,
            overlayRef: React.RefObject<L.ImageOverlay | null>
    ) {
        if(!L) return;

    // Calculate the bounds that correspond to the image.
    // IMPORTANT: map.getBounds() THROWS (not returns NaN) when the map container
    // has zero pixel size (e.g. during the first render before invalidateSize runs).
    // The error propagates inside Leaflet's unproject → new LatLng(NaN,NaN) → throw.
    // A try-catch is the only reliable guard here.
    let bounds: L.LatLngBounds | null = null;
    try {
        bounds = map.getBounds();
    } catch {
        return; // map not yet properly sized — skip this render cycle
    }
    if (!bounds) return;

    if(overlayRef != null) {
        if (overlayRef.current ) {
            // Remove previous overlay smoothly
            const prevOverlay = overlayRef.current;
            const prevElement = prevOverlay.getElement();

            if (prevElement) {
                prevElement.style.transition = `opacity ${timer}ms ease-out`;
                prevElement.style.opacity = "0";
                //console.log("prevElement:", prevElement);
            }

            setTimeout(() => {
                if (map.hasLayer(prevOverlay)) {
                    map.removeLayer(prevOverlay);
                }
            }, timer);
        }

        // Create and store the new overlay with the calculated bounds
        const newOverlay = L.imageOverlay(imageUrl, bounds);
        overlayRef.current = newOverlay;
        newOverlay.addTo(map);

        // Fade-in effect
        const overlayElement = newOverlay.getElement();
        if (overlayElement) {
            overlayElement.style.opacity = "0"; // Initial opacity set to 0
            overlayElement.style.transition = `opacity ${timer}ms ease-in`;
            setTimeout(() => {
                overlayElement.style.opacity = layerOpacity.toString(); // Fade-in after 0ms
            }, timer);
        }
    }
}


// ─── Native L.GridLayer with equirectangular tile rendering ───────────────
// No debounce, no ImageOverlay recompilation – Leaflet handles zoom via CSS3.
/*useGridLayer({
    map,
    L,
    gridData,
    cellSize: gridcellSizeLatLng.current,
    colorMap,
    layerOpacity,
    isLoading: isLoading_MosquitoData,
    hasError: mosquitoData.error !== null,
    isTransitioningRef: gridLayerTransitionRef,
    isZoomingRef: isZoomingRef,
    redrawRef: gridLayerRedrawRef,
    isTransitioning: isTransitioning,
});*/

useCanvasGridLayer({




    map,
    L,
    isUpdate,
    isLoading: isLoading_MosquitoData,
    hasError: mosquitoData.error !== null,
    gridData,
    cellSize: parsedGridCellSize,
    dimensions,
    colorMap,
    layerOpacity,
    transitionDuration : 0,
    debug : false,



});

MapDrawLayer_MosquitoPresenceData(presenceDrawHash.current);
MapDrawLayer_CovidPresenceData(presenceDrawHash.current);

/**
 * Hook-function that renders mosquito presence / occurrence points as
 * a canvas-based `L.ImageOverlay` with a cross-fade transition.
 *
 * @remarks
 * Skipped entirely when `mapUIsettings.inCovidDataView` is `true`;
 * COVID presence data is rendered by `MapDrawLayer_CovidPresenceData`
 * instead. Each point is drawn as a filled circle whose radius scales
 * with the `screenDistanceOneKM` value to maintain consistent
 * geographic sizing across zoom levels.
 *
 * @param presenceDrawHash - Monotonically increasing counter used to
 *                           trigger re-renders after debounced map events.
 */
function MapDrawLayer_MosquitoPresenceData(presenceDrawHash: number) {
    const layerTansitionTime = 500;
    const canvasRef = useRef<HTMLCanvasElement | null>(null); // Reuse canvas instead of recreating
    const overlayRef = useRef<L.ImageOverlay | null>(null);

    // Clean up overlay when map instance changes or component unmounts
    useEffect(() => {
        return () => {
            if (map && overlayRef.current) {
                if (map.hasLayer(overlayRef.current)) {
                    map.removeLayer(overlayRef.current);
                }
                overlayRef.current = null;
            }
        };
    }, [map]);

    useEffect(() => {
        // Don't render if map is not initialized, we are in Covid view, or presence data is disabled in datasets
        if (!map || mapUIsettings.inCovidDataView || !props.mapDataSets.isPresenceData) {
            if (map && overlayRef.current) {
                if (map.hasLayer(overlayRef.current)) {
                    map.removeLayer(overlayRef.current);
                }
                overlayRef.current = null;
            }
            return;
        }

        // When presence data is toggled off, smoothly transition out the existing overlay
        if (!isPresData) {
            if (overlayRef.current) {
                const prevOverlay = overlayRef.current;
                overlayRef.current = null;
                const prevElement = prevOverlay.getElement();
                if (prevElement) {
                    prevElement.style.transition = `opacity ${layerTansitionTime}ms ease-out`;
                    prevElement.style.opacity = "0";
                }
                setTimeout(() => {
                    if (map && map.hasLayer(prevOverlay)) {
                        map.removeLayer(prevOverlay);
                    }
                }, layerTansitionTime);
            }
            L_presenceLayer.stop();
            prev_presenceDrawHash.current = presenceDrawHash;
            circlesSelectionRef.current = null;
            return;
        }

        function Render(){
            // Don't render if map is not initialized
            if (!map) return;

            // Reuse existing canvas if available
            let canvas = canvasRef.current;
            if (!canvas) {
                canvas = document.createElement("canvas");
                canvasRef.current = canvas;
                console.log("Creating new canvas for layer rendering");
            }

            const canvasSize = { width: dimensions.width , height: dimensions.height }; 
            canvas.width = canvasSize.width;
            canvas.height = canvasSize.height;
            canvas.style.width = `${canvasSize.width}px`;
            canvas.style.height = `${canvasSize.height}px`;

            const context = canvas.getContext("2d");
            if (!context) return;

            context.clearRect(0, 0, canvas.width, canvas.height);
            
            const dotSizeConstant = 4;

            if(isPresData) {
                if (!map) return;
                L_presenceLayer.start();

                const dotColor = getPresenceDataColor(curColorMapType, props.mapUIsettings.presenceDataColor);

                const sortedPresDataLocal = sortedPresDataMemo;
                for (const d of sortedPresDataLocal) {
                    if (!d.geometry) continue;
                    let coords;
                    if (L) {
                        coords = d.latLng
                            ? map.latLngToContainerPoint(L.latLng(d.latLng[0], d.latLng[1]))
                            : map.latLngToContainerPoint(L.latLng(d.geometry[0], d.geometry[1]));
                    } else {
                        return;
                    }
                    const x1 = coords.x;
                    const y1 = coords.y;
                    context.fillStyle = dotColor;
                    context.beginPath();
                    context.arc(x1, y1, screenDistanceOneKM.current + dotSizeConstant, 0, Math.PI * 2);
                    context.fill();
                    context.fillStyle = "black";
                    context.beginPath();
                    context.arc(x1, y1, (screenDistanceOneKM.current + dotSizeConstant) * 0.2, 0, Math.PI * 2);
                    context.fill();
                }
            }
            const imageUrl = canvas.toDataURL();

            LayerTransition(
                map,
                imageUrl,
                layerTansitionTime,
                0.9,
                overlayRef
            );
            setTimeout(() => { L_presenceLayer.stop(); }, layerTansitionTime*1.5);
             
            prev_presenceDrawHash.current = presenceDrawHash;
            overlayRef.current?.setZIndex(300);
            circlesSelectionRef.current = null;
        }

        Render();
    }, [presenceDrawHash, dimensions, presData, isPresData, curColorMapType, props.mapUIsettings.presenceDataColor]);

    return overlayRef.current;
}

/**
 * Hook-function that renders COVID-19 epidemiological data points as
 * interactive SVG circles in the Leaflet overlay pane.
 *
 * @remarks
 * Unlike `MapDrawLayer_MosquitoPresenceData` (canvas-based), this
 * function uses D3 data-joins (`enter`/`exit`/`merge`) to create
 * individual `<circle>` elements so that each point is clickable
 * and shows a detailed popup with localised country/sub-region names,
 * feature values, and date ranges.
 *
 * Circle radii are scaled via `radiusScale` (a `d3.scaleSqrt`
 * derived from `[minVal, maxVal]`) and coloured by the active
 * `colorMap`.
 *
 * @param presenceDrawHash - Monotonically increasing counter used to
 *                           trigger re-renders after debounced map events.
 */
function MapDrawLayer_CovidPresenceData(presenceDrawHash: number) {
    const layerTansitionTime = 500;

    useEffect(() => {
        // Don't render if map is not initialized or we are not in Covid view
        if (!map || !mapUIsettings.inCovidDataView) return;

        function Render(){
            if (!map) return;

            try {
              if(isPresData) {
                if (!map) return;
                L_presenceLayerCovid.start();

                let mapSize = map.getSize();

                const sortedPresDataLocal = sortedPresDataMemo;
                const max_feature_value_per_country = maxFeaturePerCountryMemo;
                const filtered = sortedPresDataLocal.filter(d => d.geometry && (zoom > zoomBreakpoint || (d.country_name && Number(d.feature) === max_feature_value_per_country[d.country_name])));
                
                const svgContainer = d3.select(map.getPanes().overlayPane);
                let svgUpdate = svgContainer.select<SVGSVGElement>('.svg-circles-container_' + props.chartName);
                if (svgUpdate.empty()) {
                    svgUpdate = svgContainer.append<SVGSVGElement>('svg')
                        .attr('class', 'svg-circles-container_' + props.chartName)
                        .style('position', 'absolute')
                        .style('top', 0)
                        .style('left', 0)
                        .style('z-index', '900')
                        .style('pointer-events', 'none')
                        .style('overflow', 'visible');
                }
                svgUpdate.attr('width', mapSize.x).attr('height', mapSize.y)
                    .style('width', `${mapSize.x}px`).style('height', `${mapSize.y}px`);

                const keyFn = (d: any) => `${d.geometry[0]}_${d.geometry[1]}_${d.feature}`;
                const groups = svgUpdate.selectAll('g.pres-point').data(filtered as any, keyFn);

                // exit
                groups.exit().remove();

                // enter
                const groupsEnter = groups.enter().append('g').attr('class', 'pres-point').style('pointer-events', 'visible');
                groupsEnter.append('circle').attr('class', 'outer');
                groupsEnter.append('circle').attr('class', 'inner');

                // update + enter
                const merged = groupsEnter.merge(groups as any);
                merged.each(function(d: any) {
                    const g = d3.select(this);
                    const lat = d.geometry[0];
                    const lng = d.geometry[1];
                    const coords = L ? map.latLngToLayerPoint(new L.LatLng(lat, lng)) : { x: 0, y: 0 };
                    const x1 = coords.x;
                    const y1 = coords.y;
                    const outerRadius = screenDistanceOneKM.current + 5;
                    const innerRadius = outerRadius * 0.2;

                    g.select('circle.outer')
                        .attr('cx', x1)
                        .attr('cy', y1)
                        .attr('r', radiusScale(Number(d.feature)) * outerRadius)
                        .attr('fill', d3.color(colorMap(Number(d.feature)))?.copy({ opacity: layerOpacity })?.toString() || 'rgba(0,0,0,0)')
                        .attr('stroke', '#D3D3D3')
                        .attr('data-lat', lat)
                        .attr('data-lng', lng)
                        .attr('feature-value', d.feature)
                        .style('cursor', 'pointer');

                    g.select('circle.inner')
                        .attr('cx', x1)
                        .attr('cy', y1)
                        .attr('r', innerRadius)
                        .attr('fill', 'black')
                        .attr('data-lat', lat)
                        .attr('data-lng', lng);
                });

                merged.select('circle.outer')
                    .on('mouseover', function() { (this as HTMLElement).style.cursor = 'pointer'; })
                    .on('mouseout', function() { (this as HTMLElement).style.cursor = 'default'; })
                    .on('click', function(event: any, d: any) {
                        if (props.mapInteractions.disableClick) return;
                        event.stopPropagation();
                        const latlng = L ? L.latLng(+d.geometry[0], +d.geometry[1]) : { lat: 0, lng: 0 };
                        const curFeatKey = selectedFeature || contextT.curFeature || props.mapUIsettings.defaultFeatureName;
                        const featMeta = metaData && curFeatKey ? metaData[curFeatKey as keyof typeof metaData] : undefined;
                        const featLabel = featMeta?.description ? featMeta.description : curFeatKey;
                        const featDimension = featMeta?.dimension ? ` [${featMeta.dimension}]` : '';

                        const rawCountry = d.country_name != null ? d.country_name : contextT.mouseEvent.current.country;
                        const localizedCountry = getLocalizedCountryName(rawCountry, locale);

                        const rawSubregion = d.subregion_name;
                        const hasSubregion = rawSubregion && rawSubregion !== 'NULL' && rawSubregion !== '';
                        const localizedSubregion = hasSubregion ? getLocalizedSubregionName(rawSubregion, locale) : '';

                        const numFormatted = new Intl.NumberFormat(locale === 'de' ? 'de-DE' : 'en-US').format(Number(d.feature));
                        const dateFormatStr = locale === 'de' ? 'dd.MM.yyyy' : 'MM/dd/yyyy';
                        const dateFromStr = dateRange?.from ? format(dateRange.from, dateFormatStr) : undefined;
                        const dateToStr = dateRange?.to ? format(dateRange.to, dateFormatStr) : undefined;
                        const toWord = locale === 'de' ? 'bis' : 'to';

                        const formattedDateRange = dateFromStr
                            ? (dateToStr
                                ? `<div class="inline-block text-right font-medium leading-tight"><span>${dateFromStr}</span><div class="text-[10px] text-indigo-300 font-normal italic my-0.5 text-center">${toWord}</div><span>${dateToStr}</span></div>`
                                : dateFromStr)
                            : 'N/A';

                        const content = renderStandardTooltipHTML({
                            value: numFormatted,
                            unit: featDimension,
                            description: featLabel,
                            rows: [
                                { label: String(t.rich('covid19_world_data.country', {...t_richConfig})), value: localizedCountry },
                                ...(hasSubregion ? [{ label: String(t.rich('covid19_world_data.subregion', {...t_richConfig})), value: localizedSubregion }] : []),
                                { label: String(t.rich('covid19_world_data.time_range', {...t_richConfig})), value: formattedDateRange },
                            ],
                            chartId: "toolTipPresence_" + props.chartName,
                        });
                        setTimeout(() => {
                            const tooltip = L ? L.popup({ className: 'custom-popup' }) : null;
                            if (!tooltip) return;
                            tooltip
                                .setLatLng(latlng)
                                .setContent(content)
                                .openOn(map)
                                .addTo(map);
                            setTimeout(() => { map.removeLayer(tooltip); }, 10000);
                        }, 0);
                    });
            } else {
                if (map) {
                    d3.select(map.getPanes().overlayPane)
                        .selectAll('.svg-circles-container_' + props.chartName)
                        .selectAll('g.pres-point')
                        .remove();
                }
            }

              prev_presenceDrawHash.current = presenceDrawHash;
              circlesSelectionRef.current = null;
            } finally {
              L_presenceLayerCovid.stop();
            }
        }

        Render();

        return () => {
            L_presenceLayerCovid.stop();
            if (map) {
                d3.select(map.getPanes().overlayPane)
                    .selectAll('.svg-circles-container_' + props.chartName)
                    .remove();
            }
        };
    }, [presenceDrawHash, dimensions, presData, isPresData]);
}


/**
 * Hook-function that renders per-country D3 donut / pie charts for
 * sequence-metadata distributions (e.g. Dengue serotype DENV-1–4).
 *
 * @remarks
 * Creates a dedicated Leaflet SVG renderer (`piesPane`) at z-index 650
 * and positions each donut at the computed country centroid. Donut size
 * is driven by a `d3.scaleSqrt` based on sample counts; slice colours
 * are drawn from the `DonutColors` palette.
 *
 * On hover, individual slices enlarge with a D3 tween animation and a
 * React-rendered `<DonutTooltip>` is mounted into `SVG_tooltip_ref`.
 *
 * @param countryCounts - Object keyed by country name, each value
 *                        containing `count`, `center`, `counts[]`, and `labels[]`.
 */
function MapDrawLayer_SequenceMetadata(countryCounts: { [key: string]: any }) {

    useEffect(() => {
        if (!L || !map) return;
        // Don't render if data is loading or rendering is disabled or countryCounts is empty
        if (
            isLoading_sequenceMetadata ||
            isLoadingSequenceBreakdown ||
            !isSequenceMetaData ||
            !countryCounts ||
            Object.keys(countryCounts).length === 0
        ) {
            if (map && SVGLayer_ref.current) {
                if (map.hasLayer(SVGLayer_ref.current)) {
                    map.removeLayer(SVGLayer_ref.current);
                }
                SVGLayer_ref.current = null;
                SVG_ref.current = undefined;
                piesMerged.current = undefined;
            }
            return;
        }

        createPieCharts(countryCounts, pieSize);
        updatePieCharts();

        // cleanup function to remove the SVG layer when component unmounts or dependencies change
        return () => {
            if (map) {
                map.off("zoom move viewreset", updatePieCharts);
                if (SVGLayer_ref.current && map.hasLayer(SVGLayer_ref.current)) {
                    map.removeLayer(SVGLayer_ref.current);
                }
            }
            SVGLayer_ref.current = null;
            SVG_ref.current = undefined;
            piesMerged.current = undefined;
        };

    }, [countryCounts, isSequenceMetaData, pieSize, isLoading_sequenceMetadata, isLoadingSequenceBreakdown, map, L]);

    /**
     * Re-projects and re-scales all existing donut-chart `<g>` groups
     * after a zoom or pan event, keeping them anchored to their country
     * centroids.
     *
     * @remarks
     * The base zoom level for scale calculation is `3.0`. Each donut's
     * outer `<g>` is translated to `latLngToLayerPoint` and the inner
     * `<g.pie-scale>` is uniformly scaled by `getZoomScale(zoom, 3.0)`.
     */
    function updatePieCharts() {
        if (!L || !map || isLoading_sequenceMetadata || !isSequenceMetaData) return;
        const z = 3.0;
        const s = map.getZoomScale( map.getZoom(), z); // scale factor relative to base zoom

        // position each pie and scale its inner group
        if (piesMerged.current) {
            piesMerged.current.each(function(d: any) {
                const p = map.latLngToLayerPoint([d.lat, d.lng]);
                const outer = d3.select(this);    // g.pie (translation)
                const inner = outer.select<SVGGElement>("g.pie-scale"); // g.pie-scale (scale)
                outer.attr("transform", `translate(${p.x},${p.y})`);
                inner.attr("transform", `scale(${s})`);
            });
        }
    }


    /**
     * Creates the D3 donut / pie charts from scratch inside a dedicated
     * Leaflet SVG pane (`piesPane`, z-index 650).
     *
     * Each country entry in `countryCounts` produces one `<g.pie>` group
     * positioned at the country centroid. Slice arcs are coloured from
     * the `DonutColors` palette. Hover interactions trigger a D3 arc-
     * tween enlargement and mount a `<DonutTooltip>` into `SVG_tooltip_ref`.
     *
     * @param countryCounts - Object keyed by country name, each value
     *                        containing `count`, `center`, `counts[]`,
     *                        and `labels[]`.
     * @param pieSize       - Base diameter (px) before zoom-dependent scaling.
     */
    function createPieCharts(countryCounts: { [key: string]: any }, pieSize: number) {
            if (!L || !map) return;
            if (!countryCounts || Object.keys(countryCounts).length === 0) return;

            // Remove existing SVG layer if present to avoid duplicate layers
            if (SVGLayer_ref.current && map.hasLayer(SVGLayer_ref.current)) {
                map.removeLayer(SVGLayer_ref.current);
            }
            SVGLayer_ref.current = null;
            SVG_ref.current = undefined;
            piesMerged.current = undefined;

            // 1) Ensure the Leaflet pane exists
            if (!map.getPane("piesPane")) {
                map.createPane("piesPane");
            }
            const piesPane = map.getPane("piesPane");
            if (piesPane) {
                piesPane.style.zIndex = "650"; // Ensure it is above the base pane
            }

            // 2) Create Leaflet SVG layer
            SVGLayer_ref.current = L.svg({ pane: 'piesPane' });
            SVGLayer_ref.current.addTo(map);
            SVG_ref.current = {
                renderer: SVGLayer_ref.current,
                baseZoom: map.getZoom(),
                handlersAttached: true,
            } as any;

            if (!piesPane) return;
            const rootSvg = d3.select(piesPane).select("svg");
            rootSvg.selectAll(`.pies-${props.chartName}`).remove();
            const piesG = rootSvg.append("g")
                .attr("class", `pies-${props.chartName}`)
                .style("pointer-events", "all")
                .style("overflow", "visible");

            // 3) Define sizeScale based on countryCounts
            const counts = Object.values(countryCounts).map((c: any) => c.count || 0);
            const maxCount = d3.max(counts) || 1;
            const sizeScale = d3.scaleSqrt()
                .domain([1, maxCount])
                .range([pieSize * 0.5, pieSize * 1.5]);

            const pieGen      = d3.pie<number>();

            // prepare data
            let isInvalid = false;
            const dataArr = Object.entries(countryCounts)
                .map(([id, c]: [string, any]) => {
                    // Ensure c.center exists and has lat/lng, and counts is always an array
                    const lat = c.center?.lat ?? 0;
                    const lng = c.center?.lng ?? 0;
                    // If counts is not an array, wrap count in an array
                    const values = Array.isArray(c.counts) ? c.counts : [c.count ?? null];
                    const labels = Array.isArray(c.labels) ? c.labels : [c.label ?? ""];
                    if(values == null || labels == "") {
                        isInvalid = true;
                    }
                    if (c.count > 0) {
                        return {
                            id,
                            lat,
                            lng,
                            values,
                            labels,
                        };
                    }
                    return undefined;
                })
                .filter((d) => d !== undefined);
            if(isInvalid) {
                // Handle invalid data case
                console.error("Invalid data found");
                return;
            }

            // 4) JOIN (bind data)
            const pies = piesG.selectAll<SVGGElement, any>("g.pie")
                .data(dataArr, d => d.id);

            const piesEnter = pies.enter()
                .append("g")
                .attr("class", "pie"); // parent group for translation only

            // inner group for scale so translation isn't scaled
            const piesInner = piesEnter.append("g").attr("class", "pie-scale");
            const enlargeBy = 4; // pixels to grow outward

            // draw slices once at base size
            piesInner.each(function(d) {
                const g = d3.select(this);
                const pieData = pieGen(d.values); // pie data for this country

                const countryCount = countryCounts[d.id]?.count || 1;
                const basePieSize = sizeScale(countryCount);
                const thickness = Math.ceil(basePieSize / 3.333);

                const arcGen = d3.arc<d3.PieArcDatum<number>>()
                    .innerRadius(basePieSize / 2 - thickness)
                    .outerRadius(basePieSize / 2);

                // Initial arc generator with zero angle (for animation start)
                const arcGenZero = d3.arc<d3.PieArcDatum<number>>()
                    .innerRadius(basePieSize / 2 - thickness)
                    .outerRadius(basePieSize / 2)
                    .startAngle((a: any) => a.startAngle)
                    .endAngle((a: any) => a.startAngle)

                // Create background circle under the donut chart
                g.append("circle")
                    .attr("cx", 0)
                    .attr("cy", 0)
                    .attr("r", basePieSize / 2 )
                    .attr("fill", "none")
                    .attr("stroke", "white")
                    .attr("stroke-width", thickness/2 + 0.5)
                    .style("pointer-events", "none");
                 g.append("circle")
                    .attr("cx", 0)
                    .attr("cy", 0)
                    .attr("r", basePieSize / 2 - thickness)
                    .attr("fill", "none")
                    .attr("stroke", "white")
                    .attr("stroke-width", thickness/2 )
                    .style("pointer-events", "none");

                // Create paths with initial collapsed state
                const paths = g.selectAll("path")
                    .data(pieData)
                    .enter()
                    .append("path")
                    .attr("d", arcGenZero as any)
                    .attr("labelID", (_: d3.PieArcDatum<number>, i) => i.toString())
                    .attr("fill", (_: d3.PieArcDatum<number>, i) =>
                        DonutColors[d.labels[i]] || categoricalColors[i % categoricalColors.length] || "#808080"
                    )
                    .attr("label", (_: d3.PieArcDatum<number>,i) => d.labels[i])
                    .attr("stroke-opacity", 0.0)
                    .attr("stroke", "black")
                    .attr("stroke-width", 0.5)
                    .style("pointer-events", "all")
                    .style("cursor", "pointer")
                    .on("click", function(event, arcData) {
                        event.stopPropagation();
                    })
                    .on("mousemove", function(event, arcData) {
                        event.stopPropagation();
                    })
                    .on("mouseover", function(event, arcData) {
                       event.stopPropagation();
                        // move grid-data-tooltip out of sight
                        if (contextT.mouseEvent.current.event) {
                            if (L) {
                                contextT.mouseEvent.current.event.latlng = L.latLng(-90, -180);
                            }
                        }
                        // Show tooltip on pie slice click
                        const HexHighlightCol = "#a6abafe4";
                        const renderLabel = d3.select(this).attr("label");
                        const renderColor = d3.select(this).attr("fill");
                          

                        if (root.current && map) {
                            root.current.render(
                                <DonutTooltip
                                    map={map}
                                    mapData={mapData}
                                    arcData={arcData}
                                    d={d}
                                    renderColor={renderColor}
                                    countryCounts={countryCounts}
                                    locale={locale}
                                    basePieSize={basePieSize}
                                    thickness={thickness}
                                    HexHighlightCol={"#ffffff"}
                                    label={renderLabel}
                                    t={t}
                                    selection={cur_Sorgansim}
                                    isVisible={true}
                                    />
                            );
                        }
                        const select = d3.select(this);
                        

                        // Elongate: transition outerRadius from normal to enlarged
                        select.transition()
                            .duration(200)
                            .attrTween("d", function() {
                                const outerInterp = d3.interpolate(basePieSize / 2, basePieSize / 2 + enlargeBy);
                                return function(t) {
                                    const expandedArc = d3.arc<d3.PieArcDatum<number>>()
                                        .innerRadius(basePieSize / 2 - thickness)
                                        .outerRadius(outerInterp(t));
                                    return expandedArc(arcData as any) || "";
                                };
                            })
                          .attr("stroke", "black")
                    .attr("stroke-width", 0.5)
                            .attr("stroke-opacity", 1.0);
                        select.raise(); // bring to front
                    })
                    .on("mouseout", function(event, arcData) {
                        // Remove any previous tooltip
                        if(root.current && map){
                            root.current.render(
                                <DonutTooltip arcData={0} d={0} countryCounts={{}} locale={""} HexHighlightCol={""} basePieSize={0} thickness={0} isVisible={false} />
                            );
                        }
                        const select = d3.select(this);
                        // Shrink back: transition outerRadius from enlarged to normal
                        select.transition()
                            .duration(300)
                            .attrTween("d", function() {
                                const outerInterp = d3.interpolate(basePieSize / 2 + enlargeBy, basePieSize / 2);
                                return function(t) {
                                    const shrinkArc = d3.arc<d3.PieArcDatum<number>>()
                                        .innerRadius(basePieSize / 2 - thickness)
                                        .outerRadius(outerInterp(t));
                                    return shrinkArc(arcData as any) || "";
                                };
                            })
                            .attr("stroke", "black")
                            .attr("stroke-width", 0.5)
                            .attr("stroke-opacity", 1.0);
                    });

                    let bgColor = d3.color(sequenceMedatdata_colorMap ? sequenceMedatdata_colorMap(countryCounts[d.id]?.count) : "#0d3eec");
                    let textColor = getContrastTextColorForBgColor(bgColor);
                    // add colored background for text
                    const textSize = thickness
                    g.append("text")
                        .attr("x", 0)
                        .attr("y", -((basePieSize/2)+textSize))
                        .attr("opacity", 0.0)
                        .attr("text-anchor", "middle")
                        .attr("dominant-baseline", "middle")
                        .attr("font-size", textSize+"px")
                        .attr("fill",  bgColor ? bgColor.toString() : "white")
                        .text("■■■")
                        .attr("paint-order", "stroke") // Ensures stroke is painted below fill
                        .attr("stroke", bgColor ? bgColor.toString() : "white")
                        .attr("stroke-width", textSize-2)
                         .transition()
                            .duration(2000)
                            .attr("opacity", 1.0)
                            .attr("font-size", textSize+"px")
                    // add the text (counts)
                    g.append("text")
                        .attr("x", 0)
                        .attr("y", -((basePieSize/2)+textSize-1))
                        .attr("opacity", 0.0)
                        .attr("text-anchor", "middle")
                        .attr("dominant-baseline", "middle")
                        .attr("font-size", "0px")
                        .attr("fill",textColor.rgb().toString())
                        .text(countryCounts[d.id]?.count || "0")
                        .transition()
                            .duration(2000)
                            .attr("opacity", 1.0)
                            .attr("font-size", textSize+"px")

                    const labelGroup = g.append("g").attr("class", "pie-labels");

                    /**
                     * Renders permanent polyline + text labels for each donut
                     * slice, positioned outside the arc via `getLabelPolyline`.
                     */
                    function renderStaticLabels(){
                        // Add a label for each slice with a polyline
                        pieData.forEach((arcData, i) => {
                            // Compute centroid for label position
                            const [posA, posB, posC] = getLabelPolyline(arcData, basePieSize, thickness);

                            // Polyline from arc edge to label
                            labelGroup.append("polyline")
                                .attr("points", `${posA[0]},${posA[1]} ${posB[0]},${posB[1]} ${posC[0]},${posC[1]}`)
                                .attr("stroke", "#444")
                                .attr("stroke-width", 0.5)
                                .attr("fill", "none")
                                .raise();

                            // Label text
                            labelGroup.append("text")
                            .attr("transform", `translate(0,3)`)
                                .attr("x", posC[0])
                                .attr("y", posC[1])
                                .attr("text-anchor", posC[0] > 0 ? "start" : "end")
                                    .attr("alignment-baseline", "middle")
                                    .attr("font-size", (textSize-2)+"px")
                                .attr("fill", "#222")
                                .text(`${arcData.value}`);
                        });
                    }
                    //renderStaticLabels();

                // Animate to full arc (spinner effect)
                // Animate each arc so that the startAngle and endAngle grows from curStartAngle to the curCumulative endAngle,
                setTimeout(() => {
                    paths.transition()
                        .duration(1500)
                        .delay((_, i) => i * 80)
                        .ease(d3.easeCubicOut)
                        .attr("stroke-opacity", 1.0)
                        .attrTween("d", function(a) {
                            // Animate both startAngle and endAngle from collapsed to full arc
                            const startInterpolator = d3.interpolate(a.startAngle, a.startAngle);
                            const endInterpolator = d3.interpolate(a.startAngle, a.endAngle);
                            return function(t) {
                                const currentArc = { ...a, startAngle: startInterpolator(t-0.0001), endAngle: endInterpolator(t-0.0001) };
                                return arcGen(currentArc as any) || "";
                            };
                        });
                }, 0);
            });

            piesMerged.current = piesEnter.merge(pies as any);

            // 5) Attach handlers (recalculate on zoom/pan)
            map.off("zoom move viewreset", updatePieCharts);
            map.on("zoom move viewreset", updatePieCharts);
        }

    return null;
}



/* eslint-disable react-hooks/set-state-in-effect -- Loaded dataset metadata initializes the controlled feature selection. */
useEffect(() => {
    // Initialize the selected feature when column names are available.
    if (mosquitoData !== undefined && !isLoading_MosquitoData && mosquitoData.error == null && mosquitoData.header && mosquitoData.header.length > 0 && selectedFeature === "") {
        let index = Math.ceil(mosquitoData.header.length / 2)-1;
        const compactFeatureName = !Array.isArray(mosquitoData.response) &&
            mosquitoData.response?.format === "map-grid-v1"
            ? mosquitoData.response.featureName
            : undefined;
        const tempSelectedFeature = props.mapUIsettings.defaultFeatureName || compactFeatureName || mosquitoData.header[index];
        contextT.setCurFeature(tempSelectedFeature);
        setSelectedFeature(tempSelectedFeature);
        const curMonthNumber = tempSelectedFeature.split("_").length > 1 && !tempSelectedFeature.includes("prob") ? parseInt(tempSelectedFeature.split("_")[1]) : -1;
        if( curMonthNumber !== -1){contextT.setCurMonth(curMonthNumber);}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mosquitoData])
/* eslint-enable react-hooks/set-state-in-effect */

    const roundTo = 1;
    const  rounder = Math.pow(10, roundTo);

    // Tiny overlay in top-left corner to show render count
    // (You can style/position as needed)
    const renderCountOverlay = (
        <div
            style={{
                position: "absolute",
                top: 4,
                left: 4,
                background: "rgba(0,0,0,0.5)",
                color: "white",
                fontSize: "10px",
                padding: "2px 6px",
                borderRadius: "6px",
                zIndex: 1000,
                pointerEvents: "none"
            }}
        >
            Render: {renderCount.current}
        </div>
    );

    


    const colWidth = 285; // Set the desired column width here in pixels

    /**
     * Returns a combined `{ className, style }` object used to style
     * individual settings-panel grid cells with consistent padding,
     * border-radius, and column-span behaviour.
     *
     * @param colSpan - Number of CSS Grid columns the element should
     *                  span. @default 1
     * @returns Props object spreadable onto a JSX element.
     */
    function UI_elementStyler(colSpan: number = 1){
        return { className: `text-sm p-2 border row-span-2 bg-white/75 z-10 rounded-lg shadow-md pointer-events-auto`, style: { gridColumn: `span ${colSpan} / span ${colSpan}` } };
    }


  
// Cleanup only when component is unmounted
// useEffect(() => {
//     return () => {
//         setGridData(new Map());
//         setPresData([]);
//         setCountryCounts({});
//         if (mapRef.current) {
//             const map = mapRef.current;
//             map.off();
//             map.eachLayer(layer => {
//                 if(!L) return;
//                 if (layer instanceof L.GeoJSON || layer instanceof L.ImageOverlay || layer instanceof L.Tooltip) {
//                     map.removeLayer(layer);
//                 }
//             });
//             const container = map.getContainer();
//             container.removeEventListener("wheel", () => {});
//         }
//         if (layerUpdateHandlerTime.current) {
//             clearTimeout(layerUpdateHandlerTime.current);
//         }
//         d3.select("#" + id_scaleBar).remove();
//         d3.select("#" + id_colorMap).remove();
//          if (layerUpdateHandlerTime.current) clearTimeout(layerUpdateHandlerTime.current);
//         if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
//         if (frameRef.current) cancelAnimationFrame(frameRef.current);
        
//     };
//     // Only run on unmount
//     // eslint-disable-next-line react-hooks/exhaustive-deps
// }, []);


   // the page
    return (
        <>
  
       
<div ref={settingsContainerRef} className="@container relative size-full" >
    <div className="absolute right-14 z-600" style={{ top: `${settingsButtonTop}px` }}>
        <button
            onClick={() =>{
                 setIsSettingsOpen(true);
                 setIsSettingsOpenFixed(!isSettingsOpenFixed);
            }}
            className="p-1  rounded-full shadow-md hover:bg-gray-600 bg-black "
        >
            <Settings className="text-white " />
        </button>
    </div>
    <PrintDataLoadingErrors listOfErrors={collectDataLoadingErrors.current}/>
    <SizeHook element={element} sizeRef={sizeRef} setSize={setSizes}/>

      <div
        className={`absolute w-full mt-1 ml-1 pr-2 grid gap-2 z-30 max-w-full pointer-events-none   ${
            props.mapUIsettings.isSettingsBlendAnimation
                ? (isSettingsOpen
                    ? "transition-all delay-1000 duration-1000 opacity-100 scale-100 z-30"
                    : "transition-all duration-500 opacity-0 scale-100")
                : ""
        }`}
        style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${colWidth}px), ${colWidth}px))`,
        }}
    >
    {(props.mapUIsettings.isSettingsBlendAnimation ? (isSettingsOpen && isSettingsOpenFixed) : isSettingsOpenFixed) && (
        
        <>
            {/* Reset UI position counter */}
            {mapUIsettings.isLatitudeSlider && (<div {...UI_elementStyler()}>
                {t.rich('latitude', {...t_richConfig})}: {Math.round(latitude*rounder)/rounder}
                    <input
                        type="range"
                    value={latitude}
                    onChange={handleInputChange2}
                    min={-RANGE_LAT}
                    max={RANGE_LAT}
                    className="w-full"
                   
                />
            </div>
        )}
        {mapUIsettings.isLongitudeSlider && (
            <div  {...UI_elementStyler()}>
            {t.rich('longitude', {...t_richConfig})}: { Math.round(longitude*rounder)/rounder}
                <input
                    type="range"
                    value={longitude}
                    onChange={handleInputChange1}
                    min={-RANGE_LONG}
                    max={RANGE_LONG}
                    className="w-full"
                />
            </div>
        )}
        {mapUIsettings.isZoomSlider && (
                <div {...UI_elementStyler()}>
                Zoom: {Math.round(zoom*rounder)/rounder}
                <input
                    type="range"
                    value={zoom}
                    onChange={handleInputChangeZoom}
                    step={ZOOM_STEP}
                    min={MIN_ZOOM}
                    max={MAX_ZOOM}
                    className="w-full"
                />
            </div>
        )}
        {mapUIsettings.isDatasetSelectionDropdown && (
            <div {...UI_elementStyler()}>
                <span className="mb-1 flex items-center justify-between">
                {t.rich('data_set', {...t_richConfig})}:
                <span className="ml-2"><HoverCardTooltip MDXContent={MDX.DataSet} /></span>
            </span>
            {listOfDataSets && 
            <Select value={selectedDatasetKey} onValueChange={(value) => { 
                const dataset = listOfDataSets[value];
                curDatasetname.current = dataset;
                setSelectedDatasetKey(value);
                let url = buildMapDatasetURL({
                    relationName: dataset,
                    feature: mapUIsettings.defaultFeatureName,
                    filterBy: mapUIsettings.inCovidDataView && selectedCountry ? COVID_COUNTRY_FILTER_COLUMN : undefined,
                    filterValue: mapUIsettings.inCovidDataView && selectedCountry ? selectedCountry : undefined,
                    aggregation_level: mapUIsettings.inCovidDataView ? (isCountryLevelData ? 0 : isSubregionLevelData ? 1 : undefined) : undefined,
                    startDate: mapUIsettings.inCovidDataView && (dateRange && dateRange.from && dateRange.to) ? format(dateRange.from, "yyyy-MM-dd") : undefined,
                    endDate: mapUIsettings.inCovidDataView && (dateRange && dateRange.from && dateRange.to) ? format(dateRange.to, "yyyy-MM-dd") : undefined,
                }, useCompactGridResponse);


                setSelectedDataset(url);
                contextT.setCurDatasetURL(url);

                contextT.setCurFeature("");
                setSelectedFeature("");

                // Extract month from monthly-split table names (e.g. t_2024_monthly_mean_7_...)
                const monthlyMatch = dataset.match(/^t_\d+_monthly_mean_(\d+)_/);
                if (monthlyMatch) {
                    contextT.setCurMonth(parseInt(monthlyMatch[1]));
                }

                if (mapUIsettings.inCovidDataView){
                    contextT.setCurPresenceDatasetURL(url);
                    contextT.setIsPresenceData(true);
                    setIsPresData(true);
                    setPresenceDataURL(url);
                }

                //isLoadingSpinner.current = false;
                //if(isLoadingSpinnerDEBUG) console.log("off Spinner: SelectDataset onValueChange");
                }
                            } >
                <SelectTrigger className="w-full">
                <SelectValue placeholder={ curDatasetname.current} />
                </SelectTrigger>
                <SelectContent>
                <SelectGroup>
                    <SelectLabel></SelectLabel>
                        {Object.keys(listOfDataSets).map((key: string, index: number) => {
                            if (isDatasetIncluded(key, props.mapUIsettings.filterStringForAvailableDatasetInclude, props.mapUIsettings.filterStringForAvailableDatasetExclude)) {
                                return (
                                    <SelectItem key={index} value={key}>
                                        {key}
                                    </SelectItem>
                                );
                            }
                            return null;
                        })}
                    </SelectGroup>
        </SelectContent>
        </Select>
        }
        </div>)}
        {mapUIsettings.isFeatureSelectionDropdown && (
            <div {...UI_elementStyler()}>
            <span className="mb-1 flex items-center justify-between">
                 {t.rich('feature', {...t_richConfig})}:
                <span className="ml-2"><HoverCardTooltip MDXContent={MDX.DataFeature} /></span>
            </span>
            {colNames && metaData && (
        <Select value={selectedFeature} onValueChange={(value) => { 
                contextT.setCurFeature(value);
                let url = buildMapDatasetURL({
                    relationName: curDatasetname.current,
                    feature: value,
                    filterBy: mapUIsettings.inCovidDataView && selectedCountry ? COVID_COUNTRY_FILTER_COLUMN : undefined,
                    filterValue: mapUIsettings.inCovidDataView && selectedCountry ? selectedCountry : undefined,
                    startDate: mapUIsettings.inCovidDataView && (dateRange && dateRange.from && dateRange.to) ? format(dateRange.from, "yyyy-MM-dd") : undefined,
                    endDate: mapUIsettings.inCovidDataView && (dateRange && dateRange.from && dateRange.to) ? format(dateRange.to, "yyyy-MM-dd") : undefined,
                    aggregation_level: mapUIsettings.inCovidDataView ? (isCountryLevelData ? 0 : isSubregionLevelData ? 1 : undefined) : undefined,
                }, useCompactGridResponse);

                // get month from selection when feature includes a number after an underscore
                const curMonthNumber = value.split("_").length > 1 && !value.includes("prob") ? parseInt(value.split("_")[1]) : -1;
                if (curMonthNumber !== -1) {
                    contextT.setCurMonth(curMonthNumber);
                }
                    
                setSelectedDataset(url);
                contextT.setCurDatasetURL(url);

                setSelectedFeature(value);
                contextT.setCurFeature(value);
                
                if (mapUIsettings.inCovidDataView){
                    contextT.setCurPresenceDatasetURL(url);
                    contextT.setIsPresenceData(true);
                    setIsPresData(true);
                    setPresenceDataURL(url);
                }
                
                }
                } >
                {(() => {
                    const selectedMetadata = metaData?.[selectedFeature as keyof typeof metaData];
                    const selectedDimension = selectedMetadata?.dimension && selectedMetadata.dimension !== "NA"
                        ? ` [${selectedMetadata.dimension}]`
                        : "";
                    const selectedDescription = selectedMetadata?.description && selectedMetadata.description !== "NA"
                        ? selectedMetadata.description
                        : "";

                    return (
                        <SelectTrigger className="w-full text-left text-[15px]">
                            {selectedFeature ? (
                                <span className="truncate flex-1 text-left min-w-0 block">
                                    <span className="text-[15px] font-medium">{selectedFeature + selectedDimension}</span>
                                    {selectedDescription && (
                                        <span className="ml-2 text-xs italic text-slate-500 dark:text-slate-400">{selectedDescription}</span>
                                    )}
                                </span>
                            ) : (
                                <span className="text-slate-500 text-sm">loading...</span>
                            )}
                        </SelectTrigger>
                    );
                })()}
                <SelectContent>
                <SelectGroup>
                    <SelectLabel></SelectLabel>
                        {colNames.map((name) => {
                            const columnMetadata = metaData[name as keyof typeof metaData];
                            const isAvailable = (columnMetadata?.availability === "1" ||
                                columnMetadata?.availability === undefined) && name !== "id";
                            const passesFilter = passesStringFilters(
                                name,
                                props.mapUIsettings.filterStringForAvailableFeature
                            );
                            const dimension = columnMetadata?.dimension && columnMetadata.dimension !== "NA"
                                ? ` [${columnMetadata.dimension}]`
                                : "";
                            const description = columnMetadata?.description;

                            if (isAvailable && passesFilter) {
                                return (
                                    <SelectItem key={name} value={name} className="py-2 text-left">
                                        <div className="flex max-w-[28rem] flex-col text-left">
                                            <span className="text-[15px] font-medium">{name + dimension}</span>
                                            {description && description !== "NA" && (
                                                <span className="text-xs italic text-slate-500">{description}</span>
                                            )}
                                        </div>
                                    </SelectItem>
                                );
                            }
                            return null;
                        })}
                    </SelectGroup>
        </SelectContent>
        </Select>
        )}
        </div>)}

        {mapUIsettings.isColorMapSelectionDropdown && ischanged && (
            <div {...UI_elementStyler()}>
                <span className="mb-1 flex items-center justify-between">
                    {t.rich('color_map', {...t_richConfig})}:
                    <span className="ml-2"><HoverCardTooltip MDXContent={MDX.ColorMap} /></span>
                </span>
                <div className="grid grid-cols-7 gap-2">
                    <div className='col-span-5'>
                        <Select onValueChange={(value) => {
                            setColorMapType(value);
                            contextT.setCurColorMap(value);
                            //isLoadingSpinner.current = true;
                        }} defaultValue={curColorMapType}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel></SelectLabel>
                                    {Object.keys(availableColorMaps).map((key: string, index: number) => (
                                        <SelectItem key={index} value={key}>
                                            <div style={{ display: "flex", alignItems: "center" }}>
                                                <span ><div className='w-12'>{key.split("interpolate")[1]}</div></span>
                                                <svg width="100" height="10" style={{ marginLeft: "10px" }}>
                                                    <defs>
                                                        <linearGradient id={`gradient-${key}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                                            {d3.range(0, 1.0, 0.1).map((t) => (
                                                                <stop
                                                                    key={t}
                                                                    offset={`${t * 100}%`}
                                                                    stopColor={d3.scaleSequential(availableColorMaps[key as keyof typeof availableColorMaps]).domain([0, 1])(t)}
                                                                />
                                                            ))}
                                                        </linearGradient>
                                                    </defs>
                                                    <rect width="100" height="10" fill={`url(#gradient-${key})`} />
                                                </svg>
                                            </div>
                                        </SelectItem>
                                    ))}
                            </SelectGroup>
                </SelectContent>
                </Select>
            </div>
            <div className='col-span-2 '>
                 <span className="text-xs">
                {t.rich("opacity", { ...t_richConfig })}:
            </span>
                <input
                    type="range"
                    value={layerOpacity}
                    onChange={handleLayerOpacityChange}
                    step={0.01}
                    min={0.0}
                    max={1.0}
                    className="w-full"
                />
            </div>
            </div>
        </div>)}

    {mapUIsettings.isPresenceData && (
        <div {...UI_elementStyler()}>
            <span className="mb-1 flex items-center justify-between">
                    {t.rich('presence_data.description', { ...t_richConfig })}
                    <span className="ml-2"><HoverCardTooltip MDXContent={MDX.MosquitoPresenceData} /></span>
                </span>
            <div className="grid grid-cols-7 gap-2">
            <div>
        <div className="flex flex-col items-center justify-center">
            <div className='mb-1 flex items-center justify-center relative'>
                <MosquitoIcon size={20} />
                <span
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-black/40 shadow-xs"
                    style={{ backgroundColor: getPresenceDataColor(curColorMapType, props.mapUIsettings.presenceDataColor) }}
                    title={curColorMapType}
                />
            </div>
            <Checkbox
                className="scale-140 m-1 mt-1.5"
                id="isPresData-checkbox"
                checked={isPresData}
                onCheckedChange={(checked: boolean) => {
                    contextT.setIsPresenceData(checked);
                    setIsPresData(checked)
                }}
            />
        </div>
            </div>

                <div className='col-span-3'>
                    <label htmlFor="species-select">
                        {t.rich('presence_data.dropdownSpecies', {...t_richConfig})}:
                    </label>
                    <Select value={curSpecies} onValueChange={(value) => {
                        let url = apiRoutes.fetchDbData({ relationName: contextT.curPresenceDatasetName, feature: "pointtype", filterBy: "'pointtype','species','year'", filterValue: "'point, exact location','" + value + "','" + curYear + "'" });
                      //  isLoadingSpinner.current = true;
                        setCurSpecies(value);
                        setTimeout(() => {
                            contextT.setCurPresenceDatasetURL(url);
                            setPresenceDataURL(url);
                        }, 200);
                    }}>
                        <SelectTrigger className="w-full" id="species-select">
                            <SelectValue placeholder={"loading..."} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectLabel></SelectLabel>
                                <SelectItem key="ALL" value="ALL">
                                    <b>all</b>
                                </SelectItem>
                                {Array.isArray(P_species?.response) && P_species.response.map((entry, index: number) => (
                                    entry && entry["feature"] ? (
                                        <SelectItem key={index} value={entry["feature"]}>
                                            <b>{entry["feature"]}</b>
                                        </SelectItem>
                                    ) : null
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>

                <div className='col-span-3'>
                    <label htmlFor="year-select">
                        {t.rich('presence_data.dropdownYear', {...t_richConfig})}:
                    </label>
                    <Select value={curYear} onValueChange={(value) => {
                        let url = apiRoutes.fetchDbData({ relationName: contextT.curPresenceDatasetName, feature: "pointtype", filterBy: "'pointtype','species','year'", filterValue: "'point, exact location','" + curSpecies + "','" + value + "'" });
                        //isLoadingSpinner.current = true;
                        setCurYear(value);
                        setTimeout(() => {
                            contextT.setCurPresenceDatasetURL(url);
                            setPresenceDataURL(url);
                        }, 200);
                    }}>
                        <SelectTrigger className="w-full" id="year-select">
                            <SelectValue placeholder={"loading..."} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectLabel></SelectLabel>
                                <SelectItem key="ALL" value="ALL">
                                    <b>all</b>
                                </SelectItem>
                                {Array.isArray(P_years?.response) && P_years.response.map((entry, index: number) => (
                                    entry && entry["feature"] ? (
                                        <SelectItem key={index} value={entry["feature"]}>
                                            <b>{entry["feature"]}</b>
                                        </SelectItem>
                                    ) : null
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
        )}

         {mapUIsettings.isSequenceMetaData && (
        <div {...UI_elementStyler()}>
            <span className="mb-2 flex items-center justify-between">
                {t.rich('sequence_Metadata.description', { ...t_richConfig })}
                <span className="ml-2"><HoverCardTooltip MDXContent={MDX.DengueSerotypeCounts} /></span>
            </span>
             <div className="grid grid-cols-8 gap-2">
            <div className='col-span-1 mt-4 flex items-center justify-center'>
                <Checkbox
                    className="scale-140 "
                        id="isSequenceMetaData-checkbox"
                        checked={isSequenceMetaData}
                        onCheckedChange={(e) => {
                            const checked = e as boolean;
                            contextT.setIsSequenceMetaData(checked);
                            setIsSequenceMetaData(checked);
                            let url = apiRoutes.fetchDbData({ relationName: contextT.curDonutChartDatasetName, feature: geoAssignmentColumn, task: "getCount", filterBy: "'" + sequenceColumnForDonut + "','date'", filterValue: "'" + cur_Sorgansim + "','" + cur_SYear + "'" });
                            setSequenceMetaDataURL(url);
                            contextT.setCurDonutChartDataURL(url);
                            return checked;

                        }}
                />
                               
  
            </div>
                <div className="col-span-1 mt-0 flex flex-col gap-0 ">
                <span className="pl-1 text-xs">{pieSize}</span>
                <Button
                    variant="outline"
                    size="icon"
                    className="w-5 h-4 mt-1 hover:bg-accent"
                    onClick={() => {
                        setPieSize((prev) => Math.max(10, prev - 5))
                        contextT.setPieSize_sequenceMetaData((prev) => Math.max(10, prev - 5))
                    }}
                    aria-label="Decrease pie size"
                >
                    <span className="text-lg font-bold">−</span>
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    className="w-5 h-4 hover:bg-accent"
                    onClick={() => {
                        setPieSize((prev) => Math.min(200, prev + 5))
                        contextT.setPieSize_sequenceMetaData((prev) => Math.min(200, prev + 5))
                    }}
                    aria-label="Increase pie size"
                >
                    <span className="text-lg font-bold">+</span>
                </Button>
            </div>

                    <div className='col-span-3'>
                        <label htmlFor="organism-select">
                            {t.rich('sequence_Metadata.dropdownType', {...t_richConfig})}:
                        </label>
                        <Select value={cur_Sorgansim} onValueChange={(value) => {
                            let url = apiRoutes.fetchDbData({ relationName: contextT.curDonutChartDatasetName, feature: geoAssignmentColumn, task: "getCount", filterBy: "'" + sequenceColumnForDonut + "','date'", filterValue: "'" + value + "','" + cur_SYear + "'" });
                            setCur_SOrgansim(value);
                            contextT.setCurSOrgansim(value);
                            setTimeout(() => {
                                contextT.setCurDonutChartDataURL(url);
                                setSequenceMetaDataURL(url);
                            }, 200);
                        }}>
                            <SelectTrigger className="w-full" id="organism-select">
                                <SelectValue placeholder={"loading..."} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel></SelectLabel>
                                    <SelectItem key="ALL" value="ALL">
                                        <b>all</b>
                                    </SelectItem>
                                    {Array.isArray(S_organism?.response) && S_organism.response.map((entry, index: number) => (
                                        entry && entry["feature"] ? (
                                            <SelectItem key={index} value={entry["feature"]}>
                                                <b>
                                                    <span
                                                        style={{
                                                            display: "inline-block",
                                                            width: "16px",
                                                            height: "16px",
                                                            marginRight: "6px",
                                                            verticalAlign: "middle",
                                                            borderRadius: "3px",
                                                            background: DonutColors[entry["feature"]] || "#ccc",
                                                            border: "1px solid #888"
                                                        }}
                                                    ></span>
                                                    {entry["feature"]}
                                                </b>
                                            </SelectItem>
                                        ) : null
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className='col-span-3'>
                        <label htmlFor="seq-year-select">
                            {t.rich('sequence_Metadata.dropdownYear', {...t_richConfig})}:
                        </label>
                        <Select value={cur_SYear} onValueChange={(value) => {
                            let url = apiRoutes.fetchDbData({ relationName: contextT.curDonutChartDatasetName, feature: geoAssignmentColumn, task: "getCount", filterBy: "'" + sequenceColumnForDonut + "','date'", filterValue: "'" + cur_Sorgansim + "','" + value + "'" });
                            setCur_SYear(value);
                            contextT.setCurSyear(value);
                            setTimeout(() => {
                                contextT.setCurDonutChartDataURL(url);
                                setSequenceMetaDataURL(url);
                            }, 200);
                        }}>
                            <SelectTrigger className="w-full" id="seq-year-select">
                                <SelectValue placeholder={"loading..."} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel></SelectLabel>
                                    <SelectItem key="ALL" value="ALL">
                                        <b>all</b>
                                    </SelectItem>
                                    {Array.isArray(S_years?.response) && S_years.response.map((entry, index: number) => (
                                        entry && entry["feature"] ? (
                                            <SelectItem key={index} value={entry["feature"]}>
                                                <b>{entry["feature"] == "1" ? "N/A" : entry["feature"]}</b>
                                            </SelectItem>
                                        ) : null
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
             </div>
          {sequenceMedatdata_colorMap && (
                            <div className="mt-0 w-full">
                                <svg className='w-full' height={24} style={{ display: "block", width: "100%" }}>
                                    <defs>
                                        <linearGradient id="sequenceMeta-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            {d3.range(0, 1.01, 0.1).map((t) => (
                                                <stop
                                                    key={t}
                                                    offset={`${t * 100}%`}
                                                    stopColor={sequenceMedatdata_colorMap(
                                                        t * (sequenceMedatdata_colorMap.domain()[1] - sequenceMedatdata_colorMap.domain()[0]) +
                                                        sequenceMedatdata_colorMap.domain()[0]
                                                    )}
                                                />
                                            ))}
                                        </linearGradient>
                                    </defs>
                                    <rect x={0} y={6} width={"100%"} height={12} fill="url(#sequenceMeta-gradient)" />
                                    {/* Start label inside gradient, left-aligned, white */}
                                    <text x={2} y={16} fontSize={12} fill="#fff" textAnchor="start">
                                        {Math.round(sequenceMedatdata_colorMap.domain()[0])}
                                    </text>
                                    {/* End label inside gradient, right-aligned, white */}
                                    <text x={"99%"} y={16} fontSize={12} fill="#000000" textAnchor="end">
                                        {Math.round(sequenceMedatdata_colorMap.domain()[1])}
                                    </text>
                                </svg>
                            </div>
                        )}
        </div>
        )}
        {mapUIsettings.isCountrySelectionDropdownMapBased && Array.isArray(mapData.features) && mapData.features.length > 0 && map && (
            <div {...UI_elementStyler()}>
            <span className="mb-1 flex items-center justify-between">
                {t.rich('country', {...t_richConfig})}:
                <span className="ml-2"><HoverCardTooltip MDXContent={MDX.CountrySelection} /></span>
            </span>
            {selected_country_names && metaData && (
            <Select value={selectedCountry} onValueChange={(value) => {
                selectCountry(value);
            }}>
                <SelectTrigger className="w-full">
                <SelectValue placeholder={"Select country..."} />
                </SelectTrigger>
                <SelectContent>
                <SelectGroup>
                    {[...mapData.features]
                        .map((feature) => feature.properties?.name || feature.properties?.NAME || "")
                        .filter((country) => country)
                        .sort((a, b) => a.localeCompare(b))
                        .map((country, index) => (
                            <SelectItem key={index} value={country}>
                                <b>{country}</b>
                            </SelectItem>
                        ))
                    }
                </SelectGroup>
          </SelectContent>
        </Select>
        )}
        </div>)}
        {mapUIsettings.isCountrySelectionDropdown && (
            <div {...UI_elementStyler()}>
            <span className="mb-1 flex items-center justify-between">
                {t.rich('country', {...t_richConfig})}:
                <span className="ml-2"><HoverCardTooltip MDXContent={MDX.CountrySelection} /></span>
            </span>
            {selected_country_names && metaData && (
           <Select value={selectedCountry} onValueChange={(value) => {
                selectCountry(value);
            }}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder={t.rich('covid19_world_data.select_country_name', {...t_richConfig})+"..."} />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        {selected_country_names.map((country, index) => (
                            <SelectItem key={index} value={country[0]}>
                                <b>{country[1]}</b>
                            </SelectItem>
                        ))}
                    </SelectGroup>
                </SelectContent>
        </Select>
        )}

    {/*<div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 mt-2">
        <Button
                className="truncate w-full  min-w-0 px-4 py-2 mb-2  bg-blue-500 text-white rounded text-sm whitespace-nowrap overflow-hidden text-ellipsis"
                onClick={handleResetToAllCountries}
            >
            <span className="block lg:hidden">{t.rich('covid19_world_data.reset_to_all_countries_short', {...t_richConfig})}</span>
            <span className="hidden lg:block">{t.rich('covid19_world_data.reset_to_all_countries', {...t_richConfig})}</span>
        </Button>
        </div>
    */}

         </div>)
        }
        


    {mapUIsettings.isDatePicker && (
        <div {...UI_elementStyler(2)}   > 
            <span className="mb-1 flex items-center justify-between">
                {t.rich('time_range', {...t_richConfig})}:
                <span className="ml-2"><HoverCardTooltip MDXContent={MDX.CalendarTimeRange} /></span>
            </span>
            <div className="flex w-full flex-row items-start space-y-2 lg:space-y-0 lg:space-x-2 mt-2 min-w-0">
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                    variant="outline"
                    data-empty={!dateRange}
                    className="data-[empty=true]:text-muted-foreground w-[60%] justify-start text-left font-normal border-3 border-purple-800 focus-visible:ring-3 focus-visible:ring-purple-800
                    truncate min-w-0 px-4 rounded text-sm whitespace-nowrap overflow-hidden text-ellipsis" 
                    >
                    <CalendarIcon className="mr-0.5 w-4 h-4  shrink-0"/>
                    {dateRange?.from
                        ? (dateRange.to 
                            ? `${format(dateRange.from, "PP")} - ${format(dateRange.to, "PP")}`
                            : `${format(dateRange.from, "PP")} - ...`
                        )
                        : <span>{t.rich('select_time_span', {...t_richConfig})}</span>}
                    </Button>
                </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <div className="flex flex-col md:flex-row bg-white dark:bg-slate-950 rounded-md overflow-hidden">
                    <div className="flex flex-col p-3 border-b w-full md:border-b-0 md:border-r border-slate-200 dark:border-slate-800">
                        <div className="px-3 pb-2 text-[10px] font-bold text-purple-800 dark:text-purple-400 uppercase tracking-widest flex items-center opacity-70">
                             {t.rich('covid19_world_data.time_range', {...t_richConfig})} (From)
                        </div>
                        <Calendar
                            mode="single"
                            selected={dateRange?.from}
                            onSelect={(date) => {
                                let newRange = { from: date, to: dateRange?.to };
                                if (newRange.from && newRange.to && isAfter(newRange.from, newRange.to)) {
                                    newRange = { from: newRange.to, to: newRange.from };
                                }
                                setDateRange(newRange);
                            }}
                            disabled={disabledMatcher}
                            modifiers={{
                                range_start: dateRange?.from,
                                range_end: dateRange?.to,
                                range_middle: (dateRange?.from && dateRange?.to) ? { from: dateRange.from, to: dateRange.to } : undefined
                            }}
                            defaultMonth={dateRange?.from || min_date}
                            captionLayout="dropdown"
                            numberOfMonths={1}
                            startMonth={min_date}
                            endMonth={max_date}
                        />
                    </div>
                    <div className="flex flex-col p-3 w-full">
                        <div className="px-3 pb-2 text-[10px] font-bold text-purple-800 dark:text-purple-400 uppercase tracking-widest flex items-center opacity-70">
                             {t.rich('covid19_world_data.time_range', {...t_richConfig})} (To)
                        </div>
                        <Calendar
                            mode="single"
                            selected={dateRange?.to}
                            onSelect={(date) => {
                                let newRange = { from: dateRange?.from, to: date };
                                if (newRange.from && newRange.to && isAfter(newRange.from, newRange.to)) {
                                    newRange = { from: newRange.to, to: newRange.from };
                                }
                                setDateRange(newRange);
                            }}
                            disabled={disabledMatcher}
                            modifiers={{
                                range_start: dateRange?.from,
                                range_end: dateRange?.to,
                                range_middle: (dateRange?.from && dateRange?.to) ? { from: dateRange.from, to: dateRange.to } : undefined
                            }}
                            defaultMonth={dateRange?.to || (dateRange?.from ? addMonths(dateRange.from, 1) : min_date)}
                            captionLayout="dropdown"
                            numberOfMonths={1}
                            startMonth={min_date}
                            endMonth={max_date}
                        />
                    </div>
                </div>
            </PopoverContent>
            </Popover>
            <Button
                className="mt-0 bg-purple-800 w-[40%] truncate  min-w-0 px-4 py-2 text-white p-1 rounded text-sm whitespace-nowrap overflow-hidden text-ellipsis"
                onClick={ () => {
                    L_dataLoading.start();
                    if (dateRange?.from && dateRange?.to) {
                        contextT.setDateRange(dateRange);
                    }
                    let url = apiRoutes.fetchDbData({
                        relationName: curDatasetname.current,
                        feature: selectedFeature || contextT.curFeature,
                        filterBy: mapUIsettings.inCovidDataView && selectedCountry ? COVID_COUNTRY_FILTER_COLUMN : undefined,
                        filterValue: mapUIsettings.inCovidDataView && selectedCountry ? selectedCountry : undefined,
                        startDate: (dateRange?.from && dateRange?.to) ? format(dateRange.from, "yyyy-MM-dd") : undefined,
                        endDate: (dateRange?.from && dateRange?.to) ? format(dateRange.to, "yyyy-MM-dd") : undefined,
                        aggregation_level: mapUIsettings.inCovidDataView ? (isCountryLevelData ? 0 : isSubregionLevelData ? 1 : undefined) : undefined,
                    });

                    contextT.setCurDatasetURL(url);
                    contextT.setCurPresenceDatasetURL(url);
                    contextT.setIsPresenceData(true);
                    setIsPresData(true);
                    setPresenceDataURL(url);
                    setShowSuccesTimerangeDropdown(true);

                    setTimeout(() => {
                        setShowSuccesTimerangeDropdown(true);
                    }, 4000);

                    setTimeout(() => {
                        setShowSuccesTimerangeDropdown(false);
                    }, 5000);

                }}
            >
                <span className="block lg:hidden">{t.rich('covid19_world_data.time_range_data_short', {...t_richConfig})}</span>
                <span className="hidden lg:block">{t.rich('covid19_world_data.time_range_data', {...t_richConfig})}</span>
            </Button>

            </div>

            <div className="flex flex-row items-start items-center space-y-2 pr-2 mt-2 ">
            <Button
                  className="truncate w-[60%] px-4 py-2 text-white rounded text-sm"
                onClick={ () => {
                             
                    let url = apiRoutes.fetchDbData({
                        relationName: curDatasetname.current,
                        feature: selectedFeature || contextT.curFeature,
                        filterBy: mapUIsettings.inCovidDataView && selectedCountry ? COVID_COUNTRY_FILTER_COLUMN : undefined,
                        filterValue: mapUIsettings.inCovidDataView && selectedCountry ? selectedCountry : undefined,
                        startDate: format(min_date, "yyyy-MM-dd"),
                        endDate: format(max_date, "yyyy-MM-dd"),
                        aggregation_level: mapUIsettings.inCovidDataView ? (isCountryLevelData ? 0 : isSubregionLevelData ? 1 : undefined) : undefined,
                    });

                    setDateRange({ from: min_date, to: max_date });
                    contextT.setDateRange({ from: min_date, to: max_date });

                    contextT.setCurDatasetURL(url);
                    contextT.setCurPresenceDatasetURL(url);
                    contextT.setIsPresenceData(true);
                    setIsPresData(true);
                    setPresenceDataURL(url);

                    setTimeout(() => {
                        setShowSuccesTimerangeDropdown(true);
                    }, 2000);

                    setTimeout(() => {
                        setShowSuccesTimerangeDropdown(false);
                    }, 5000);

                }}
            >                
            <span className="block lg:hidden">{t.rich('covid19_world_data.complete_data_short', {...t_richConfig})}</span>
            <span className="hidden lg:block">{t.rich('covid19_world_data.complete_data', {...t_richConfig})}</span>
            </Button>
{/*
            <Button
                className="truncate w-full min-w-0 px-4 py-2 text-white p-1 rounded text-sm whitespace-nowrap overflow-hidden text-ellipsis bg-blue-500 mb-2"
                onClick={ () => {
                    isLoadingSpinner.current = true;
                    
                    let start_date = new Date('2020-01-01');
                    let end_date = new Date('2020-12-31');

                    setDateRange({ from: start_date, to: end_date });
                    contextT.setDateRange({ from: start_date, to: end_date });

                    let url = apiRoutes.fetchDbData({
                        relationName: curDatasetname.current,
                        feature: selectedFeature || contextT.curFeature,
                        filterBy: mapUIsettings.inCovidDataView && selectedCountry ? COVID_COUNTRY_FILTER_COLUMN : undefined,
                        filterValue: mapUIsettings.inCovidDataView && selectedCountry ? selectedCountry : undefined,
                        startDate: format(start_date, "yyyy-MM-dd"),
                        endDate: format(end_date, "yyyy-MM-dd"),
                        aggregation_level: mapUIsettings.inCovidDataView ? (isCountryLevelData ? 0 : isSubregionLevelData ? 1 : undefined) : undefined,
                    });
                    
                    
                    contextT.setCurDatasetURL(url);
                    contextT.setCurPresenceDatasetURL(url);
                    contextT.setIsPresenceData(true);
                    setIsPresData(true);
                    setPresenceDataURL(url);

                    setTimeout(() => {
                        setShowSuccesTimerangeDropdown(true);
                    }, 1000);

                    setTimeout(() => {
                        isLoadingSpinner.current = false;
                        if(isLoadingSpinnerDEBUG) console.log("off Spinner: TimerangeDropdown 5000ms setTimeout");
                        setShowSuccesTimerangeDropdown(false);
                    }, 5000);

                }}
            >
                {t.rich('covid19_world_data.reset_to_2020', {...t_richConfig})}
            </Button>

            <Button
                className="truncate w-full lg:w-2/3 min-w-0 px-4 py-2 text-white p-1 rounded text-sm whitespace-nowrap overflow-hidden text-ellipsis bg-red-600 hover:bg-red-700 mb-2"
            onClick={ () => {
                isLoadingSpinner.current = true;
                d3.selectAll('[class^="svg-circles-container_"]')
                .each(function () {
                    d3.select(this)
                      .selectAll('circle')
                      .remove();
                  });

                  d3.selectAll('.leaflet-popup-pane')
                  .each(function () {
                    d3.select(this)
                      .selectAll('.custom-popup')
                      .remove();
                  });          
                isLoadingSpinner.current = false;
                if(isLoadingSpinnerDEBUG) console.log("off Spinner: Clear map");
            }}>
            {t.rich('covid19_world_data.clear_map', {...t_richConfig})}
            </Button>
    */}
            </div>
         </div>)
        }
        


         {mapUIsettings.isAutoHideSettingsToggle && (
        <div {...UI_elementStyler(2)} > 
         <div className="grid grid-cols-4 gap-2">
        <div className='col-span-1 mt-0 flex items-center justify-center'>
            <Checkbox
                className="scale-140 "
                    id="isAutoHideSettings-checkbox"
                    defaultChecked={props.mapUIsettings.isSettingsBlendAnimation}
                    onCheckedChange={(e) => {
                        const checked = e as boolean;
                        props.mapUIsettings.isSettingsBlendAnimation = checked;
                        return checked;
                    }}
            />
            </div>
           <div className='col-span-3'>{t.rich('auto_hide_settings', {...t_richConfig})}</div>
       </div>
         </div>
        )}
        </>
        )}

    {mapUIsettings.dataFilteringCheckboxes && (
        <div {...UI_elementStyler()}>
            <div className="mt-8">
            <div>
                <div className="flex flex-col items-center justify-center">

                    <div className="flex flex-col">
                        <div className="flex items-center mb-2">
                            <Checkbox
                                className="scale-140 m-1"
                                id="isPresData-checkbox-1"
                                defaultChecked={isCountryLevelData}
                                onCheckedChange={(checked: boolean) => {
                                    contextT.setIsCountryLevelData(checked);
                                    setIsCountryLevelData(checked);

                                    let url = presenceDataURL;
                                    if (checked && isSubregionLevelData) {
                                        url = url.replace("&aggregation_level=0", "");
                                        url = url.replace("&aggregation_level=1", "");
                                        contextT.setCurPresenceDatasetURL(url);
                                        setPresenceDataURL(url);
                                    }
                                    else {
                                        if(checked == true){
                                            if(url.includes("&aggregation_level=1")) {
                                                url = url.replace("&aggregation_level=1", "");
                                            }
                                            url += "&aggregation_level=0";
                                            contextT.setCurPresenceDatasetURL(url);
                                            setPresenceDataURL(url);
                            
                                        }
                                        else {

                                            if (!isSubregionLevelData) {

                                                // remove circles
                                                d3.selectAll('[class^="svg-circles-container_"]')
                                                .each(function () {
                                                    d3.select(this)
                                                        .selectAll('g.pres-point')
                                                        .remove();
                                                    });
                                                circlesSelectionRef.current = null;
                                
                                                    d3.selectAll('.leaflet-popup-pane')
                                                    .each(function () {
                                                    d3.select(this)
                                                        .selectAll('.custom-popup')
                                                        .remove();
                                                    });  
                                            }
                                            else {
                                                if(url.includes("&aggregation_level=1")) {
                                                    url = url.replace("&aggregation_level=1", "");
                                                }
                                                url += "&aggregation_level=1";

                                                contextT.setCurPresenceDatasetURL(url);
                                                setPresenceDataURL(url);
                                            }
                                        }
                                    }
                                }}
                            />
                            <span className="ml-2">{t.rich('covid19_world_data.country_level', {...t_richConfig})}</span>
                        </div>
                        <div className="flex items-center mb-5">
                            <Checkbox
                                className="scale-140 m-1"
                                id="isPresData-checkbox-2"
                                defaultChecked={isSubregionLevelData}
                                onCheckedChange={(checked: boolean) => {

                                    contextT.setIsSubregionLevelData(checked);
                                    setIsSubregionLevelData(checked);


                                    let url = presenceDataURL;
                                    if (checked && isCountryLevelData) {
                                        url = url.replace("&aggregation_level=0", "");
                                        url = url.replace("&aggregation_level=1", "");
                                        contextT.setCurPresenceDatasetURL(url);
                                        setPresenceDataURL(url);
                                    }
                                    else {
                                        if(checked == true){
                                            if(url.includes("&aggregation_level=0")) {
                                                url = url.replace("&aggregation_level=0", "");
                                            }
                                            url += "&aggregation_level=1";
                                            contextT.setCurPresenceDatasetURL(url);
                                            setPresenceDataURL(url);
                                        }
                                        else {
                                            if (!isCountryLevelData) {

                                                // remove circles
                                                d3.selectAll('[class^="svg-circles-container_"]')
                                                .each(function () {
                                                    d3.select(this)
                                                        .selectAll('g.pres-point')
                                                        .remove();
                                                    });
                                                circlesSelectionRef.current = null;
                                
                                                    d3.selectAll('.leaflet-popup-pane')
                                                    .each(function () {
                                                    d3.select(this)
                                                        .selectAll('.custom-popup')
                                                        .remove();
                                                    });  
                                            }
                                            else {
                                                if(url.includes("&aggregation_level=1")) {
                                                    url = url.replace("&aggregation_level=1", "");
                                                }
                                                url += "&aggregation_level=0";

                                                contextT.setCurPresenceDatasetURL(url);
                                                setPresenceDataURL(url);
                                            }

                                        }
                                    }
                                }}
                            />
                            <span className="ml-2">{t.rich('covid19_world_data.subregion_level', {...t_richConfig})}</span>
                        </div>
                    </div>
                </div>
            </div>
            </div>
        </div>
        )}
        
        {/* settings close */}
        
        

    </div>{/* grid close */}

        

    <LoadingSpinnerAnimation  />
    <div ref={divRef} className='flex justify-center items-center size-full'>
    <svg id={chart} className=' w-full h-full'></svg>

    <LeafletMapComponent chartProps={leafProps}>
        <MapContentChild
            variant="world"
            mapRef={mapRef}
            toolTipRef={toolTipRef}
            L={L}
            isDistanceLegend={mapUIsettings.isDistanceLegend}
        />
        <div ref={SVG_tooltip_ref} className='absolute pointer-events-none'></div>
    </LeafletMapComponent>

    {/*{renderCountOverlay}*/}
    {props.mapUIsettings.isLatLngZoomOverlay && (
        <LatLngZoomLegend
            latitude={latitude}
            longitude={longitude}
            zoom={zoom}
            scaleLegDims={scaleLegDims}
        />
    )}

    {/* Declarative color map legend (replaces imperative appendColorMap) */}
    {mapUIsettings.isColorMapLegend && isColorMapLegendReady && (
        <div
            style={{
                position: "absolute",
                right: legendDistanceToMapBorderX,
                bottom: legendDistanceToMapBorderY + leafletLogoHeight,
                pointerEvents: "none",
                zIndex: 50,
            }}
        >
            <ColorMapLegend
                chartId={chart}
                colorMapType={curColorMapType}
                minVal={minVal}
                maxVal={maxVal}
                selectedFeature={selectedFeature || contextT.curFeature || props.mapUIsettings.defaultFeatureName}
                metaData={metaData}
                layerOpacity={layerOpacity}
                locale={locale}
                height={colMapDims.height}
                barWidth={barWidth}
                isVisible={mapUIsettings.isColorMapLegend}
            />
        </div>
    )}

    {(showSuccessCountryDropdown || showSuccessTimerangeDropdown) && (
        <div
            style={{
                position: "absolute",
                left: legendDistanceToMapBorderX ,
                bottom: legendDistanceToMapBorderY + scaleLegDims.height + 5,
                zIndex: 1000,
                pointerEvents: "auto",
                maxWidth: "350px",
            }}
            className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
            <DataLoadSuccessAlert locationCount={presData.length} />
        </div>
    )}
   
    </div>
</div>

</>
    );
};


// LatLngZoomOverlay — extracted to ./LatLngZoomOverlay.tsx
// DonutTooltip, PolylineTooltip, getLabelPolyline — extracted to ./DonutTooltip.tsx



/** @see {@link LeafD3MapLayerComponent} */
export { LeafD3MapLayerComponent };
export default LeafD3MapLayerComponent;


