
import { Row } from '@tanstack/react-table';
import { createContext, useCallback, useContext, useMemo, useState, useRef } from 'react'
import React from 'react';


const GinterfaceContext = createContext({} as interfaceContextI);

/**
 * Global reactive state interface for the ICV (Interactive Context-rich Views) framework.
 *
 * Serves as the central event bus and synchronized state contract across multi-view dashboard elements,
 * coordinating state parameters between spatial maps, time-series line charts, data tables, and donut overlays.
 *
 * @remarks
 * To prevent infinite render loops when multiple visual widgets receive state updates, components accept
 * boolean flags like `isApplyContextData` and `isSetIntialContextDataFromComponent`. High-frequency mouse events
 * are routed through `mouseEvent` (a React `MutableRefObject`) to bypass React re-render cycles during rapid cursor movements.
 *
 * @see {@link InterfaceContextProvider} for the React context provider implementation.
 * @see {@link useInterfaceContext} for consuming this context within React dashboard widgets.
 * @see {@link LeafD3Map} for Leaflet spatial map consumer implementation.
 * @see {@link useFetchAndCache} for data fetching hooks driven by state context parameters.
 *
 * @example
 * ```tsx
 * const {
 *   curFeature,
 *   setCurFeature,
 *   mapCoords,
 *   setMapCoords,
 *   isPresenceData,
 *   setIsPresenceData,
 * } = useInterfaceContext();
 *
 * // Update selected public health vector feature
 * setCurFeature("mosquito_density_albopictus");
 * ```
 */
export interface interfaceContextI {
    /** Currently selected data table row ID (-1 if unselected) */
    selectedTableRowID: number;
    /** Dispatcher to set selected table row ID */
    setTableRowID: React.Dispatch<React.SetStateAction<number>>;
    /** Currently selected TanStack Table row instance */
    selectedTableRow: Row<unknown>;
    /** Dispatcher to set selected table row instance */
    setTableRow: React.Dispatch<React.SetStateAction<Row<unknown>>>;
    /** Active database table name associated with selected row */
    selectedTableName: string;
    /** Dispatcher to set active table name */
    setTableName: React.Dispatch<React.SetStateAction<string>>;
    /** Selected subregion / administrative state ID */
    selectedStateID: number;
    /** Dispatcher to set selected state ID */
    setSelectedStateID: React.Dispatch<React.SetStateAction<number>>;
    /** Selected spatial 2D grid cell index */
    selectedGridcellID: number;
    /** Dispatcher to set selected grid cell index */
    setSelectedGridcellID: React.Dispatch<React.SetStateAction<number>>;
    /** SQL primary key row ID corresponding to `selectedGridcellID` */
    dbRowID_of_selectedGridcellID: number;
    /** Dispatcher to set SQL primary key row ID for selected grid cell */
    setDbRowID_of_selectedGridcellID: React.Dispatch<React.SetStateAction<number>>;
    /** Filter mode selection string (e.g. "gridcell", "country", "subregion") */
    selectedFilter: string;
    /** Dispatcher to set filter mode selection string */
    setSelectedFilter: React.Dispatch<React.SetStateAction<string>>;
    /** ISO or localized name of currently selected country */
    selectedCountry: string;
    /** Dispatcher to set selected country name */
    setSelectedCountry: React.Dispatch<React.SetStateAction<string>>;
    /** Active GeoJSON selection feature object for animated camera transitions */
    mapSelectionObj: any;
    /** Dispatcher to set map selection feature object */
    setMapSelectionObj: React.Dispatch<React.SetStateAction<any>>;
    /** Active D3 sequential or diverging color map palette key (e.g. "interpolateInferno") */
    curColorMap: string;
    /** Dispatcher to set active color map palette key */
    setCurColorMap: React.Dispatch<React.SetStateAction<string>>;
    /** Currently selected dataset feature column name (e.g. "mosquito_amount") */
    curFeature: string;
    /** Dispatcher to set dataset feature column name */
    setCurFeature: React.Dispatch<React.SetStateAction<string>>;
    /** Active backend API URL string for fetching grid dataset payloads */
    curDatasetURL: string;
    /** Dispatcher to set active backend API URL string */
    setCurDatasetURL: React.Dispatch<React.SetStateAction<string>>;
    /** Active spatial layer alpha opacity (0 to 1) */
    curLayerOpacity: number;
    /** Dispatcher to set layer opacity */
    setCurLayerOpacity: React.Dispatch<React.SetStateAction<number>>;
    /** Formatted string representation of currently inspected feature value */
    curFeatureValue: string;
    /** Dispatcher to set formatted feature value string */
    setCurFeatureValue: React.Dispatch<React.SetStateAction<string>>;
    /** Toggle flag enabling species presence marker overlays */
    isPresenceData: boolean;
    /** Dispatcher to toggle species presence data overlays */
    setIsPresenceData: React.Dispatch<React.SetStateAction<boolean>>;
    /** Toggle flag enabling genomic sequence metadata donut chart overlays */
    isSequenceMetaData: boolean;
    /** Dispatcher to toggle sequence metadata donut overlays */
    setIsSequenceMetaData: React.Dispatch<React.SetStateAction<boolean>>;
    /** Outer pixel size diameter for sequence metadata donut charts */
    pieSize_sequenceMetaData: number;
    /** Dispatcher to set sequence metadata donut outer pixel size */
    setPieSize_sequenceMetaData: React.Dispatch<React.SetStateAction<number>>;
    /** Temporal filter date range object containing starting `from` and ending `to` dates */
    dateRange: { from: Date | undefined; to?: Date | undefined; } | undefined;
    /** Setter method updating temporal date range */
    setDateRange(arg0: { from: Date | undefined; to?: Date | undefined; } | undefined): unknown;
    /** Currently selected month index (1–12, or -1 for all months) */
    curMonth: number;
    /** Dispatcher to set current selected month index */
    setCurMonth: React.Dispatch<React.SetStateAction<number>>;
    /** Active presence dataset identifier string */
    curPresenceDatasetName: string;
    /** Dispatcher to set presence dataset name */
    setCurPresenceDatasetName: React.Dispatch<React.SetStateAction<string>>;
    /** API URL endpoint for presence marker data fetching */
    curPresenceDatasetURL?: string;
    /** Dispatcher to set presence dataset API URL */
    setCurPresenceDatasetURL: React.Dispatch<React.SetStateAction<string>>;
    /** Active donut chart dataset identifier string (e.g. "dengue_serotype_full_dataset") */
    curDonutChartDatasetName: string;
    /** Dispatcher to set donut chart dataset name */
    setCurDonutChartDatasetName: React.Dispatch<React.SetStateAction<string>>;
    /** API URL endpoint for donut chart genomic metadata fetching */
    curDonutChartDataURL?: string;
    /** Dispatcher to set donut chart API URL */
    setCurDonutChartDataURL: React.Dispatch<React.SetStateAction<string>>;
    /** Filter selection year string (e.g. "2020" or "ALL") */
    curSyear: string;
    /** Dispatcher to set filter selection year string */
    setCurSyear: React.Dispatch<React.SetStateAction<string>>;
    /** Filter target pathogen or vector organism species string */
    curSOrgansim: string;
    /** Dispatcher to set target organism species string */
    setCurSOrgansim: React.Dispatch<React.SetStateAction<string>>;
    /** Synchronized spatial viewport coordinates (latitude, longitude, zoom) */
    mapCoords: { latitude: number; longitude: number; zoom: number };
    /** Dispatcher to update spatial viewport coordinates */
    setMapCoords: React.Dispatch<React.SetStateAction<{ latitude: number; longitude: number; zoom: number }>>;
    /** High-frequency mouse tracking ref preventing re-render thrashing during continuous drag/hover */
    mouseEvent: React.MutableRefObject<mapMouseEvents>;
    /** Subscribe to shared mouse events without starting a component-wide render loop. */
    subscribeMouseEvent: (listener: () => void) => () => void;
    /** Notify subscribed linked views after updating {@link mouseEvent}. */
    notifyMouseEvent: () => void;
    /** Toggle flag enabling country-level polygon aggregation mode */
    isCountryLevelData: boolean;
    /** Dispatcher to toggle country-level data mode */
    setIsCountryLevelData: React.Dispatch<React.SetStateAction<boolean>>;
    /** Toggle flag enabling subregion/administrative level polygon aggregation mode */
    isSubregionLevelData: boolean;
    /** Dispatcher to toggle subregion-level data mode */
    setIsSubregionLevelData: React.Dispatch<React.SetStateAction<boolean>>;
    /** Selected genomic metadata column name for donut chart distribution rendering */
    donutChartSelectedColumnName: string;
    /** Dispatcher to set donut chart grouping column name */
    setDonutChartSelectedColumnName: React.Dispatch<React.SetStateAction<string>>;
    /** GeoJSON property column name mapping donut charts to administrative boundaries */
    geoAssignmentColumnNameForDonut: string;
    /** Dispatcher to set geographic assignment column name for donut overlays */
    setGeoAssignmentColumnNameForDonut: React.Dispatch<React.SetStateAction<string>>;
    /** Target filter date string in YYYY-MM-DD format */
    targetDate?: string;
    /** Dispatcher to set target filter date string */
    setTargetDate: React.Dispatch<React.SetStateAction<string | undefined>>;
}


/**
 * High-frequency mouse interaction event structure stored in React mutable refs.
 *
 * @see {@link interfaceContextI.mouseEvent}
 *
 * @example
 * ```ts
 * const hoverEvent: mapMouseEvents = {
 *   type: "hover",
 *   position: [420, 180],
 *   country: "Germany",
 * };
 * ```
 */
export interface mapMouseEvents {
    /** Interaction event type (e.g. "hover", "click", "mousemove", "null") */
    type?: string;
    /** Bounded container pixel coordinates `[x, y]` */
    position?: [number, number];
    /** Original Leaflet mouse event instance */
    event?: L.LeafletMouseEvent;
    /** Inspected country or administrative boundary name */
    country?: string;
}


/**
 * React Context Provider component wrapping ICV multi-view dashboard applications.
 *
 * @param props - Component children elements to be wrapped by the context provider.
 *
 * @remarks
 * Instantiates initial state defaults for public health datasets (e.g. mosquito presence datasets,
 * Dengue serotype distributions, spatial layer opacity default 0.85).
 *
 * @see {@link useInterfaceContext} to consume state in child components.
 * @see {@link interfaceContextI} for complete shape of context state.
 */
interface InterfaceContextProviderProps {
    children: React.ReactNode;
    /** Optional initial spatial grid key for showcases with a meaningful default cell. */
    initialSelectedGridcellID?: number;
    /** Optional initial database row ID corresponding to the selected spatial cell. */
    initialDbRowIDOfSelectedGridcell?: number;
}

function InterfaceContextProvider({
    children,
    initialSelectedGridcellID = -1,
    initialDbRowIDOfSelectedGridcell = 200509,
}: InterfaceContextProviderProps) {

    const [selectedTableRowID, setTableRowID] = useState<number>(-1)
    const [selectedTableRow, setTableRow] = useState<Row<unknown>>({} as Row<unknown>);
    const [selectedTableName, setTableName] = useState<string>("empty")
    const [selectedStateID, setSelectedStateID] = useState<number>(-1)
    const [selectedGridcellID, setSelectedGridcellID] = useState<number>(initialSelectedGridcellID)
    const [dbRowID_of_selectedGridcellID, setDbRowID_of_selectedGridcellID] = useState<number>(initialDbRowIDOfSelectedGridcell)
    const [selectedFilter, setSelectedFilter] = useState<string>("gridcell")
    const [selectedCountry, setSelectedCountry] = useState<string>("")
    const [mapSelectionObj, setMapSelectionObj] = useState<any>(0)
    const [curColorMap, setCurColorMap] = useState<string>("interpolateInferno")
    const [curFeature, setCurFeature] = useState<string>("")
    const [curDataset, setCurDataset] = useState<string>("")
    const [curLayerOpacity, setCurLayerOpacity] = useState<number>(0.85)
    const [curFeatureValue, setCurFeatureValue] = useState<string>("")
    const [curSyear, setCurSyear] = useState<string>("ALL")
    const [curSOrgansim, setCurSOrgansim] = useState<string>("ALL")
    const [isPresenceData, setIsPresenceData] = useState<boolean>(false)
    const [isSequenceMetaData, setIsSequenceMetaData] = useState<boolean>(false);
    const [pieSize_sequenceMetaData, setPieSize_sequenceMetaData] = useState<number>(40);
    const mouseEvent = useRef<mapMouseEvents>({ type: "null", position: [0, 0], event: undefined });
    const mouseEventSubscribers = useRef(new Set<() => void>());
    const subscribeMouseEvent = useCallback((listener: () => void) => {
        mouseEventSubscribers.current.add(listener);
        return () => {
            mouseEventSubscribers.current.delete(listener);
        };
    }, []);
    const notifyMouseEvent = useCallback(() => {
        mouseEventSubscribers.current.forEach((listener) => listener());
    }, []);
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to?: Date | undefined; } | undefined>({ from: new Date("2020-01-01"), to: new Date("2020-12-31")});
    const [isSubregionLevelData, setIsSubregionLevelData] = useState<boolean>(false);
    const [isCountryLevelData, setIsCountryLevelData] = useState<boolean>(false);

    // for showCase `Climate and Habitats and Training Data View`
    const [curMonth, setCurMonth] = useState<number>(-1);


    const [curPresenceDatasetName, setCurPresenceDatasetName] = useState<string>("world_mosquitos_2014_2025_gdf_mosquito_amount");
    const [curPresenceDatasetURL, setCurPresenceDatasetURL] = useState<string>("");
    const [curSequenceMetaDatasetName, setCurSequenceMetaDatasetName] = useState<string>("dengue_serotype_full_dataset");
    const [curSequenceMetaDataURL, setCurSequenceMetaDataURL] = useState<string>("");
    const [donutChartSelectedColumnName, setDonutChartSelectedColumnName] = useState<string>("serotype_genbank");
    const [geoAssignmentColumnNameForDonut, setGeoAssignmentColumnNameForDonut] = useState<string>("country");
    const [mapCoords, setMapCoords] = useState<{ latitude: number; longitude: number; zoom: number }>({ latitude: 0, longitude: 0, zoom: 0 });
    const [targetDate, setTargetDate] = useState<string | undefined>(undefined);

    // Memoize the context value so consumers only re-render when a state
    // field actually changes — not on every parent render cycle.
    // React guarantees that useState setters are referentially stable,
    // so only the state *values* need to appear in the dependency array.
    const contextValue = useMemo(() => ({
        selectedTableRowID, setTableRowID,
        selectedTableRow, setTableRow,
        selectedTableName, setTableName,
        selectedStateID, setSelectedStateID,
        selectedGridcellID, setSelectedGridcellID,
        dbRowID_of_selectedGridcellID, setDbRowID_of_selectedGridcellID,
        selectedFilter, setSelectedFilter,
        selectedCountry, setSelectedCountry,
        mapSelectionObj, setMapSelectionObj,
        curColorMap, setCurColorMap,
        curFeature, setCurFeature,
        curDatasetURL: curDataset, setCurDatasetURL: setCurDataset,
        curLayerOpacity, setCurLayerOpacity,
        curFeatureValue, setCurFeatureValue,
        isPresenceData, setIsPresenceData,
        isSequenceMetaData, setIsSequenceMetaData,
        pieSize_sequenceMetaData, setPieSize_sequenceMetaData,
        dateRange, setDateRange,
        isCountryLevelData, setIsCountryLevelData,
        isSubregionLevelData, setIsSubregionLevelData,
        curMonth, setCurMonth,
        curPresenceDatasetName, setCurPresenceDatasetName,
        curPresenceDatasetURL, setCurPresenceDatasetURL,
        curDonutChartDatasetName: curSequenceMetaDatasetName, setCurDonutChartDatasetName: setCurSequenceMetaDatasetName,
        curDonutChartDataURL: curSequenceMetaDataURL, setCurDonutChartDataURL: setCurSequenceMetaDataURL,
        curSyear, setCurSyear,
        curSOrgansim, setCurSOrgansim,
        donutChartSelectedColumnName, setDonutChartSelectedColumnName,
        geoAssignmentColumnNameForDonut, setGeoAssignmentColumnNameForDonut,
        mapCoords, setMapCoords,
        mouseEvent, subscribeMouseEvent, notifyMouseEvent,
        targetDate, setTargetDate,
    }), [
        selectedTableRowID,
        selectedTableRow,
        selectedTableName,
        selectedStateID,
        selectedGridcellID,
        dbRowID_of_selectedGridcellID,
        selectedFilter,
        selectedCountry,
        mapSelectionObj,
        curColorMap,
        curFeature,
        curDataset,
        curLayerOpacity,
        curFeatureValue,
        isPresenceData,
        isSequenceMetaData,
        pieSize_sequenceMetaData,
        dateRange,
        isCountryLevelData,
        isSubregionLevelData,
        curMonth,
        curPresenceDatasetName,
        curPresenceDatasetURL,
        curSequenceMetaDatasetName,
        curSequenceMetaDataURL,
        curSyear,
        curSOrgansim,
        donutChartSelectedColumnName,
        geoAssignmentColumnNameForDonut,
        mapCoords,
        mouseEvent,
        subscribeMouseEvent,
        notifyMouseEvent,
        targetDate,
    ]);

    return (
        <GinterfaceContext.Provider value={contextValue}>
            {children}
        </GinterfaceContext.Provider>
    )
}

/**
 * Custom React hook accessing the ICV global interface context.
 *
 * @returns The global state contract object matching {@link interfaceContextI}.
 *
 * @example
 * ```tsx
 * function MosquitoMapWidget() {
 *   const { curFeature, mapCoords } = useInterfaceContext();
 *   return <div>Inspecting {curFeature} at zoom {mapCoords.zoom}</div>;
 * }
 * ```
 */
function useInterfaceContext() {
    return useContext(GinterfaceContext);
}

/** Public linked-view state provider and consumer hook. */
export { InterfaceContextProvider, useInterfaceContext};
