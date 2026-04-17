"use client";
import React, { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot, Root } from "react-dom/client";
import dynamic from 'next/dynamic';

const ScaleControl = dynamic(() => import("react-leaflet").then(mod => mod.ScaleControl), { ssr: false });
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
    getCountryCenterFromMapData,
    getContrastTextColorForBgColor,
    getOceanMaskGeoJSON,
} from './helpers';
import {
    metaDataT,
    alignFeature_to_Metadata,
} from '../metaDataHandler';
import {availableColorMaps} from './constants';
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
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox";
import { useLocale ,useTranslations } from "next-intl";
import { t_richConfig, country_names, country_names_de, dbDATA, categoricalColors, categoryCoordsMap } from "../../../const_store";
import { Locale } from '@/i18n/routing';
import useChartResizer from '../../../hooks/customPlotHooks';
import * as GEOjson from 'geojson';
import {HoverCardTooltip} from '../../layout/infoCards';
import {MDXContentProvider} from '../../../../../messages/markdown/MDXContentProvider';

// Icons
import {Settings,
    X} from "iconoir-react";
import  {MosquitoIcon} from  "../../../../../messages/reactIcons"

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
import LeafletMapComponent, {LeafletComponentPorps} from './baseMap';
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
import { getGoodReadableRange } from '../maps/helpers';
import type * as Leaflet from "leaflet";
import { metadata } from '@/app/[locale]/layout';

let leafProps = new LeafletComponentPorps("LeafletMap1", apiRoutes.FETCH_WORLD_MAP, "exampleVar");
leafProps.center = [-20, 25.8];
leafProps.zoom = 1.5;

const rangeLong = 180;
const rangeLat = 90;
const mapFlyTransitionTime = 1800;
const maxZoom = 13;
const minZoom = 0.1;
const zoomStep = 0.01;

const legendDistanceToMapBorderX = 5;
const legendDistanceToMapBorderY = 5;
const leafletLogoHeight = 14;

let NumbersAfterComma = 3;
let calcer = Math.pow(10, NumbersAfterComma);

// Default dates moved to state within the component


/**
 * Class representing the properties for a D3 map with layer.
 */
class LeafD3MapLayerProps {
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
        areSettingsOpen?: boolean;
        isSettingsBelndAnimation?: boolean;
        isAutoHideSettingsToggle?: boolean;
        isLongnitude_slider: boolean;
        isLatitude_slider: boolean;
        isZoom_slider: boolean;
        isLatLngZoomOverlay?: boolean;
        isColorMapSelection_dropdown: boolean;
        isFeatureSelection_dropdown: boolean;
        isDatasetSelection_dropdown: boolean;
        isCountrySelection_dropdown: boolean;
        isCountrySelection_dropdownMapBased: boolean;
        isDoNotApplyCountryFromContext: boolean;
        // `isDatePicker` enables the display of the time range component
        isDatePicker: boolean;
        isDistance_legend: boolean;
        isColorMap_legend: boolean;
        filterString_for_availableDataset_include: string;
        filterString_for_availableDataset_exclude: string;
        filterString_for_availableFeature: string;
        defaultDatasetName: string;
        defaultFeatureName: string;
        //`inCovidDataView` determines whether the map is in a specific data visualization mode for COVID-19 world data
        inCovidDataView?: boolean;
        defaultDatasetURL: string;
        defaultFeatureColorMap: string;
        isPresenceData: boolean;
        isPresenceDataChecked: boolean;
        presenceDataColor: string; // "rgb(239, 23, 23)"
        isSequenceMetaData: boolean;
        isSequenceMetaDataChecked: boolean;
        defaultDonutSize: number;
        defaultLayerOpacity: number;
        //`isCountryLevelData` determines for the COVID-19 world data to be shown on the map on country level
        // i.e. total feature value for the whole country
        isCountryLevelData?: boolean;
        //`isSubregionLevelData` determines for the COVID-19 world data to be shown on the map on subregion level
        // i.e. total feature value for all the available subregions of a country
        isSubregionLevelData?: boolean;
        //`dataFilteringCheckboxes` enables the showing of the checkboxes for the 'Country Level' and 'Subregion Level'
        dataFilteringCheckboxes?: boolean;
    } ;

    mapInteractions: {
        disableMouse?: boolean;
        disableScroll?: boolean;
        disableClick?: boolean;
    };

    mapDataSets:{
        isGridData: boolean;
        isPresenceData: boolean;
        isSequenceMetaData: boolean;
        isCityNames?: boolean;
    }
    mapStyles: {
        strokeWidth: number;
        strokeColor: string;
        fillColor: string;
        fillOpacity: number;
        backgroundColor: string;
    }
    /**
     * Flag to indicate if selections / transitions should be applied.
     */
    isApplyContextData: boolean;
    isSetIntialContextDataFromComponent?: boolean;
    isSyncMapCoordsOnTheFly_SETTER?: boolean;
    isSyncMapCoordsOnTheFly_RECIEVER?: boolean;
    isApplyTransitions?: boolean;

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
                areSettingsOpen?: boolean;
                isSettingsBelndAnimation?: boolean;
                isAutoHideSettings?: boolean;
                isLongnitude_slider?: boolean;
                isLatitude_slider?: boolean;
                isZoom_slider?: boolean;
                isLatLngZoomOverlay?: boolean;
                isColorMapSelection_dropdown?: boolean;
                isFeatureSelection_dropdown?: boolean;
                isCountrySelection_dropdown?: boolean;
                isCountrySelection_dropdownMapBased?: boolean;
                isDoNotApplyCountryFromContext?: boolean;
                datePicker?: boolean;
                isDatasetSelection_dropdown?: boolean;
                isDistance_legend?: boolean;
                isColorMap_legend?: boolean;
                filterString_for_availableDataset?: string;
                filterString_for_availableDataset_avoid?: string;
                filterString_for_availableFeature?: string;
                defaultDatasetName?: string;
                defaultFeatureName?: string;
                defaultDatasetURL?: string;
                defaultFeatureColorMap?: string;
                isPresenceData?: boolean;
                isPresenceDataChecked?: boolean;
                presenceDataColor?: string;
                isSequenceMetaData?: boolean;
                isSequenceMetaDataChecked?: boolean;
                defaultDonutSize?: number;
                inCovidDataView?: boolean;
                defaultLayerOpacity?: number;
           },
           mapInteractions?: {
                disableMouse?: boolean;
                disableScroll?: boolean;
                disableClick?: boolean;
           },
           mapDataSets?: {
                isGridData: boolean;
                isPresenceData: boolean;
                isSequenceMetaData: boolean;
                isCityNames: boolean;
           },
           center?: [number, number],
           zoom?: number,
           mapStyles?: {
               strokeWidth?: number;
               strokeColor?: string;
               fillColor?: string;
               fillOpacity?: number;
               backgroundColor?: string;
           },
           isStaticAutoFitFullSize?: boolean,
           isApplySelectionsAndTransitions?: boolean,
           isApplyTransitions?: boolean,
           isProjection_equirectangular?: boolean,
           isSyncMapCoordsOnTheFly_SETTER?: boolean,
           isSyncMapCoordsOnTheFly_RECIEVER?: boolean,
           isSetContextData?: boolean
       ) {
           mapUIsettings = mapUIsettings || {};
           this.chartName = chartName || "D3mapLayer";
           this.mapDataURL = mapDataURL || apiRoutes.FETCH_WORLD_MAP;
           this.dataURL = dataURL;
           this.center = center !== undefined ? center : [9.7, 52];
           this.zoom = zoom !== undefined ? zoom : 2;

           this.mapUIsettings = {
            areSettingsOpen: mapUIsettings.areSettingsOpen !== undefined ? mapUIsettings.areSettingsOpen : true,
            isSettingsBelndAnimation: mapUIsettings.isSettingsBelndAnimation !== undefined ? mapUIsettings.isSettingsBelndAnimation : false,
            isAutoHideSettingsToggle: mapUIsettings.isAutoHideSettings !== undefined ? mapUIsettings.isAutoHideSettings : false,
            isLongnitude_slider: mapUIsettings.isLongnitude_slider !== undefined ? mapUIsettings.isLongnitude_slider : true,
            isLatitude_slider: mapUIsettings.isLatitude_slider !== undefined ? mapUIsettings.isLatitude_slider : true,
            isZoom_slider: mapUIsettings.isZoom_slider !== undefined ? mapUIsettings.isZoom_slider : true,
            isLatLngZoomOverlay: mapUIsettings.isLatLngZoomOverlay !== undefined ? mapUIsettings.isLatLngZoomOverlay : true,
            isColorMapSelection_dropdown: mapUIsettings.isColorMapSelection_dropdown !== undefined ? mapUIsettings.isColorMapSelection_dropdown : true,
            isFeatureSelection_dropdown: mapUIsettings.isFeatureSelection_dropdown !== undefined ? mapUIsettings.isFeatureSelection_dropdown : true,
            isCountrySelection_dropdown: mapUIsettings.isCountrySelection_dropdown !== undefined ? mapUIsettings.isCountrySelection_dropdown : true,
            isCountrySelection_dropdownMapBased: mapUIsettings.isCountrySelection_dropdownMapBased !== undefined ? mapUIsettings.isCountrySelection_dropdownMapBased : false,
            isDoNotApplyCountryFromContext: mapUIsettings.isDoNotApplyCountryFromContext !== undefined ? mapUIsettings.isDoNotApplyCountryFromContext : false,
            isDatePicker: mapUIsettings.datePicker !== undefined ? mapUIsettings.datePicker : true,
            isDatasetSelection_dropdown: mapUIsettings.isDatasetSelection_dropdown !== undefined ? mapUIsettings.isDatasetSelection_dropdown : true,
            isDistance_legend: mapUIsettings.isDistance_legend !== undefined ? mapUIsettings.isDistance_legend : true,
            isColorMap_legend: mapUIsettings.isColorMap_legend !== undefined ? mapUIsettings.isColorMap_legend : true,
            filterString_for_availableDataset_include: mapUIsettings.filterString_for_availableDataset !== undefined ? mapUIsettings.filterString_for_availableDataset : "",
            filterString_for_availableDataset_exclude: mapUIsettings.filterString_for_availableDataset_avoid !== undefined ? mapUIsettings.filterString_for_availableDataset_avoid : "?",
            filterString_for_availableFeature: mapUIsettings.filterString_for_availableFeature !== undefined ? mapUIsettings.filterString_for_availableFeature : "",
            isPresenceData: mapUIsettings.isPresenceData !== undefined ? mapUIsettings.isPresenceData : false,
            isPresenceDataChecked: mapUIsettings.isPresenceDataChecked !== undefined ? mapUIsettings.isPresenceDataChecked : false,
            presenceDataColor: mapUIsettings.presenceDataColor !== undefined ? mapUIsettings.presenceDataColor : "",
            isSequenceMetaData: mapUIsettings.isSequenceMetaData !== undefined ? mapUIsettings.isSequenceMetaData : false,
            isSequenceMetaDataChecked: mapUIsettings.isSequenceMetaDataChecked !== undefined ? mapUIsettings.isSequenceMetaDataChecked : false,
            defaultDonutSize: mapUIsettings.defaultDonutSize !== undefined ? mapUIsettings.defaultDonutSize : 40,
            defaultDatasetName: mapUIsettings.defaultDatasetName !== undefined ? mapUIsettings.defaultDatasetName : "",
            inCovidDataView: mapUIsettings.inCovidDataView !== undefined ? mapUIsettings.inCovidDataView : false,
            defaultFeatureName: mapUIsettings.defaultFeatureName !== undefined ? mapUIsettings.defaultFeatureName : "",
            // ToDo: defaultDatasetURL should be a private variable + also use setter and getter!
            defaultDatasetURL: mapUIsettings.defaultDatasetName !== undefined ? apiRoutes.fetchDbData({ relationName: mapUIsettings.defaultDatasetName, feature: mapUIsettings.defaultFeatureName || "" }) : "",
            defaultFeatureColorMap: mapUIsettings.defaultFeatureColorMap !== undefined ? mapUIsettings.defaultFeatureColorMap : "",
            defaultLayerOpacity: mapUIsettings.defaultLayerOpacity !== undefined ? mapUIsettings.defaultLayerOpacity : 0.85,
        };


        this.mapInteractions = {
            disableMouse: mapInteractions?.disableMouse !== undefined ? mapInteractions.disableMouse : false,
            disableScroll: mapInteractions?.disableScroll !== undefined ? mapInteractions.disableScroll : false,
            disableClick: mapInteractions?.disableClick !== undefined ? mapInteractions.disableClick : false,
        };
        this.mapDataSets =  {
            isGridData: mapDataSets?.isGridData !== undefined ? mapDataSets.isGridData : true,
            isPresenceData: mapDataSets?.isPresenceData !== undefined ? mapDataSets.isPresenceData : true,
            isSequenceMetaData: mapDataSets?.isSequenceMetaData !== undefined ? mapDataSets.isSequenceMetaData : true,
            isCityNames: mapDataSets?.isCityNames !== undefined ? mapDataSets.isCityNames : true
        };
        this.mapStyles = {
            strokeWidth: mapStyles?.strokeWidth !== undefined ? mapStyles.strokeWidth : 1.5,
            strokeColor: mapStyles?.strokeColor !== undefined ? mapStyles.strokeColor : "#000000",
            fillColor: mapStyles?.fillColor !== undefined ? mapStyles.fillColor : "#ffffffff",
            fillOpacity: mapStyles?.fillOpacity !== undefined ? mapStyles.fillOpacity : 0.0,
            backgroundColor: mapStyles?.backgroundColor !== undefined ? mapStyles.backgroundColor : "#ffffff",
        };

        this.isStaticAutoFitFullSize = isStaticAutoFitFullSize || false;
        this.isApplyContextData = isApplySelectionsAndTransitions !== undefined ? isApplySelectionsAndTransitions : true;
        this.isSetIntialContextDataFromComponent = isSetContextData !== undefined ? isSetContextData : false;
        this.isSyncMapCoordsOnTheFly_SETTER = isSyncMapCoordsOnTheFly_SETTER !== undefined ? isSyncMapCoordsOnTheFly_SETTER : false;
        this.isSyncMapCoordsOnTheFly_RECIEVER = isSyncMapCoordsOnTheFly_RECIEVER !== undefined ? isSyncMapCoordsOnTheFly_RECIEVER : false;
        this.isApplyTransitions = isApplyTransitions !== undefined ? isApplyTransitions : false;
        this.isProjection_equirectangular = isProjection_equirectangular !== undefined ? isProjection_equirectangular : false;
    }
}

const LeafD3MapLayerComponent = ({props}: {props: LeafD3MapLayerProps}) => {

    leafProps.zoom = props.zoom;
    leafProps.center = props.center;
    leafProps.isProjection_equirectangular = props.isProjection_equirectangular;

    // apply data boolean flags to UI settings
    props.mapUIsettings.isPresenceData = !props.mapDataSets.isPresenceData ? false : props.mapUIsettings.isPresenceData;
    props.mapUIsettings.isSequenceMetaData = !props.mapDataSets.isSequenceMetaData ? false : props.mapUIsettings.isSequenceMetaData;


   

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
            color: props.mapStyles?.strokeColor,
            fillColor: props.mapStyles?.fillColor,
            fillOpacity: props.mapStyles?.fillOpacity,
            weight: strokeWidth,
            fill: true,
        };

        const hoverStyle: Leaflet.PathOptions = {
            ...baseStyle,
            fillColor: "rgb(29, 73, 217)",
            fillOpacity: 0.5,
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



        if(props.mapUIsettings.isDistance_legend === false){
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

    // initialize leaflet (useEffect: avoiding SSR issues)
    const [L, setL] = useState<typeof Leaflet | null>(null);
    useEffect(() => {
        import("leaflet").then((module) => {
            setL(module);
        });
    }, []);

 
    const mapRef = useRef<L.Map | null>(null);
    function MapContent() {
        const map = useMap();
        mapRef.current = map;
        useEffect(() => {
            if (!map || !L) return;
            // Create the custom pane first if it doesn't exist
            if (!map.getPane("custom-tooltips")) {
                map.createPane("custom-tooltips");
                const customTooltipsPane = map.getPane("custom-tooltips");
                if (customTooltipsPane) {
                    customTooltipsPane.style.zIndex = "9999";
                }
            }
            // create the tooltip with the pane
            if (!toolTipRef.current) {
                toolTipRef.current = L.tooltip({ pane: "custom-tooltips" });
            }
        }, [L, map]);
        return (
            <>
                {mapUIsettings.isDistance_legend && (
                    <ScaleControl 
                        position="bottomleft" 
                        imperial={false}
                        metric={true}
                        maxWidth={100}
                    />
                )}
            </>
        );
    }

    const getMapIntance = () => {
        if (!mapRef.current) return null;
        const map = mapRef.current;
        return map;
    }
    const map = getMapIntance();


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
    let collectDataLoadingEROORS =  useRef<React.ReactNode[]>([]);
    let chart:string = props.chartName;

     
   const mapUIsettings = { ...props.mapUIsettings };

    // *** Types *** //
    type visDataT = {
        geometry: [number, number][];
        feature: number;
        visDatIdx?: number;
        rowID?: number;
    }
    type presDBdataT = {
        geometry: string
        feature: string
        longLat?: [number, number][]
        longitude?: number
        latitude?: number
        subregion_name?: string
        country_name?: string
    }
    type UniquesDB_entriesT = {
        feature: string
    }

    interface UniquesDB_entriesI extends dbDATA {
        response: UniquesDB_entriesT[]
    }
    interface presDBdataI extends dbDATA {
        response: presDBdataT[]
    }
    interface  mapMouseEvents {
        type?: string; // "hover" | "click"
        position?: [number, number];
        event?: L.LeafletMouseEvent | null;
        lastSetTime?: number;
    }

    interface CapitalProperties {
        title: {
            en:string;
            de:string;
        };
    }

    type CapitalGeometry = GEOjson.Point & { coordinates: [number, number] };

    type CapitalFeature = GEOjson.Feature<CapitalGeometry, CapitalProperties>;

    interface CapitalsFeatureCollection extends GEOjson.FeatureCollection<CapitalGeometry, CapitalProperties> {
        features: CapitalFeature[];
    }

    const [[latitude, longitude, zoom], setCoordinates] = useState<[number, number, number]>(
        [leafProps.center?.[0] ?? 0, leafProps.center?.[1] ?? 0, leafProps.zoom ?? 1]
    );
    const [isUpdate, setisUpdate] = useState(false);
    const [curColroMapType, setColorMapType] = useState<string>(props.mapUIsettings.defaultFeatureColorMap || defaultColorMap);
    const [layerOpacity, setLayerOpacity] = useState(props.mapUIsettings.defaultLayerOpacity || contextT.curLayerOpacity);
    const [selectedFilter, setSelectedFilter] = useState<string>("")
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to?: Date | undefined; } | undefined>();
    const [selectedFeature, setSelectedFeature] = useState<string>(props.mapUIsettings.defaultFeatureName || "");
    const [selectedCountry, setSelectedCountry] = useState<string>("");
    const [isSettingsOpen, setIsSettingsOpen] = useState(true);
    const [isSettingsOpenFixed, setIsSettingsOpenFixed] = useState(props.mapUIsettings.areSettingsOpen ?? true);
    const curMouseEvent = useRef<string>("null");
    const screenDistanceOneKM = useRef<number>(0);
    const curDatasetname = useRef<string>(props.mapUIsettings.defaultDatasetName || "");
    const curPropertyNames = useRef<string>("");
    const hoverCountry = useRef<string>("0");
    const toolTipRef = useRef<any>(null);
    const isHoverCountry = useRef<boolean>(false);
    const [showSuccessCountryDropdown, setShowSuccessCountryDropdown] = useState(false);
    const [showSuccessTimerangeDropdown, setShowSuccesTimerangeDropdown] = useState(false);
    const highlightedCountryRef = useRef<L.GeoJSON | null>(null);

    const [min_date, setMinDate] = useState<Date>(new Date("2020-01-01"));
    const [max_date, setMaxDate] = useState<Date>(new Date("2024-12-31"));

    // set default dataset URL
    if (props.mapUIsettings.defaultDatasetURL === "" && props.mapUIsettings.defaultDatasetName !== "") {
        props.mapUIsettings.defaultDatasetURL = apiRoutes.fetchDbData({ relationName: props.mapUIsettings.defaultDatasetName, feature: props.mapUIsettings.defaultFeatureName });
    } else {
        props.mapUIsettings.defaultDatasetURL = "";
    }

    // mosquito data (grid data)
    const [selectedDatasetURL, setSelectedDataset] = useState<string>(props.mapUIsettings.defaultDatasetURL);

    // Fetch dynamic min/max dates when dataset changes
    useEffect(() => {
        const fetchMinMax = async () => {
            const dataset = curDatasetname.current;
            if (!dataset) return;
            
            const url = apiRoutes.fetchDbData({
                relationName: dataset,
                feature: "date",
                task: "getMinMax"
            });
            
            try {
                const response = await fetch(url);
                const data = await response.json();
                if (data && data.response && data.response.min_val && data.response.max_val) {
                    setMinDate(new Date(data.response.min_val));
                    setMaxDate(new Date(data.response.max_val));
                }
            } catch (error) {
                console.error("Error fetching dynamic dates:", error);
            }
        };
        fetchMinMax();
    }, [selectedDatasetURL]);


    let isLoadingSpinner = useRef(false);

    const renderCount = useRef(0);
    const curMapMouseEvents = useRef<mapMouseEvents >({ type: "null", position: [0, 0], event: null, lastSetTime: 0 });


    // data loading
    const [isLoading_mapData, rawMapData] = useGetJSONData(props.mapDataURL);
    const [isLoadingDatalist, dataList] = useGetJSONData(apiRoutes.GET_LIST_OF_DATASETS)
    const [isLoading_Metadata, rawMetaData] = useGetJSONData(apiRoutes.getDatasetsMetadata({ LANGID: locale }));
    const [isLoadingCapitals, rawCapitalsData] = useGetJSONData(apiRoutes.FETCH_CAPITALS);




     // column names from database
    const columnNamesURL = useMemo(() => {
        if (props.mapUIsettings.defaultDatasetName) {
            return apiRoutes.fetchDbColumnNames({ relationName: props.mapUIsettings.defaultDatasetName });
        }
        return "";
    }, [props.mapUIsettings.defaultDatasetName]);
    const [isLoading_ColumnNames, rawColumnNames] = useGetJSONData(columnNamesURL, props.mapDataSets.isGridData || props.mapUIsettings.inCovidDataView);

    // Wait for column names and metadata to load and set default feature name if not already set
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

    

    const [isLoading_MosquitoData, rawMosquitoData] = useGetJSONData(selectedDatasetURL, props.mapDataSets.isGridData || props.mapUIsettings.inCovidDataView);
    
   
    
    const [gridData, setGridData] = useState<Map<number, visDataT>>(new Map<number, visDataT>());
    const gridcellSizeLatLng = useRef<{ lng: number; lat: number }>({ lng: 0, lat: 0 });
    const curGridCell = useRef<[number, number]>([0, 0]);
    const curGridCellFeature = useRef<number>(0);
    const curGridCellID = useRef<number>(0);
    const curGridCellRowID = useRef<number>(0);


    // presence data
    const [isPresData, setIsPresData] = useState(props.mapUIsettings.isPresenceDataChecked || false);
    const [presData, setPresData] = useState<{geometry: [number, number], feature: string, latLng?: [number, number], country_name?: string, subregion_name?: string;}[]>([]);
    const defaultPresenceDataURL = !mapUIsettings.inCovidDataView ? apiRoutes.fetchDbData({ relationName: contextT.curPresenceDatasetName, feature: "pointtype", filterBy: "pointtype", filterValue: "point, exact location" }) : "";
    const [presenceDataURL, setPresenceDataURL] = useState<string>(defaultPresenceDataURL);
    const [isLoadingPresenceData, rawPresenceData] = useGetJSONData(presenceDataURL, props.mapDataSets.isPresenceData);
    const [isLoadingP_species, rawP_species] = useGetJSONData( apiRoutes.fetchDbData({ relationName: contextT.curPresenceDatasetName, feature: "species", task: "getUniqueEntries" }), props.mapDataSets.isPresenceData && !props.mapUIsettings.inCovidDataView);
    const [isLoadingP_years, rawP_years] = useGetJSONData( apiRoutes.fetchDbData({ relationName: contextT.curPresenceDatasetName, feature: "year", task: "getUniqueEntries" }), props.mapDataSets.isPresenceData && !props.mapUIsettings.inCovidDataView);
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
    const [isSequenceMetaData, setIsSequenceMetaData] = useState(props.mapUIsettings.isSequenceMetaDataChecked || false);
    const [sequenceMetaDataURL, setSequenceMetaDataURL] = useState<string>(apiRoutes.fetchDbData({ relationName: contextT.curDonutChartDatasetName, feature: geoAssignmentColumn, task: "getCount" }));

    const [isLoading_sequenceMetadata, rawSequenceMetaData] = useGetJSONData( sequenceMetaDataURL, props.mapDataSets.isSequenceMetaData);
    const [isLoadingS_organism, rawS_organsim] = useGetJSONData( apiRoutes.fetchDbData({ relationName: contextT.curDonutChartDatasetName, feature: sequenceColumnForDonut, task: "getUniqueEntries" }), props.mapDataSets.isSequenceMetaData);
    const [isLoadingS_years, rawS_years] = useGetJSONData( apiRoutes.fetchDbData({ relationName: contextT.curDonutChartDatasetName, feature: "date", task: "getUniqueEntries" }), props.mapDataSets.isSequenceMetaData);

    const [cur_Sorgansim, setCur_SOrgansim] = useState<string>("ALL")
    const [cur_SYear, setCur_SYear] = useState<string>("ALL")
    const [pieSize, setPieSize] = useState<number>(props.mapUIsettings.defaultDonutSize || 40);
    const [isCountryLevelData, setIsCountryLevelData] = useState(props.mapUIsettings.isCountryLevelData);
    const [isSubregionLevelData, setIsSubregionLevelData] = useState(props.mapUIsettings.isSubregionLevelData);


   
    // collect data loading errors
    collectDataLoadingEROORS.current = [];
    collectDataLoadingEROORS.current.push(handleLoadDataERROR(isLoading_mapData, rawMapData as unknown as dbDATA));
    collectDataLoadingEROORS.current.push(handleLoadDataERROR(isLoading_MosquitoData, rawMosquitoData as unknown as dbDATA));
    collectDataLoadingEROORS.current.push(handleLoadDataERROR(isLoadingDatalist, dataList as unknown as dbDATA));
    collectDataLoadingEROORS.current.push(handleLoadDataERROR(isLoading_Metadata, rawMetaData as unknown as dbDATA));
    collectDataLoadingEROORS.current.push(handleLoadDataERROR(isLoadingPresenceData, rawPresenceData as unknown as dbDATA));
    collectDataLoadingEROORS.current.push(handleLoadDataERROR(isLoadingP_species, rawP_species as unknown as dbDATA));
    collectDataLoadingEROORS.current.push(handleLoadDataERROR(isLoadingP_years, rawP_years as unknown as dbDATA));
    collectDataLoadingEROORS.current.push(handleLoadDataERROR(isLoading_sequenceMetadata, rawSequenceMetaData as unknown as dbDATA));
    collectDataLoadingEROORS.current.push(handleLoadDataERROR(isLoadingS_organism, rawS_organsim as unknown as dbDATA));
    collectDataLoadingEROORS.current.push(handleLoadDataERROR(isLoadingS_years, rawS_years as unknown as dbDATA));
    collectDataLoadingEROORS.current.push(handleLoadDataERROR(isLoadingCapitals, rawCapitalsData as unknown as dbDATA));

    // assign data types
    let presenceDat= rawPresenceData as unknown as presDBdataI;
    let sequenceMetaData = rawSequenceMetaData as unknown as presDBdataI;
    let mosquitoData = rawMosquitoData as unknown as presDBdataI;
    let P_species = rawP_species as unknown as UniquesDB_entriesI;
    let P_years = rawP_years as unknown as UniquesDB_entriesI;
    let S_organism = rawS_organsim as unknown as UniquesDB_entriesI;
    let S_years = rawS_years as unknown as UniquesDB_entriesI;
    let capitalsData = rawCapitalsData as unknown as CapitalsFeatureCollection;
   
    let listOfDataSets = dataList as unknown as { [key: string]: string };
    const metaData = rawMetaData as unknown as metaDataT;
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
          isLoadingSpinner.current = true;
          setisUpdate(prev => !prev);
    },[presenceDataURL, sequenceMetaDataURL]);

 
    const applyGlobalContext = useCallback(() => {
        if(curColroMapType != contextT.curColorMap){
            setColorMapType(contextT.curColorMap);
        }
        if(curDatasetname.current != contextT.curDatasetURL && contextT.curDatasetURL != ""){
            setSelectedDataset(contextT.curDatasetURL);
        }
        if(isPresData != contextT.isPresenceData && contextT.isPresenceData !== undefined){
            setIsPresData(contextT.isPresenceData);
        }
        if(isSequenceMetaData != contextT.isSequenceMetaData && contextT.isSequenceMetaData !== undefined){
            setIsSequenceMetaData(contextT.isSequenceMetaData);
        }
        if(pieSize != contextT.pieSize_sequenceMetaData && contextT.pieSize_sequenceMetaData !== undefined){
             isLoadingSpinner.current = false;
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
        curColroMapType,
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
        if (selectedFeature === contextT.curFeature || contextT.curFeature === "") return;
        let ff = contextT.curFeature;
        const filterStr = props.mapUIsettings.filterString_for_availableFeature;
        if (
            filterStr !== "" &&
            colNames.filter((name) => name.includes(filterStr)).includes(`${filterStr}_${contextT.curMonth}`)
        ) {
            ff = `${filterStr}_${contextT.curMonth}`;
            isLoadingSpinner.current = true;
            setSelectedFeature(ff);
            //contextT.setCurFeature(ff);
            const url = apiRoutes.fetchDbData({ relationName: curDatasetname.current, feature: ff });
            setSelectedDataset(url);
            //contextT.setCurDatasetURL(url);
        }
    }, [ contextT.curMonth ]);

    useEffect(() => {
        syncSelectedFeatureWithMonthSelection();
    }, [contextT.curMonth, syncSelectedFeatureWithMonthSelection]);

    useEffect(() => {
        if(props.isApplyContextData === true) {
            // Only show loading spinner if data-related context values changed
            const needsLoading = 
                curDatasetname.current !== contextT.curDatasetURL ||
                selectedFeature !== contextT.curFeature ||
                presenceDataURL !== contextT.curPresenceDatasetURL ||
                sequenceMetaDataURL !== contextT.curDonutChartDataURL;
            if (needsLoading) {
                isLoadingSpinner.current = true;
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
            contextT.setCurColorMap(curColroMapType);
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
                curColroMapType,
                pieSize,
                cur_SYear,
                cur_Sorgansim,
                layerOpacity,
                selectedFilter,
                selectedCountry,
               // dateRange
            });
        }
    }, [props.isSetIntialContextDataFromComponent, selectedDatasetURL, selectedFeature, curColroMapType]);


    useEffect(() => {
        if (props.isSyncMapCoordsOnTheFly_RECIEVER === true) {
            SET_coordinates(contextT.mapCoords.latitude, contextT.mapCoords.longitude, contextT.mapCoords.zoom);
            console.log("SET_coordinates:", latitude, longitude, zoom);
        }
    }, [props.isSyncMapCoordsOnTheFly_RECIEVER, contextT.mapCoords]);

    const frameRef = useRef(0);
    useEffect(() => {
        if (!map) return;
        const renderLoop = () => {
            const mouseData = contextT.mouseEvent.current;

            if (mouseData?.event?.latlng != curMapMouseEvents.current.position) {
                curMapMouseEvents.current.type = mouseData.type;
                if (mouseData.event && map) {
                    HandleMouseMoveX(mouseData.event, map, gridData)
                }
            }
            
            frameRef.current = requestAnimationFrame(renderLoop);
        };
    renderLoop(); // start the loop

    return () => cancelAnimationFrame(frameRef.current);
}, [map, gridData, metaData, isLoading_MosquitoData, L, contextT.selectedGridcellID, curColroMapType]);



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
    if(!isLoadingDatalist &&  selectedDatasetURL === "" && Object.keys(listOfDataSets).length > 0) {

        let filterStr = props.mapUIsettings.defaultDatasetName !== "" ? props.mapUIsettings.defaultDatasetName : ""; 
        let key = Object.keys(listOfDataSets).find(key => filterStr === "" || key.includes(filterStr)) ||  "-1";
        if(key === "-1" || filterStr === "") {
            filterStr = props.mapUIsettings.filterString_for_availableDataset_include || "";
            key = Object.keys(listOfDataSets).find(key => filterStr === "" || (key.includes(filterStr) && !key.includes(props.mapUIsettings.filterString_for_availableDataset_exclude))) || Object.keys(listOfDataSets)[0];
        }
        console.log("key:", key, "filterStr:", filterStr, "listOfDataSets:", listOfDataSets);
        curDatasetname.current = listOfDataSets[key];
        let url = apiRoutes.fetchDbData({ relationName: listOfDataSets[key], feature: contextT.curFeature });
        setSelectedDataset(url);
        // Find the first dataset key that contains the filter string, or fallback to the first key
    }

     const seq_countryList = useMemo(() => {
        if (sequenceMetaData.response) {
            return sequenceMetaData.response.map((d: any) => d.feature);
        }
        return [];
    }, [sequenceMetaData]);


    const colNames = useMemo(() => {
        if(mosquitoData.response !== undefined && mosquitoData.header && mosquitoData.error == null && mosquitoData.response.length > 1) {
            return mosquitoData.header.filter((name: string) => name !== "id");
        }
        else {
            return [] as string[];
        }
    }, [mosquitoData]);
   
    useEffect(() => {
        if(!isLoadingPresenceData) {
            let presDat: {geometry: [number, number], feature: string, country_name?: string, subregion_name?: string}[] = [];
            let groupedPresData: presDBdataT[] = [];
            try {
                presenceDat.response.forEach((d: presDBdataT) => {
                    if (d.geometry || (d.latitude && d.longitude && !isNaN(d.latitude) && !isNaN(d.longitude))) {
                        if (d.latitude && d.longitude && !isNaN(d.latitude) && !isNaN(d.longitude)) {

                            if (mapUIsettings.inCovidDataView == true){
                                preprocessPresenceDataForLatLng(d, groupedPresData);
                            }
                            else {
                                presDat.push({ geometry: [d.latitude, d.longitude], feature: d.feature });
                            }
                        } else {
                            const coords = pointParser(d.geometry);
                            if (!isNaN(coords[0]) && !isNaN(coords[1])) {
                                presDat.push({ geometry: coords, feature: "test" });
                            }
                        }
                    }
                });
                if (groupedPresData.length > 0) {
                    for (const item of groupedPresData) {
                        if (item.latitude && item.longitude && !isNaN(item.latitude) && !isNaN(item.longitude)) {
                            presDat.push({geometry: [item.latitude, item.longitude], feature: item.feature, subregion_name: item.subregion_name, country_name: item.country_name});   
                        }
                    }
                }
            }
            catch(e) {
                let erroMsg = { ERROR: "ERROR: while parsing the data set. csv format is required." +e};
                let res = <div>{String(erroMsg['ERROR'])}</div>;
                console.log("Error:", erroMsg);
                collectDataLoadingEROORS.current.push(res)
            }
            setPresData(presDat);
        }
    }, [presenceDat]);

    // ------------------------------------------------------------------
    // Zoom-dependent auto-switch between country-level and subregion-level
    // ------------------------------------------------------------------
    // Track the previous zoom "side" of the threshold so we only re-fetch
    // when the user actually crosses the boundary.
    const prevZoomAboveThreshold = useRef<boolean | null>(null);

    useEffect(() => {
        if (!mapUIsettings.inCovidDataView) return;

        const isAboveThreshold = zoom >= zoomBreakpoint;

        // Skip if the side hasn't changed (or on first mount we initialise)
        if (prevZoomAboveThreshold.current === isAboveThreshold) return;
        prevZoomAboveThreshold.current = isAboveThreshold;

        // Determine the new data-level flags
        const newCountryLevel  = !isAboveThreshold;  // zoom < 4  → country
        const newSubregionLevel = isAboveThreshold;   // zoom >= 4 → subregion

        // Only act if the flags actually need to change
        if (newCountryLevel === isCountryLevelData && newSubregionLevel === isSubregionLevelData) return;

        // Update local + context state
        setIsCountryLevelData(newCountryLevel);
        setIsSubregionLevelData(newSubregionLevel);
        contextT.setIsCountryLevelData(newCountryLevel);
        contextT.setIsSubregionLevelData(newSubregionLevel);

        // Re-build the *local* presence data URL with the correct aggregation_level.
        // We intentionally do NOT push this URL to context so that each map
        // keeps its own zoom-appropriate aggregation_level independently.
        let url = presenceDataURL;
        // Strip any existing aggregation_level param
        url = url.replace(/&aggregation_level=[01]/g, "");
        // Append the correct one
        url += newCountryLevel ? "&aggregation_level=0" : "&aggregation_level=1";

        isLoadingSpinner.current = true;
        setPresenceDataURL(url);

        console.log(
            `[Zoom-switch] zoom=${zoom}, threshold=${zoomBreakpoint}, ` +
            `country=${newCountryLevel}, subregion=${newSubregionLevel}`
        );

        setTimeout(() => {
            isLoadingSpinner.current = false;
        }, 2000);
    }, [zoom, mapUIsettings.inCovidDataView, isCountryLevelData, isSubregionLevelData, presenceDataURL]);

     // *** useRef *** //
    const divRef = useRef<HTMLDivElement | null>(null);
    const ischanged = useRef(false);
    let layerUpdateHandlerTime = useRef<ReturnType<typeof setTimeout> | null>(null);


    
  const DonutColors = useMemo(() => {
        const colors: Record<string, string> = {};
        if (S_organism && S_organism.response) {
            S_organism.response.forEach((item: any, index: number) => {
                if (item && item.feature) {
                    colors[item.feature] = categoricalColors[(index + 0) % categoricalColors.length]+""; // Adding "80" for transparency
                }
            });
        }
        return colors;
    }, [isLoadingS_organism, isSequenceMetaData]);

// Fetch country counts for the selected countries
const [countryCounts, setCountryCounts] = useState<{ [key: string]: any }>({});
const prevSequenceMetaDataRef = useRef<any>(null);
const prevIsLoadingRef = useRef<boolean>(true);
const prevSequenceMetaDataURLRef = useRef<string>("");
const prevIsLoadingMapDataRef = useRef<boolean>(true);

useEffect(() => {
    // Skip if data hasn't actually changed
    if (prevSequenceMetaDataRef.current === sequenceMetaData && 
        prevIsLoadingRef.current === isLoadingS_organism &&
        prevSequenceMetaDataURLRef.current === sequenceMetaDataURL &&
        prevIsLoadingMapDataRef.current === isLoading_mapData) {
        return;
    }
    prevSequenceMetaDataRef.current = sequenceMetaData;
    prevIsLoadingRef.current = isLoadingS_organism;
    prevSequenceMetaDataURLRef.current = sequenceMetaDataURL;
    prevIsLoadingMapDataRef.current = isLoading_mapData;
    
    const fetchCountryCounts = async () => {
        if (isLoading_sequenceMetadata || isLoading_mapData || !props.mapDataSets.isSequenceMetaData || isLoadingS_organism) return;
        console.log("fetching country counts...", sequenceMetaDataURL, props.chartName, props.mapDataSets.isSequenceMetaData);
            const counts: { [key: string]: any } = {};
                try {
                    const url =  sequenceMetaDataURL
                    const response = await fetch(url);
                    let dataM = await response.json();
                    dataM = dataM.response || dataM; // Ensure we are working with the response array
                if (dataM && Array.isArray(dataM) && dataM.length > 0) {
                    dataM.forEach((item,index: any) => {
                         let countryCenter =  getCountryCenterFromMapData(mapData, item.feature);
                        // Fallback to categoryCoordsMap if map data doesn't have coordinates
                        if (countryCenter && countryCenter.lat === 0 && countryCenter.lng === 0) {
                            const fallback = categoryCoordsMap[item.feature];
                            if (fallback) {
                                countryCenter = { lat: fallback[0], lng: fallback[1] };
                            }
                        }
                        if(countryCenter && (countryCenter.lat !== 0 || countryCenter.lng !== 0)) {
                            // Ensure the feature key exists in counts
                            if (!counts[item.feature]) {
                                counts[item.feature] = {};
                            }
                            counts[item.feature]["count"] = item.count;
                            counts[item.feature]["center"] = countryCenter;
                        }
                    });
                } else {
                        console.warn("No data found for the selected countries.");
                    }
                } catch (error) {
                    console.error("Error fetching country counts:", error);
                    let erroMsg = { ERROR: "ERROR: while fetching country counts. " + error};
                    let res = <div>{String(erroMsg['ERROR'])}</div>;
                    console.log("Error:", erroMsg);
                    collectDataLoadingEROORS.current.push(res);
                }
                // get counts for each dengue serotype
                if(!isLoadingS_organism) {
                    // S_organism is an object with response: array of features
                    if (S_organism && S_organism.response && Array.isArray(S_organism.response)) {
                        for (let index = 0; index < S_organism.response.length; index++) {
                            const featureObj = S_organism.response[index];
                            if (!featureObj || !featureObj.feature) continue;
                            try {
                                let url = apiRoutes.fetchDbData({
                                    relationName: contextT.curDonutChartDatasetName,
                                    feature: geoAssignmentColumn,
                                    task: "getCount",
                                    filterBy: "'" + sequenceColumnForDonut + "','date'",
                                    filterValue: "'" + featureObj.feature + "','" + cur_SYear + "'",
                                });
                                const response = await fetch(url);
                                let dataM = await response.json();
                                dataM = dataM.response || dataM;
                                if (dataM && Array.isArray(dataM) && dataM.length > 0) {
                                    dataM.forEach((item: any) => {
                                        if (counts[item.feature]) {
                                            if (!Array.isArray(counts[item.feature]["counts"])) {
                                                counts[item.feature]["counts"] = [];
                                                counts[item.feature]["labels"] = [];
                                            }
                                            counts[item.feature]["counts"].push(Number(item.count));
                                            counts[item.feature]["labels"].push(featureObj.feature);
                                        }
                                    });
                                } else {
                                    console.warn("No data found for the selected countries.");
                                }
                            } catch (error) {
                                console.error("Error fetching country counts:", error);
                                let erroMsg = { ERROR: "ERROR: while fetching country counts. " + error + " index: " + index, S_organism };
                                let res = <div>{String(erroMsg['ERROR'])}</div>;
                                console.log("Error:", erroMsg);
                                collectDataLoadingEROORS.current.push(res);
                            }
                        }
                    }
                }
       setCountryCounts(counts);
    };
   fetchCountryCounts();
}, [sequenceMetaData, isLoadingS_organism, sequenceMetaDataURL, cur_SYear, cur_Sorgansim, isLoading_mapData, mapData]);


  

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



useEffect(() => {
    if(mosquitoData.response) {
        if (!mapUIsettings.inCovidDataView) {
            let visDat = new Map<number, visDataT>();
            let rect1:[number, number][] = [];   
            try {
                mosquitoData.response.forEach((d: presDBdataT, index: number) => {
                    if (d.geometry) {
                        const coords = polygonParser(d.geometry);
                        // const coords: [number, number][] = Array.isArray(d.longLat) && d.longLat.every(item => Array.isArray(item) && item.length === 2 && typeof item[0] === 'number' && typeof item[1] === 'number') 
                        //     ? d.longLat 
                        //     : [[0, 0]];
                        if(rect1 == null || rect1.length === 0) {
                            rect1 = coords;
                            let dims = getGridCellDims(rect1);
                            gridcellSizeLatLng.current.lng = dims.gridDimLng;
                            gridcellSizeLatLng.current.lat = dims.gridDimLat;
                            //console.log("gridCellDims", dims);
                        }
                        const centerPoint = getGeometryCenter(coords);
                        const gridCellIndex = getGridCellIndex({lat:centerPoint[0], lng:centerPoint[1]}, {lat: gridcellSizeLatLng.current.lat, lng: gridcellSizeLatLng.current.lng});
                        if (coords.length == 5) {
                            visDat.set(gridCellIndex, {geometry: coords, feature: Number(d.feature), visDatIdx: index, rowID: (d as any).id});
                        }
                    }
                })
            }
            catch(e) {
                let erroMsg = { ERROR: "ERROR: while parsing the data set. csv format is required." +e};
                let res = <div>{String(erroMsg['ERROR'])}</div>;
                console.log("Error:", erroMsg);
                collectDataLoadingEROORS.current.push(res)
            }
            if(visDat.size === 0) {return;}

            setGridData(visDat)
            //console.log("visData:", visDat, mosquitoData);
        }
    }
    }, [mosquitoData]);



    // *** functions *** //

    // Debounce timer for broadcasting coordinates to other synced maps via context.
    // This prevents rapid zoom (wheel) or pan events from flooding the context
    // while still keeping the local map responsive.
    const mapCoordsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const MAP_COORDS_DEBOUNCE_MS = 1000;

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (mapCoordsDebounceRef.current) clearTimeout(mapCoordsDebounceRef.current);
        };
    }, []);

    function SET_coordinates(latitude: number, longitude: number, zoom: number) {
        
        // check if the new values are within the allowed range (clip the values if not)
        longitude = Math.max(-rangeLong, Math.min(rangeLong, longitude));
        latitude = Math.max(-rangeLat, Math.min(rangeLat, latitude));
        zoom = Math.max(minZoom, Math.min(maxZoom, zoom));

        // round the values to two decimal places
        longitude = Math.round(longitude * calcer) / calcer;
        latitude = Math.round(latitude * calcer) / calcer;
        zoom = Math.round(zoom * 100) / 100;

        if(props.isSyncMapCoordsOnTheFly_SETTER === true) {
            // Debounce the context broadcast so rapid zoom / pan events
            // are batched before other maps react.
            if (mapCoordsDebounceRef.current) clearTimeout(mapCoordsDebounceRef.current);
            mapCoordsDebounceRef.current = setTimeout(() => {
                contextT.setMapCoords({
                    latitude: latitude,
                    longitude: longitude,
                    zoom: zoom
                });
            }, MAP_COORDS_DEBOUNCE_MS);
        }
        // update the local state immediately so this map stays responsive
        setCoordinates([latitude, longitude, zoom]);
    }

    function AlertSuccess() {
        return (
            <div
            role="alert"
            className="flex items-start gap-3 rounded-md border border-green-300 bg-green-50 p-4 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-100"
            >
            <CheckCircle2Icon className="h-5 w-5 mt-1 text-green-500" />
            <div className="flex flex-col">
                <span className="font-semibold"></span>
                <span className="text-sm text-green-700 dark:text-green-300">
                {presData.length > 0 ? "Data loaded for " + presData.length + " locations."  : "Data loaded. No new data points for the selection."} 
                </span>
            </div> 
            </div>
        );
    }


    /**
     * Aggregates feature values for a specific latitude-longitude pair in the provided grouped presence data.
     * If a matching latitude-longitude pair is found in the grouped data, the feature values are updated.
     * Otherwise, a new entry is added to the grouped data.
     *
     * @param d - The presence data object containing the latitude, longitude, and other feature details.
     * @param groupedPresData - The array of grouped presence data to be updated or appended to.
     * @returns The updated array of grouped presence data.
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
     * Updates the feature value for a specific latitude-longitude location in the grouped presentation data.
     *
     * @param groupedPresData - An array of objects representing grouped presentation data, 
     *                          each containing geometry, feature, and optional longitude and latitude properties.
     * @param d - An object representing the data to be used for updating, containing geometry, feature, 
     *            and optional longitude and latitude properties.
     * @param latLngElem_index - The index of the latitude-longitude element in the grouped presentation data array 
     *                           that needs to be updated.
     *
     * The function finds the matching latitude-longitude group in the `groupedPresData` array and updates its 
     * geometry, longitude, latitude, and feature values. If the `selectedFeature` is one of the specified types 
     * ("new_recovered", "new_confirmed", "new_deceased", "new_tested"), the feature value is incremented by the 
     * feature value of the provided data object `d`.
     */
    function updateFeatureValueForLatLng(groupedPresData: { geometry: string; feature: string; longitude?: number; latitude?: number; }[], d: { geometry: string; feature: string; longitude?: number; latitude?: number; }, latLngElem_index: number) {
        // Update the feature value for the existing latitude-longitude location
    
        const longLatGroup = groupedPresData.find(el => el.longitude === d.longitude && el.latitude === d.latitude);
        if (longLatGroup) {
            longLatGroup.latitude = d.latitude;
            longLatGroup.longitude = d.longitude;
            longLatGroup.geometry = d.geometry;
    
            if (selectedFeature == "new_recovered"
                || selectedFeature == "new_confirmed"
                || selectedFeature == "new_deceased"
                || selectedFeature == "new_tested") {
                longLatGroup.feature = String(Number(longLatGroup.feature) + Number(d.feature));
            }
    
            groupedPresData[latLngElem_index] = longLatGroup;
        }
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
}, [dimensions, id_scaleBar, id_colorMap]);




  /*********************************
   * *** Layer Update Handler **** *
   *********************************/
   useEffect(() => {
    resetTimeout(layerUpdateHandlerTime);
    let delay = 500;
    switch (curMouseEvent.current) {
        case "wheel":
            delay = 1500;
            break;
        case "opacity":
            delay = 150;
            break;
        case "null":
            delay = 1000;
            break;
        case "slider":
            delay = 200;
            break;
        case "mousemove":
            delay = 1500;
            break;
    }

    layerUpdateHandlerTime.current = setTimeout(() => {
            setisUpdate(prev => !prev);
             if(!isLoading_MosquitoData)
                isLoadingSpinner.current = false;
            presenceDrawHash.current += 1;
            delay = 1000;
            setIsSettingsOpen(true);
    }, delay);
}, [latitude, longitude, zoom, rawMosquitoData, curColroMapType, layerOpacity, dimensions, isPresData, isSequenceMetaData, isLoading_MosquitoData]
);


function RenderMap_onPosUpdate(latitude: number, longitude: number, zoom: number, map: L.Map | null) {
    useEffect(() => {
        if (!map) return ;
        const currentCenterLat = Math.round(map.getCenter().lat * calcer) / calcer;
        const currentCenterLng = Math.round(map.getCenter().lng * calcer) / calcer;
        const currentZoom = Math.round(map.getZoom() * 100) / 100;

        if (currentCenterLat !== latitude || currentCenterLng !== longitude || currentZoom !== zoom) {
            //console.log("Map position updated:", { latitude, longitude, zoom });
            map.setView([latitude, longitude], zoom);
        }
    }, [latitude, longitude, zoom, map]);
    return null;
}


// Apply active style to selected map feature/country
useEffect(() => {
    applyActiveStyleToSelection(contextT.mapSelectionObj);
}, [contextT.mapSelectionObj]);

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
                d3.select(this).selectAll("circle").remove();
            });
            d3.selectAll(".leaflet-popup-pane").each(function () {
                d3.select(this).selectAll(".custom-popup").remove();
            });
        };

        const nextLayer = L.geoJSON(mapData, {
            style: baseStyle,
            interactive: true,
            onEachFeature: (feature: GeoJSON.Feature, leafletLayer: L.Layer) => {
                const pathLayer = leafletLayer as L.Path;

                // Click
                const handleClick = () => {
                    const countryName = feature.properties?.name ?? "";
                    const countryCode = feature.properties?.iso_a3 ?? "";

                    if (mapUIsettings.inCovidDataView) {
                        clearPresenceOverlays();

                        let featureName = contextT.curFeature || selectedFeature;
                        if (!featureName) {
                            featureName = mapUIsettings.defaultFeatureName;
                            contextT.setCurFeature(featureName);
                        }

                        let url = apiRoutes.fetchDbData({
                            relationName: curDatasetname.current,
                            feature: featureName,
                            filterBy: "iso_3166_1_alpha_3",
                            filterValue: countryCode,
                            startDate: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
                            endDate: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
                            aggregation_level: isCountryLevelData ? 0 : isSubregionLevelData ? 1 : undefined,
                        });
                        isLoadingSpinner.current = true;

                        setDateRange({ from: dateRange?.from ?? min_date, to: dateRange?.to ?? max_date });
                        contextT.setDateRange({ from: dateRange?.from ?? min_date, to: dateRange?.to ?? max_date });

                        setSelectedCountry(countryCode);
                        contextT.setSelectedCountry(countryCode);
                        contextT.setCurDatasetURL(url);
                        contextT.setCurPresenceDatasetURL(url);
                        contextT.setIsPresenceData(true);
                        setIsPresData(true);
                        setPresenceDataURL(url);
                        setShowSuccessCountryDropdown(true);
                    }

                    if (!props.mapInteractions.disableClick) {
                        contextT.setMapSelectionObj(feature as GEOjson.Feature);
                    }

                    resetLayerStyles();
                    curPropertyNames.current = countryName;
                    pathLayer.bringToFront();

                    setTimeout(() => {
                        isLoadingSpinner.current = false;
                        setShowSuccessCountryDropdown(false);
                    }, 3000);
                };

                // Hover
                const handleMouseMove = (event: L.LeafletMouseEvent) => {
                    //pathLayer.bringToFront();
                    const translated =
                        feature.properties?.[`NAME_${locale}`] ??
                        feature.properties?.[`name_${locale}`] ??
                        "";
                    hoverCountry.current = translated;
                    contextT.mouseEvent.current.country = translated;

                    if (curPropertyNames.current !== feature.properties?.name) {
                        pathLayer.setStyle({ ...hoverStyle });
                    }
                };

                const handleMouseOut = () => {
                    if (curPropertyNames.current !== feature.properties?.name) {
                        pathLayer.setStyle({ ...baseStyle });
                    }
                    hoverCountry.current = "";
                    isHoverCountry.current = false;
                    removeAllTooltips();
                    const svg = d3.select(map.getContainer()).select("svg");
                    svg.selectAll("rect.hover-grid-cell").remove();
                    svg.selectAll("rect.selected-grid-cell").remove();
                    svg.selectAll("circle").remove();
                    contextT.mouseEvent.current.country = "NA";
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

  

function MapTransition(mapSelectionObj: GEOjson.Feature) {
    useEffect(() => {
        if (!map) return ;
        if(!props.isApplyTransitions) {isLoadingSpinner.current = false; return;};

        let curCenter = { lat: 0, lng: 0 };
        curCenter = getCountryCenterFromMapData(mapData, contextT.mapSelectionObj.properties.name);

        let geometry = contextT.mapSelectionObj.geometry;
        // if lat or long is undefined, use the geometry center
        if (geometry.type === "Polygon" && curCenter.lng == 0 && L) {
            curCenter = L.geoJSON(geometry).getBounds().getCenter();
        } else if (contextT.mapSelectionObj.geometry.type === "MultiPolygon" && curCenter.lng == 0 && L) {
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

        svg.transition()
            .duration(mapFlyTransitionTime)
            .on("start", () => {
                console.log("Transition started");
                setIsSettingsOpen(false);
            }) 
            .on("end", () => {
                console.log("Transition ended");
            })
            .tween("coordinates", () => (t) => {
                const prarbT = (x: number): number => {
                    return x * x;
                };
                let tnew = 0;
                let newZoom = 0;
                 tnew = 1 - prarbT(t * 2 - 1.0);
                if(zoom < 3.2)  {
                   newZoom = zoom;
                }
                else {
                    newZoom = interpolateZoom(tnew);
                }
                const newLat = interpolateLat(t);
                const newLong = interpolateLong(t);
                map.setView([newLat, newLong], newZoom,);
                //SET_coordinates(newLat, newLong, newZoom);
            });
        }

    }, [mapSelectionObj]);
    return null;
}


function MapWatchRezies(dimensions: { width: number; height: number }) {
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (!map) return ;
        if (dimensions.width && dimensions.height) {
            if (timer.current !== null) {
                clearTimeout(timer.current);
            }
            timer.current = setTimeout(() => {
                map.invalidateSize();
            }, 100);
           
        }
    }, [dimensions]);
}


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

const [isCapitalLabel, setIsCapitalLabel] = useState<boolean>(false);

useEffect(() => {
    if (zoom >= 3.9) {
        setIsCapitalLabel(true);
    } else {
        setIsCapitalLabel(false);
    }
}, [zoom]);


// Throttle helper
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

            const cMap = d3.scaleSequential(availableColorMaps[curColroMapType as keyof typeof availableColorMaps]);
            cMap.domain([minGoodVal, maxGoodVal]);
            if (curColroMapType === "interpolateRdBu") {
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

        // Close existing tooltip if open
        if (map && toolTipRef.current && map.hasLayer(toolTipRef.current)) {
            map.closeTooltip(toolTipRef.current);
        }
        
        toolTipRef.current.setLatLng(event.latlng);
        toolTipRef.current.setContent(`
            <div id=${"toolTip" + chart} class="min-w-[220px] max-w-[280px] rounded-xl bg-linear-to-br from-indigo-600 via-indigo-700 to-slate-900 p-4 text-white shadow-xl font-sans">
                
                <div class="mb-2">
                    <span class="text-3xl font-semibold align-baseline">
                        ${value.toLocaleString(locale)}
                    </span>
                    <span class="text-lg font-medium text-indigo-200 ml-1 align-baseline">
                        ${unit}
                    </span>
                </div>

                ${colorBarHtml}

                <table class="w-full text-sm">
                    <tbody>
                        <tr class="border-b border-white/20">
                            <td class="py-1.5 pr-2 text-left font-normal text-indigo-200">
                                ${t.rich("tooltip.country")}
                            </td>
                            <td class="py-1.5 pl-2 text-right font-medium" style="white-space: normal; word-break: break-word;">
                                ${contextT.mouseEvent.current.country}
                            </td>
                        </tr>
                        
                        <tr class="border-b border-white/20">
                            <td class="pt-1.5 pb-1.5 pr-2 text-left font-normal text-indigo-200">
                                ${t.rich("tooltip.latLong")}
                            </td>
                            <td class="pt-1.5 pb-1.5 pl-2 text-right font-medium">
                                ${curGridCell.current[0].toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${curGridCell.current[1].toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                        </tr>
                    </tbody>
                </table>

                <p class="m-0 mt-3 pt-3  italic text-sm text-indigo-100/90" style="white-space: normal; word-break: break-word;">
                    ${metaData[selectedFeature] !== undefined ? metaData[selectedFeature].description : "N/A"}
                </p>
            </div>
        `)
        if (map) {
            map.openTooltip(toolTipRef.current);
        }
        }
        if (isLoading_MosquitoData) return;
        let mapVal = gridData.entries().next();
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

    }, 16), [map, L, gridData, isLoading_MosquitoData, metaData, selectedFeature, locale, t, contextT.selectedGridcellID, curColroMapType]);
 // first call of draw function: keeps rectangle correctly projected during zooming/panning   
DrawSelectedGridCell(contextT.selectedGridcellID);

const circlesSelectionRef = useRef<d3.Selection<any, any, any, any> | null>(null);

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

function MapMouseEvents(isUpdate: boolean) {
    let debug = false;
    useEffect(() => {
        // Invalidate cached circle selection when map data changes
        circlesSelectionRef.current = null;
        
        if (!map || isLoading_MosquitoData) return ;
        if (true) {
            const handleMouseEvent = () => {
                let curCenter = map.getCenter();
                let curZoom = map.getZoom();
                curCenter.lat = Math.round(curCenter.lat * calcer) / calcer;
                curCenter.lng = Math.round(curCenter.lng * calcer) / calcer;
                curZoom = Math.round(curZoom * 100) / 100;

                if (curCenter && zoom) {
                    if(curCenter.lng !== longitude || curCenter.lat !== latitude || curZoom !== zoom) {
                        SET_coordinates(curCenter.lat, curCenter.lng, curZoom);
                    }
                }
            };

              const handleMouseMove = (event: L.LeafletMouseEvent) => {

               
           
                // LeafletMouseEvent does not have isDragging; use map.dragging.enabled() if needed
                if (event.originalEvent.buttons === 1) { // 1 means left mouse button is pressed
                    setIsSettingsOpen(false);
                    curMouseEvent.current = "null";
                }

              
                 curMouseEvent.current = "mousemove";
                curMapMouseEvents.current.type = curMouseEvent.current;
                curMapMouseEvents.current.position = [event.latlng.lng, event.latlng.lat];
                curMapMouseEvents.current.event = event; 
                //console.log("setMouseEvent:", curMouseEvent.current, event);
                    if (
                    typeof curMapMouseEvents.current.lastSetTime === "number" &&
                    Date.now() - curMapMouseEvents.current.lastSetTime > 16
                ) {
                    //console.log("time:",  Date.now() - curMapMouseEvents.current.lastSetTime );
                    contextT.mouseEvent.current.type = curMouseEvent.current;
                    contextT.mouseEvent.current.event = event;
                    contextT.mouseEvent.current.position = [event.latlng.lng, event.latlng.lat];
                 
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
                }

                // Draw the selected grid cell (non-filled yellow rectangle)
               
            };
            map.on("click", (event: L.LeafletMouseEvent) => handleMouseClick(event));
            map.on("moveend", handleMouseEvent);
            map.on("zoomend", handleMouseEvent);
            map.on("mousemove", handleMouseMove);


            map.on("mouseout", () => {
                removeAllTooltips();
            }
            );
            
            if (mapUIsettings.inCovidDataView) {
                map.on('zoomend', updateCirclesOnMapMove);
                map.on('moveend', updateCirclesOnMapMove);
            }

            
    
            // Cleanup function to remove event listeners when component unmounts
            return () => {
                map.off("moveend", handleMouseEvent);
                map.off("zoomend", handleMouseEvent);
                map.off("mousemove", handleMouseMove);
                map.off("zoom", handleMouseEvent);
                map.off("click", handleMouseClick);
                map.off("mouseout", () => {
                    removeAllTooltips();
                });
            };
        }
    }, [isUpdate, debug] ); 
    return null;
}

// This effect handles the wheel event to close settings when zooming
useEffect(() => {
    if (!map) return;
    const container = map.getContainer();
    const handleWheel = () => {
        setIsSettingsOpen(false);
        curMouseEvent.current = "wheel";
    };
    container.addEventListener("wheel", handleWheel);

    return () => {
        container.removeEventListener("wheel", handleWheel);
    };
}, [map]);

    function removeAllTooltips() {
        if (!map || !L) return;
        // Close the single reused tooltip instead of iterating all layers
        if (toolTipRef.current && map.hasLayer(toolTipRef.current)) {
            map.closeTooltip(toolTipRef.current);
        }
    }

    function MapDistanceProvider(zoom: number, map: L.Map | null) {
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

            screenDistanceOneKM.current = distanceInPixels;

        }, [zoom, map]);

        return null;
    }

function DrawSelectedGridCell(GridCellID: number) {
        
        if (!map) return;
        // Remove previous grid cell highlight
        const svg = d3.select(map.getContainer()).select("svg");
        svg.selectAll("rect.selected-grid-cell").remove();
        if (GridCellID !== -1) {
            // Find the selected grid cell's coordinates
            let selectedGridData = gridData.get(GridCellID);
            if (selectedGridData && selectedGridData.geometry) {
                // Get the bounds of the selected grid cell
                const selectedGridLat = selectedGridData.geometry[0][0];
                const selectedGridLng = selectedGridData.geometry[0][1];
                
                const selectedTopLeft = map.latLngToLayerPoint([selectedGridLat, selectedGridLng]);
                const selectedBottomRight = map.latLngToLayerPoint([
                    selectedGridLat + gridcellSizeLatLng.current.lat,
                    selectedGridLng + gridcellSizeLatLng.current.lng
                ]);
                
                const selectedWidth = Math.abs(selectedBottomRight.x - selectedTopLeft.x);
                const selectedHeight = Math.abs(selectedBottomRight.y - selectedTopLeft.y);
               
                
                // Draw the selected grid cell as a non-filled rectangle with yellow stroke
                svg.append("rect")
                    .attr("class", "selected-grid-cell")
                    .attr("x", selectedTopLeft.x)
                    .attr("y", selectedTopLeft.y)
                    .attr("width", selectedWidth)
                    .attr("height", selectedHeight)
                    .attr("fill", "none")
                    .attr("stroke", "yellow")
                    .attr("stroke-width", 3);
            }
        }
}


MapDrawLayer_CountryPolygons(mapData, map, oceanGeoJSON);
MapDrawLayer_Captials(capitalsData, map);
RenderMap_onPosUpdate(latitude, longitude, zoom, map);
MapTransition(contextT.mapSelectionObj);
MapMouseEvents(isUpdate);
MapWatchRezies(dimensions);
MapDistanceProvider(zoom, map);
MapDrawLayer_MosquitoPresenceData(presenceDrawHash.current);
MapDrawLayer_SequenceMetadata(countryCounts);
MapDrawLayer_Grid(isUpdate);


// longitude
const handleInputChange1 = (event: React.ChangeEvent<HTMLInputElement>) => {
    SET_coordinates(latitude, Number(event.target.value), zoom);
    curMouseEvent.current = "slider";
};
// latitude
const handleInputChange2 = (event: React.ChangeEvent<HTMLInputElement>) => {
    SET_coordinates( Number(event.target.value), longitude, zoom);
    curMouseEvent.current = "slider";
};

const handleInputChangeZoom = (event: React.ChangeEvent<HTMLInputElement>) => {
    SET_coordinates(latitude, longitude, Number(event.target.value));
    curMouseEvent.current = "slider";
};

    const handleLayerOpacityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(0, Math.min(1, Number(event.target.value)));
    curMouseEvent.current = "opacity";
    setLayerOpacity(value);
    contextT.setCurLayerOpacity(value);
};

const [minVal, maxVal] = useMemo(() => {
    if(isLoading_MosquitoData || mosquitoData.error !== null) {
        return [0, 0];
    }
    if (mapUIsettings.inCovidDataView) {
        return getMinMaxFeature(
            (presData).map(d => ({
                feature: Number(d.feature)
            }))
        );
    }
    else{
        return getMinMaxFeature(
            (mosquitoData.response as presDBdataT[]).map(d => ({
                feature: Number(d.feature)
            }))
        );
    }
}, [mosquitoData,isLoading_MosquitoData, presData]);


const radiusScale = useMemo(() => {
    return d3.scaleSqrt()
        .domain([minVal, maxVal])
        .range([1, 5]);
}, [minVal, maxVal]);

const colorMap = useMemo(() => {
    const c = d3.scaleSequential(availableColorMaps[curColroMapType as keyof typeof availableColorMaps]);
    
    let minG = alignFeature_to_Metadata(minVal, selectedFeature, metaData).value;
    let maxG = alignFeature_to_Metadata(maxVal, selectedFeature, metaData).value;
    [minG, maxG] = getGoodReadableRange(minG, maxG);

    c.domain([minG, maxG]);
    if (curColroMapType === "interpolateRdBu") {
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
}, [curColroMapType, minVal, maxVal, selectedFeature, metaData]);


function resetTimeout( ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null> = layerUpdateHandlerTime) {
    if(ref.current) {
        clearTimeout(ref.current);
    }
}

function LayerTransition(
            map: L.Map,
            imageUrl: string,
            timer: number,
            layerOpacity: number,
            overlayRef: React.RefObject<L.ImageOverlay | null>
    ) {
        if(!L) return;

    // Calculate the bounds that correspond to the image
    const bounds = map.getBounds() || L.latLngBounds([0, 0], [0, 0]);
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
                isLoadingSpinner.current = false;
            }, timer);
        }
    }
}


// Debounce LayerTransition to avoid multiple rapid executions
const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
function MapDrawLayer_Grid(isUpdate: boolean) {
    const layerTansitionTime = 0;
    const debug = false;
    const canvasRef = useRef<HTMLCanvasElement | null>(null); // Reuse canvas instead of recreating
    const overlayRef = useRef<L.ImageOverlay | null>(null);

    useEffect(() => {
        // Don't render if data is loading
        // or if visData is empty
        // or if there is an error in mosquitoData
        if (isLoading_MosquitoData || mosquitoData.error !== null || gridData.size === 0) return;

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

            // Draw visualization data on canvas
            for (const [key, d] of gridData)  {
                
                if (d.geometry) {
                    
                    const coords = d.geometry.map(coord => {
                        return L ? map.latLngToContainerPoint(L.latLng(coord[0], coord[1])) : { x: 0, y: 0 };
                    });

                    if (coords.length > 3) {
                        const x1 = coords[0].x;
                        const y1 = coords[0].y;
                        const x2 = coords[1].x;
                        const y2 = coords[3].y;

                        context.fillStyle = d3.color(colorMap(Number(d.feature)))?.copy({ opacity: layerOpacity })?.toString() || "rgba(0, 0, 0, 1)";
                        context.fillRect(x1, y1, Math.abs(x2 - x1), Math.abs(y2 - y1));

                        // Add gridID as text to the top-right corner of the grid cell
                        if (debug) {
                            if(!L) return;
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

            if (debounceTimeout.current) {
                clearTimeout(debounceTimeout.current);
            }
            debounceTimeout.current = setTimeout(() => {
                LayerTransition(
                    map,
                    imageUrl,
                    layerTansitionTime,
                    layerOpacity,
                    overlayRef
                );
            }, 200); // 200ms debounce delay

            isLoadingSpinner.current = false;
            return null;
        }

        Render();
    }, [isUpdate, debug]);

}


function MapDrawLayer_MosquitoPresenceData(presenceDrawHash: number) {
    const layerTansitionTime = 500;
    const canvasRef = useRef<HTMLCanvasElement | null>(null); // Reuse canvas instead of recreating
    const overlayRef = useRef<L.ImageOverlay | null>(null);
    const debug = false;


    useEffect(() => {
        // Don't render if data is loading
        if (!map || isLoadingPresenceData) return;

        function Render(){
            // Don't render if map is not initialized
            if (!map) return;
            isLoadingSpinner.current = true;

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

            const dotSizeConstant= 4; // Adjust dot size based on zoom level

            if(isPresData) {
                if (!map) return;
                //map.fitWorld();

                // make sure svg container is aligned to MapContainer
                let mapSize = map.getSize();
                const container = d3.select(map.getPanes().overlayPane);
                let svg = container.select('.svg-circles-container_' + props.chartName);
                if (svg.empty()) {
                    const svg = d3.select(map.getPanes().overlayPane).append('svg')
                    .attr("class", "svg-circles-container_" + props.chartName)
                    .attr("width", mapSize.x)
                    .attr("height", mapSize.y)
                    .style("width", `${mapSize.x}px`)
                    .style("height", `${mapSize.y}px`)
                    .style("position", "absolute")
                    .style("top", 0)
                    .style("left", 0)
                    .style("z-index", 900)
                    .style("pointer-events", "none")
                    .style("overflow", "visible");
                }

                // Use memoized data structures to avoid repeated sorting
                const sortedPresDataLocal = sortedPresDataMemo;
                // Canvas branch: draw all presence points on canvas when not in Covid view
                if (!mapUIsettings.inCovidDataView) {
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
                        context.fillStyle = props.mapUIsettings.presenceDataColor || "rgb(239, 23, 23)";
                        context.beginPath();
                        context.arc(x1, y1, screenDistanceOneKM.current + dotSizeConstant, 0, Math.PI * 2);
                        context.fill();
                        context.fillStyle = "black";
                        context.beginPath();
                        context.arc(x1, y1, (screenDistanceOneKM.current + dotSizeConstant) * 0.2, 0, Math.PI * 2);
                        context.fill();
                    }
                } else {
                    // SVG branch: use enter/update/exit with memoized max-per-country
                    const max_feature_value_per_country = maxFeaturePerCountryMemo;
                    const filtered = sortedPresDataLocal.filter(d => d.geometry && (zoom > zoomBreakpoint || (d.country_name && Number(d.feature) === max_feature_value_per_country[d.country_name])));

                    // create or update svg container
                    const svgContainer = d3.select(map.getPanes().overlayPane);
                    let svg = svgContainer.select<SVGSVGElement>('.svg-circles-container_' + props.chartName);
                    if (svg.empty()) {
                        svg = svgContainer.append<SVGSVGElement>('svg')
                            .attr('class', 'svg-circles-container_' + props.chartName)
                            .style('position', 'absolute')
                            .style('top', 0)
                            .style('left', 0)
                            .style('z-index', '900')
                            .style('pointer-events', 'none')
                            .style('overflow', 'visible');
                    }
                    svg.attr('width', mapSize.x).attr('height', mapSize.y)
                        .style('width', `${mapSize.x}px`).style('height', `${mapSize.y}px`);

                    const keyFn = (d: any) => `${d.geometry[0]}_${d.geometry[1]}_${d.feature}`;
                    const groups = svg.selectAll('g.pres-point').data(filtered as any, keyFn);

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
                            event.stopPropagation();
                            const latlng = L ? L.latLng(+d.geometry[0], +d.geometry[1]) : { lat: 0, lng: 0 };
                            const content = `
                                    <div class="p-2 rounded-lg bg-indigo-700 text-white shadow">
                                        <h1 class="m-0 text-xl font-bold text-shadow">
                                        ${new Intl.NumberFormat('de-DE').format(Number(d.feature))}
                                        </h1>
                                        <h2 style="margin: 0; font-size: 13px; font-weight: 600;">${contextT.curFeature}<h2>
                                        <p style="margin-top:15px;margin-bottom:2px;" class="text-base"><b>${t.rich('covid19_world_data.country', {...t_richConfig})}:</b> ${d.country_name != null ? d.country_name : contextT.mouseEvent.current.country}</p>
                                        <p style="margin:0px 0;margin-bottom:15px;" class="text-base"> ${d.subregion_name != 'NULL' ? '<b>'+ t.rich('covid19_world_data.subregion', {...t_richConfig})+': </b>' + d.subregion_name : ''}</p>
                                        <p style="margin: 2px 0;"><b>${t.rich('covid19_world_data.time_range', {...t_richConfig})}:  </b> ${dateRange?.from ? format(dateRange.from, "dd.MM.yyyy") : "N/A"} - ${dateRange?.to ? format(dateRange.to, "dd.MM.yyyy") : "N/A"}</p>
                                    </div>`;
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
                    isLoadingSpinner.current = false;
                };
            }
            const imageUrl = canvas.toDataURL();

            LayerTransition(
                map,
                imageUrl,
                layerTansitionTime,
                0.9,
                overlayRef
            );

            isLoadingSpinner.current = false;
            prev_presenceDrawHash.current = presenceDrawHash; // Update the previous hash to the current one
            overlayRef.current?.setZIndex(300); // Set a high z-index to ensure it appears above other layers
        } // Render end

        Render();
    }, [presenceDrawHash,  presData, debug]);

    return overlayRef.current; // Return the canvas reference for further use
}


function MapDrawLayer_SequenceMetadata(countryCounts: { [key: string]: any }) {

    useEffect(() => {
           if (!L || !map) return;
        // Don't render if  data is loading or rendering is disabled
        if (isLoading_sequenceMetadata || !isSequenceMetaData || !isSequenceMetaData) return;


        createPieCharts(countryCounts, pieSize);
        updatePieCharts();

        // cleanup function to remove the SVG layer when component unmounts or dependencies change
        return () => {if (map && SVGLayer_ref.current) {
            if (map.hasLayer(SVGLayer_ref.current)) {
                map.removeLayer(SVGLayer_ref.current);
            }
            SVGLayer_ref.current = null;
            SVG_ref.current = undefined;
        }
    };

    }, [countryCounts, isSequenceMetaData, pieSize, isLoading_sequenceMetadata]);

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


    function createPieCharts(countryCounts: { [key: string]: any }, pieSize: number) {
            if (!L || !map || SVG_ref.current) return;
            //if(piesMerged.current != undefined) return;

            // 1) Create the Leaflet SVG renderer once
            if (!SVG_ref.current) {
                map.createPane("piesPane");
                const piesPane = map.getPane("piesPane");
                if (piesPane) {
                    piesPane.style.zIndex = "650"; // Ensure it is above the base pane
                }
                SVGLayer_ref.current = L.svg({ pane: 'piesPane' }); // Leaflet-managed <svg>
                (SVGLayer_ref.current as any)
                SVGLayer_ref.current.addTo(map);
                SVG_ref.current = {
                renderer: SVGLayer_ref.current,
                baseZoom: map.getZoom(),
                handlersAttached: false,
                } as any;
            }

            const rootSvg = d3.select(map.getPanes().piesPane).select("svg");
            const piesG = rootSvg.append("g")
                .attr("class", `pies-${props.chartName}`)
                .style("pointer-events", "all")
                .style("overflow", "visible");

            // 3) Pie/arc at *base* size (pixels at base zoom)
            const basePieSize = pieSize; // size at baseZoom
            const thickness   = Math.ceil(pieSize/3.333);
            const pieGen      = d3.pie<number>();
            const arcGen      = d3.arc<d3.PieArcDatum<number>>()
                .innerRadius(basePieSize / 2 - thickness)
                .outerRadius(basePieSize / 2);

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

                // Initial arc generator with zero angle (for animation start)
                const arcGenZero = d3.arc<d3.PieArcDatum<number>>()
                    .innerRadius(basePieSize / 2 - thickness)
                    .outerRadius(basePieSize / 2)
                    .startAngle((a: any) => a.startAngle)
                    .endAngle((a: any) => a.startAngle)

                // Create paths with initial collapsed state
                const paths = g.selectAll("path")
                    .data(pieData)
                    .enter()
                    .append("path")
                    .attr("d", arcGenZero as any)
                    .attr("labelID", (_: d3.PieArcDatum<number>, i) => i.toString())
                    .attr("fill", (_: d3.PieArcDatum<number>, i) => DonutColors[d.labels[i]])
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
                                <DonutTooltip arcData={0} d={0} countryCounts={0} locale={0} HexHighlightCol={0} basePieSize={0} thickness={0} isVisible={false} />
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
                        .attr("y", -((pieSize/2)+textSize))
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
                        .attr("y", -((pieSize/2)+textSize-1))
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

                    function renderStaticLabels(){
                        // Example: Add a label for each slice with a polyline
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

            // 5) Attach handlers once (recalculate on zoom/pan)
            if (!(SVG_ref.current as any).handlersAttached) {
                map.on("zoom move viewreset", updatePieCharts);
                (SVG_ref.current as any).handlersAttached = true;
            }
        }

    return null;
}




const appendScaleBar = useCallback(() => {
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

    let a = zoom;

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
        .attr("rx", 4)
        .attr("ry", 4)
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
}, [chart, mapUIsettings.isDistance_legend, scaleLegDims, dimensions, id_scaleBar, divRef, mapSvgHeight, barWidth, zoom]);

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
            .attr("rx", 4)
            .attr("ry", 4)
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
            }else{
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
}, [isLoading_MosquitoData, mosquitoData, selectedFeature, metaData, mapUIsettings.isColorMap_legend, colMapDims, dimensions, id_colorMap, curColroMapType, minVal, maxVal, barWidth, chart, layerOpacity, locale]);

useEffect(() => {
    appendColorMap();
    // appendScaleBar(); // Disabled: Using Leaflet's built-in ScaleControl instead
},[isUpdate, appendColorMap, layerOpacity, selectedFeature, metaData, curColroMapType, minVal, maxVal]);


useEffect(() => {
    // Initialize the selected feature when colNames are available
    if (mosquitoData !== undefined && !isLoading_MosquitoData && mosquitoData.error == null && mosquitoData.header && mosquitoData.header.length > 0 && selectedFeature === "") {
        let index = Math.ceil(mosquitoData.header.length / 2)-1;
        const tempSelectedFeature = props.mapUIsettings.defaultFeatureName ? props.mapUIsettings.defaultFeatureName : mosquitoData.header[index];
        contextT.setCurFeature(tempSelectedFeature);
        setSelectedFeature(tempSelectedFeature);
        const curMonthNumber = tempSelectedFeature.split("_").length > 1 ? parseInt(tempSelectedFeature.split("_")[1]) : -1;
        if( curMonthNumber !== -1){contextT.setCurMonth(curMonthNumber);}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mosquitoData])

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

    


   function UI_elementStyler(colSpan: number = 4){
        return { className: `text-sm m-1 p-1 border row-span-2 bg-white/75 z-10 rounded-lg shadow-md`, style: { gridColumn: `span ${colSpan} / span ${colSpan}` } };
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
       
<div className="relative size-full" >
    <div className="absolute top-[-35px] right-14 z-600">
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
    <PrintDataLoadingERRORs listOfERRORs={collectDataLoadingEROORS.current}/>
    <SizeHook element={element} sizeRef={sizeRef} setSize={setSizes}/>

      <div
        className={`absolute w-full mt-1 ml-1 pr-2 grid grid-cols-12 md:grid-cols-12 z-30   ${
            props.mapUIsettings.isSettingsBelndAnimation
                ? (isSettingsOpen
                    ? "transition-all delay-1000 duration-1000 opacity-100 scale-100 z-30"
                    : "transition-all duration-500 opacity-0 scale-100")
                : ""
        }`}
    >
    {(props.mapUIsettings.isSettingsBelndAnimation ? (isSettingsOpen && isSettingsOpenFixed) : isSettingsOpenFixed) && (
        
        <>
            {/* Reset UI position counter */}
            {mapUIsettings.isLatitude_slider && (<div {...UI_elementStyler()}>
                {t.rich('latitude', {...t_richConfig})}: {Math.round(latitude*rounder)/rounder}
                    <input
                        type="range"
                    value={latitude}
                    onChange={handleInputChange2}
                    min={-rangeLat}
                    max={rangeLat}
                    className="w-full"
                   
                />
            </div>
        )}
        {mapUIsettings.isLongnitude_slider && (
            <div  {...UI_elementStyler()}>
            {t.rich('longnitude', {...t_richConfig})}: { Math.round(longitude*rounder)/rounder}
                <input
                    type="range"
                    value={longitude}
                    onChange={handleInputChange1}
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
                    onChange={handleInputChangeZoom}
                    step={zoomStep}
                    min={minZoom}
                    max={maxZoom}
                    className="w-full"
                />
            </div>
        )}
        {mapUIsettings.isDatasetSelection_dropdown && (
            <div {...UI_elementStyler()}>
                <span className="mb-1 flex items-center justify-between">
                {t.rich('data_set', {...t_richConfig})}:
                <span className="ml-2"><HoverCardTooltip MDXContent={MDX.DataSet} /></span>
            </span>
            {listOfDataSets && 
            <Select defaultValue={ curDatasetname.current || props.mapUIsettings.defaultDatasetName} onValueChange={(value) => { 
                const dataset = listOfDataSets[value];
                curDatasetname.current = dataset;
                let url = apiRoutes.fetchDbData({
                    relationName: dataset,
                    feature: mapUIsettings.defaultFeatureName,
                    aggregation_level: isCountryLevelData ? 0 : isSubregionLevelData ? 1 : undefined,
                    startDate: (dateRange && dateRange.from && dateRange.to) ? format(dateRange.from, "yyyy-MM-dd") : undefined,
                    endDate: (dateRange && dateRange.from && dateRange.to) ? format(dateRange.to, "yyyy-MM-dd") : undefined,
                });
                isLoadingSpinner.current = true;

                setSelectedDataset(url);
                contextT.setCurDatasetURL(url);

                contextT.setCurFeature("");
                setSelectedFeature("");

                if (mapUIsettings.inCovidDataView){
                    contextT.setCurPresenceDatasetURL(url);
                    contextT.setIsPresenceData(true);
                    setIsPresData(true);
                    setPresenceDataURL(url);
                }

                isLoadingSpinner.current = false;
                }
                            } >
                <SelectTrigger className="w-full">
                <SelectValue placeholder={ curDatasetname.current} />
                </SelectTrigger>
                <SelectContent>
                <SelectGroup>
                    <SelectLabel></SelectLabel>
                        {Object.keys(listOfDataSets).map((key: string, index: number) => {
                            if (props.mapUIsettings.filterString_for_availableDataset_include != "" ) {
                                if(key.includes(props.mapUIsettings.filterString_for_availableDataset_include) && !key.includes(props.mapUIsettings.filterString_for_availableDataset_exclude)) {
                                return (
                                    <SelectItem key={index} value={key}>
                                        {key}
                                    </SelectItem>
                                );
                            }
                        }
                        else {
                        return(<SelectItem key={index} value={key}>
                            {key}
                        </SelectItem>)
                        }
                        })}
                    </SelectGroup>
        </SelectContent>
        </Select>
        }
        </div>)}
        {mapUIsettings.isFeatureSelection_dropdown && (
            <div {...UI_elementStyler()}>
            <span className="mb-1 flex items-center justify-between">
                 {t.rich('feature', {...t_richConfig})}:
                <span className="ml-2"><HoverCardTooltip MDXContent={MDX.DataFeature} /></span>
            </span>
            {colNames && metaData && (
        <Select value={selectedFeature} onValueChange={(value) => { 
                contextT.setCurFeature(value);
                let url = apiRoutes.fetchDbData({
                    relationName: curDatasetname.current,
                    feature: value,
                    filterBy: selectedCountry ? "iso_3166_1_alpha_3" : undefined,
                    filterValue: selectedCountry || undefined,
                    startDate: (dateRange && dateRange.from && dateRange.to) ? format(dateRange.from, "yyyy-MM-dd") : undefined,
                    endDate: (dateRange && dateRange.from && dateRange.to) ? format(dateRange.to, "yyyy-MM-dd") : undefined,
                    aggregation_level: isCountryLevelData ? 0 : isSubregionLevelData ? 1 : undefined,
                });
                props.mapUIsettings.defaultFeatureName = "";
                isLoadingSpinner.current = true;

                // get month from selection when feature includes a number after an underscore
                const curMonthNumber = value.split("_").length > 1 ? parseInt(value.split("_")[1]) : -1;
                contextT.setCurMonth(curMonthNumber);
                    
             

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
                
                setTimeout(() => {
                    isLoadingSpinner.current = false;
                }, 3000);
                }
                } >
                <SelectTrigger className="w-full">
                <SelectValue placeholder={"loading..."} />
                </SelectTrigger>
                <SelectContent>
                <SelectGroup>
                    <SelectLabel></SelectLabel>
                        {colNames.map((name) => {
                            const isAvailable = (metaData[name as keyof typeof metaData]?.availability === "1" ||
                                metaData[name as keyof typeof metaData]?.availability === undefined) && name !== "id";
                            const filterStr = props.mapUIsettings.filterString_for_availableFeature;
                            const passesFilter = !filterStr || name.includes(filterStr);

                            if (isAvailable && passesFilter) {
                                return (
                                    <SelectItem key={name} value={name}>
                                    <b>{name + " [" + metaData[name as keyof typeof metaData]?.dimension + "]"}</b>
                                    <i>{" " + metaData[name as keyof typeof metaData]?.description}</i>
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

        {mapUIsettings.isColorMapSelection_dropdown && ischanged && (
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
                            isLoadingSpinner.current = true;
                        }} defaultValue={curColroMapType}>
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
            <div className='mb-1'>
                <MosquitoIcon size={20} />
            </div>
            <Checkbox
                className="scale-140 m-1 mt-1.5"
                id="isPresData-checkbox"
                checked={isPresData}
                onCheckedChange={(checked: boolean) => {
                    isLoadingSpinner.current = true;

                    contextT.setIsPresenceData(checked);
                    setIsPresData(checked)

                }}
            />
        </div>
            </div>

                {P_species.response && (
                    <div className='col-span-3'>
                        <label htmlFor="species-select">
                            {t.rich('presence_data.dropdownSpecies', {...t_richConfig})}:
                        </label>
                        <Select value={curSpecies} onValueChange={(value) => {
                            let url = apiRoutes.fetchDbData({ relationName: contextT.curPresenceDatasetName, feature: "pointtype", filterBy: "'pointtype','species','year'", filterValue: "'point, exact location','" + value + "','" + curYear + "'" });
                            isLoadingSpinner.current = true;
                            setCurSpecies(value);
                            setTimeout(() => {
                                contextT.setCurPresenceDatasetURL(url);
                                setPresenceDataURL(url);
                            }, 200);
                        }}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder={"loading..."} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel></SelectLabel>
                                    <SelectItem key="ALL" value="ALL">
                                        <b>all</b>
                                    </SelectItem>
                                    {Object.keys(P_species.response).map((key: string, index: number) => (
                                        P_species.response[index] && P_species.response[index]["feature"] ? (
                                            <SelectItem key={index} value={P_species.response[index]["feature"]}>
                                                <b>{P_species.response[index]["feature"]}</b>
                                            </SelectItem>
                                        ) : null
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {P_years.response && (
                    <div className='col-span-3'>
                        <label htmlFor="year-select">
                            {t.rich('presence_data.dropdownYear', {...t_richConfig})}:
                        </label>
                        <Select value={curYear} onValueChange={(value) => {
                            let url = apiRoutes.fetchDbData({ relationName: contextT.curPresenceDatasetName, feature: "pointtype", filterBy: "'pointtype','species','year'", filterValue: "'point, exact location','" + curSpecies + "','" + value + "'" });
                            isLoadingSpinner.current = true;
                            setCurYear(value);
                            setTimeout(() => {
                                contextT.setCurPresenceDatasetURL(url);
                                setPresenceDataURL(url);
                            }, 200);
                        }}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder={"loading..."} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel></SelectLabel>
                                    <SelectItem key="ALL" value="ALL">
                                        <b>all</b>
                                    </SelectItem>
                                    {Object.keys(P_years.response).map((_: string, index: number) => (
                                        P_years.response[index] && P_years.response[index]["feature"] ? (
                                            <SelectItem key={index} value={P_years.response[index]["feature"]}>
                                                <b>{P_years.response[index]["feature"]}</b>
                                            </SelectItem>
                                        ) : null
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                )}
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
                            isLoadingSpinner.current = true;
                            const checked = e as boolean;
                            contextT.setIsSequenceMetaData(checked);
                            setIsSequenceMetaData(checked);
                            let url = apiRoutes.fetchDbData({ relationName: contextT.curDonutChartDatasetName, feature: geoAssignmentColumn, task: "getCount", filterBy: "'" + sequenceColumnForDonut + "','date'", filterValue: "'" + cur_Sorgansim + "','" + cur_SYear + "'" });
                            //setSequenceMetaDataURL(url);
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

             {S_organism.response && (
                    <div className='col-span-3'>
                        <label htmlFor="organism-select">
                            {t.rich('sequence_Metadata.dropdownType', {...t_richConfig})}:
                        </label>
                        <Select value={cur_Sorgansim} onValueChange={(value) => {
                            let url = apiRoutes.fetchDbData({ relationName: contextT.curDonutChartDatasetName, feature: geoAssignmentColumn, task: "getCount", filterBy: "'" + sequenceColumnForDonut + "','date'", filterValue: "'" + value + "','" + cur_SYear + "'" });
                            isLoadingSpinner.current = true;
                            setCur_SOrgansim(value);
                            contextT.setCurSOrgansim(value);
                            setTimeout(() => {
                                contextT.setCurDonutChartDataURL(url);
                                setSequenceMetaDataURL(url);
                            }, 200);
                        }}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder={"loading..."} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel></SelectLabel>
                                    <SelectItem key="ALL" value="ALL">
                                        <b>all</b>
                                    </SelectItem>
                                    {Object.keys(S_organism.response).map((key: string, index: number) => (
                                        S_organism.response[index] && S_organism.response[index]["feature"] ? (
                                            <SelectItem key={index} value={S_organism.response[index]["feature"]}>
                                                <b>
                                                    <span
                                                        style={{
                                                            display: "inline-block",
                                                            width: "16px",
                                                            height: "16px",
                                                            marginRight: "6px",
                                                            verticalAlign: "middle",
                                                            borderRadius: "3px",
                                                            background: DonutColors[S_organism.response[index]["feature"]] || "#ccc",
                                                            border: "1px solid #888"
                                                        }}
                                                    ></span>
                                                    {S_organism.response[index]["feature"]}
                                                </b>
                                            </SelectItem>
                                        ) : null
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        
                    </div>
                )}

                {S_years.response && (
                    <div className='col-span-3'>
                        <label htmlFor="year-select">
                            {t.rich('sequence_Metadata.dropdownYear', {...t_richConfig})}:
                        </label>
                        <Select value={cur_SYear} onValueChange={(value) => {
                            let url = apiRoutes.fetchDbData({ relationName: contextT.curDonutChartDatasetName, feature: geoAssignmentColumn, task: "getCount", filterBy: "'" + sequenceColumnForDonut + "','date'", filterValue: "'" + cur_Sorgansim + "','" + value + "'" });
                            isLoadingSpinner.current = true;
                            setCur_SYear(value);
                            contextT.setCurSyear(value);
                            setTimeout(() => {
                                contextT.setCurDonutChartDataURL(url);
                                setSequenceMetaDataURL(url);
                            }, 200);
                        }}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder={"loading..."} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel></SelectLabel>
                                    <SelectItem key="ALL" value="ALL">
                                        <b>all</b>
                                    </SelectItem>
                                    {Object.keys(S_years.response).map((key: string, index: number) => (
                                        S_years.response[index] && S_years.response[index]["feature"] ? (
                                            <SelectItem key={index} value={S_years.response[index]["feature"]}>
                                                <b>{S_years.response[index]["feature"] == "1" ? "N/A" : S_years.response[index]["feature"]}</b>
                                            </SelectItem>
                                        ) : null
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                )}
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
        {mapUIsettings.isCountrySelection_dropdownMapBased && Array.isArray(mapData.features) && mapData.features.length > 0 && map && (
            <div {...UI_elementStyler()}>
            <label htmlFor="dataset-select">
                 {t.rich('country', {...t_richConfig})}
            </label>
            {selected_country_names && metaData && (
           <Select value={selectedCountry} onValueChange={(value) => {
                
                {mapData.features.map((feature, index) => {
                        const country = feature.properties?.name || feature.properties?.NAME || "";
                        if(country === value && L) {
                            const bounds = L.geoJSON(feature).getBounds();
                            map?.fitBounds(bounds, { maxZoom: 8, padding: [20, 20] });
                        }
                    })}
                    const selectionColor = DonutColors[value] || "#2196f3";
                    mapData.features.forEach((feature, index) => {
                        const country = feature.properties?.name || feature.properties?.NAME || "";
                        if (country === value && L) {
                            const bounds = L.geoJSON(feature).getBounds();
                            map?.fitBounds(bounds, { maxZoom: 8, padding: [20, 20] });
                            // Highlight selected country with selection color
                            map.eachLayer((layer) => {
                                if (layer instanceof L.GeoJSON) {
                                    (layer as L.GeoJSON).eachLayer((subLayer) => {
                                        if (subLayer instanceof L.Path) {
                                            const featureName = (subLayer as any).feature?.properties?.name || (subLayer as any).feature?.properties?.NAME || "";
                                            if (featureName === value) {
                                                (subLayer as L.Path).setStyle({
                                                    color: selectionColor,
                                                    fillColor: selectionColor,
                                                    weight: props.mapStyles?.strokeWidth + 2,
                                                    fillOpacity: 0.3,
                                                });
                                            } else {
                                                (subLayer as L.Path).setStyle({
                                                    color: "#000000",
                                                    fillColor: "rgba(50, 95, 184, 0)",
                                                    weight: props.mapStyles?.strokeWidth,
                                                    fillOpacity: 0.0,
                                                });
                                            }
                                        }
                                    });
                                }
                            });
                        }
                    });
    
                setSelectedCountry(value);
                }
                } >
                <SelectTrigger className="w-full">
                <SelectValue placeholder={"Select country..."} />
                </SelectTrigger>
                <SelectContent>
                <SelectGroup>
                    {[...mapData.features]
                        .map((feature) => feature.properties?.name || feature.properties?.NAME || "")
                        .filter((country) => country) // filter out empty names
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
        {mapUIsettings.isCountrySelection_dropdown && (
            <div {...UI_elementStyler()}>
            <label htmlFor="dataset-select">
                 {t.rich('country', {...t_richConfig})}:
            </label>
            {selected_country_names && metaData && (
           <Select value={selectedCountry} onValueChange={(value) => {
                let url = apiRoutes.fetchDbData({
                    relationName: curDatasetname.current,
                    feature: contextT.curFeature,
                    filterBy: "iso_3166_1_alpha_3",
                    filterValue: value,
                    startDate: (dateRange && dateRange.from && dateRange.to) ? format(dateRange.from, "yyyy-MM-dd") : undefined,
                    endDate: (dateRange && dateRange.from && dateRange.to) ? format(dateRange.to, "yyyy-MM-dd") : undefined,
                    aggregation_level: isCountryLevelData ? 0 : isSubregionLevelData ? 1 : undefined,
                });
                isLoadingSpinner.current = true;

                setDateRange(dateRange ? dateRange : {from: min_date, to: max_date});

                setSelectedCountry(value);
                contextT.setSelectedCountry(value);
                contextT.setCurDatasetURL(url);
                contextT.setCurPresenceDatasetURL(url);
                contextT.setIsPresenceData(true);
                setIsPresData(true);
                isLoadingSpinner.current = true;
                setPresenceDataURL(url);
                setShowSuccessCountryDropdown(true);

                let curCenter =  getCountryCenterFromMapData(mapData, value);

                if(map!= null){
                    if (highlightedCountryRef.current) {
                        console.log("Layer exists in map?", map.hasLayer(highlightedCountryRef.current));

                        console.log("** before remove", highlightedCountryRef.current);
                        map.removeLayer(highlightedCountryRef.current);
                        highlightedCountryRef.current = null;
                      }
                    
                    const svg = d3.select(map.getContainer()).select("svg");
                    const interpolateLat = d3.interpolate(latitude, curCenter.lat);
                    const interpolateLong = d3.interpolate(longitude, curCenter.lng);
                    let interpolateZoom = d3.interpolate(zoom,  zoom * 0.6);
                      
                    svg.transition()
                        .duration(mapFlyTransitionTime)
                        .on("start", () => {
                            console.log("Transition started");
                            setIsSettingsOpen(false);
                        }) 
                        .on("end", () => {

                            const matchingFeature = mapData.features.find(
                                (feature) =>
                                feature.properties?.iso_a3 === value ||
                                feature.properties?.name === value
                            );

                            if (matchingFeature) {
    
                                const countryLayer = L ? L.geoJSON(matchingFeature, {
                                style: {
                                    color: "rgba(106, 13, 173, 1)",
                                    weight: 5,
                                    fill: false,
                                    fillOpacity: 0,
                                    opacity:1
                                },
                                }) : null;
                                if (!countryLayer) return;
                                countryLayer.addTo(map);


                                map.flyToBounds(countryLayer.getBounds(), {
                                    padding: [200, 100],
                                    maxZoom: 5,
                                    duration:2.5
                                  });


                                highlightedCountryRef.current = countryLayer;
                            }
                            console.log("Transition ended");
                        })
                        .tween("coordinates", () => (t) => {

                            console.log("**tween");

                            const prarbT = (x: number): number => {
                                return x * x;
                            };
                            let tnew = 0;
                            let newZoom = 0;
                             tnew = 1 - prarbT(t * 2 - 1.0);
                            if(zoom < 3.2)  {
                               newZoom = zoom;
                            }
                            else {
                                newZoom = interpolateZoom(tnew);
                            }
                            const newLat = interpolateLat(t);
                            const newLong = interpolateLong(t);
                            SET_coordinates(newLat, newLong, newZoom);
                        });
                }

                setTimeout(() => {
                    isLoadingSpinner.current = false;
                    setShowSuccessCountryDropdown(false);
                }, 3000);

                }
                } >
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

    <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 mt-2">
        <Button
                className="truncate w-full  min-w-0 px-4 py-2 mb-2  bg-blue-500 text-white rounded text-sm whitespace-nowrap overflow-hidden text-ellipsis"
                onClick={ () => {
                    isLoadingSpinner.current = true;

                    setSelectedCountry("");
                    contextT.setSelectedCountry("");

                    let url = apiRoutes.fetchDbData({
                        relationName: curDatasetname.current,
                        feature: contextT.curFeature,
                        startDate: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
                        endDate: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
                        aggregation_level: isCountryLevelData ? 0 : isSubregionLevelData ? 1 : undefined,
                    });
        
                    contextT.setCurDatasetURL(url);
                    contextT.setCurPresenceDatasetURL(url);
                    contextT.setIsPresenceData(true);
                    setIsPresData(true);
                    isLoadingSpinner.current = true;
                    setPresenceDataURL(url);
                    setShowSuccessCountryDropdown(true);
    
    
                    setTimeout(() => {
                        isLoadingSpinner.current = false;
                        setShowSuccessCountryDropdown(false);
                    }, 5000);

                    isLoadingSpinner.current = false;
                }}
            >
            <span className="block lg:hidden">{t.rich('covid19_world_data.reset_to_all_countries_short', {...t_richConfig})}</span>
            <span className="hidden lg:block">{t.rich('covid19_world_data.reset_to_all_countries', {...t_richConfig})}</span>
        </Button>
        </div>

        {showSuccessCountryDropdown && <div>
            <div className="pointer-events-auto">
            <AlertSuccess/>
            </div>
        </div>}

        </div>)
        }


    {mapUIsettings.isDatePicker && (
        <div {...UI_elementStyler(8)}   > 
            <label htmlFor="dataset-select">
            {t.rich('time_range', {...t_richConfig})}:
            </label>
            <div className="flex flex-col lg:flex-row items-start lg:items-center space-y-2 lg:space-y-0 lg:space-x-2 mt-2 min-w-0">
            <Popover>
            <PopoverTrigger asChild>
                <Button
                variant="outline"
                data-empty={!dateRange}
                className="data-[empty=true]:text-muted-foreground w-full justify-start text-left font-normal border-3 border-purple-800 focus-visible:ring-3 focus-visible:ring-purple-800
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
                    <div className="flex flex-col p-3 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800">
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
                                contextT.setDateRange(newRange);
                            }}
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
                    <div className="flex flex-col p-3">
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
                                contextT.setDateRange(newRange);
                            }}
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
                className="mt-0 bg-purple-800 truncate w-full min-w-0 px-4 py-2 text-white p-1 rounded text-sm whitespace-nowrap overflow-hidden text-ellipsis"
                onClick={ () => {
                    isLoadingSpinner.current = true;
                    
                    let url = apiRoutes.fetchDbData({
                        relationName: curDatasetname.current,
                        feature: selectedFeature || contextT.curFeature,
                        filterBy: selectedCountry ? "iso_3166_1_alpha_3" : undefined,
                        filterValue: selectedCountry || undefined,
                        startDate: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
                        endDate: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
                        aggregation_level: isCountryLevelData ? 0 : isSubregionLevelData ? 1 : undefined,
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
                        isLoadingSpinner.current = false;
                        setShowSuccesTimerangeDropdown(false);
                    }, 5000);

                }}
            >
                <span className="block lg:hidden">{t.rich('covid19_world_data.time_range_data_short', {...t_richConfig})}</span>
                <span className="hidden lg:block">{t.rich('covid19_world_data.time_range_data', {...t_richConfig})}</span>
            </Button>

            </div>

            <div className="flex flex-col lg:flex-row items-start lg:items-center space-y-2 lg:space-y-0 lg:space-x-2 mt-2 min-w-0">
            <Button
                  className="truncate w-full min-w-0 lg:w-2/3 px-4 py-2 text-white rounded text-sm mb-2"
                onClick={ () => {
                    isLoadingSpinner.current = true;
                    
                    let url = apiRoutes.fetchDbData({
                        relationName: curDatasetname.current,
                        feature: selectedFeature || contextT.curFeature,
                        filterBy: selectedCountry ? "iso_3166_1_alpha_3" : undefined,
                        filterValue: selectedCountry || undefined,
                        startDate: format(min_date, "yyyy-MM-dd"),
                        endDate: format(max_date, "yyyy-MM-dd"),
                        aggregation_level: isCountryLevelData ? 0 : isSubregionLevelData ? 1 : undefined,
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
                        isLoadingSpinner.current = false;
                        setShowSuccesTimerangeDropdown(false);
                    }, 5000);

                }}
            >                
            <span className="block lg:hidden">{t.rich('covid19_world_data.complete_data_short', {...t_richConfig})}</span>
            <span className="hidden lg:block">{t.rich('covid19_world_data.complete_data', {...t_richConfig})}</span>
            </Button>

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
                        filterBy: selectedCountry ? "iso_3166_1_alpha_3" : undefined,
                        filterValue: selectedCountry || undefined,
                        startDate: format(start_date, "yyyy-MM-dd"),
                        endDate: format(end_date, "yyyy-MM-dd"),
                        aggregation_level: isCountryLevelData ? 0 : isSubregionLevelData ? 1 : undefined,
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
            }}>
            {t.rich('covid19_world_data.clear_map', {...t_richConfig})}
            </Button>

            </div>
            {showSuccessTimerangeDropdown && <div>
            <div className="pointer-events-auto">
            <AlertSuccess/>
            </div>
        </div>}
         
        </div>)
        }


         {mapUIsettings.isAutoHideSettingsToggle && (
        <div {...UI_elementStyler(2)} > 
         <div className="grid grid-cols-4 gap-2">
        <div className='col-span-1 mt-0 flex items-center justify-center'>
            <Checkbox
                className="scale-140 "
                    id="isAutoHideSettings-checkbox"
                    defaultChecked={props.mapUIsettings.isSettingsBelndAnimation}
                    onCheckedChange={(e) => {
                        isLoadingSpinner.current = true;
                        const checked = e as boolean;
                        props.mapUIsettings.isSettingsBelndAnimation = checked;
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
                                    isLoadingSpinner.current = true;

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
                                                        .selectAll('circle')
                                                        .remove();
                                                    });
                                
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

                                    
                                    isLoadingSpinner.current = false;
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
                                    isLoadingSpinner.current = true;

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
                                                        .selectAll('circle')
                                                        .remove();
                                                    });
                                
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
                                    
                                    // setTimeout(() => {
                                        isLoadingSpinner.current = false;
                                    //}, 1000);
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

        

    {isLoadingSpinner.current && (<LoadingSpinner  />)}
    <div ref={divRef} className='flex justify-center items-center size-full'>
    <svg id={chart} className=' w-full h-full'></svg>

    <LeafletMapComponent ChartPorps={leafProps}>
     
    <MapContent /> 
    <div ref={SVG_tooltip_ref} className='absolute pointer-events-none'></div>
    </LeafletMapComponent>

    {/*{renderCountOverlay}*/}
    {props.mapUIsettings.isLatLngZoomOverlay && (
        <LatLongZoomOverlay
            latitude={latitude}
            longitude={longitude}
            zoom={zoom}
            scaleLegDims={scaleLegDims}
        />
    )}
   
    </div>
</div>

</>
    );
};


const LatLongZoomOverlay: React.FC<{ latitude: number; longitude: number; zoom: number; scaleLegDims: { posY: number; width: number; posX: number; height: number } }> = ({
        latitude,
        longitude,
        zoom,
        scaleLegDims
    }) => {

        const locale = useLocale();

        return(
        <div
            style={{
                position: "absolute",
                bottom: scaleLegDims.posY-1,
                left: scaleLegDims.width + scaleLegDims.posX + 4,
                height: scaleLegDims.height+1,
                background: "rgba(255, 255, 255, 0.7)",
                color: "black",
                fontSize: "10px",
                padding: "2px 6px",
                borderRadius: "6px",
                zIndex: 50,
                pointerEvents: "none",
                textAlign: "center",
                border: "1px solid #454444af",
                boxSizing: "border-box"
            }}
        >
            <div className="grid grid-cols-3 gap-0 w-full text-center overflow-hidden">
                <div className="font-bold">Lat</div>
                <div className="font-bold">Lng</div>
                <div className="font-bold">Zoom</div>
                <div className="">{latitude.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</div>
                <div className="">{longitude.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</div>
                <div className="">{zoom.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</div>
            </div>
        </div>
    )};


    function DonutTooltip({ map, mapData, arcData, d, renderColor, countryCounts, locale, HexHighlightCol, basePieSize, thickness, label, t, selection, isVisible }: any) {

        const labelWidth = 230;
        const labelHeight = 160;
        // Get the center of the current hover object (pie slice)
        // Get absolute pie center in SVG coordinates
        if (!map) return null;
        const pieCenterAbs = map.latLngToContainerPoint([d.lat, d.lng]);

        const s = map.getZoomScale( map.getZoom(), 3.0); // scale factor relative to base zoom
        const [posA, posB, posC] = getLabelPolyline(arcData, basePieSize, thickness);
        let posCLatLng = map.containerPointToLatLng([posC[0], posC[1]]);
        posCLatLng.lat += d.lat;
        posCLatLng.lng += d.lng;

        
        // Adjust tooltip position: offset from pie center by posC, then shift right/down for better visibility
        const posCPol = [posC[0]*s + pieCenterAbs.x, posC[1]*s + pieCenterAbs.y];
        const posBPol = [posB[0]*s + pieCenterAbs.x, posB[1]*s + pieCenterAbs.y];
        const posAPol = [posA[0]*s + pieCenterAbs.x, posA[1]*s + pieCenterAbs.y];

        const midangle = arcData.startAngle + (arcData.endAngle - arcData.startAngle) / 2
      
        const tooltipX = posCPol[0]+(labelWidth*(midangle < Math.PI ? 0.1 : -1.1));
        const tooltipY = posCPol[1]-labelHeight/2;

        const posCPolfin = [ tooltipX, posCPol[1]];

        let textTotal = selection == "ALL" ? t.rich('tooltipDonut.total', {...t_richConfig}) : label;
        let textPercentage = selection == "ALL" ? (Math.min(
                                (arcData.value / (countryCounts[d.id]?.count || 1)) * 100,
                                100
                            )).toLocaleString(locale, {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                        })+"%" : "does not apply";

        // get tranlated country name
        let countryName = "";
        mapData.features.forEach((feature: GEOjson.Feature) => {
                feature.properties = feature.properties || {};
                if (feature && (feature.properties.admin == d.id) 
                    || feature.properties.NAME == d.id
                    || feature.properties.iso_a3 == d.id
                    || feature.properties.iso_a2 == d.id) {
                        countryName = feature.properties["NAME_"+locale] || feature.properties["name_"+locale] || "";
                        return
                    }
        });

        // Polyline coordinates adjusted to be relative to the SVG’s local coords
        const points: [number, number][] = [
            [posCPolfin[0], posCPolfin[1] ],
            [posBPol[0], posBPol[1]],
            [posAPol[0], posAPol[1]]
        ]

        if (!isVisible) return null;
            return (
                <>
                <PolylineTooltip points={points} />
                <div
                className="
                    absolute
                    bg-linear-to-br from-[#23235b] via-[#23235b] to-[#1a1a2a]
                    text-slate-50
                    rounded-3xl
                    shadow-lg
                    p-[14px_22px]
                    text-[15px]
                    border border-[#3b3b6b]
                    font-[Segoe_UI,Arial,sans-serif]
                    z-9999
                "
                style={{
                    top: tooltipY,
                    left: tooltipX,
                    width: labelWidth,
                    height: labelHeight,
                    minWidth: labelWidth,
                    maxWidth: labelWidth,
                    pointerEvents: "none",
                }}
                >
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                        <span>
                            <span
                            className="text-3xl font-semibold tracking-tight"
                            style={{ color: HexHighlightCol }}
                        >
                            {arcData.value.toLocaleString(locale)}
                        </span>
                        <span className="text-sm text-indigo-200">
                                {" counts"}
                            </span>
                        </span>
                        
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-2 py-2 text-xs font-medium tracking-wide text-indigo-100">
                        <span
                            className="h-4 w-4 rounded-sm"
                            style={{ backgroundColor: renderColor }}
                        />
                        <span>{label}</span>
                    </div>
                </div>
                <div className="my-1 border-t border-white/20" role="separator"></div>
                <table className="w-full mt-2 text-sm border-collapse">
                    <tbody>
                         {selection == "ALL" && (
                    <tr>
                        <td className="font-medium text-indigo-300">Serotype:</td>
                        <td>{label}</td>
                    </tr>)}
                    {selection == "ALL" && (
                    <tr>
                        <td className="font-medium text-indigo-300">{textTotal}:</td>
                        <td>{countryCounts[d.id]?.count || "0"}</td>
                    </tr>)}
                    {selection == "ALL" && (
                        <tr>
                            <td className="font-medium text-indigo-300">{t.rich('tooltipDonut.relative', {...t_richConfig})}:</td>
                            <td>
                            {textPercentage}
                            </td>
                        </tr>
                    )}
                    <tr>
                        <td className="font-medium text-indigo-300"> {t.rich('tooltipDonut.country', {...t_richConfig})}:</td>
                        <td>{countryName}</td>
                    </tr>
                    </tbody>
                </table>
                </div>
                </>
            );
    }

    type PolylineTooltipProps = {
        points: [number, number][];
    };

    const PolylineTooltip: React.FC<PolylineTooltipProps> = ({
        points = [[0, 0], [0, 0], [0, 0]],
    }) => {
        const polyLineSVG = useRef<SVGSVGElement | null>(null);

        // Add extra space for stroke width
        const strokeWidth = 4;
        const xs = points.map(p => p[0]);
        const ys = points.map(p => p[1]);
        const minX = Math.min(...xs) - strokeWidth;
        const minY = Math.min(...ys) - strokeWidth;
        const maxX = Math.max(...xs) + strokeWidth;
        const maxY = Math.max(...ys) + strokeWidth;
        const width = maxX - minX;
        const height = maxY - minY;

        useEffect(() => {
            // Adjust points to local SVG coordinates
            const polyCoords = [
            [points[2][0] - minX, points[2][1] - minY],
            [points[1][0] - minX, points[1][1] - minY],
            [points[0][0] - minX, points[0][1] - minY],
            ]
            .map((p) => p.join(","))
            .join(" ");

            const existingSVG = d3.select(polyLineSVG.current).selectAll("polyline");
            existingSVG.remove();
            const d3Svg = d3.select(polyLineSVG.current)
            .attr("width", width)
            .attr("height", height)
      

            d3Svg.append("polyline")
            .style("pointer-events", "none")
            .attr("points", polyCoords)
            .attr("stroke", "#23235b")
            .attr("stroke-width", strokeWidth)
            .attr("fill", "none");
        }, [points, width, height, minX, minY]);

        return (
            <div
            className='absolute z-8000 bg-transparent overflow-visible '
                style={{
                    left: `${minX}px`,
                    top: `${minY}px`,
                    width: `${width}px`,
                    height: `${height}px`,
                    pointerEvents: "none",
                    border: "none",
                    display: "block",
                }}
            >
                <svg ref={polyLineSVG}> </svg>
            </div>
        );
    };

     function getLabelPolyline(arcData: d3.PieArcDatum<number>, basePieSize: number, thickness: number){
            const labelRadius = basePieSize / 2 + thickness/2; // distance from pie center
            const startRadius = basePieSize / 2 - thickness/2; // distance from pie center to start of arc
            const angle = (arcData.startAngle + arcData.endAngle) / 2;
            const posA = [Math.cos(angle - Math.PI / 2) * startRadius, Math.sin(angle - Math.PI / 2) * startRadius];
            const posB = [Math.cos(angle - Math.PI / 2) * labelRadius, Math.sin(angle - Math.PI / 2) * labelRadius];
            let posC = [posB[0], posB[1]];
            const midangle = arcData.startAngle + (arcData.endAngle - arcData.startAngle) / 2
            posC[0] = labelRadius * 0.95 * (midangle < Math.PI ? 1 : -1); // multiply by 1 or -1 to put it on the right or on the left

            return [posA,posB,posC]
        }



export default  LeafD3MapLayerComponent;
export { LeafD3MapLayerProps };


