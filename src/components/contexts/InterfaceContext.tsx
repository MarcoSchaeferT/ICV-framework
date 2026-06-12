
import { Row } from '@tanstack/react-table';
import {  createContext, useContext, use, useState, useRef } from 'react'
import React from 'react';


const GinterfaceContext = createContext({} as interfaceContextI);


export interface interfaceContextI {
    selectedTableRowID: number;
    setTableRowID: React.Dispatch<React.SetStateAction<number>>;
    selectedTableRow: Row<unknown>;
    setTableRow: React.Dispatch<React.SetStateAction<Row<unknown>>>;
    selectedTableName: string;
    setTableName: React.Dispatch<React.SetStateAction<string>>;
    selectedStateID: number;
    setSelectedStateID: React.Dispatch<React.SetStateAction<number>>;
    selectedGridcellID: number;
    setSelectedGridcellID: React.Dispatch<React.SetStateAction<number>>;
    dbRowID_of_selectedGridcellID: number;
    setDbRowID_of_selectedGridcellID: React.Dispatch<React.SetStateAction<number>>;
    selectedFilter: string;
    setSelectedFilter: React.Dispatch<React.SetStateAction<string>>;
    selectedCountry: string;
    setSelectedCountry: React.Dispatch<React.SetStateAction<string>>;
    mapSelectionObj: any;
    setMapSelectionObj: React.Dispatch<React.SetStateAction<any>>;
    curColorMap: string;
    setCurColorMap: React.Dispatch<React.SetStateAction<string>>;
    curFeature: string;
    setCurFeature: React.Dispatch<React.SetStateAction<string>>;
    curDatasetURL: string;
    setCurDatasetURL: React.Dispatch<React.SetStateAction<string>>;
    curLayerOpacity: number;
    setCurLayerOpacity: React.Dispatch<React.SetStateAction<number>>;
    curFeatureValue: string;
    setCurFeatureValue: React.Dispatch<React.SetStateAction<string>>;
    isPresenceData: boolean;
    setIsPresenceData: React.Dispatch<React.SetStateAction<boolean>>;
    isSequenceMetaData: boolean;
    setIsSequenceMetaData: React.Dispatch<React.SetStateAction<boolean>>;
    pieSize_sequenceMetaData: number;
    setPieSize_sequenceMetaData: React.Dispatch<React.SetStateAction<number>>;
    dateRange: { from: Date | undefined; to?: Date | undefined; } | undefined;
    setDateRange(arg0: { from: Date | undefined; to?: Date | undefined; } | undefined): unknown;
    curMonth: number;
    setCurMonth: React.Dispatch<React.SetStateAction<number>>;
    curPresenceDatasetName: string;
    setCurPresenceDatasetName: React.Dispatch<React.SetStateAction<string>>;
    curPresenceDatasetURL?: string;
    setCurPresenceDatasetURL: React.Dispatch<React.SetStateAction<string>>;
    curDonutChartDatasetName: string;
    setCurDonutChartDatasetName: React.Dispatch<React.SetStateAction<string>>;
    curDonutChartDataURL?: string;
    setCurDonutChartDataURL: React.Dispatch<React.SetStateAction<string>>;
    curSyear: string;
    setCurSyear: React.Dispatch<React.SetStateAction<string>>;
    curSOrgansim: string;
    setCurSOrgansim: React.Dispatch<React.SetStateAction<string>>;
    mapCoords: { latitude: number; longitude: number; zoom: number };
    setMapCoords: React.Dispatch<React.SetStateAction<{ latitude: number; longitude: number; zoom: number }>>;
    mouseEvent: React.MutableRefObject<mapMouseEvents>;
    isCountryLevelData: boolean;
    setIsCountryLevelData: React.Dispatch<React.SetStateAction<boolean>>;
    isSubregionLevelData: boolean;
    setIsSubregionLevelData: React.Dispatch<React.SetStateAction<boolean>>;
    donutChartSelectedColumnName: string;
    setDonutChartSelectedColumnName: React.Dispatch<React.SetStateAction<string>>;
    geoAssignmentColumnNameForDonut: string;
    setGeoAssignmentColumnNameForDonut: React.Dispatch<React.SetStateAction<string>>;
}


interface mapMouseEvents {
    type?: string; // "hover" | "click" 
    position?: [number, number];
    event?: L.LeafletMouseEvent;
    country?: string;
}


function InterfaceContextProvider({children}: any) {

    const [selectedTableRowID, setTableRowID] = useState<number>(-1)
    const [selectedTableRow, setTableRow] = useState<Row<unknown>>({} as Row<unknown>);
    const [selectedTableName, setTableName] = useState<string>("empty")
    const [selectedStateID, setSelectedStateID] = useState<number>(-1)
    const [selectedGridcellID, setSelectedGridcellID] = useState<number>(-1)
    const [dbRowID_of_selectedGridcellID, setDbRowID_of_selectedGridcellID] = useState<number>(200509)
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

  
    return (
        <>
         <GinterfaceContext.Provider value={{
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
            mouseEvent,}}>
            {children}
         </GinterfaceContext.Provider>
         </>
    )
}

function useInterfaceContext() {
    return useContext(GinterfaceContext);
}

export { InterfaceContextProvider, useInterfaceContext};