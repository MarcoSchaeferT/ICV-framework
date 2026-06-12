
"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    LoadingSpinner,
    getMinMaxFeature,
    getGridCellIndex,
    getGridOffset,
    snapToGrid,
    roundLatLng,
} from './helpers';
import {
    metaDataT,
} from '../MetaDataHandler';
import {availableColorMaps, availableColorMapsNames} from './constants';
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
import { useLocale ,useTranslations } from "next-intl";
import { t_richConfig, dbDATA } from '@/app/const_store';
import { Locale } from '@/i18n/routing';
import useChartResizer from '@/app/hooks/useChartResizer';

import  stateMappersGermany from '@/app/helpers';
import LeafletMapComponent, {LeafletComponentProps} from './BaseMap';
import { Settings } from 'iconoir-react';
import ColorMapLegend from './overlays/ColorMapLegend';

// ─── Shared hooks & utils (extracted from nested component definitions) ───
import {
    useLeafletInit,
    useMapPosition,
    useMapResize,
    useMapDistance,
    useMapTransition,
    useGridDataParser,
    useCanvasGridLayer,
    useLayerUpdateDebounce,
    useTooltipCleanup,
} from './hooks';
import { clampCoordinates, resetTimeout, removeReusedTooltip, getParamsOfURL } from './utils/mapUtils';
import MapContentChild from './MapContentChild';
import { RANGE_LAT, RANGE_LONG, MAX_ZOOM, MIN_ZOOM, ZOOM_STEP, CALCER } from './constants';




let leafProps = LeafletComponentProps("LeafletMap1", apiRoutes.FETCH_MAP_DATA.GERMANY_MAP_STATES, "exampleVar");
leafProps.center = [-20, 25.8];
leafProps.zoom = 1.5;

const duration_mapTransition = 1800;

const legendDistanceToMapBorderX = 5;
const legendDistanceToMapBorderY = 15;

const defaultColorMap = availableColorMapsNames.interpolateViridis;

// controls if the layer is drawn with canvas or svg
const isLayerDrawnCanvas = true;



/**
 * Class representing the properties for a D3 map with layer.
 */
export interface LeafD3MapGermanyProps {
    chartName: string;
    mapDataURL: any;
    dataURL: any;
    center: [number, number];
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
        defaultFeatureName?: string;
    };
    isApplySelectionsTransition: boolean;
    isStaticAutoFitFullSize: boolean;
    isProjection_equirectangular?: boolean;
    isSetIntialContextDataFromComponent?: boolean;
}

export function LeafD3MapGermanyProps(
    chartName = "D3mapLayer",
    mapDataURL = apiRoutes.FETCH_MAP_DATA.GERMANY_MAP_STATES,
    dataURL?: string,
    mapUIsettings: any = {},
    center: [number, number] = [9.7, 52],
    zoom = 2,
    mapBaseColor?: any,
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
            defaultFeatureName: "",
            ...mapUIsettings,
        },
        isStaticAutoFitFullSize,
        isApplySelectionsTransition: isApplySelectionsAndTransitions,
        isSetIntialContextDataFromComponent: isSetContextData,
        isProjection_equirectangular
    };
}


const LeafD3MapGermanyComponent = ({props}: {props: LeafD3MapGermanyProps}) => {
  
    let c = useInterfaceContext();
    leafProps.zoom = props.zoom;
    leafProps.center = props.center;
    leafProps.isProjection_equirectangular = props.isProjection_equirectangular;

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
    // distance legend
        const scaleLegHeight = 35;
        const scaleLegWidth = 200;
        const scaleLegDims = {
            width: scaleLegWidth,
            height: scaleLegHeight,
            posX: legendDistanceToMapBorderX,
            posY: legendDistanceToMapBorderY
        };


    // initialize component variables
    let contextT = useInterfaceContext();
    let collectDataLoadingErrors = [];
    let chart:string = props.chartName;
    
   const mapUIsettings = { ...props.mapUIsettings };

    type visDataT = {
        geometry: [number, number][];
        feature: number;
    }


    // *** useState *** //
    const [[latitude, longitude, zoom], setCoordinates] = useState<[number, number, number]>(
        [leafProps.center?.[0] ?? 0, leafProps.center?.[1] ?? 0, leafProps.zoom ?? 1]
    );
    const [isUpdate, setisUpdate] = useState(false);
    const [isMouseEvent, setIsMouseEvent] = useState(false);
    const curMouseEvent = useRef<string>("null");
    const screenDistanceOneKM = useRef<number>(0);
    const [selectedDataset, setSelectedDataset] = useState<string>("");
    const [curColorMapType, setColorMapType] = useState<string>(defaultColorMap);
    const [layerOpacity, setLayerOpacity] = useState(1.0);
    const [visData, setVisData] = useState<Map<number, visDataT>>(new Map<number, visDataT>());
    const [selectedFeature, setSelectedFeature] = useState<string>(props.mapUIsettings.defaultFeatureName || "")
    console.log("tmp selectedFeature",selectedFeature)
    const curDatasetname = useRef<string>("");
    const curPropertyNames = useRef<string>("");
    const curGridCell = useRef<[number, number]>([0, 0]);
    const curGridCellFeature = useRef<number>(0);
    const curGridCellID = useRef<number>(0);
    const hoverCountry = useRef<string>("0");
    const toolTipRef = useRef<any>(null);
    const UIcntRef = useRef<number>(0);
    const isHoverCountry = useRef<boolean>(false);
    const gridcellSizeLatLng = useRef<{ lng: number; lat: number }>({ lng: 0, lat: 0 });
     const [isSettingsOpen, setIsSettingsOpen] = useState(true);
    
    const locale = useLocale() as Locale;
    // data loading 

    const [isLoading_mapData, rawMapData] = useGetJSONData(props.mapDataURL);
    const [isLoading_MosquitoData, rawMosquitoData] = useGetJSONData(selectedDataset);  
    const [isLoadingDatalist, dataList] = useGetJSONData(apiRoutes.GET_LIST_OF_DATASETS)
    const [isLoading_Metadata, rawMetaData] = useGetJSONData(apiRoutes.getDatasetsMetadata({ LANGID: locale }));
    
    
    type dataListT = {
        [key: string]: string
    }
    type MosquitoDataRowT = {
        geometry: string
        feature: string
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



    useEffect(() => {
        if(props.isApplySelectionsTransition) {
            isLoadingSpinner.current = true;

            if(curColorMapType != contextT.curColorMap){
                
                setColorMapType(contextT.curColorMap);
            }
            if(curDatasetname.current != contextT.curDatasetURL && contextT.curDatasetURL != ""){
                setSelectedDataset(contextT.curDatasetURL);
            }
            if(layerOpacity != contextT.curLayerOpacity){
                
                setTimeout(() => {
                    setLayerOpacity(contextT.curLayerOpacity);
                }, 50);
            }
            
                setSelectedFeature(contextT.curFeature);
                //console.log("selectedFeature2:", contextT.curFeature);
            
        }
    }, [contextT.curColorMap, contextT.curDatasetURL, contextT.curLayerOpacity, contextT.curFeature]);

    // if isSetIntialContextDataFromComponent is true set context values from component
    useEffect(() => {
        if (props.isSetIntialContextDataFromComponent === true) {
            contextT.setCurDatasetURL(selectedDataset);
            contextT.setCurFeature(selectedFeature);
            contextT.setCurColorMap(curColorMapType);
            contextT.setCurLayerOpacity(layerOpacity);
            console.log("SET context from Germany component:", {
                selectedDataset,
                selectedFeature,
                curColorMapType,
                layerOpacity,
            });
        }
    }, [props.isSetIntialContextDataFromComponent, selectedDataset, selectedFeature, curColorMapType]);

    const metaData = rawMetaData as unknown as metaDataT;
    let dataTableContext = useInterfaceContext();

    let listOfDataSets = dataList as unknown as dataListT;
    const sortedKeys = Object.keys(listOfDataSets).sort();
    listOfDataSets = sortedKeys.reduce((acc, key) => {
            acc[key] = listOfDataSets[key];
            return acc;
        }, {} as dataListT);
    if(!isLoadingDatalist &&  selectedDataset === "") {
        //console.log("dataList:", dataList);
        
        curDatasetname.current = URLparams["relationName"];
        let initialURL = props.dataURL;
        if (props.mapUIsettings.defaultFeatureName) {
            initialURL = apiRoutes.fetchDbData({
                relationName: curDatasetname.current,
                feature: props.mapUIsettings.defaultFeatureName
            });
        }
        setSelectedDataset(initialURL);
       
    }


    
    let mosquitoData = rawMosquitoData as unknown as dbDATA;
    collectDataLoadingErrors.push(handleLoadDataError(isLoading_mapData, rawMapData as unknown as dbDATA));
    collectDataLoadingErrors.push(handleLoadDataError(isLoading_MosquitoData, rawMosquitoData as unknown as dbDATA));
    collectDataLoadingErrors.push(handleLoadDataError(isLoadingDatalist, dataList as unknown as dbDATA));
    collectDataLoadingErrors.push(handleLoadDataError(isLoading_Metadata, rawMetaData as unknown as dbDATA));
    const mapData = rawMapData as unknown as any;
   

    


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
    let isLoadingSpinner = useRef(false);

    // ─── Shared hook: parse raw polygon data → Map<gridCellIndex, VisDataT> ───
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
}, [dimensions]);


     /************************** */

  /*********************************
   * *** Layer Update Handler **** *
   *********************************/
useLayerUpdateDebounce({
    curMouseEventRef: curMouseEvent,
    timerRef: time,
    isLoadingSpinnerRef: isLoadingSpinner,
    setIsUpdate: setisUpdate,
    onDebounceComplete: () => {
        if (map && L && props.isStaticAutoFitFullSize && mapData && !mapData.error && mapData.type) {
            const geoLayer = L.geoJSON(mapData);
            let bounds = geoLayer.getBounds();
            bounds = bounds.pad(-1.05);
            map.fitBounds(bounds);
        }
    },
    deps: [latitude, longitude, zoom, isMouseEvent, rawMosquitoData, curColorMapType, layerOpacity, dimensions, map],
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
        let geoLayer: any;
        try {
            if (mapData && !mapData.error && mapData.type) {
                geoLayer = L.geoJSON(mapData, {
                style: (feature) => {
                    const country = feature?.properties?.name || "";
                    const id = stateMappersGermany.Map__State_to_ID(country);
                    let idd = stateMappersGermany.mapper__MapTable__ID_to_ID(id);
                    const curKey = Object.keys(mosquitoData.response)[idd-1];
                    const curVal = mosquitoData.response[curKey]?.feature;
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
                        curPropertyNames.current = country;
                        let id = stateMappersGermany.Map__State_to_ID(country);
                        c.setSelectedStateID(id);
                     
                    });

                    layer.on("mousemove", function (event: L.LeafletMouseEvent) {
                        toolTip();

                        function toolTip() {
                            removeAllTooltips();

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
                                if (
                                    metaData[selectedFeature]?.description.includes("precipitation") ||
                                    metaData[selectedFeature]?.description.includes("Niederschlag")
                                ) {
                                    number = Math.round(Number(curGridCellFeature.current) * 1000);
                                    unit = "mm";
                                }

                                // round percentage values
                                if (unit === "%") {
                                    number = Math.round(Number(curGridCellFeature.current) * 100);
                                }

                                // convert Kelvin to Celsius
                                if (unit === "K") {
                                    number = Math.round(Number(curGridCellFeature.current) - 273.15);
                                    unit = "°C";
                                }
                            }

                            toolTipRef.current.setLatLng(event.latlng);
                           
                        }

                        (layer as L.Path).bringToFront(); // Ensures the hovered polygon is on top
                        if (feature.properties) {
                                const country = feature.properties ? feature.properties.name : "";
                                const id = stateMappersGermany.Map__State_to_ID(country);
                                let idd = stateMappersGermany.mapper__MapTable__ID_to_ID(id);
                                const curKey = Object.keys(mosquitoData.response)[idd-1];
                                const curVal = mosquitoData.response[curKey]?.feature;
                                 let unit = "";
                                if (metaData[selectedFeature] !== undefined) {
                                    unit = metaData[selectedFeature].dimension ?? "";
                                }

                                const numericValue = typeof curVal === "number" ? curVal : Number(curVal);
                                const formattedValue = Number.isFinite(numericValue)
                                    ? numericValue.toLocaleString(locale, { maximumFractionDigits: 3 })
                                    : "N/A";
                                const countryLabel = country ? country : "Unknown Location";
                                const featureDescription =
                                    metaData[selectedFeature] !== undefined ? metaData[selectedFeature].description : "N/A";

                                toolTipRef.current.setContent(`
                                    <div id=${"toolTip" + chart} class="min-w-[220px] max-w-[280px] border-gray-800 border rounded-xl bg-linear-to-br from-indigo-600 via-indigo-700 to-slate-900 p-4 text-white shadow-xl font-sans">
                                        <div class="mb-2">
                                            <span class="text-3xl font-semibold align-baseline">
                                                ${formattedValue}
                                            </span>
                                            <span class="text-lg font-medium text-indigo-200 ml-1 align-baseline">
                                                ${unit || ""}
                                            </span>
                                        </div>

                                        <table class="w-full text-sm">
                                            <tbody>
                                                <tr class="border-b border-white/20">
                                                    <td class="py-1.5 pr-2 text-left font-normal text-indigo-200">
                                                        ${t.rich('tooltip.country', {...t_richConfig})}
                                                    </td>
                                                    <td class="py-1.5 pl-2 text-right font-medium" style="white-space: normal; word-break: break-word;">
                                                        ${countryLabel}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="pt-1.5 pb-0 pr-2 text-left font-normal text-indigo-200">
                                                        ${t.rich('tooltip.feature', {...t_richConfig})}
                                                    </td>
                                                    <td class="pt-1.5 pb-0 pl-2 text-right font-medium" style="white-space: normal; word-break: break-word;">
                                                        ${selectedFeature ? selectedFeature : "N/A"}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>

                                        <p class="m-0 mt-3 pt-3 italic text-sm text-indigo-100/90" style="white-space: normal; word-break: break-word;">
                                            ${featureDescription}
                                        </p>
                                    </div>
                                    `);
                            if (map && isMouseInsideRef.current) {
                                map.openTooltip(toolTipRef.current);
                            }
                            if (curPropertyNames.current !== feature.properties.name) {
                                (layer as L.Path).setStyle({
                                    fillColor: "rgba(29, 73, 217, 0.5)",
                                    // weight: 1,
                                    // fillOpacity: layerOpacity,
                                });
                                (layer as L.Path).bringToBack();
                                isHoverCountry.current = true;
                            }
                            hoverCountry.current = feature.properties.name;
                        } else {
                            hoverCountry.current = "";
                        }
                    });

                    layer.on("mouseout", function () {
                        if (feature.properties) {
                              const country = feature?.properties?.name || "";
                            const id = stateMappersGermany.Map__State_to_ID(country);
                            let idd = stateMappersGermany.mapper__MapTable__ID_to_ID(id);
                            const curKey = Object.keys(mosquitoData.response)[idd-1];
                            const curVal = mosquitoData.response[curKey]?.feature;
                            if (curPropertyNames.current !== feature.properties.name) {
                                (layer as L.Path).setStyle({
                                    fillColor: colorMap(curVal),
                                    color: "#000000",
                                    weight: 1,
                                    //fillOpacity: c.curLayerOpacity,
                                });
                                hoverCountry.current = "";
                                isHoverCountry.current = false;
                                removeAllTooltips();
                                const svg = d3.select(map.getContainer()).select("svg");
                                svg.selectAll("rect").remove();
                                svg.selectAll("circle").remove();
                            }
                        }
                    });
                },
            }).addTo(map);
           }
        }
        catch(e) {
            let errorMsg = { ERROR: "ERROR: while retriving geo data." +e};
            let res = <div>{String(errorMsg['ERROR'])}</div>;
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
                   
                removeAllTooltips()
                    
                let unit = "";
                let number: any = "";
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
                              let mapVal = visData.entries().next();
                              if (!mapVal || mapVal.done) return; // Ensure visData is not empty
              
                              const [firstKey, firstVisData] = mapVal.value;
                              let gridOffset = getGridOffset(
                                  firstVisData.geometry[0][0],
                                  firstVisData.geometry[0][1],
                                  gridcellSizeLatLng.current.lat,
                                  gridcellSizeLatLng.current.lng
                              );
                              let coords = {lat: event.latlng.lat, lng: event.latlng.lng};
                              let gridCellDims = {lat:gridcellSizeLatLng.current.lat, lng: gridcellSizeLatLng.current.lng};
                              let curSnapped = snapToGrid(coords, gridCellDims, gridOffset);
              
                              // Compute the top-left corner of the current grid cell
                              let rPoint = roundLatLng(curSnapped.topLeft); 
              
                              let gridLat = rPoint.lat;
                              let gridLng = rPoint.lng;
              
                              // avoid unnecessary updates
                              if (curGridCell.current[0] === gridLat && curGridCell.current[1] === gridLng) {
                                  return; // No change in grid cell
                              }
                              //console.log("drawTooltip...")
                              curGridCell.current = [gridLat, gridLng];
                             
                              let curGridCoords = {lat: gridLat, lng: gridLng};
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
                  
            
                // Convert mouse position to container point
                const pos = map.latLngToContainerPoint(event.latlng);
            
                // Remove previous mouse position circle
                svg.selectAll("circle").remove();
            
                // Draw a circle at the mouse position
                svg.append("circle")
                    .attr("cx", topLeft.x)
                    .attr("cy", topLeft.y)
                    .attr("r", 5) // Adjust radius as needed
                    .attr("fill", "blue");
            };

            const handleMouseClick = (event: L.LeafletMouseEvent) => {


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
            

                
            map.on("click", (event: L.LeafletMouseEvent) => handleMouseClick(event));
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
                            let idd = stateMappersGermany.mapper__MapTable__ID_to_ID(id);
                            const curKey = Object.keys(mosquitoData.response)[idd - 1];
                            const curVal = mosquitoData.response[curKey]?.feature;
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

// ─── Shared hook: canvas grid layer rendering (replaces nested MapDrawLayer) ───
useCanvasGridLayer({
    map,
    L,
    isUpdate,
    isLoading: isLoading_MosquitoData || !isLayerDrawnCanvas,
    hasError: mosquitoData.error != null,
    gridData: visData,
    dimensions,
    colorMap,
    layerOpacity,
    transitionDuration: 0,
    debug: false,
});
 
    useEffect(() => {
        // Initialize the selected feature when colNames are available
        if (mosquitoData.response !== undefined && !isLoading_MosquitoData && mosquitoData.error === null && selectedFeature === "") {
            let index = Math.ceil(mosquitoData.header.length / 2)-1;
            const tempSelectedFeature = props.mapUIsettings.defaultFeatureName ? props.mapUIsettings.defaultFeatureName : mosquitoData.header[index];
            setSelectedFeature(tempSelectedFeature);
            contextT.setCurFeature(tempSelectedFeature);
            contextT.setCurDatasetURL(selectedDataset);
            console.log("tempSelectedFeature", selectedFeature,selectedDataset);
        }
      }, [mosquitoData])

    const roundTo = 1;
    const  rounder = Math.pow(10, roundTo);

    function UI_elementStyler() {
        return { className: `text-sm m-1 p-1 border row-span-2 col-span-6 bg-white/75 z-10 rounded-lg shadow-md`};
   }

   // the page
    return (

<div className="relative size-full" >
    <div className="absolute top-1 right-1 z-20">
        <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="p-1  rounded-full shadow-md hover:bg-gray-600 bg-black "
        >
            <Settings className="text-white " />
        </button>
    </div>

    <PrintDataLoadingErrors listOfErrors={collectDataLoadingErrors}/>
    <SizeHook element={element} sizeRef={sizeRef} setSize={setSizes}/>
    {isSettingsOpen && (
    <div className={`absolute w-full mt-2 ml-1 pr-2 grid grid-cols-12 md:grid-cols-12`}>
    
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
        <label htmlFor="dataset-select">
        {t.rich('data_set', {...t_richConfig})}:
        </label>
        {listOfDataSets && 
        <Select defaultValue={Object.keys(listOfDataSets)[0]} onValueChange={(value) => { 
            const dataset = listOfDataSets[value];
            curDatasetname.current = dataset;
            let url = apiRoutes.fetchDbData({ relationName: dataset, feature: props.mapUIsettings.defaultFeatureName || "" })
            isLoadingSpinner.current = true;

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
        <label htmlFor="dataset-select">
             {t.rich('feature', {...t_richConfig})}:
        </label>
        {colNames && metaData && (
       <Select value={selectedFeature} onValueChange={(value) => { 
            let url = apiRoutes.fetchDbData({ relationName: curDatasetname.current, feature: value });
            //console.log("setCurFeatureName:", value);
            //console.log("setCurDatasetName:",url);
            props.mapUIsettings.defaultFeatureName = "";
            isLoadingSpinner.current = true;
            setSelectedDataset(url);
            contextT.setCurDatasetURL(url);

            setSelectedFeature(value);
            contextT.setCurFeature(value);
            }
            } >
            <SelectTrigger className="w-full">
            <SelectValue placeholder={"loading..."} />
            </SelectTrigger>
            <SelectContent>
            <SelectGroup>
                <SelectLabel></SelectLabel>
                    {colNames.map((name, index) => {
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

    {mapUIsettings.isColorMapSelectionDropdown && ischanged && (
        <div {...UI_elementStyler()}>
            <label htmlFor="dataset-select">
                {t.rich('color_map', {...t_richConfig})}:
            </label>
            <Select onValueChange={(value) => {
                setColorMapType(value);
                contextT.setCurColorMap(value);
                isLoadingSpinner.current = true;
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
   
    
    {isLoadingSpinner.current && (<LoadingSpinner  />)}
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

// getParamsOfURL is now imported from utils/mapUtils

export default  LeafD3MapGermanyComponent;
