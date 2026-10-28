
"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    getMinMaxFeature,
    getGridCellIndex,
    getGridOffset,
    snapToGrid,
    roundLatLng,
    renderStandardTooltipHTML,
} from './helpers';
import {LoadingSpinnerProvider, useLoadingTask, LoadingSpinnerAnimation} from './utils/loadingSpinner';
import { type metaDataT } from '../MetaDataHandler';
import {
    availableColorMaps,
    availableColorMapsNames,
    RANGE_LAT,
    RANGE_LONG,
    MAX_ZOOM,
    MIN_ZOOM,
    ZOOM_STEP,
    CALCER,
} from './constants';
import * as d3 from 'd3';
import { useInterfaceContext } from '@/components/contexts/InterfaceContext';
import { apiRoutes } from '@/app/api_routes';
import { aggregateRKI } from '@/app/api_commands';
import stateMappersGermany, { PrintDataLoadingErrors, handleLoadDataError } from '@/app/helpers';
import { useGetJSONData, clearDataCache } from '@/app/hooks/useFetchAndCache';
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
import { useLocale ,useTranslations } from "next-intl";
import { t_richConfig, type dbDATA } from '@/app/const_store';
import { Locale } from '@/i18n/routing';
import useChartResizer from '@/app/hooks/useChartResizer';

import LeafletMapComponent, { LeafletComponentProps } from './BaseMap';
import { Settings } from 'iconoir-react';
import ColorMapLegend from './overlays/ColorMapLegend';
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { HoverCardTooltip } from '@/components/layout/InfoCards';
import { CardHeaderAction } from '@/components/layout/CardHeaderAction';
import { MDXContentProvider } from '@messages/markdown/MDXContentProvider';

// ─── Shared hooks & utils (extracted from nested component definitions) ───
import {
    useLeafletInit,
    useMapPosition,
    useMapResize,
    useMapDistance,
    useMapTransition,
    useGridDataParser,
    useLayerUpdateDebounce,
    useTooltipCleanup,
} from './hooks';
import { clampCoordinates, resetTimeout, removeReusedTooltip, getParamsOfURL } from './utils/mapUtils';
import MapContentChild from './MapContentChild';




const defaultLeafProps = {
    ...LeafletComponentProps("LeafletMap1", apiRoutes.FETCH_MAP_DATA.GERMANY_MAP_STATES, "exampleVar"),
    center: [-20, 25.8] as [number, number],
    zoom: 1.5,
};

const duration_mapTransition = 1800;

const legendDistanceToMapBorderX = 5;
const legendDistanceToMapBorderY = 15;

const defaultColorMap = availableColorMapsNames.interpolateViridis;

/**
 * Loads the available report-date range for Germany COVID-19 observations.
 *
 * @param selectedTargetDate - Optional selected day used to derive a seven-day lookback.
 * @returns Loading state, date bounds, calendar limits, and optional lookback range.
 *
 * @remarks The `getMinMax` database task runs through `useGetJSONData`.
 * Calendar bounds fall back to January 2020–January 2023 while the request is
 * pending or lacks dates; the disabled matcher excludes dates outside the
 * reported range once it is available.
 */
function useDatasetDateBounds(selectedTargetDate?: Date) {
    const [isLoadingDateBounds, rawDateBounds] = useGetJSONData(
        apiRoutes.fetchDbData({
            relationName: "aktuell_deutschland_sarscov2_infektionen",
            feature: "meldedatum",
            task: "getMinMax"
        })
    );

    const minDateVal = (rawDateBounds?.response as any)?.min_val;
    const maxDateVal = (rawDateBounds?.response as any)?.max_val;

    const parseDateString = (str?: string) => {
        if (!str) return undefined;
        const cleanStr = String(str).substring(0, 10);
        const parts = cleanStr.split('-');
        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                return new Date(year, month, day);
            }
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? undefined : d;
    };

    const minDate = useMemo(() => parseDateString(minDateVal), [minDateVal]);
    const maxDate = useMemo(() => parseDateString(maxDateVal), [maxDateVal]);

    const startMonth = useMemo(() => {
        return minDate || new Date(2020, 0, 1);
    }, [minDate]);

    const endMonth = useMemo(() => {
        return maxDate || new Date(2023, 0, 1);
    }, [maxDate]);

    const disabledMatcher = useMemo(() => {
        const matchers: any[] = [];
        if (minDate) matchers.push({ before: minDate });
        if (maxDate) matchers.push({ after: maxDate });
        return matchers;
    }, [minDate, maxDate]);

    const weekLookbackRange = useMemo(() => {
        if (!selectedTargetDate) return undefined;
        const fromDate = new Date(
            selectedTargetDate.getFullYear(),
            selectedTargetDate.getMonth(),
            selectedTargetDate.getDate() - 6
        );
        return { from: fromDate, to: selectedTargetDate };
    }, [selectedTargetDate]);

    return {
        isLoadingDateBounds,
        minDate,
        maxDate,
        startMonth,
        endMonth,
        disabledMatcher,
        weekLookbackRange,
    };
}



/**
 * Configuration properties interface for the Germany COVID-19 regional map component (`LeafD3MapGermanyComponent`).
 *
 * Configures spatial map bounds (center `[9.7, 52]`), administrative state boundaries (`GERMANY_MAP_STATES`),
 * epidemiological feature selections, and temporal date filters.
 *
 * @see {@link LeafD3MapGermanyProps} (factory function)
 * @see {@link LeafD3MapGermanyComponent} for primary map component.
 * @see {@link useInterfaceContext} for multi-view state context synchronization.
 * @see {@link useGetJSONData} for API payload fetching.
 *
 * @example
 * ```tsx
 * import { apiRoutes } from "@/app/api_routes";
 * import { LeafD3MapGermanyProps } from "@/components/plots/maps/LeafD3MapGermanyCovid";
 *
 * const germanyConfig: LeafD3MapGermanyProps = LeafD3MapGermanyProps(
 *   "germany-covid-map",
 *   apiRoutes.FETCH_MAP_DATA.GERMANY_MAP_STATES,
 *   apiRoutes.fetchDbData({
 *     relationName: "aktuell_deutschland_sarscov2_infektionen",
 *     feature: "accuCasesPerWeek",
 *   }),
 *   { defaultFeatureName: "accuCasesPerWeek", isDatePicker: true },
 *   [52, 9.7],
 *   6,
 * );
 * ```
 */
export interface LeafD3MapGermanyProps {
    /** Unique DOM ID for the chart container element */
    chartName: string;
    /** GeoJSON URL or FeatureCollection object for German state boundaries */
    mapDataURL: any;
    /** Dataset URL endpoint for regional COVID-19 metrics */
    dataURL: any;
    /** Viewport center coordinates `[latitude, longitude]` for Leaflet. */
    center: [number, number];
    /** Viewport zoom level */
    zoom: number;
    /** UI settings toggle object */
    mapUIsettings: {
        isLongitudeSlider: boolean;
        isLatitudeSlider: boolean;
        isZoomSlider: boolean;
        isColorMapSelectionDropdown: boolean;
        isFeatureSelectionDropdown: boolean;
        isDatasetSelectionDropdown: boolean;
        isDistanceLegend: boolean;
        isColorMapLegend: boolean;
        isDatePicker?: boolean;
        defaultFeatureName?: string;
    };
    /** Whether linked selection changes animate the map view. */
    isApplySelectionsTransition: boolean;
    /** Whether a static render fills the available map container. */
    isStaticAutoFitFullSize: boolean;
    /** Whether the map uses an equirectangular CRS. */
    isProjection_equirectangular?: boolean;
    /** Whether the map seeds initial values into linked-view context. */
    isSetIntialContextDataFromComponent?: boolean;
}

/**
 * Creates a complete configuration for the Germany COVID-19 Leaflet/D3 map.
 *
 * @param chartName - Stable DOM identifier for the map.
 * @param mapDataURL - German state-boundary GeoJSON endpoint.
 * @param dataURL - Epidemiological dataset endpoint.
 * @param mapUIsettings - Partial overrides for map-control visibility and default feature.
 * @param center - Initial `[latitude, longitude]` center used by Leaflet.
 * @param zoom - Initial Leaflet zoom.
 * @param mapBaseColor - Legacy base-color argument retained for compatibility.
 * @param isStaticAutoFitFullSize - Fits static rendering to the complete available container.
 * @param isApplySelectionsAndTransitions - Applies linked selections and animated map transitions.
 * @param isProjection_equirectangular - Uses EPSG:4326 rather than Web Mercator.
 * @param isSetContextData - Seeds linked-view context values from this map.
 * @returns A configuration accepted by `LeafD3MapGermanyComponent`.
 *
 * @remarks The factory currently defaults `center` to `[9.7, 52]`, which is
 * outside Germany in Leaflet's latitude-first order. Germany Vis. Interfaces
 * should pass an explicit center such as `[52, 9.7]`.
 */
export function LeafD3MapGermanyProps(
    chartName = "D3mapLayer",
    mapDataURL = apiRoutes.FETCH_MAP_DATA.GERMANY_MAP_STATES,
    dataURL?: string,
    mapUIsettings: any = {},
    center: [number, number] = [9.7, 52],
    zoom = 2,
    _mapBaseColor?: any,
    isStaticAutoFitFullSize = false,
    isApplySelectionsAndTransitions = false,
    isProjection_equirectangular = false,
    isSetContextData = false
): LeafD3MapGermanyProps {
    return {
        chartName,
        mapDataURL,
        dataURL,
        center,
        zoom,
        mapUIsettings: {
            isLongitudeSlider: true,
            isLatitudeSlider: true,
            isZoomSlider: true,
            isColorMapSelectionDropdown: true,
            isFeatureSelectionDropdown: true,
            isDatasetSelectionDropdown: true,
            isDistanceLegend: true,
            isColorMapLegend: true,
            isDatePicker: false,
            defaultFeatureName: "",
            ...mapUIsettings,
        },
        isStaticAutoFitFullSize,
        isApplySelectionsTransition: isApplySelectionsAndTransitions,
        isSetIntialContextDataFromComponent: isSetContextData,
        isProjection_equirectangular
    };
}


/**
 * Composes the Germany COVID-19 Leaflet map and linked epidemiological layers.
 *
 * @param props - Fully defaulted Germany map configuration.
 * @returns The map body, temporal controls, and data-layer overlays.
 *
 * @remarks Reads shared selections from `InterfaceContext`; date bounds and
 * spatial data arrive through `useGetJSONData`. The outer component supplies
 * a card-local loading provider before rendering this body.
 */
const LeafD3MapGermanyComponentInner = ({props}: {props: LeafD3MapGermanyProps}) => {
  
    let c = useInterfaceContext();
    const leafProps = {
        ...defaultLeafProps,
        zoom: props.zoom,
        center: props.center,
        isProjection_equirectangular: props.isProjection_equirectangular,
    };

    const URLparams = useMemo(() => getParamsOfURL(props.dataURL), [props.dataURL]);

    // ─── Shared hook: SSR-safe Leaflet init (replaces nested useEffect + import) ───
    const L = useLeafletInit();


    const t = useTranslations("component_D3MapLayerComponent");


    // L is now provided by useLeafletInit() above

   
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
        const colMapWidth = 68;
        const colMapDims = {
            width: colMapWidth,
            height: colMapHeight,
            posX: mapSvgWidth - colMapWidth - legendDistanceToMapBorderX,
            posY: mapSvgHeight - colMapHeight - legendDistanceToMapBorderY
        };


    // initialize component variables
    let contextT = useInterfaceContext();
    let collectDataLoadingErrors = [];
    let chart:string = props.chartName;
    
   const mapUIsettings = { ...props.mapUIsettings };

    // *** useState *** //
    const [[latitude, longitude, zoom], setCoordinates] = useState<[number, number, number]>(
        [leafProps.center?.[0] ?? 0, leafProps.center?.[1] ?? 0, leafProps.zoom ?? 1]
    );
    const [isUpdate, setisUpdate] = useState(false);
    const curMouseEvent = useRef<string>("null");
    const screenDistanceOneKM = useRef<number>(0);
    const initialDataset = props.dataURL && props.mapUIsettings.defaultFeatureName && URLparams["relationName"]
        ? apiRoutes.fetchDbData({
            relationName: URLparams["relationName"],
            feature: props.mapUIsettings.defaultFeatureName,
        })
        : props.dataURL || "";
    const [localSelectedDataset, setSelectedDataset] = useState(initialDataset);
    const [localColorMapType, setColorMapType] = useState<string>(defaultColorMap);
    const [localLayerOpacity, setLayerOpacity] = useState(1.0);
    const [localSelectedFeature, setSelectedFeature] = useState<string>(props.mapUIsettings.defaultFeatureName || "")
    const selectedDataset = props.isApplySelectionsTransition && contextT.curDatasetURL
        ? contextT.curDatasetURL : localSelectedDataset;
    const curColorMapType = props.isApplySelectionsTransition
        ? contextT.curColorMap : localColorMapType;
    const layerOpacity = props.isApplySelectionsTransition
        ? contextT.curLayerOpacity : localLayerOpacity;
    const [selectedTargetDate, setSelectedTargetDate] = useState<Date | undefined>(undefined);
    const [isAggregating, setIsAggregating] = useState<boolean>(false);
    const curDatasetname = useRef<string>(URLparams["relationName"] || "");
    const curPropertyNames = useRef<string>("");
    const curGridCell = useRef<[number, number]>([0, 0]);
    const curGridCellFeature = useRef<number>(0);
    const curGridCellID = useRef<number>(0);
    const hoverCountry = useRef<string>("0");
    const toolTipRef = useRef<any>(null);
    const isHoverCountry = useRef<boolean>(false);
    const activeLayerRef = useRef<L.Path | null>(null);
    const gridcellSizeLatLng = useRef<{ lng: number; lat: number }>({ lng: 0, lat: 0 });
     const [isSettingsOpen, setIsSettingsOpen] = useState(true);
    
    const locale = useLocale() as Locale;
    const MDX = MDXContentProvider[locale]?.MapUI || MDXContentProvider["en"].MapUI;
    // data loading 

    const [isLoading_mapData, rawMapData] = useGetJSONData(props.mapDataURL);
    const [isLoading_MosquitoData, rawMosquitoData] = useGetJSONData(selectedDataset);  
    const [isLoadingDatalist, dataList] = useGetJSONData(apiRoutes.GET_LIST_OF_DATASETS)
    const [isLoading_Metadata, rawMetaData] = useGetJSONData(apiRoutes.getDatasetsMetadata({ LANGID: locale }));
    const mosquitoData = rawMosquitoData as unknown as dbDATA;
    const inferredFeature = !isLoading_MosquitoData && mosquitoData.response && mosquitoData.error === null
        ? mosquitoData.header[Math.ceil(mosquitoData.header.length / 2) - 1] || ""
        : "";
    const selectedFeature = props.isApplySelectionsTransition && contextT.curDatasetURL
        ? (contextT.curFeature || inferredFeature)
        : (localSelectedFeature || inferredFeature);
    
    // Date bounds, month limits, and lookback range from dedicated hook
    const {
        startMonth,
        endMonth,
        disabledMatcher,
        weekLookbackRange,
    } = useDatasetDateBounds(selectedTargetDate);
    
    /** Available database relations keyed by their backend-provided label. */
    type dataListT = {
        [key: string]: string
    }
  

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
    // MapContent is now the extracted <MapContentChild /> component (see JSX below)



    const { setCurDatasetURL, setCurFeature, setCurColorMap, setCurLayerOpacity } = contextT;
    // if isSetIntialContextDataFromComponent is true set context values from component
    useEffect(() => {
        if (props.isSetIntialContextDataFromComponent === true) {
            setCurDatasetURL(selectedDataset);
            setCurFeature(selectedFeature);
            setCurColorMap(curColorMapType);
            setCurLayerOpacity(layerOpacity);
            console.log("SET context from Germany component:", {
                selectedDataset,
                selectedFeature,
                curColorMapType,
                layerOpacity,
            });
        }
    }, [props.isSetIntialContextDataFromComponent, selectedDataset, selectedFeature, curColorMapType, layerOpacity, setCurDatasetURL, setCurFeature, setCurColorMap, setCurLayerOpacity]);

    const metaData = rawMetaData as unknown as metaDataT;
    let dataTableContext = useInterfaceContext();

    let listOfDataSets = dataList as unknown as dataListT;
    const sortedKeys = Object.keys(listOfDataSets).sort();
    listOfDataSets = sortedKeys.reduce((acc, key) => {
            acc[key] = listOfDataSets[key];
            return acc;
        }, {} as dataListT);
    collectDataLoadingErrors.push(handleLoadDataError(isLoading_mapData, rawMapData as unknown as dbDATA));
    collectDataLoadingErrors.push(handleLoadDataError(isLoading_MosquitoData, rawMosquitoData as unknown as dbDATA));
    collectDataLoadingErrors.push(handleLoadDataError(isLoadingDatalist, dataList as unknown as dbDATA));
    collectDataLoadingErrors.push(handleLoadDataError(isLoading_Metadata, rawMetaData as unknown as dbDATA));
    const mapData = rawMapData as unknown as any;

    const getFeatureValForState = useCallback((countryName: string): any => {
        if (!mosquitoData?.response || !Array.isArray(mosquitoData.response)) return undefined;
        const trimmed = countryName.trim().toLowerCase();
        const record = mosquitoData.response.find((r: any) => {
            if (!r) return false;
            if (r.bundesland && r.bundesland.trim().toLowerCase() === trimmed) return true;
            const id = stateMappersGermany.Map__State_to_ID(countryName);
            const idd = stateMappersGermany.mapper__MapTable__ID_to_ID(id);
            const expectedIdStr = String(idd).padStart(2, '0');
            return r.idbundesland === expectedIdStr;
        });
        return record?.feature;
    }, [mosquitoData]);


    const colNames = useMemo(() => {
        if(mosquitoData.response !== undefined && !isLoading_MosquitoData && mosquitoData.error === null) {
            //console.log("data:", mosquitoData);
            return mosquitoData.header.filter((name: string) => name !== "id");
        }
        else {
            return [] as string[];
        }
    }, [isLoading_MosquitoData, mosquitoData]);

   
    
     // *** useRef *** //
    const divRef = useRef<HTMLDivElement | null>(null);
    const ischanged = useRef(false);
    let time = useRef<ReturnType<typeof setTimeout> | null>(null);
    let mapTime = useRef<ReturnType<typeof setTimeout> | null>(null);
    // ── Loading task hooks (replace old isLoadingSpinner ref) ──
    const L_dataLoading = useLoadingTask('Data');
    const L_debounceLoading = useLoadingTask('Debounce Render');
    const L_aggregationLoading = useLoadingTask('Aggregating Data');

 

    // Clear loading spinner when all main datasets finish loading
    useEffect(() => {
        if (!isLoading_mapData &&
            !isLoading_MosquitoData &&
            !isLoadingDatalist &&
            !isLoading_Metadata) {
            L_dataLoading.stop();
        } else {
            L_dataLoading.start();
        }
    }, [isLoading_mapData, isLoading_MosquitoData, isLoadingDatalist, isLoading_Metadata, L_dataLoading]);

    // ─── Shared hook: parse raw polygon data → Map<gridCellIndex, VisDataT> ───
    const { gridData: parsedGridData, parseErrors } = useGridDataParser({
        isLoading: isLoading_MosquitoData,
        rawData: mosquitoData,
        gridcellSizeRef: gridcellSizeLatLng,
    });

    const visData = parsedGridData;
    parseErrors.forEach((parseError) => collectDataLoadingErrors.push(<div key={parseError}>{parseError}</div>));
 
        // Leaflet init is now handled by useLeafletInit() hook at the top of the component

    // *** functions *** //
    function updateCoordinates(latitude: number, longitude: number, zoom: number) {
        const [clampedLat, clampedLng, clampedZoom] = clampCoordinates(latitude, longitude, zoom);
        setCoordinates([clampedLat, clampedLng, clampedZoom]);
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


     /************************** */

  /*********************************
   * *** Layer Update Handler **** *
   *********************************/
useLayerUpdateDebounce({
    curMouseEventRef: curMouseEvent,
    timerRef: time,
    startLoading: L_debounceLoading.start,
    stopLoading: L_debounceLoading.stop,
    setIsUpdate: setisUpdate,
    interactionMap: map,
    onDebounceComplete: () => {
        if (map && L && props.isStaticAutoFitFullSize && mapData && !mapData.error && mapData.type) {
            const geoLayer = L.geoJSON(mapData);
            let bounds = geoLayer.getBounds();
            bounds = bounds.pad(-1.05);
            map.fitBounds(bounds);
        }
    },
    deps: [latitude, longitude, zoom, rawMosquitoData, curColorMapType, layerOpacity, dimensions, map],
});


// map is now a state variable, so getMapInstance is no longer needed


// ─── Shared hook: sync React state → Leaflet map view (replaces nested MapPosUpdates) ───
useMapPosition({ map, latitude, longitude, zoom });



function DrawMapPolygons() {

    

    useEffect(() => {
       
        if (!map || !L || isLoading_mapData || isLoading_MosquitoData || !mosquitoData.response) return ;
       

        // Remove previous layers if they exist
        map.eachLayer((layer) => {
            if (layer instanceof L.GeoJSON) {
                map.removeLayer(layer);
               
            }
        });
        try {
            if (mapData && !mapData.error && mapData.type) {
                L.geoJSON(mapData, {
                style: (feature: any) => {
                    const country = feature?.properties?.name || "";
                    const curVal = getFeatureValForState(country);
                    return {
                        color: "#000000",
                        fillColor: colorMap(curVal),
                        fill: true,
                        weight: 1,
                        fillOpacity: layerOpacity,
                    };
                },
                interactive: true,
                onEachFeature: (feature: GeoJSON.Feature, layer: L.Layer) => {
                    layer.on("click", () => {
                      
                    const country = feature && 'properties' in feature ? feature.properties?.name || "" : "";

                        contextT.setMapSelectionObj(feature);
                        // eslint-disable-next-line react-hooks/refs -- Leaflet invokes this click handler after the effect registers it.
                        curPropertyNames.current = country;
                        let id = stateMappersGermany.Map__State_to_ID(country);
                        c.setSelectedStateID(id);

                        // Track and bring active layer to front
                        // eslint-disable-next-line react-hooks/refs -- Leaflet invokes this click handler after render.
                        activeLayerRef.current = layer as L.Path;
                        (layer as L.Path).bringToFront();
                     
                    });

                    layer.on("mousemove", function (event: L.LeafletMouseEvent) {
                        toolTip();

                        function toolTip() {
                            // eslint-disable-next-line react-hooks/refs -- Tooltip cleanup runs in a Leaflet mouse event.
                            removeAllTooltips();
                            // eslint-disable-next-line react-hooks/refs -- Leaflet invokes this mouse handler after render.
                            toolTipRef.current.setLatLng(event.latlng);
                        }

                        if (feature.properties) {
                                const country = feature.properties ? feature.properties.name : "";
                                const curVal = getFeatureValForState(country);
                                let unit = "";
                                if (metaData && metaData[selectedFeature] !== undefined) {
                                    unit = metaData[selectedFeature].dimension ?? "";
                                }

                                const numericValue = typeof curVal === "number" ? curVal : Number(curVal);
                                const formattedValue = Number.isFinite(numericValue)
                                    ? numericValue.toLocaleString(locale, { maximumFractionDigits: 3 })
                                    : "N/A";
                                const countryLabel = country ? country : "Unknown Location";
                                const featureDescription =
                                    (metaData && metaData[selectedFeature] !== undefined) ? metaData[selectedFeature].description : "";

                                toolTipRef.current.setContent(
                                    renderStandardTooltipHTML({
                                        value: formattedValue,
                                        unit: unit || "",
                                        description: featureDescription,
                                        rows: [
                                            { label: String(t.rich('tooltip.country', {...t_richConfig})), value: countryLabel },
                                            { label: String(t.rich('tooltip.feature', {...t_richConfig})), value: selectedFeature || "N/A" },
                                        ],
                                        chartId: "toolTip" + chart,
                                    })
                                );
                            if (map && isMouseInsideRef.current) {
                                map.openTooltip(toolTipRef.current);
                            }
                            if (curPropertyNames.current !== feature.properties.name) {
                                
                                (layer as L.Path).setStyle({
                                    //fillColor: "rgb(29, 73, 217)",
                                    color: "rgb(47, 214, 109)",
                                    //fillOpacity: 0.5,
                                    weight: 4,
                                    lineJoin: "round",
                                    lineCap: "round",
                                });
                                 (layer as L.Path).bringToFront();
                                // Add glow class for the CSS drop-shadow filter
                                const el = (layer as any).getElement?.();
                                if (el) el.classList.add("leaflet-path-hover");
                                isHoverCountry.current = true;
                            }
                            // eslint-disable-next-line react-hooks/refs -- Leaflet invokes this mouse handler after render.
                            hoverCountry.current = feature.properties.name;
                        } else {
                            hoverCountry.current = "";
                        }
                    });

                    layer.on("mouseout", function () {
                        if (feature.properties) {
                              const country = feature?.properties?.name || "";
                            const curVal = getFeatureValForState(country);
                            if (curPropertyNames.current !== feature.properties.name) {
                                (layer as L.Path).setStyle({
                                    fillColor: colorMap(curVal),
                                    color: "#000000",
                                    weight: 1,
                                    //fillOpacity: c.curLayerOpacity,
                                });
                                // Remove glow class (transitions handle the slow fade-out)
                                const el = (layer as any).getElement?.();
                                if (el) el.classList.remove("leaflet-path-hover");
                                hoverCountry.current = "";
                                isHoverCountry.current = false;
                                removeAllTooltips();
                                const svg = d3.select(map.getContainer()).select("svg");
                                svg.selectAll("rect").remove();
                                svg.selectAll("circle").remove();
                            }
                            // Always bring the active (clicked) layer back to front
                            if (activeLayerRef.current && typeof activeLayerRef.current.bringToFront === "function") {
                                activeLayerRef.current.bringToFront();
                            }
                        }
                    });
                },
            }).addTo(map);
           }
        }
        catch(e) {
            let errorMsg = { ERROR: "ERROR: while retriving geo data." +e};
            console.log("Error:", errorMsg);
        };

        
        return () => {
            if (map) {
                map.eachLayer((layer) => {
                    if (L && layer instanceof L.GeoJSON) {
                        map.removeLayer(layer);
                    }
                });
            }
        };
    }, [mapData, isLoading_mapData, map, mosquitoData, curColorMapType, selectedFeature]);


    return null;
}


// ─── Shared hook: fly-to transition (replaces nested MapTransition) ───
useMapTransition({
    map,
    L,
    isEnabled: !!props.isApplySelectionsTransition,
    selectionObj: contextT.mapSelectionObj,
    latitude,
    longitude,
    zoom,
    duration: duration_mapTransition,
    updateCoordinates,
});

// ─── Shared hook: invalidateSize on resize (replaces nested MapWatchRezies) ───
useMapResize({ map, dimensions });

function MapMouseEvents() {
    let c = useInterfaceContext();
    let debug = false;
    useEffect(() => {
        if (!map || isLoading_MosquitoData) return ;
        if (!props.isStaticAutoFitFullSize) {
            const handleMouseEvent = () => {
                let curCenter = map.getCenter();
                let curZoom = map.getZoom();
                curCenter.lat = Math.round(curCenter.lat * CALCER) / CALCER;
                curCenter.lng = Math.round(curCenter.lng * CALCER) / CALCER;
                curZoom = Math.round(curZoom * 100) / 100;
            
                if (curCenter && zoom) {
                    if(curCenter.lng !== longitude || curCenter.lat !== latitude || curZoom !== zoom) {
                        //console.log("curZoom:", curZoom, "curCenter:", curCenter);

                        updateCoordinates(curCenter.lat, curCenter.lng, curZoom);
                    }
                }
            };
           
            const handleMouseMove = (event: L.LeafletMouseEvent) => {

                toolTip();
                //console.log("mousemove:", event.latlng.lat, event.latlng.lng);
                function toolTip() {
                   
                // eslint-disable-next-line react-hooks/refs -- Tooltip cleanup runs in a Leaflet mouse event.
                removeAllTooltips()
                    
                let unit = "";
                let number: any = "";
                // eslint-disable-next-line react-hooks/refs -- Leaflet invokes this mouse handler after render.
                if(Number.isNaN(curGridCellFeature.current)) {
                    number = "NA";
                    unit = "";
                }
                else{

                  
                    number = Math.round(Number(curGridCellFeature.current));
                    if(metaData[selectedFeature] != undefined) {
                        unit = metaData[selectedFeature].dimension;
                    }
                        if(metaData[selectedFeature]?.description.includes("precipitation") || metaData[selectedFeature]?.description.includes("Niederschlag")) {
                            number = Math.round(Number(curGridCellFeature.current)*1000);
                            unit = "mm";
                        }
        
                        // round percentage values
                        if(unit === "%") {
                            number = Math.round(Number(curGridCellFeature.current)*100);
                        }
        
                        // convert Kelvin to Celsius
                        if (unit === "K") {
                            number = Math.round(Number(curGridCellFeature.current) - 273.15);
                            unit = "°C";
                        }
                    }
                    
                   
               
                    toolTipRef.current.setLatLng(event.latlng);
                    toolTipRef.current
                        .setContent(`
                            <div id=${"toolTip"+chart} class="p-2 size-full rounded-lg bg-linear-to-br from-indigo-500 to-indigo-800 text-white font-sans shadow-lg">
                                <h1 class="m-0 text-xl font-bold text-shadow">
                                    ${number} ${unit}
                                </h1>
                                <hr class="border-none border-t border-white/50 my-2">
                                <p class="m-0">
                                    <b>Country:</b> ${hoverCountry.current }
                                </p>
                                <p class="m-0">
                                    <b>LatLng:</b> ${curGridCell.current[0].toFixed(3)}, ${curGridCell.current[1].toFixed(3)}
                                </p>
                            </div>
                        `);
                    if (map && isMouseInsideRef.current) {
                        map.openTooltip(toolTipRef.current);
                    }
                }
               if (isLoading_MosquitoData) return;
                              const gridCellDims = {
                                  // eslint-disable-next-line react-hooks/refs -- Leaflet invokes this mouse handler after render.
                                  lat: gridcellSizeLatLng.current.lat,
                                  lng: gridcellSizeLatLng.current.lng,
                              };
                              if (
                                  !Number.isFinite(gridCellDims.lat) || gridCellDims.lat <= 0 ||
                                  !Number.isFinite(gridCellDims.lng) || gridCellDims.lng <= 0 ||
                                  !Number.isFinite(event.latlng.lat) || !Number.isFinite(event.latlng.lng)
                              ) return;
                              let mapVal = visData.entries().next();
                              if (!mapVal || mapVal.done) return; // Ensure visData is not empty
              
                              const [, firstVisData] = mapVal.value;
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
                              curGridCell.current = [gridLat, gridLng];
                             
                              let curGridCoords = {lat: gridLat, lng: gridLng};
                              // eslint-disable-next-line react-hooks/refs -- Leaflet invokes this mouse handler after render.
                              curGridCellID.current = getGridCellIndex(curGridCoords, gridCellDims)-1;
                              curGridCellFeature.current = NaN; // Use NaN to indicate an invalid or uninitialized state
                   
                              // get gridCell Data
                              let curGridCellDat = visData.get(curGridCellID.current)
                              curGridCellFeature.current = curGridCellDat?.feature ?? NaN;
             
                // Compute the bottom-right corner of the grid cell
                const gridLatBottom = gridLat +  gridcellSizeLatLng.current.lat;
                const gridLngRight = gridLng +  gridcellSizeLatLng.current.lng;
            
                // Convert grid coordinates to layer points for correct placement
                const topLeft = map.latLngToLayerPoint([gridLat , gridLng]);
                const bottomRight = map.latLngToLayerPoint([gridLatBottom , gridLngRight]);
            
                // Compute width and height in pixels
                const width = Math.abs(bottomRight.x - topLeft.x);
                const height =  Math.abs(bottomRight.y - topLeft.y);
            
                // Select the SVG layer inside the map container
                const svg = d3.select(map.getContainer()).select("svg");
            
                // Remove previous grid cell highlight
               
            
                // Draw the highlighted grid cell
               
                svg.selectAll("rect").remove();
                svg.append("rect")
                    .attr("x", topLeft.x)
                    .attr("y", topLeft.y)
                    .attr("width", width)
                    .attr("height", height)
                    .attr("fill", "red")
                    .attr("opacity", 0.5)
                    .attr("stroke", "black")
                    .attr("stroke-width", 1);

                let textFields = d3.selectAll(".grid-cell-text");
                if (textFields.size() > 30) {
                    textFields.remove();
                }
                // Draw the grid cell text
                if(debug) {
                svg.append("text")
                    .attr("class", "grid-cell-text")
                    .attr("x", topLeft.x + width / 2)
                    .attr("y", topLeft.y + width / 2)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .attr("fill", "white")
                    .attr("font-size", "12px")
                    .text(  curGridCellID.current);
                }
                  
            
                // Remove previous mouse position circle
                svg.selectAll("circle").remove();
            
                // Draw a circle at the mouse position
                svg.append("circle")
                    .attr("cx", topLeft.x)
                    .attr("cy", topLeft.y)
                    .attr("r", 5) // Adjust radius as needed
                    .attr("fill", "blue");
            };

            const handleMouseClick = () => {


                // Handle click event here
                c.setSelectedGridcellID( curGridCellID.current);
                c.setCurFeatureValue(Number.isNaN(curGridCellFeature.current) ? "NA" : curGridCellFeature.current.toString());

                

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
                }
              
    
          
              
            
            };
            

                
            map.on("click", handleMouseClick);
            map.on("moveend", handleMouseEvent);
            map.on("zoomend", handleMouseEvent);
            map.on("mousemove", handleMouseMove);

            // Cleanup function to remove event listeners when component unmounts
            return () => {
                map.off("moveend", handleMouseEvent);
                map.off("zoomend", handleMouseEvent);
                map.off("mousemove", handleMouseMove);
                map.off("click", handleMouseClick);
            };
        }
    }, [isUpdate, visData] ); 
    return null;
}

const removeAllTooltips = useCallback(() => removeReusedTooltip(map, L, toolTipRef), [map, L]);

// ─── Shared hook: hide tooltip when cursor leaves the map container ───
const { isMouseInsideRef } = useTooltipCleanup({ map, L, toolTipRef });

// ─── Shared hook: screen distance calculation (replaces nested MapDistanceProvider) ───
useMapDistance({
    map,
    longitude,
    latitude,
    zoom,
    dimensions,
    screenDistanceOneKMRef: screenDistanceOneKM,
    projectionFactory: d3.geoEquirectangular,
    extraDeps: [isUpdate],
});

let curSelectedStateID = React.useRef(dataTableContext.selectedStateID);
    useEffect(() => {
        curSelectedStateID.current = dataTableContext.selectedStateID;
    }, [dataTableContext.selectedStateID]);


// ─── Component-specific hooks (nested functions converted to module-level below) ───
// Note: useMapPosition, useMapResize, useMapDistance are now called above via shared hooks.
// DrawMapPolygons, ColorMapBySelection, MapTransition, MapMouseEvents remain as
// component-level hooks (converted from nested functions to useEffect calls below).
DrawMapPolygons();
ColorMapBySelection();
// MapTransition is now handled by useMapTransition() hook above
MapMouseEvents();
  


    function ColorMapBySelection() {
        useEffect(() => {
            if (!map || !L || isLoading_mapData || !mapData || isLoading_MosquitoData || !mosquitoData.response) return;

            map.eachLayer((layer) => {
                if (layer instanceof L.GeoJSON) {
                    (layer as L.GeoJSON).eachLayer((subLayer) => {
                        if (subLayer instanceof L.Path) {
                            const feature = (subLayer as any).feature;
                            const country = feature && 'properties' in feature ? feature.properties?.name || "" : "";
                            const id = stateMappersGermany.Map__State_to_ID(country);
                            const curVal = getFeatureValForState(country);
                            //console.log("coloring...:", curSelectedStateID.current + "==", id);
                           
                                if (curSelectedStateID.current == id) {
                                    (subLayer as L.Path).setStyle({
                                        fillColor: colorMap(curVal),
                                        color: "rgb(255, 179, 0)",
                                        weight: 4,
                                        fillOpacity: 1.0,
                               
                                      
                                        // Use renderer options to draw border inside (Leaflet doesn't natively support inner stroke, but you can simulate by reducing fill area if using SVG)
                                    });
                                    (subLayer as L.Path).bringToFront();
                                }else {
                                    (subLayer as L.Path).setStyle({
                                        fillColor: colorMap(curVal),
                                        color: "#000000",
                                        weight: 1,
                                        fillOpacity: layerOpacity,
                                    });
                                }
                            
                        }
                    });
                }
            });
        }
        , [mapData, isLoading_mapData, map, mosquitoData, curColorMapType, c.selectedStateID, layerOpacity]);
    }


    // longitude
    const handleInputSlider_lng = (event: React.ChangeEvent<HTMLInputElement>) => {
        updateCoordinates(latitude, Number(event.target.value), zoom);
    };
    // latitude
    const handleInputSlider_lat = (event: React.ChangeEvent<HTMLInputElement>) => {
        updateCoordinates( Number(event.target.value), longitude, zoom);
    };

    const handleInputSlider_zoom = (event: React.ChangeEvent<HTMLInputElement>) => {
        updateCoordinates(latitude, longitude, Number(event.target.value));
    };

     const handleLayerOpacityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = Math.max(0, Math.min(1, Number(event.target.value)));
        curMouseEvent.current = "opacity";
        setLayerOpacity(value);
        contextT.setCurLayerOpacity(value);
        if (contextT.curLayerOpacity !== layerOpacity) {
            setLayerOpacity(value);
        }
    };

  
    const [minVal, maxVal] = useMemo(() => {
        if(isLoading_MosquitoData || mosquitoData.error != null || !mosquitoData.response) {
            return [0, 1];
        } 
        else{

         return getMinMaxFeature(mosquitoData.response);
        }
    }, [mosquitoData,isLoading_MosquitoData]);


    let colorMap = d3.scaleSequential(availableColorMaps[curColorMapType as keyof typeof availableColorMaps]);
    colorMap.domain([minVal, maxVal]);
    if (curColorMapType === "interpolateRdBu") {
        colorMap.domain([maxVal, minVal ]);
    } 
   
    

    useEffect(() => {
            //console.log("Zoom:", zoom, screenDistanceOneKM);
        // avoid multiple calls
        resetTimeout(mapTime);
        mapTime.current = setTimeout(() => {
            console.log("DrawLayer");
        }, 200);
    }, [latitude, longitude, zoom, mapData, mosquitoData, dimensions, selectedFeature, screenDistanceOneKM]);
   
    

// resetTimeout is now imported from utils/mapUtils

 
    useEffect(() => {
        if (!localSelectedFeature && inferredFeature) {
            if (contextT.curFeature !== inferredFeature) contextT.setCurFeature(inferredFeature);
            if (contextT.curDatasetURL !== selectedDataset) contextT.setCurDatasetURL(selectedDataset);
        }
    }, [localSelectedFeature, inferredFeature, selectedDataset, contextT]);

    const roundTo = 1;
    const  rounder = Math.pow(10, roundTo);

    function UI_elementStyler() {
        return { className: `text-sm m-1 p-1 border row-span-2 col-span-6 bg-white/75 z-10 rounded-lg shadow-md pointer-events-auto`};
   }

   // the page
    return (

<div className="@container relative size-full" >
    <CardHeaderAction>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t(isSettingsOpen ? 'hideMapControls' : 'showMapControls')}
        title={t(isSettingsOpen ? 'hideMapControls' : 'showMapControls')}
        onClick={() => setIsSettingsOpen((open) => !open)}
        className="h-8 w-8 text-white hover:text-slate-900 focus-visible:ring-white"
      >
        <Settings className="h-5 w-5" aria-hidden="true" />
      </Button>
    </CardHeaderAction>

    <PrintDataLoadingErrors listOfErrors={collectDataLoadingErrors}/>
    <SizeHook element={element} sizeRef={sizeRef} setSize={setSizes}/>
    {isSettingsOpen && (
    <div className={`absolute w-full mt-2 ml-1 pr-2 grid grid-cols-12 md:grid-cols-12 pointer-events-none z-30`}>
    
     {mapUIsettings.isLatitudeSlider && (
         <div {...UI_elementStyler()}>
        {t.rich('latitude', {...t_richConfig})}: {Math.round(latitude*rounder)/rounder}
            <input
                type="range"
                value={latitude}
                onChange={handleInputSlider_lat}
                min={-RANGE_LAT}
                max={RANGE_LAT}
                className="w-full"
            />
        </div>
     )}
      {mapUIsettings.isLongitudeSlider && (
        <div {...UI_elementStyler()}>
        {t.rich('longitude', {...t_richConfig})}: { Math.round(longitude*rounder)/rounder}
            <input
                type="range"
                value={longitude}
                onChange={handleInputSlider_lng}
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
                onChange={handleInputSlider_zoom}
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
        <Select defaultValue={Object.keys(listOfDataSets)[0]} onValueChange={(value) => { 
            const dataset = listOfDataSets[value];
            curDatasetname.current = dataset;
            let url = apiRoutes.fetchDbData({ relationName: dataset, feature: props.mapUIsettings.defaultFeatureName || "" })

            setSelectedDataset(url);
            contextT.setCurDatasetURL(url);

            
            contextT.setCurFeature("");
            setSelectedFeature("");
            }
                        } >
            <SelectTrigger className="w-full">
            <SelectValue placeholder={Object.keys(listOfDataSets)[0]} />
            </SelectTrigger>
            <SelectContent>
            <SelectGroup>
                <SelectLabel></SelectLabel>
                    {Object.keys(listOfDataSets).map((key: string, index: number) => (
                        <SelectItem key={index} value={key}> {key}
                            </SelectItem>
                    ))}
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
            let url = apiRoutes.fetchDbData({
                relationName: curDatasetname.current,
                feature: value,
                targetDate: dataTableContext.targetDate
            });
            //console.log("setCurFeatureName:", value);
            //console.log("setCurDatasetName:",url);
            setSelectedDataset(url);
            contextT.setCurDatasetURL(url);

            setSelectedFeature(value);
            contextT.setCurFeature(value);
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
                    {colNames.map((_, index) => {
                        const isAvailable = (metaData[colNames[index] as keyof typeof metaData]?.availability === "1" ||  metaData[colNames[index] as keyof typeof metaData]?.availability === undefined) && colNames[index] !== "id";
                        if (isAvailable) {
                            return (
                                <SelectItem key={index} value={colNames[index]}>
                                    <b>{colNames[index]+" ["+metaData[colNames[index] as keyof typeof metaData]?.dimension+"]"}</b>
                                    <i>{" "+metaData[colNames[index] as keyof typeof metaData]?.description}</i>
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
    {mapUIsettings.isDatePicker && (
        <div {...UI_elementStyler()}>
        <span className="mb-1 flex items-center justify-between">
             {t.rich('time_range', {...t_richConfig})}:
            <span className="ml-2"><HoverCardTooltip MDXContent={MDX.CalendarTargetDate} /></span>
        </span>
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal border-3 border-purple-800 focus-visible:ring-3 focus-visible:ring-purple-800 truncate px-4 rounded text-sm whitespace-nowrap overflow-hidden text-ellipsis mt-1"
                >
                    <CalendarIcon className="mr-1.5 w-4 h-4 shrink-0" />
                    {selectedTargetDate ? format(selectedTargetDate, "PP") : <span>{isAggregating ? "Calculating..." : t.rich('select_time_span', {...t_richConfig})}</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={selectedTargetDate}
                    onSelect={async (date) => {
                        if (!date) return;
                        const formattedDate = format(date, "yyyy-MM-dd");
                        setIsAggregating(true);
                        L_aggregationLoading.start();
                        try {
                            await aggregateRKI({ targetDate: formattedDate });
                            clearDataCache();
                            setSelectedTargetDate(date);
                            contextT.setTargetDate(formattedDate);

                            const baseUrl = apiRoutes.fetchDbData({
                                relationName: curDatasetname.current || "aktuell_deutschland_sarscov2_infektionen_aggregated",
                                feature: selectedFeature || "accudeaths",
                                targetDate: formattedDate
                            });
                            setSelectedDataset(baseUrl);
                            contextT.setCurDatasetURL(baseUrl);
                        } catch (err) {
                            console.error("Error aggregating data for targetDate:", err);
                        } finally {
                            setIsAggregating(false);
                            L_aggregationLoading.stop();
                        }
                    }}
                    defaultMonth={selectedTargetDate || endMonth}
                    captionLayout="dropdown"
                    numberOfMonths={1}
                    startMonth={startMonth}
                    endMonth={endMonth}
                    disabled={disabledMatcher}
                    modifiers={{
                        weekLookback: weekLookbackRange ? [weekLookbackRange] : []
                    }}
                    modifiersClassNames={{
                        weekLookback: "bg-purple-200 text-purple-950 font-semibold dark:bg-purple-800 dark:text-purple-100"
                    }}
                    classNames={{
                        disabled: "opacity-35 line-through text-slate-400 bg-slate-100/60 dark:bg-slate-900/60 cursor-not-allowed pointer-events-none"
                    }}
                />
            </PopoverContent>
        </Popover>
        </div>
    )}

    {mapUIsettings.isColorMapSelectionDropdown && ischanged && (
        <div {...UI_elementStyler()}>
            <span className="mb-1 flex items-center justify-between">
                {t.rich('color_map', {...t_richConfig})}:
                <span className="ml-2"><HoverCardTooltip MDXContent={MDX.ColorMap} /></span>
            </span>
            <Select onValueChange={(value) => {
                setColorMapType(value);
                contextT.setCurColorMap(value);
            }} defaultValue={defaultColorMap}>
                <SelectTrigger className="w-full mt-1">
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
        {t.rich("opacity",{...t_richConfig})}: {layerOpacity}
         <input
            type="range"
            value={layerOpacity}
            onChange={handleLayerOpacityChange}
            step={0.01}
            min={0.0}
            max={1.0}
            className="w-full"
        />
    </div>)}
    </div> // grid close
    )}
   
    
    <LoadingSpinnerAnimation />
    <div ref={divRef} className='flex justify-center items-center size-full'>
    <svg id={chart} className=' w-full h-full'></svg>
   
    <LeafletMapComponent chartProps={leafProps}>
     <MapContentChild
         variant="germany"
         mapRef={mapRef}
         toolTipRef={toolTipRef}
         L={L}
         isDistanceLegend={mapUIsettings.isDistanceLegend}
     />
    </LeafletMapComponent>
    {/* Declarative color map legend (replaces imperative appendColorMap) */}
    {mapUIsettings.isColorMapLegend && !isLoading_MosquitoData && mosquitoData.error === null && (
        <div
            style={{
                position: "absolute",
                right: legendDistanceToMapBorderX,
                bottom: legendDistanceToMapBorderY,
                pointerEvents: "none",
                zIndex: 50,
            }}
        >
            <ColorMapLegend
                chartId={chart}
                colorMapType={curColorMapType}
                minVal={minVal}
                maxVal={maxVal}
                selectedFeature={selectedFeature}
                metaData={metaData}
                layerOpacity={layerOpacity}
                locale={locale}
                height={colMapDims.height}
                barWidth={barWidth}
                isVisible={mapUIsettings.isColorMapLegend}
            />
        </div>
    )}
    </div>
</div>
    );
};

/**
 * Wraps the supported Germany COVID-19 Leaflet map in a loading-task provider.
 *
 * @param props - Germany map configuration created by {@link LeafD3MapGermanyProps}.
 * @returns The map with card-scoped asynchronous loading feedback.
 *
 * @example
 * ```tsx
 * import GermanyCovidMap, { LeafD3MapGermanyProps } from "@/components/plots/maps/LeafD3MapGermanyCovid";
 * import { InterfaceContextProvider } from "@/components/contexts/InterfaceContext";
 * const mapProps = LeafD3MapGermanyProps("covid-states");
 * <InterfaceContextProvider><GermanyCovidMap props={mapProps} /></InterfaceContextProvider>;
 * ```
 */
const LeafD3MapGermanyComponent = ({props}: {props: LeafD3MapGermanyProps}) => {
    return (
        <LoadingSpinnerProvider>
            <LeafD3MapGermanyComponentInner props={props} />
        </LoadingSpinnerProvider>
    );
};

/** Default export for the supported Germany COVID-19 Leaflet/D3 map. */
export default LeafD3MapGermanyComponent;
