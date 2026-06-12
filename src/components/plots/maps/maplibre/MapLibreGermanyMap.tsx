/**
 * MapLibreGermanyMap – MapLibre GL JS port of LeafD3MapGermanyCovid.
 *
 * Replaces Leaflet MapContainer + L.geoJSON + Canvas grid overlay with:
 * - MapLibre GL JS map instance (WebGL-rendered)
 * - MapLibre `fill` + `line` layers for Germany state polygons
 * - MapLibre `fill` layer for grid data (via useMapLibreGridLayer)
 * - React Portal tooltip (via useMapLibreTooltip)
 *
 * Preserves the existing UI controls (sliders, selects, etc.) and
 * InterfaceContext state synchronization.
 */
'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    LoadingSpinner,
    getMinMaxFeature,
    getGridCellIndex,
    getGridOffset,
    snapToGrid,
    roundLatLng,
} from '../helpers';
import { metaDataT } from '../../MetaDataHandler';
import { availableColorMaps, availableColorMapsNames } from '../constants';
import * as d3 from 'd3';
import { useInterfaceContext } from '@/components/contexts/InterfaceContext';
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
import { useLocale, useTranslations } from "next-intl";
import { t_richConfig, dbDATA } from '@/app/const_store';
import { Locale } from '@/i18n/routing';
import useChartResizer from '@/app/hooks/useChartResizer';
import stateMappersGermany from '@/app/helpers';
import { Settings } from 'iconoir-react';
import ColorMapLegend from '../overlays/ColorMapLegend';
import MapLibreBase from './MapLibreBase';
import type { Map as MapLibreMap, GeoJSONSource, MapMouseEvent, MapLayerMouseEvent } from 'maplibre-gl';

// ─── MapLibre hooks ───
import {
    useMapLibrePosition,
    useMapLibreResize,
    useMapLibreDistance,
    useMapLibreGridLayer,
    useMapLibreTooltip,
    useGridDataParser,
    useLayerUpdateDebounce,
} from './hooks';
import { clampCoordinates, resetTimeout, getParamsOfURL } from '../utils/mapUtils';
import { RANGE_LAT, RANGE_LONG, MAX_ZOOM, MIN_ZOOM, ZOOM_STEP, CALCER } from '../constants';

const duration_mapTransition = 1800;
const legendDistanceToMapBorderX = 5;
const legendDistanceToMapBorderY = 15;
const defaultColorMap = availableColorMapsNames.interpolateViridis;

// ─── Layer IDs ───
const STATES_SOURCE_ID = 'germany-states-source';
const STATES_FILL_LAYER_ID = 'germany-states-fill';
const STATES_LINE_LAYER_ID = 'germany-states-line';

/**
 * Props for the MapLibre Germany Map component.
 * Same interface as LeafD3MapGermanyProps for drop-in compatibility.
 */
export interface MapLibreGermanyMapProps {
    chartName: string;
    mapDataURL: any;
    dataURL: any;
    center: [number, number]; // [lng, lat] for MapLibre (note: Leaflet used [lat, lng])
    zoom: number;
    mapUIsettings: {
        isLongitudeSlider: boolean;
        isLatitudeSlider: boolean;
        isZoomSlider: boolean;
        isColorMapSelectionDropdown: boolean;
        isFeatureSelectionDropdown: boolean;
        isDatasetSelectionDropdown: boolean;
        isDistanceLegend: boolean;
        isColorMapLegend: boolean;
    };
    isApplySelectionsTransition: boolean;
    isStaticAutoFitFullSize: boolean;
    isProjection_equirectangular?: boolean;
}

export function MapLibreGermanyMapProps(
    chartName = "D3mapLayer",
    mapDataURL = apiRoutes.FETCH_MAP_DATA.GERMANY_MAP_STATES,
    dataURL?: string,
    mapUIsettings: any = {},
    center: [number, number] = [9.7, 52],
    zoom = 2,
    mapBaseColor?: any,
    isStaticAutoFitFullSize = false,
    isApplySelectionsAndTransitions = false,
    isProjection_equirectangular = false
): MapLibreGermanyMapProps {
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
            ...mapUIsettings,
        },
        isStaticAutoFitFullSize,
        isApplySelectionsTransition: isApplySelectionsAndTransitions,
        isProjection_equirectangular,
    };
}


const MapLibreGermanyMap = ({ props }: { props: MapLibreGermanyMapProps }) => {

    const c = useInterfaceContext();
    const contextT = useInterfaceContext();

    const URLparams = useMemo(() => getParamsOfURL(props.dataURL), [props.dataURL]);

    const t = useTranslations("component_D3MapLayerComponent");
    const locale = useLocale() as Locale;

    const chart = props.chartName;
    const mapUIsettings = { ...props.mapUIsettings };
    let collectDataLoadingErrors: React.ReactNode[] = [];

    // *** useState *** //
    // NOTE: Leaflet used [lat, lng] order for center. MapLibre uses [lng, lat].
    // The props still come in as [lng, lat] from the original interface.
    const [[latitude, longitude, zoom], setCoordinates] = useState<[number, number, number]>(
        [props.center?.[0] ?? 0, props.center?.[1] ?? 0, props.zoom ?? 1]
    );
    const [isUpdate, setisUpdate] = useState(false);
    const [isMouseEvent, setIsMouseEvent] = useState(false);
    const curMouseEvent = useRef<string>("null");
    const screenDistanceOneKM = useRef<number>(0);
    const [selectedDataset, setSelectedDataset] = useState<string>("");
    const [curColorMapType, setColorMapType] = useState<string>(defaultColorMap);
    const [layerOpacity, setLayerOpacity] = useState(1.0);
    const [visData, setVisData] = useState<Map<number, any>>(new Map());
    const [selectedFeature, setSelectedFeature] = useState<string>("");
    const curDatasetname = useRef<string>("");
    const curPropertyNames = useRef<string>("");
    const curGridCell = useRef<[number, number]>([0, 0]);
    const curGridCellFeature = useRef<number>(0);
    const curGridCellID = useRef<number>(0);
    const hoverCountry = useRef<string>("0");
    const UIcntRef = useRef<number>(0);
    const isHoverCountry = useRef<boolean>(false);
    const gridcellSizeLatLng = useRef<{ lng: number; lat: number }>({ lng: 0, lat: 0 });
    const [isSettingsOpen, setIsSettingsOpen] = useState(true);
    const hoveredFeatureId = useRef<number | null>(null);

    // ─── MapLibre map ref ───
    const mapRef = useRef<MapLibreMap | null>(null);
    const [mapReady, setMapReady] = useState(false);

    // ─── Data loading ───
    const [isLoading_mapData, rawMapData] = useGetJSONData(props.mapDataURL);
    const [isLoading_MosquitoData, rawMosquitoData] = useGetJSONData(selectedDataset);
    const [isLoadingDatalist, dataList] = useGetJSONData(apiRoutes.GET_LIST_OF_DATASETS);
    const [isLoading_Metadata, rawMetaData] = useGetJSONData(apiRoutes.getDatasetsMetadata({ LANGID: locale }));

    type dataListT = { [key: string]: string };
    type MosquitoDataRowT = { geometry: string; feature: string };

    const metaData = rawMetaData as unknown as metaDataT;
    let dataTableContext = useInterfaceContext();

    let listOfDataSets = dataList as unknown as dataListT;
    const sortedKeys = Object.keys(listOfDataSets).sort();
    listOfDataSets = sortedKeys.reduce((acc, key) => {
        acc[key] = listOfDataSets[key];
        return acc;
    }, {} as dataListT);

    if (!isLoadingDatalist && selectedDataset === "") {
        curDatasetname.current = URLparams["relationName"];
        setSelectedDataset(props.dataURL);
    }

    let mosquitoData = rawMosquitoData as unknown as dbDATA;
    collectDataLoadingErrors.push(handleLoadDataError(isLoading_mapData, rawMapData as unknown as dbDATA));
    collectDataLoadingErrors.push(handleLoadDataError(isLoading_MosquitoData, rawMosquitoData as unknown as dbDATA));
    collectDataLoadingErrors.push(handleLoadDataError(isLoadingDatalist, dataList as unknown as dbDATA));
    collectDataLoadingErrors.push(handleLoadDataError(isLoading_Metadata, rawMetaData as unknown as dbDATA));
    const mapData = rawMapData as unknown as any;

    // ─── Context sync ───
    useEffect(() => {
        if (props.isApplySelectionsTransition) {
            isLoadingSpinner.current = true;
            if (curColorMapType !== contextT.curColorMap) {
                setColorMapType(contextT.curColorMap);
            }
            if (curDatasetname.current !== contextT.curDatasetURL && contextT.curDatasetURL !== "") {
                setSelectedDataset(contextT.curDatasetURL);
            }
            if (layerOpacity !== contextT.curLayerOpacity) {
                setTimeout(() => { setLayerOpacity(contextT.curLayerOpacity); }, 50);
            }
            setSelectedFeature(contextT.curFeature);
        }
    }, [contextT.curColorMap, contextT.curDatasetURL, contextT.curLayerOpacity, contextT.curFeature]);

    // ─── Column names ───
    const colNames = useMemo(() => {
        if (mosquitoData.response !== undefined && !isLoading_MosquitoData && mosquitoData.error === null) {
            return mosquitoData.header.filter((name: string) => name !== "id");
        }
        return [] as string[];
    }, [isLoading_MosquitoData, mosquitoData]);

    // ─── Refs ───
    const divRef = useRef<HTMLDivElement | null>(null);
    const ischanged = useRef(false);
    let time = useRef<ReturnType<typeof setTimeout> | null>(null);
    let mapTime = useRef<ReturnType<typeof setTimeout> | null>(null);
    let isLoadingSpinner = useRef(false);

    // ─── Grid data parsing (unchanged from Leaflet version) ───
    const { gridData: parsedGridData, parseErrors } = useGridDataParser({
        isLoading: isLoading_MosquitoData,
        rawData: mosquitoData,
        gridcellSizeRef: gridcellSizeLatLng,
    });

    useMemo(() => {
        if (parsedGridData.size > 0) {
            setVisData(parsedGridData);
        }
        if (parseErrors.length > 0) {
            parseErrors.forEach(e => collectDataLoadingErrors.push(<div>{e}</div>));
        }
    }, [parsedGridData, parseErrors]);

    // ─── Functions ───
    function updateCoordinates(latitude: number, longitude: number, zoom: number) {
        const [clampedLat, clampedLng, clampedZoom] = clampCoordinates(latitude, longitude, zoom);
        setCoordinates([clampedLat, clampedLng, clampedZoom]);
    }

    // ─── Chart resizer ───
    let { dimensions, setSizes, element, sizeRef } = useChartResizer(props.chartName);
    dimensions = dimensions || { width: 0, height: 0 };

    // ─── Map instance getter ───
    const map = mapRef.current;

    // ─── MapLibre hooks ───
    useMapLibrePosition({ map, latitude, longitude, zoom });
    useMapLibreResize({ map, dimensions });
    useMapLibreDistance({
        map,
        longitude,
        latitude,
        zoom,
        dimensions,
        screenDistanceOneKMRef: screenDistanceOneKM,
        extraDeps: [isUpdate],
    });

    // ─── Tooltip ───
    const { showTooltip, hideTooltip, isMouseInsideRef } = useMapLibreTooltip({ map });

    // ─── Debounced layer update ───
    useLayerUpdateDebounce({
        curMouseEventRef: curMouseEvent,
        timerRef: time,
        isLoadingSpinnerRef: isLoadingSpinner,
        setIsUpdate: setisUpdate,
        onDebounceComplete: () => {
            if (map && props.isStaticAutoFitFullSize && mapData && !mapData.error && mapData.type) {
                // Compute bounds from GeoJSON
                const coords: [number, number][] = [];
                const extractCoords = (geometry: any) => {
                    if (geometry.type === 'Polygon') {
                        geometry.coordinates[0].forEach((c: number[]) => coords.push([c[0], c[1]]));
                    } else if (geometry.type === 'MultiPolygon') {
                        geometry.coordinates.forEach((p: number[][][]) =>
                            p[0].forEach((c: number[]) => coords.push([c[0], c[1]]))
                        );
                    }
                };
                mapData.features?.forEach((f: any) => extractCoords(f.geometry));
                if (coords.length > 0) {
                    const lngs = coords.map(c => c[0]);
                    const lats = coords.map(c => c[1]);
                    map.fitBounds(
                        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
                        { padding: 20 }
                    );
                }
            }
        },
        deps: [latitude, longitude, zoom, isMouseEvent, rawMosquitoData, curColorMapType, layerOpacity, dimensions],
    });

    // ─── Color map ───
    const [minVal, maxVal] = useMemo(() => {
        if (isLoading_MosquitoData || mosquitoData.error != null || !mosquitoData.response) {
            return [0, 1];
        }
        return getMinMaxFeature(mosquitoData.response);
    }, [mosquitoData, isLoading_MosquitoData]);

    let colorMap = d3.scaleSequential(availableColorMaps[curColorMapType as keyof typeof availableColorMaps]);
    colorMap.domain([minVal, maxVal]);
    if (curColorMapType === "interpolateRdBu") {
        colorMap.domain([maxVal, minVal]);
    }

    // ─── Grid layer (WebGL fill — replaces Canvas 2D → imageOverlay) ───
    useMapLibreGridLayer({
        map,
        isUpdate,
        isLoading: isLoading_MosquitoData,
        hasError: mosquitoData.error != null,
        gridData: visData,
        dimensions,
        colorMap,
        layerOpacity,
        transitionDuration: 0,
        debug: false,
    });

    // ══════════════════════════════════════════════════════════════
    // GERMANY STATE POLYGONS — MapLibre fill + line layers
    // Replaces L.geoJSON(mapData, { style, onEachFeature })
    // ══════════════════════════════════════════════════════════════
    useEffect(() => {
        if (!map || !mapReady || isLoading_mapData || isLoading_MosquitoData || !mosquitoData.response) return;
        if (!mapData || mapData.error || !mapData.type) return;

        // Assign numeric IDs to each feature for feature-state support
        const dataWithIds = {
            ...mapData,
            features: mapData.features.map((f: any, i: number) => ({
                ...f,
                id: i,
            })),
        };

        // Add or update source
        const existingSource = map.getSource(STATES_SOURCE_ID) as GeoJSONSource | undefined;
        if (existingSource) {
            existingSource.setData(dataWithIds);
        } else {
            map.addSource(STATES_SOURCE_ID, {
                type: 'geojson',
                data: dataWithIds,
            });
        }

        // ─── Fill layer (choropleth) ───
        if (!map.getLayer(STATES_FILL_LAYER_ID)) {
            map.addLayer({
                id: STATES_FILL_LAYER_ID,
                type: 'fill',
                source: STATES_SOURCE_ID,
                paint: {
                    'fill-opacity': layerOpacity,
                    // Default fill — will be overridden per-feature below
                    'fill-color': '#cccccc',
                },
            });
        }

        // ─── Line layer (borders) ───
        if (!map.getLayer(STATES_LINE_LAYER_ID)) {
            map.addLayer({
                id: STATES_LINE_LAYER_ID,
                type: 'line',
                source: STATES_SOURCE_ID,
                paint: {
                    'line-color': [
                        'case',
                        ['boolean', ['feature-state', 'selected'], false],
                        'rgb(255, 179, 0)', // selected border
                        ['boolean', ['feature-state', 'hover'], false],
                        '#333333', // hover border
                        '#000000',  // default border
                    ],
                    'line-width': [
                        'case',
                        ['boolean', ['feature-state', 'selected'], false],
                        4,
                        1,
                    ],
                },
            });
        }

        // Apply choropleth colors via feature-state-based paint OR direct update
        // Since each state has its own data-driven color (not from the GeoJSON properties),
        // we use a match expression built from the mosquitoData
        const colorStops: any[] = [];
        dataWithIds.features.forEach((feature: any, index: number) => {
            const country = feature.properties?.name || "";
            const id = stateMappersGermany.Map__State_to_ID(country);
            const idd = stateMappersGermany.mapper__MapTable__ID_to_ID(id);
            const curKey = Object.keys(mosquitoData.response)[idd - 1];
            const curVal = mosquitoData.response[curKey]?.feature;
            const color = colorMap(curVal) || '#cccccc';
            colorStops.push(index, color);
        });

        if (colorStops.length > 0) {
            map.setPaintProperty(STATES_FILL_LAYER_ID, 'fill-color', [
                'match',
                ['id'],
                ...colorStops,
                '#cccccc', // fallback
            ]);
        }

        map.setPaintProperty(STATES_FILL_LAYER_ID, 'fill-opacity', [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            1.0,
            ['boolean', ['feature-state', 'hover'], false],
            0.5,
            layerOpacity,
        ]);

    }, [mapData, isLoading_mapData, mapReady, mosquitoData, curColorMapType, selectedFeature, layerOpacity]);

    // ══════════════════════════════════════════════════════════════
    // SELECTED STATE HIGHLIGHT via feature-state
    // Replaces L.Path.setStyle() in ColorMapBySelection()
    // ══════════════════════════════════════════════════════════════
    const curSelectedStateID = useRef(dataTableContext.selectedStateID);
    useEffect(() => {
        curSelectedStateID.current = dataTableContext.selectedStateID;

        if (!map || !mapReady || !mapData?.features) return;

        // Clear all selected states
        mapData.features.forEach((_: any, i: number) => {
            map.setFeatureState(
                { source: STATES_SOURCE_ID, id: i },
                { selected: false }
            );
        });

        // Set the selected state
        const selectedFeatureIdx = mapData.features.findIndex((f: any) => {
            const country = f.properties?.name || "";
            const id = stateMappersGermany.Map__State_to_ID(country);
            return id === dataTableContext.selectedStateID;
        });

        if (selectedFeatureIdx >= 0) {
            map.setFeatureState(
                { source: STATES_SOURCE_ID, id: selectedFeatureIdx },
                { selected: true }
            );
        }
    }, [dataTableContext.selectedStateID, mapReady, mapData]);

    // ══════════════════════════════════════════════════════════════
    // MOUSE EVENTS — hover, click, grid cell detection
    // Replaces MapMouseEvents() with map.on('click'|'mousemove')
    // ══════════════════════════════════════════════════════════════
    useEffect(() => {
        if (!map || !mapReady || isLoading_MosquitoData) return;

        // ─── Viewport sync: moveend → update React state ───
        const handleMoveEnd = () => {
            if (props.isStaticAutoFitFullSize) return;
            const center = map.getCenter();
            const curZoom = map.getZoom();
            const lat = Math.round(center.lat * CALCER) / CALCER;
            const lng = Math.round(center.lng * CALCER) / CALCER;
            const z = Math.round(curZoom * 100) / 100;
            if (lng !== longitude || lat !== latitude || z !== zoom) {
                updateCoordinates(lat, lng, z);
            }
        };

        // ─── State polygon click ───
        const handleStateClick = (e: MapLayerMouseEvent) => {
            if (!e.features || e.features.length === 0) return;
            const feature = e.features[0];
            const country = feature.properties?.name || "";
            contextT.setMapSelectionObj(feature as any);
            curPropertyNames.current = country;
            const id = stateMappersGermany.Map__State_to_ID(country);
            c.setSelectedStateID(id);
        };

        // ─── State polygon hover ───
        const handleStateMouseMove = (e: MapLayerMouseEvent) => {
            if (!e.features || e.features.length === 0) return;
            const feature = e.features[0];
            const featureId = feature.id as number;

            // Clear previous hover
            if (hoveredFeatureId.current !== null && hoveredFeatureId.current !== featureId) {
                map.setFeatureState(
                    { source: STATES_SOURCE_ID, id: hoveredFeatureId.current },
                    { hover: false }
                );
            }

            // Set new hover
            hoveredFeatureId.current = featureId;
            map.setFeatureState(
                { source: STATES_SOURCE_ID, id: featureId },
                { hover: true }
            );

            hoverCountry.current = feature.properties?.name || "";
            map.getCanvas().style.cursor = 'pointer';
        };

        // ─── State polygon mouse leave ───
        const handleStateMouseLeave = () => {
            if (hoveredFeatureId.current !== null) {
                map.setFeatureState(
                    { source: STATES_SOURCE_ID, id: hoveredFeatureId.current },
                    { hover: false }
                );
                hoveredFeatureId.current = null;
            }
            hoverCountry.current = "";
            isHoverCountry.current = false;
            hideTooltip();
            map.getCanvas().style.cursor = '';
        };

        // ─── Map-level mousemove (grid cell detection + tooltip) ───
        const handleMapMouseMove = (e: MapMouseEvent) => {
            if (isLoading_MosquitoData || visData.size === 0) return;

            const lngLat = e.lngLat;

            // Grid cell detection
            const mapVal = visData.entries().next();
            if (!mapVal || mapVal.done) return;
            const [, firstVisData] = mapVal.value;

            const gridOffset = getGridOffset(
                firstVisData.geometry[0][0],
                firstVisData.geometry[0][1],
                gridcellSizeLatLng.current.lat,
                gridcellSizeLatLng.current.lng
            );
            const coords = { lat: lngLat.lat, lng: lngLat.lng };
            const gridCellDims = { lat: gridcellSizeLatLng.current.lat, lng: gridcellSizeLatLng.current.lng };
            const curSnapped = snapToGrid(coords, gridCellDims, gridOffset);
            const rPoint = roundLatLng(curSnapped.topLeft);

            const gridLat = rPoint.lat;
            const gridLng = rPoint.lng;

            if (curGridCell.current[0] === gridLat && curGridCell.current[1] === gridLng) {
                // Same cell — just update tooltip position
                if (isMouseInsideRef.current) {
                    updateTooltipContent(lngLat);
                }
                return;
            }

            curGridCell.current = [gridLat, gridLng];
            const curGridCoords = { lat: gridLat, lng: gridLng };
            curGridCellID.current = getGridCellIndex(curGridCoords, gridCellDims) - 1;
            curGridCellFeature.current = NaN;

            const curGridCellDat = visData.get(curGridCellID.current);
            curGridCellFeature.current = curGridCellDat?.feature ?? NaN;

            // Draw grid cell highlight via SVG overlay (kept from original — D3 SVG rendering)
            drawGridHighlight(gridLat, gridLng);

            // Update tooltip
            if (isMouseInsideRef.current) {
                updateTooltipContent(lngLat);
            }
        };

        // ─── Map click (grid cell selection) ───
        const handleMapClick = (e: MapMouseEvent) => {
            c.setSelectedGridcellID(curGridCellID.current);
            c.setCurFeatureValue(Number.isNaN(curGridCellFeature.current) ? "NA" : curGridCellFeature.current.toString());

            const dummyFeature = {
                type: "Feature",
                properties: { name: "" },
                geometry: {
                    type: "Polygon",
                    coordinates: [[[-10, 10], [-10, 20], [0, 20], [0, 10], [-10, 10]]],
                },
            };

            if (hoverCountry.current === "") {
                contextT.setMapSelectionObj(dummyFeature);
            }
        };

        // ─── Register events ───
        if (map.getLayer(STATES_FILL_LAYER_ID)) {
            map.on('click', STATES_FILL_LAYER_ID, handleStateClick);
            map.on('mousemove', STATES_FILL_LAYER_ID, handleStateMouseMove);
            map.on('mouseleave', STATES_FILL_LAYER_ID, handleStateMouseLeave);
        }
        map.on('moveend', handleMoveEnd);
        map.on('mousemove', handleMapMouseMove);
        map.on('click', handleMapClick);

        return () => {
            if (map.getLayer(STATES_FILL_LAYER_ID)) {
                map.off('click', STATES_FILL_LAYER_ID, handleStateClick);
                map.off('mousemove', STATES_FILL_LAYER_ID, handleStateMouseMove);
                map.off('mouseleave', STATES_FILL_LAYER_ID, handleStateMouseLeave);
            }
            map.off('moveend', handleMoveEnd);
            map.off('mousemove', handleMapMouseMove);
            map.off('click', handleMapClick);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isUpdate, visData, mapReady]);

    // ─── Helper: draw grid cell highlight (SVG overlay — kept as-is per Q4) ───
    function drawGridHighlight(gridLat: number, gridLng: number) {
        if (!map) return;

        const gridLatBottom = gridLat + gridcellSizeLatLng.current.lat;
        const gridLngRight = gridLng + gridcellSizeLatLng.current.lng;

        // MapLibre project: [lng, lat] → pixel coords
        const topLeft = map.project([gridLng, gridLat]);
        const bottomRight = map.project([gridLngRight, gridLatBottom]);

        const width = Math.abs(bottomRight.x - topLeft.x);
        const height = Math.abs(bottomRight.y - topLeft.y);

        // Select/create SVG overlay in the map container
        const container = map.getContainer();
        let svg = d3.select(container).select<SVGSVGElement>('svg.grid-highlight-svg');
        if (svg.empty()) {
            svg = d3.select(container)
                .append('svg')
                .attr('class', 'grid-highlight-svg')
                .style('position', 'absolute')
                .style('top', '0')
                .style('left', '0')
                .style('width', '100%')
                .style('height', '100%')
                .style('pointer-events', 'none')
                .style('z-index', '5');
        }

        svg.selectAll('rect').remove();
        svg.append('rect')
            .attr('x', topLeft.x)
            .attr('y', topLeft.y)
            .attr('width', width)
            .attr('height', height)
            .attr('fill', 'red')
            .attr('opacity', 0.5)
            .attr('stroke', 'black')
            .attr('stroke-width', 1);
    }

    // ─── Helper: update tooltip content ───
    function updateTooltipContent(lngLat: { lat: number; lng: number }) {
        let unit = "";
        let number: any = "";
        if (Number.isNaN(curGridCellFeature.current)) {
            number = "NA";
            unit = "";
        } else {
            number = Math.round(Number(curGridCellFeature.current));
            if (metaData[selectedFeature] != undefined) {
                unit = metaData[selectedFeature].dimension;
            }
            if (metaData[selectedFeature]?.description.includes("precipitation") ||
                metaData[selectedFeature]?.description.includes("Niederschlag")) {
                number = Math.round(Number(curGridCellFeature.current) * 1000);
                unit = "mm";
            }
            if (unit === "%") {
                number = Math.round(Number(curGridCellFeature.current) * 100);
            }
            if (unit === "K") {
                number = Math.round(Number(curGridCellFeature.current) - 273.15);
                unit = "°C";
            }
        }

        const tooltipHTML = `
            <div class="p-2 size-full rounded-lg bg-linear-to-br from-indigo-500 to-indigo-800 text-white font-sans shadow-lg">
                <h1 class="m-0 text-xl font-bold text-shadow">
                    ${number} ${unit}
                </h1>
                <hr class="border-none border-t border-white/50 my-2">
                <p class="m-0">
                    <b>Country:</b> ${hoverCountry.current}
                </p>
                <p class="m-0">
                    <b>LatLng:</b> ${curGridCell.current[0].toFixed(3)}, ${curGridCell.current[1].toFixed(3)}
                </p>
            </div>
        `;

        showTooltip([lngLat.lng, lngLat.lat], tooltipHTML);
    }

    // ─── Map-ready callback ───
    const handleMapReady = useCallback((map: MapLibreMap) => {
        setMapReady(true);
    }, []);

    // ─── Initialize selected feature ───
    useEffect(() => {
        if (mosquitoData.response !== undefined && !isLoading_MosquitoData && mosquitoData.error === null && selectedFeature === "") {
            const index = Math.ceil(mosquitoData.header.length / 2) - 1;
            setSelectedFeature(mosquitoData.header[index]);
            contextT.setCurFeature(mosquitoData.header[index]);
            contextT.setCurDatasetURL(selectedDataset);
        }
    }, [mosquitoData]);

    // ─── UI handlers ───
    const handleInputSlider_lng = (event: React.ChangeEvent<HTMLInputElement>) => {
        updateCoordinates(latitude, Number(event.target.value), zoom);
    };
    const handleInputSlider_lat = (event: React.ChangeEvent<HTMLInputElement>) => {
        updateCoordinates(Number(event.target.value), longitude, zoom);
    };
    const handleInputSlider_zoom = (event: React.ChangeEvent<HTMLInputElement>) => {
        updateCoordinates(latitude, longitude, Number(event.target.value));
    };
    const handleLayerOpacityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = Math.max(0, Math.min(1, Number(event.target.value)));
        curMouseEvent.current = "opacity";
        setLayerOpacity(value);
        contextT.setCurLayerOpacity(value);
    };

    const roundTo = 1;
    const rounder = Math.pow(10, roundTo);
    const barWidth = 10;

    function UI_elementStyler() {
        return { className: `text-sm m-1 p-1 border row-span-2 col-span-6 bg-white/75 z-10 rounded-lg shadow-md` };
    }

    // ══════════════════════════════════════════════════════════════
    // JSX — identical layout to LeafD3MapGermanyCovid
    // ══════════════════════════════════════════════════════════════
    return (
        <div className="relative size-full">
            <div className="absolute top-1 right-1 z-20">
                <button
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className="p-1 rounded-full shadow-md hover:bg-gray-600 bg-black"
                >
                    <Settings className="text-white" />
                </button>
            </div>

            <PrintDataLoadingErrors listOfErrors={collectDataLoadingErrors} />
            <SizeHook element={element} sizeRef={sizeRef} setSize={setSizes} />
            {isSettingsOpen && (
                <div className="absolute w-full mt-2 ml-1 pr-2 grid grid-cols-12 md:grid-cols-12">
                    {mapUIsettings.isLatitudeSlider && (
                        <div {...UI_elementStyler()}>
                            {t.rich('latitude', { ...t_richConfig })}: {Math.round(latitude * rounder) / rounder}
                            <input type="range" value={latitude} onChange={handleInputSlider_lat}
                                min={-RANGE_LAT} max={RANGE_LAT} className="w-full" />
                        </div>
                    )}
                    {mapUIsettings.isLongitudeSlider && (
                        <div {...UI_elementStyler()}>
                            {t.rich('longitude', { ...t_richConfig })}: {Math.round(longitude * rounder) / rounder}
                            <input type="range" value={longitude} onChange={handleInputSlider_lng}
                                min={-RANGE_LONG} max={RANGE_LONG} className="w-full" />
                        </div>
                    )}
                    {mapUIsettings.isZoomSlider && (
                        <div {...UI_elementStyler()}>
                            Zoom: {Math.round(zoom * rounder) / rounder}
                            <input type="range" value={zoom} onChange={handleInputSlider_zoom}
                                step={ZOOM_STEP} min={MIN_ZOOM} max={MAX_ZOOM} className="w-full" />
                        </div>
                    )}
                    {mapUIsettings.isDatasetSelectionDropdown && (
                        <div {...UI_elementStyler()}>
                            <label htmlFor="dataset-select">{t.rich('data_set', { ...t_richConfig })}:</label>
                            {listOfDataSets &&
                                <Select defaultValue={Object.keys(listOfDataSets)[0]} onValueChange={(value) => {
                                    const dataset = listOfDataSets[value];
                                    curDatasetname.current = dataset;
                                    const url = apiRoutes.fetchDbData({ relationName: dataset, feature: "" });
                                    isLoadingSpinner.current = true;
                                    setSelectedDataset(url);
                                    contextT.setCurDatasetURL(url);
                                    contextT.setCurFeature("");
                                    setSelectedFeature("");
                                }}>
                                    <SelectTrigger className="w-full"><SelectValue placeholder={Object.keys(listOfDataSets)[0]} /></SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectLabel></SelectLabel>
                                            {Object.keys(listOfDataSets).map((key, index) => (
                                                <SelectItem key={index} value={key}> {key}</SelectItem>
                                            ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            }
                        </div>
                    )}
                    {mapUIsettings.isFeatureSelectionDropdown && (
                        <div {...UI_elementStyler()}>
                            <label htmlFor="dataset-select">{t.rich('feature', { ...t_richConfig })}:</label>
                            {colNames && metaData && (
                                <Select value={selectedFeature} onValueChange={(value) => {
                                    const url = apiRoutes.fetchDbData({ relationName: curDatasetname.current, feature: value });
                                    isLoadingSpinner.current = true;
                                    setSelectedDataset(url);
                                    contextT.setCurDatasetURL(url);
                                    setSelectedFeature(value);
                                    contextT.setCurFeature(value);
                                }}>
                                    <SelectTrigger className="w-full"><SelectValue placeholder={"loading..."} /></SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectLabel></SelectLabel>
                                            {colNames.map((name, index) => {
                                                const isAvailable = (metaData[colNames[index] as keyof typeof metaData]?.availability === "1" || metaData[colNames[index] as keyof typeof metaData]?.availability === undefined) && colNames[index] !== "id";
                                                if (isAvailable) {
                                                    return (
                                                        <SelectItem key={index} value={colNames[index]}>
                                                            <b>{colNames[index] + " [" + metaData[colNames[index] as keyof typeof metaData]?.dimension + "]"}</b>
                                                            <i>{" " + metaData[colNames[index] as keyof typeof metaData]?.description}</i>
                                                        </SelectItem>
                                                    );
                                                }
                                                return null;
                                            })}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    )}
                    {mapUIsettings.isColorMapSelectionDropdown && ischanged && (
                        <div {...UI_elementStyler()}>
                            <label htmlFor="dataset-select">{t.rich('color_map', { ...t_richConfig })}:</label>
                            <Select onValueChange={(value) => {
                                setColorMapType(value);
                                contextT.setCurColorMap(value);
                                isLoadingSpinner.current = true;
                            }} defaultValue={defaultColorMap}>
                                <SelectTrigger className="w-full mt-1"><SelectValue placeholder="" /></SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel></SelectLabel>
                                        {Object.keys(availableColorMaps).map((key, index) => (
                                            <SelectItem key={index} value={key}>
                                                <div style={{ display: "flex", alignItems: "center" }}>
                                                    <span><div className='w-12'>{key.split("interpolate")[1]}</div></span>
                                                    <svg width="100" height="10" style={{ marginLeft: "10px" }}>
                                                        <defs>
                                                            <linearGradient id={`gradient-${key}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                                                {d3.range(0, 1.0, 0.1).map((t) => (
                                                                    <stop key={t} offset={`${t * 100}%`}
                                                                        stopColor={d3.scaleSequential(availableColorMaps[key as keyof typeof availableColorMaps]).domain([0, 1])(t)} />
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
                            {t.rich("opacity", { ...t_richConfig })}: {layerOpacity}
                            <input type="range" value={layerOpacity} onChange={handleLayerOpacityChange}
                                step={0.01} min={0.0} max={1.0} className="w-full" />
                        </div>
                    )}
                </div>
            )}

            {isLoadingSpinner.current && (<LoadingSpinner />)}
            <div ref={divRef} className='flex justify-center items-center size-full'>
                <svg id={chart} className='w-full h-full'></svg>

                {/* MapLibre GL JS container (replaces LeafletMapComponent) */}
                <MapLibreBase
                    chartName={`maplibre-${chart}`}
                    center={[longitude, latitude]}
                    zoom={zoom}
                    mapRef={mapRef}
                    onMapReady={handleMapReady}
                    isProjection_equirectangular={props.isProjection_equirectangular}
                    scrollWheelZoom={true}
                    doubleClickZoom={false}
                    dragging={true}
                />

                {/* Declarative color map legend */}
                {mapUIsettings.isColorMapLegend && !isLoading_MosquitoData && mosquitoData.error === null && (
                    <div style={{
                        position: "absolute",
                        right: legendDistanceToMapBorderX,
                        bottom: legendDistanceToMapBorderY,
                        pointerEvents: "none",
                        zIndex: 50,
                    }}>
                        <ColorMapLegend
                            chartId={chart}
                            colorMapType={curColorMapType}
                            minVal={minVal}
                            maxVal={maxVal}
                            selectedFeature={selectedFeature}
                            metaData={metaData}
                            layerOpacity={layerOpacity}
                            locale={locale}
                            height={160}
                            barWidth={barWidth}
                            isVisible={mapUIsettings.isColorMapLegend}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default MapLibreGermanyMap;
