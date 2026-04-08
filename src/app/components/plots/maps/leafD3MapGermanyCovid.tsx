
"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    LoadingSpinner,
    getMinMaxFeature,
    getGridCellIndex,
    polygonParser,
    pointParser,
    getGridOffset,
    snapToGrid,
    roundLatLng,
    getGridCellDims,
    getGeometryCenter,
} from './helpers';
import {
    metaDataT,
    alignFeature_to_Metadata,
} from '../metaDataHandler';
import {availableColorMaps, availableColorMapsNames} from './constants';
import * as d3 from 'd3';
import {useInterfaceContext} from '../../contexts/InterfaceContext';
import { apiRoutes } from '../../../api_routes';
import { PrintDataLoadingERRORs, handleLoadDataERROR } from '../../../helpers';
import { useGetJSONData } from '../../../hooks/customFetchAndCache';
import SizeHook from '../../../hooks/resizeObserver';
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
import { t_richConfig, dbDATA } from "../../../const_store";
import { Locale } from '@/i18n/routing';
import useChartResizer from '../../../hooks/customPlotHooks';

import  stateMappersGermany from '@/app/helpers';

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
     useMapEvents } from 'react-leaflet';
import LeafletMapComponent, {LeafletComponentPorps} from './baseMap';
import { Settings } from 'iconoir-react';
import { getGoodReadableRange } from './helpers';



let leafProps = new LeafletComponentPorps("LeafletMap1", apiRoutes.FETCH_GERMANY_MAP, "exampleVar");
leafProps.center = [-20, 25.8];
leafProps.zoom = 1.5;

const rangeLong = 180;
const rangeLat = 90;
const duration_mapTransition = 1800;
const maxZoom = 13;
const minZoom = 0.1;
const zoomStep = 0.01;

const legendDistanceToMapBorderX = 5;
const legendDistanceToMapBorderY = 15;

let NumbersAfterComma = 3;
let calcer = Math.pow(10, NumbersAfterComma);

const defaultColorMap = availableColorMapsNames.interpolateViridis;

// controls if the layer is drawn with canvas or svg
const isLayerDrawnCanvas = true;



/**
 * Class representing the properties for a D3 map with layer.
 */
class LeafD3MapGermanyProps {
    /**
     * The name of the chart.
     */
    chartName: string;

    /**
     * The URL of the data to be used in the map layer.
     * Can be a string or any other type that represents the data URL.
     */
    mapDataURL: any;

    dataURL: any;


    /**
     * The center coordinates of the map [latitude, longnitude].
     */
    center: [number, number];

    /**
     * The zoom level of the map.
     */
    zoom: number;
    
    /**
     * The UI settings for the map.
     */
    mapUIsettings: {
        isLongnitude_slider: boolean;
        isLatitude_slider: boolean;
        isZoom_slider: boolean;
        isColorMapSelection_dropdown: boolean;
        isFeatureSelection_dropdown: boolean;
        isDatasetSelection_dropdown: boolean;
        isDistance_legend: boolean;
        isColorMap_legend: boolean;
    } ;
    /**
     * Flag to indicate if selections / transitions should be applied.
     */
    isApplySelectionsTransition: boolean;

    /**
     * Flag to control if the map behaves like a static image.
     * @true: Map has no mouse interaction and fits the full size of the parent div.
     * @false: Map has mouse interaction and depends on the zoom and longitude/latitude values.
     */
    isStaticAutoFitFullSize: boolean;

    isProjection_equirectangular?: boolean;

    /**
     * Constructor to initialize the properties of the D3mapLayerProps class.
     * 
     * @param chartName - The name of the chart.
     * @param dataURL - The URL of the data to be used in the map layer.
     * @param center - The center coordinates of the map [latitude, longitude].
     * @param zoom - The zoom level of the map.
     * @param isColorMapSelection - Flag to indicate if color map selection is enabled.
     * @param isFeatureSelection - Flag to indicate if feature selection is enabled.
     * @param isDatasetSelection - Flag to indicate if dataset selection is enabled.
     * @param isStaticAutoFitFullSize - Flag to control if the map behaves like a static image.
     * @param isApplySelectionsAndTransitions - Flag to indicate if selections transition should be applied.
     * @param mapUIsettings - The UI settings for the map.*/
    constructor(
           chartName?: string,
           mapDataURL?: any,
           dataURL?: string,
           mapUIsettings?: {
               isLongnitude_slider?: boolean;
               isLatitude_slider?: boolean;
               isZoom_slider?: boolean;
               isColorMapSelection_dropdown?: boolean;
               isFeatureSelection_dropdown?: boolean;
               isDatasetSelection_dropdown?: boolean;
               isDistance_legend?: boolean;
               isColorMap_legend?: boolean;
           },
           center?: [number, number],
           zoom?: number,
           mapBaseColor?: d3.RGBColor | d3.HCLColor | d3.HSLColor | null,
           isStaticAutoFitFullSize?: boolean,
           isApplySelectionsAndTransitions?: boolean,
           isProjection_equirectangular?: boolean
       ) {
           mapUIsettings = mapUIsettings || {};
           this.chartName = chartName || "D3mapLayer";
           this.mapDataURL = mapDataURL || apiRoutes.FETCH_GERMANY_MAP;
           this.dataURL = dataURL;
           this.center = center !== undefined ? center : [9.7, 52];
           this.zoom = zoom !== undefined ? zoom : 2;
  
          
         
           this.mapUIsettings = {
               isLongnitude_slider: mapUIsettings.isLongnitude_slider !== undefined ? mapUIsettings.isLongnitude_slider : true,
               isLatitude_slider: mapUIsettings.isLatitude_slider !== undefined ? mapUIsettings.isLatitude_slider : true,
               isZoom_slider: mapUIsettings.isZoom_slider !== undefined ? mapUIsettings.isZoom_slider : true,
               isColorMapSelection_dropdown: mapUIsettings.isColorMapSelection_dropdown !== undefined ? mapUIsettings.isColorMapSelection_dropdown : true,
               isFeatureSelection_dropdown: mapUIsettings.isFeatureSelection_dropdown !== undefined ? mapUIsettings.isFeatureSelection_dropdown : true,
               isDatasetSelection_dropdown: mapUIsettings.isDatasetSelection_dropdown !== undefined ? mapUIsettings.isDatasetSelection_dropdown : true,
               isDistance_legend: mapUIsettings.isDistance_legend !== undefined ? mapUIsettings.isDistance_legend : true,
               isColorMap_legend: mapUIsettings.isColorMap_legend !== undefined ? mapUIsettings.isColorMap_legend : true,
               
        };
        this.isStaticAutoFitFullSize = isStaticAutoFitFullSize || false;
        this.isApplySelectionsTransition = isApplySelectionsAndTransitions !== undefined ? isApplySelectionsAndTransitions : false;
        this.isProjection_equirectangular = isProjection_equirectangular !== undefined ? isProjection_equirectangular : false;
    }
}


const LeafD3MapGermanyComponent = ({props}: {props: LeafD3MapGermanyProps}) => {
  
    let c = useInterfaceContext();
    leafProps.zoom = props.zoom;
    leafProps.center = props.center;
    leafProps.isProjection_equirectangular = props.isProjection_equirectangular;

    const URLparams = useMemo(() => getParamsOfURL(props.dataURL), [props.dataURL]);


    const t = useTranslations("component_D3MapLayerComponent");


    const [L, setL] = useState<any>(null);    

   
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
    let collectDataLoadingEROORS = [];
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
    const [curColroMapType, setColorMapType] = useState<string>(defaultColorMap);
    const [layerOpacity, setLayerOpacity] = useState(1.0);
    const [visData, setVisData] = useState<Map<number, visDataT>>(new Map<number, visDataT>());
    const [selectedFeature, setSelectedFeature] = useState<string>("")
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
  

    const mapRef = useRef<L.Map | null>(null);
    function MapContent() {
        const map = useMap();
        map.dragging.disable();
        map.scrollWheelZoom.disable();
       
        mapRef.current = map;
        useEffect(() => {
            if (!mapRef.current) return;
            toolTipRef.current = L.tooltip();
        }, []);
        return null;
    }



    useEffect(() => {
        if(props.isApplySelectionsTransition) {
            isLoadingSpinner.current = true;

            if(curColroMapType != contextT.curColorMap){
                
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
        setSelectedDataset(props.dataURL);
       
    }


    
    let mosquitoData = rawMosquitoData as unknown as dbDATA;
    collectDataLoadingEROORS.push(handleLoadDataERROR(isLoading_mapData, rawMapData as unknown as dbDATA));
    collectDataLoadingEROORS.push(handleLoadDataERROR(isLoading_MosquitoData, rawMosquitoData as unknown as dbDATA));
    collectDataLoadingEROORS.push(handleLoadDataERROR(isLoadingDatalist, dataList as unknown as dbDATA));
    collectDataLoadingEROORS.push(handleLoadDataERROR(isLoading_Metadata, rawMetaData as unknown as dbDATA));
    const mapData = rawMapData as unknown as any;
   

    


    const colNames = useMemo(() => {
        if(mosquitoData.response !== undefined && !isLoading_MosquitoData && mosquitoData.error === null) {
            //console.log("data:", mosquitoData);
            return mosquitoData.header;
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

    useMemo(() => {
            if(!isLoading_MosquitoData && mosquitoData.response !== undefined) {
                let visDat = new Map<number, visDataT>();
                let rect1:[number, number][] = [];   
                try {
                    mosquitoData.response.forEach((d: MosquitoDataRowT) => {
                        if (d.geometry) {
                            const coords = polygonParser(d.geometry);
                            if(rect1 == null || rect1.length === 0) {
                                rect1 = coords;
                                let dims = getGridCellDims(rect1);
                                gridcellSizeLatLng.current.lng = dims.gridDimLng;
                                gridcellSizeLatLng.current.lat = dims.gridDimLat;
                                console.log("gridCellDims", dims);
                            }
                            const centerPoint = getGeometryCenter(coords);
                            const gridCellIndex = getGridCellIndex({lat:centerPoint[0], lng:centerPoint[1]}, {lat: gridcellSizeLatLng.current.lat, lng: gridcellSizeLatLng.current.lng});
                            if (coords.length == 5) {
                                visDat.set(gridCellIndex, {geometry: coords, feature: Number(d.feature)});
                            }
                        }
                    })
                }
                catch(e) {
                    let erroMsg = { ERROR: "ERROR: while parsing the data set. csv format is required." +e};
                    let res = <div>{String(erroMsg['ERROR'])}</div>;
                    console.log("Error:", erroMsg);
                    collectDataLoadingEROORS.push(res)
                }
                if(visDat.size === 0) {return;}
     
    
                setVisData(visDat)
                //console.log("visData:", visDat);    
            }
            }, [isLoading_MosquitoData, mosquitoData.response]);   
 
        useEffect(() => {
            import("leaflet").then((module) => {
              setL(module);
            });
          }, []);

    // *** functions *** //
    function SET_coordinates(latitude: number, longitude: number, zoom: number) {
   
        // check if the new values are within the allowed range (clip the values if not)
        longitude = Math.max(-rangeLong, Math.min(rangeLong, longitude));
        latitude = Math.max(-rangeLat, Math.min(rangeLat, latitude));
        zoom = Math.max(minZoom, Math.min(maxZoom, zoom));

        // round the values to two decimal places
        longitude = Math.round(longitude * calcer) / calcer;
        latitude = Math.round(latitude * calcer) / calcer;
        zoom = Math.round(zoom * 100) / 100;

        // update the state
        setCoordinates([latitude, longitude, zoom]);
    }

   
   /*************************
  * *** DECTECT REZISE *** *
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
   useEffect(() => {
    resetTimeout(time);
    isLoadingSpinner.current = true;
    let delay = 500;
    switch (curMouseEvent.current) {
        case "wheel":
            delay = 800;
            break;
        case "opacity":
            delay = 150;
            break;
        case "null":
            delay = 500;
            break;
    }
    LoadingSpinner();
    time.current = setTimeout(() => {
            setisUpdate(!isUpdate);
            isLoadingSpinner.current = false;
            delay = 1000;
            if (map &&  props.isStaticAutoFitFullSize) {
                const geoLayer = L.geoJSON(mapData); // Ensure geoLayer is initialized with mapData
                let bounds = geoLayer.getBounds();
                bounds = bounds.pad(-1.05);
                map.fitBounds(bounds);
            }
            //console.log("changed:", isMouseEvent, longitude, latitude, zoom);
    }, delay);
}, [latitude, longitude, zoom, isMouseEvent, rawMosquitoData, curColroMapType, layerOpacity, dimensions]
);


const getMapIntance = () => {
    if (!mapRef.current) return null;
    const map = mapRef.current;
    return map;
}
const map = getMapIntance();


function MapPosUpdates() {
    useEffect(() => {
        if (!map) return ;
        const currentCenterLat = Math.round(map.getCenter().lat * calcer) / calcer;
        const currentCenterLng = Math.round(map.getCenter().lng * calcer) / calcer;
        const currentZoom = Math.round(map.getZoom() * 100) / 100;

        if (currentCenterLat !== latitude || currentCenterLng !== longitude || currentZoom !== zoom) {
            //console.log("Map position updated:", { latitude, longitude, zoom });
            map.setView([latitude, longitude], zoom);
        }
    }, [latitude, longitude, zoom]);
    return null;
}



function DrawMapPolygons() {

    

    useEffect(() => {
       
        if (!map || isLoading_mapData || isLoading_MosquitoData || !mosquitoData.response) return ;
       

        // Remove previous layers if they exist
        map.eachLayer((layer) => {
            if (layer instanceof L.GeoJSON) {
                map.removeLayer(layer);
               
            }
        });
        let geoLayer: any;
       try{
           
            geoLayer = L.geoJSON(mapData, {
                style: (feature: GeoJSON.Feature) => {
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
                            if (map) {
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
        catch(e) {
            let erroMsg = { ERROR: "ERROR: while retriving geo data." +e};
            let res = <div>{String(erroMsg['ERROR'])}</div>;
            console.log("Error:", erroMsg);
        };

        
        return () => {
            if (map) {
                map.eachLayer((layer) => {
                    if (layer instanceof L.GeoJSON) {
                        map.removeLayer(layer);
                    }
                });
            }
        };
    }, [mapData, isLoading_mapData, map, mosquitoData, curColroMapType, selectedFeature]);


    return null;
}


function MapTransition() {
    useEffect(() => {
        if (!map) return ;
        if(!props.isApplySelectionsTransition) {return;};

        let curCenter;
        let geometry = contextT.mapSelectionObj.geometry;
                if (geometry.type === "Polygon") {
                    curCenter = L.geoJSON(geometry).getBounds().getCenter();
                } else if (contextT.mapSelectionObj.geometry.type === "MultiPolygon") {
                    curCenter = L.geoJSON(geometry).getBounds().getCenter();
                }
            if (curCenter && curCenter.lat !== undefined && curCenter.lng !== undefined) {
               /* map.panTo(curCenter, {
                    animate: true,
                    duration: 1.0, // Duration of the pan animation in seconds
                    easeLinearity: 0.8, // Controls the easing of the animation
                });*/
            const svg = d3.select(map.getContainer()).select("svg");
            const interpolateLat = d3.interpolate(latitude, curCenter.lat);
            const interpolateLong = d3.interpolate(longitude, curCenter.lng);
            let interpolateZoom = d3.interpolate(zoom,  zoom * 0.6);
            resetTimeout(time);

            svg.transition()
                .duration(duration_mapTransition)
                .on("end", () => {
                    console.log("Transition ended");
                })
                .tween("coordinates", () => (t) => {
                    const prarbT = (x: number): number => {
                        return x * x;
                    };
                    let tnew = 1 - prarbT(t * 2 - 1.0);
                    let newZoom = interpolateZoom(tnew);
                    const newLat = interpolateLat(t);
                    const newLong = interpolateLong(t);
                    

                    SET_coordinates(newLat, newLong, newZoom);
                });
            }

        }, [contextT.mapSelectionObj]);
            return null;
}

function MapWatchRezies() {
useEffect(() => {
    if (!map) return ;
    if (dimensions.width && dimensions.height) {
      map.invalidateSize();
    }
  }, [dimensions]);
}

function MapMouseEvents() {
    let c = useInterfaceContext();
    let debug = false;
    useEffect(() => {
        if (!map || isLoading_MosquitoData) return ;
        if (!props.isStaticAutoFitFullSize) {
            const handleMouseEvent = () => {
                let curCenter = map.getCenter();
                let curZoom = map.getZoom();
                curCenter.lat = Math.round(curCenter.lat * calcer) / calcer;
                curCenter.lng = Math.round(curCenter.lng * calcer) / calcer;
                curZoom = Math.round(curZoom * 100) / 100;
            
                if (curCenter && zoom) {
                    if(curCenter.lng !== longitude || curCenter.lat !== latitude || curZoom !== zoom) {
                        //console.log("curZoom:", curZoom, "curCenter:", curCenter);

                        SET_coordinates(curCenter.lat, curCenter.lng, curZoom);
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
                    if (map) {
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
       
            map.on("mouseout", () => {
                removeAllTooltips();
            }
            );
           // map.on("mousemove", handleMouseEvent);
          //  map.on("zoom", handleMouseEvent);
    
            // Cleanup function to remove event listeners when component unmounts
            return () => {
                map.off("moveend", handleMouseEvent);
                map.off("zoomend", handleMouseEvent);
                map.off("mousemove", handleMouseMove);
                map.off("zoom", handleMouseEvent);
            };
        }
    }, [isUpdate, visData] ); 
    return null;
}

function removeAllTooltips() {
    if (!map) return;
    const svg = d3.select(map.getContainer()).select("svg");
    map.eachLayer(layer => {
        if (layer instanceof L.Tooltip) {
            map.removeLayer(layer); // Remove each tooltip layer
        }
    });
}

function MapDistanceProvider() {
   
     useEffect(() => {
        if (!map) return;

        const projection = d3.geoEquirectangular()
                    .center([longitude, latitude])
                    .scale((dimensions.width / (2 * Math.PI)) * Math.pow(2, zoom))
                    .translate([dimensions.width / 2, dimensions.height / 2]);

        // using d3 projection since leaflet projection is not accurate enough (causes issues with the scale bar)
        // numeric inaccuracy in leaflet projection lead to jumping forward and backward of the km ticks during transition animation
        const point1 = projection([0, 0]) || [0, 0];
        const point2 = projection([0, 1]) || [0, 0]; // 1 degree latitude is 111.321 km

        const distanceInPixels = Math.abs(point2[1] - point1[1]) / 111.321;

        screenDistanceOneKM.current = distanceInPixels; // Keep 4 decimal placesconst point1 = map.latLngToContainerPoint([0 , 0]);

    }, [isUpdate, zoom]);

    return null;
}

let curSelectedStateID = React.useRef(dataTableContext.selectedStateID);
    useEffect(() => {
        curSelectedStateID.current = dataTableContext.selectedStateID;
    }, [dataTableContext.selectedStateID]);


DrawMapPolygons();
ColorMapBySelection()
MapPosUpdates();
MapTransition();
MapMouseEvents ();
MapWatchRezies();
MapDistanceProvider();
MapDrawLayer();
  


    function ColorMapBySelection() {
        useEffect(() => {
            if (!map || isLoading_mapData || !mapData || isLoading_MosquitoData || !mosquitoData.response) return;

            map.eachLayer((layer) => {
                if (layer instanceof L.GeoJSON) {
                    (layer as L.GeoJSON).eachLayer((subLayer) => {
                        if (subLayer instanceof L.Path) {
                            const feature = (subLayer as L.GeoJSON).feature;
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
        , [mapData, isLoading_mapData, map, mosquitoData, curColroMapType, c.selectedStateID, layerOpacity]);
    }


    // longitude
    const handleInputSlider_lng = (event: React.ChangeEvent<HTMLInputElement>) => {
        SET_coordinates(latitude, Number(event.target.value), zoom);
    };
    // latitude
    const handleInputSlider_lat = (event: React.ChangeEvent<HTMLInputElement>) => {
        SET_coordinates( Number(event.target.value), longitude, zoom);
    };

    const handleInputSlider_zoom = (event: React.ChangeEvent<HTMLInputElement>) => {
        SET_coordinates(latitude, longitude, Number(event.target.value));
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


    let colorMap = d3.scaleSequential(availableColorMaps[curColroMapType as keyof typeof availableColorMaps]);
    colorMap.domain([minVal, maxVal]);
    if (curColroMapType === "interpolateRdBu") {
        colorMap.domain([maxVal, minVal ]);
    } 
   
    

    useEffect(() => {
       if(mapUIsettings.isDistance_legend)
            appendScaleBar();
            //console.log("Zoom:", zoom, screenDistanceOneKM);
        // avoid multiple calls
        resetTimeout(mapTime);
        mapTime.current = setTimeout(() => {
            console.log("DrawLayer");
        }, 200);
    }, [latitude, longitude, zoom, mapData, mosquitoData, dimensions, selectedFeature, screenDistanceOneKM]);
   
    

function resetTimeout( ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null> = time) {
    if(ref.current) {
        clearTimeout(ref.current);
    }
}

// draw layer
// Draw Layer
function MapDrawLayer() {
    const timer = 0;
    const debug = false;
    const canvasRef = useRef<HTMLCanvasElement | null>(null); // Reuse canvas instead of recreating
    const overlayRef = useRef<L.ImageOverlay | null>(null);

    useEffect(() => {
        if (!map) return;

        // Don't render if the layer is not drawn or data is loading
        if (!isLayerDrawnCanvas || isLoading_MosquitoData || mosquitoData.error != null || visData.size === 0) return;

        // Reuse existing canvas if available
        let canvas = canvasRef.current;
        if (!canvas) {
            canvas = document.createElement("canvas");
            canvasRef.current = canvas;
        }

        const canvasSize = { width: dimensions.width , height: dimensions.height }; 
        canvas.width = canvasSize.width;
        canvas.height = canvasSize.height;
        canvas.style.width = `${canvasSize.width}px`;
        canvas.style.height = `${canvasSize.height}px`;

        const context = canvas.getContext("2d");
        if (!context) return;

        context.clearRect(0, 0, canvas.width, canvas.height);

        // Draw visualization data on canvas
       for (const [key, d] of visData)  {
            if (d.geometry) {
               
                const coords = d.geometry.map(coord => {
                    return map.latLngToContainerPoint(new L.latLng(coord[0], coord[1]));
                });

                if (coords.length > 3) {
                    const x1 = coords[0].x;
                    const y1 = coords[0].y;
                    const x2 = coords[1].x;
                    const y2 = coords[3].y;

                    context.fillStyle = d3.color(colorMap(Number(d.feature)))?.copy({ opacity: layerOpacity })?.toString() || "rgba(0, 0, 0, 0)";
                    context.fillRect(x1, y1, Math.abs(x2 - x1), Math.abs(y2 - y1));

                    // Add gridID as text to the top-right corner of the grid cell
                    if (debug) {
                        context.fillStyle = "black";
                        context.font = "14px Arial";
                        context.textAlign = "right";
                        context.textBaseline = "top";
                        const point = map.containerPointToLatLng(L.point(x1, y1))
                        context.fillText(Math.round(point.lat*100)/100 +", "+ Math.round(point.lng*100)/100, x2 - 5, y1 + 40);
                        context.fillText(key.toString(), x2 - 5, y1 + 23);
                        context.fillText(d.feature.toString(), x2 - 5, y1 + 5);
                    }
                }
            }
        };
        

        const imageUrl = canvas.toDataURL();
        
        // Calculate the bounds that correspond to the image
        // Assuming the image represents a rectangular region; you can customize the bounds if needed
        const bounds = map.getBounds() || L.latLngBounds([0, 0], [0, 0]);


        if (overlayRef.current) {
            // Remove previous overlay smoothly
            const prevOverlay = overlayRef.current;
            const prevElement = prevOverlay.getElement();
            /*
            if (prevElement) {
                prevElement.style.transition = `opacity ${timer}ms ease-out`;
                prevElement.style.opacity = "0";
            }
                */

            setTimeout(() => {
                if (map.hasLayer(prevOverlay)) {
                    map.removeLayer(prevOverlay);
                }
            }, 1);
        }

        // Create and store the new overlay with the calculated bounds
        const newOverlay = L.imageOverlay(imageUrl, bounds);
        overlayRef.current = newOverlay;
        newOverlay.addTo(map);

        // Fade-in effect
        const overlayElement = newOverlay.getElement();
        if (overlayElement) {
            //overlayElement.style.opacity = "0"; // Initial opacity set to 0
            //overlayElement.style.transition = `opacity ${timer}ms ease-in`;
            setTimeout(() => {
                overlayElement.style.opacity = layerOpacity.toString(); // Fade-in after 0ms
            }, 0);
        }

    }, [isUpdate]);

    return null;
}


    function appendScaleBar() {
        const innerMargins = {top: 5, right: 19, bottom: 5, left: 19};
        const CLASS_legends = "legends"+chart;
        if(!mapUIsettings.isDistance_legend) {
            return;
        }
       
        let lWidth = scaleLegDims.width-innerMargins.left-innerMargins.right;
        // clean up empty legends
        d3.selectAll("."+CLASS_legends).each(function() {
            if (d3.select(this).selectAll("*").empty()) {
                d3.select(this).remove();
            }
        });
         // remove existing scale bar
         d3.select("#"+id_scaleBar).remove();

        let scaleBar = d3.select(divRef.current)
            .append("svg")
            .attr("width", dimensions.width)
            .attr("height", dimensions.height)
            .attr("class", CLASS_legends)
            .style("position", "absolute")
            .style("float", "bottom")
            .style("pointer-events", "none")
            .append("g")
            .attr("id", id_scaleBar)
            .attr("transform", `translate(${scaleLegDims.posX}, ${mapSvgHeight - scaleLegDims.height - scaleLegDims.posY})`);

        scaleBar.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", scaleLegDims.width )
            .attr("height", scaleLegDims.height )
            .attr("fill", "rgba(255, 255, 255, 0.7)")
            .attr("stroke", "grey")
            .attr("stroke-width", 1);

        const scale = d3.scaleLinear()
            .domain([0, lWidth/screenDistanceOneKM.current])
            .range([0, scaleLegDims.width-innerMargins.left-innerMargins.right]);

        
        const scaleBarGroup = scaleBar.append("g")
            .attr("transform", `translate(${innerMargins.left}, ${innerMargins.top})`);

        scaleBarGroup.append("rect")
            .attr("width", scaleLegDims.width - innerMargins.left - innerMargins.right)
            .attr("height", barWidth)
            .attr("fill", "black");

        const axis = d3.axisBottom(scale)
            .ticks(2)
            .tickSizeOuter(0)
            .tickFormat(d => `${Math.round(Number(d))} km`);

        scaleBarGroup.append("g")
            .attr("transform", `translate(0, ${barWidth})`)
            .call(axis);
    }

  const appendColorMap = useCallback(() => {
      if(isLoading_MosquitoData || mosquitoData.error !== null) {
          return;
      }
      let unit = "";
  
      // abort redraw if selected feature is not available / metadata not ready yet
      if(metaData[selectedFeature] != undefined) {
          unit = metaData[selectedFeature].dimension;
      }/*else {
          return;
      }*/
  
      if(mapUIsettings.isColorMap_legend) {
              // remove existing scale bar
              const CLASS_legends = "legends"+chart;
      d3.selectAll("."+CLASS_legends).each(function() {
          if (d3.select(this).selectAll("*").empty()) {
              d3.select(this).remove();
          }
      });
  
      let innerMargins = {top: 7, right: 10, bottom: 7, left: 5};
      d3.select("#"+id_colorMap).remove();
      // clean up empty legends
          let colorBar = d3.select(divRef.current).append("svg")
              .attr("width", dimensions.width)
              .attr("height", dimensions.height)
              .attr("class", CLASS_legends)
              .style("position", "absolute")
              .style("float", "bottom")
              .style("float", "right")
              .style("pointer-events", "none")
              .attr("id", id_colorMap)
              .append("g")
              .attr("transform", `translate(${colMapDims.posX}, ${ colMapDims.posY})`);
  
              colorBar.append("rect")
              .attr("x", 0)
              .attr("y", 0)
              .attr("width",  colMapDims.width)
              .attr("height", colMapDims.height)
              .attr("fill", "rgba(255, 255, 255, 0.7)")
              .attr("stroke", "grey")
              .attr("stroke-width", 1);
  
  
          const colorMap = d3.scaleSequential(availableColorMaps[curColroMapType as keyof typeof availableColorMaps])
  
          let minGoodVal = alignFeature_to_Metadata(minVal, selectedFeature, metaData).value;
          let maxGoodVal = alignFeature_to_Metadata(maxVal, selectedFeature, metaData).value;
          let unit = alignFeature_to_Metadata(minVal, selectedFeature, metaData).unit;
          [minGoodVal, maxGoodVal] = getGoodReadableRange(minGoodVal, maxGoodVal);
          colorMap.domain([minGoodVal, maxGoodVal]);
  
          // Adjust the color map domain for interpolateRdBu to ensure it is symmetric around zero
          // if minGoodVal < 0 && maxGoodVal > 0
          if (curColroMapType === "interpolateRdBu") {
              if((minGoodVal < 0 && maxGoodVal > 0) || unit === "K" || unit === "°C") {
                  const m = Math.max(Math.abs(minGoodVal), Math.abs(maxGoodVal));
                  minGoodVal = -m;
                  maxGoodVal = m;
                  colorMap.domain([maxGoodVal, minGoodVal]);
              }
          }
  
          const legendSvg = colorBar.append("g")
              .attr("width", colMapDims.width-innerMargins.left-innerMargins.right)
              .attr("height", colMapDims.height-innerMargins.top-innerMargins.bottom) 
              .attr("transform", `translate(${innerMargins.left}, ${innerMargins.top})`);
  
          const gradient = legendSvg.append("defs")
              .append("linearGradient")
              .attr("id", "gradient"+chart)
              .attr("x1", "0%")
              .attr("y1", "100%")
              .attr("x2", "0%")
              .attr("y2", "0%");
  
          gradient.selectAll("stop")
              .data(d3.range(minGoodVal, maxGoodVal, (maxGoodVal - minGoodVal) / 100))
              .enter()
              .append("stop")
              .attr("offset", d => `${((d - minGoodVal) / (maxGoodVal - minGoodVal)) * 100}%`)
               .attr("stop-color", d => d3.color(colorMap(d))?.copy({ opacity: layerOpacity })?.toString() || colorMap(d));
  
          legendSvg.append("rect")
          .attr("x", 0+"px")
          .attr("y", 0+"px")
          .attr("width", barWidth+"px")
          .attr("height", colMapDims.height-innerMargins.top-innerMargins.bottom+"px")
          .style("fill", "url(#gradient"+chart+")");
  
          const legendScale = d3.scaleLinear()
              .domain([minGoodVal, maxGoodVal])
              .range([colMapDims.height-innerMargins.top-innerMargins.bottom-1, 0]);
  
          const legendAxis = d3.axisRight(legendScale)
          .tickValues([...d3.range(minGoodVal, maxGoodVal, (maxGoodVal - minGoodVal) / 5), maxGoodVal]) // 
          .tickFormat(d => { 
              let rawValue = d as unknown as number;
              return` ${rawValue.toLocaleString(locale, { maximumFractionDigits: 3 }) } ${unit}
              `})
          .tickSize(6);
  
          legendSvg.append("g")
              .attr("transform", `translate(${barWidth}, 0)`)
              .call(legendAxis);
      }
  }, [isLoading_MosquitoData, mosquitoData, selectedFeature, metaData, mapUIsettings.isColorMap_legend, colMapDims, dimensions, id_colorMap, curColroMapType, minVal, maxVal, barWidth, chart, layerOpacity]);

    
    useEffect(() => {
        appendColorMap();
        appendScaleBar();
    },[isUpdate]);


 
    useEffect(() => {
        // Initialize the selected feature when colNames are available
        if (mosquitoData.response !== undefined && !isLoading_MosquitoData && mosquitoData.error === null && selectedFeature === "") {
            let index = Math.ceil(mosquitoData.header.length / 2)-1;
            setSelectedFeature(mosquitoData.header[index]);
            contextT.setCurFeature(mosquitoData.header[index]);
            contextT.setCurDatasetURL(selectedDataset);
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

    <PrintDataLoadingERRORs listOfERRORs={collectDataLoadingEROORS}/>
    <SizeHook element={element} sizeRef={sizeRef} setSize={setSizes}/>
    {isSettingsOpen && (
    <div className={`absolute w-full mt-2 ml-1 pr-2 grid grid-cols-12 md:grid-cols-12`}>
    
     {mapUIsettings.isLatitude_slider && (
         <div {...UI_elementStyler()}>
        {t.rich('latitude', {...t_richConfig})}: {Math.round(latitude*rounder)/rounder}
            <input
                type="range"
                value={latitude}
                onChange={handleInputSlider_lat}
                min={-rangeLat}
                max={rangeLat}
                className="w-full"
            />
        </div>
     )}
      {mapUIsettings.isLongnitude_slider && (
        <div {...UI_elementStyler()}>
        {t.rich('longnitude', {...t_richConfig})}: { Math.round(longitude*rounder)/rounder}
            <input
                type="range"
                value={longitude}
                onChange={handleInputSlider_lng}
                min={-rangeLong}
                max={rangeLong}
                className="w-full"
            />
        </div>
    )}
      {mapUIsettings.isZoom_slider && (
           <div {...UI_elementStyler()}>
            Zoom: {Math.round(zoom*rounder)/rounder} 
            <input
                type="range"
                value={zoom}
                onChange={handleInputSlider_zoom}
                step={zoomStep}
                min={minZoom}
                max={maxZoom}
                className="w-full"
            />
        </div>
     )}
    {mapUIsettings.isDatasetSelection_dropdown && (
        <div {...UI_elementStyler()}>
        <label htmlFor="dataset-select">
        {t.rich('data_set', {...t_richConfig})}:
        </label>
        {listOfDataSets && 
        <Select defaultValue={Object.keys(listOfDataSets)[0]} onValueChange={(value) => { 
            const dataset = listOfDataSets[value];
            curDatasetname.current = dataset;
            let url = apiRoutes.fetchDbData({ relationName: dataset, feature: "" })
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
    {mapUIsettings.isFeatureSelection_dropdown && (
        <div {...UI_elementStyler()}>
        <label htmlFor="dataset-select">
             {t.rich('feature', {...t_richConfig})}:
        </label>
        {colNames && metaData && (
       <Select value={selectedFeature} onValueChange={(value) => { 
            let url = apiRoutes.fetchDbData({ relationName: curDatasetname.current, feature: value });
            //console.log("setCurFeatureName:", value);
            //console.log("setCurDatasetName:",url);
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
                    {colNames.map((name, index) => ( 
                        (metaData[colNames[index] as keyof typeof metaData]?.availability === "1" ||  metaData[colNames[index] as keyof typeof metaData]?.availability === undefined) && (
                        <SelectItem key={index} value={colNames[index]}>
                            <b>{colNames[index]+" ["+metaData[colNames[index] as keyof typeof metaData]?.dimension+"]"}</b>
                            <i>{" "+metaData[colNames[index] as keyof typeof metaData]?.description}</i>
                        </SelectItem>)
                    ))}
                   </SelectGroup>
      </SelectContent>
    </Select>
    )}
    </div>)}

    {mapUIsettings.isColorMapSelection_dropdown && ischanged && (
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
   
    <LeafletMapComponent ChartPorps={leafProps}>
     <MapContent />
    </LeafletMapComponent>
    </div>
</div>
    );
};

function getParamsOfURL(url: string) {
  const urlParams = new URLSearchParams(url.split('?')[1]);
  const paramsDict: { [key: string]: string } = {};
  urlParams.forEach((value, key) => {
    paramsDict[key] = value;
  });
  return paramsDict;
}

export default  LeafD3MapGermanyComponent;
export { LeafD3MapGermanyProps };
