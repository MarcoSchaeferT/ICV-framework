
"use client";

import { useRef, useEffect, useMemo, useState } from 'react'
import CovidDataStates from '@/app/components/dataTableClasses/CovidDataStates';
import {apiRoutes } from "@/app/api_routes";
import React from 'react';
import { InterfaceContextProvider, useInterfaceContext, interfaceContextI } from '@/app/components/contexts/InterfaceContext';
import SGridPlotCard from '@/app/components/layout/swapy_gridPlotCard';
import { CardPropsClass } from '@/app/components/layout/cardWrapper';
import { availableColorMapsNames } from '@/app/components/plots/maps/constants';

import LeafD3MapLayerComponent, {LeafD3MapLayerProps}  from '@/app/components/plots/maps/leafD3Map';
import D3ExampleChartComponent, { ExampleChartPorps } from '@/app/components/plots/templates/plotTemplate';
import { createSwapy, Swapy } from 'swapy';
import LinechartComponent, { LinechartPorps } from '@/app/components/plots/linechart/linechart';

import { LeafletComponentPorps } from '@/app/components/plots/maps/baseMap';
import { useLocale ,useTranslations } from "next-intl";
import { t_richConfig } from "@/app/const_store";
import { useGetJSONData } from "@/app/hooks/customFetchAndCache";
import { metaDataT } from '@/app/components/plots/metaDataHandler';
import {ViewMainInfoComponent} from '@/app/components/viewPageMainInfo';
import { useUIContext } from '@/app/components/contexts/UIContext';
import { MDXContentProvider } from '../../../../../../messages/markdown/MDXContentProvider';
import { Locale } from '@/i18n/routing';



const isSWAPY = true;

export default function Home() {
  
  const locale = useLocale() as Locale;
  const t = useTranslations("page_home.ShowCases.page_Climate_and_Habitats");
  let md = MDXContentProvider[locale];

  const UI_contextT = useUIContext();
  const layoutSizes = UI_contextT.layoutDims;

  let mainInfoHeading = t('mainInfo.heading');

  const defaultMonth =  "4"; // april 

  let mapPropsWorld_precipitation = new LeafD3MapLayerProps();
  mapPropsWorld_precipitation.chartName = 'map_World';
  mapPropsWorld_precipitation.dataURL = apiRoutes.FETCH_WORLD_MAP;
//mapPropsWorld_precipitation.center = [10.5, -69.8];
//mapPropsWorld_precipitation.zoom = 3.0;
  mapPropsWorld_precipitation.center = [4.8,-68.8];
  mapPropsWorld_precipitation.zoom = 3.0;
  mapPropsWorld_precipitation.mapUIsettings.defaultLayerOpacity = 0.95;
  mapPropsWorld_precipitation.mapUIsettings.isColorMap_legend = true;
  mapPropsWorld_precipitation.mapUIsettings.isFeatureSelection_dropdown = true;
  mapPropsWorld_precipitation.mapUIsettings.isDatasetSelection_dropdown = false;
  mapPropsWorld_precipitation.mapUIsettings.isColorMapSelection_dropdown = false;
  mapPropsWorld_precipitation.mapUIsettings.isCountrySelection_dropdown = false;
  mapPropsWorld_precipitation.mapUIsettings.isDatePicker = false;
  mapPropsWorld_precipitation.mapUIsettings.filterString_for_availableDataset_include = "named";
  mapPropsWorld_precipitation.mapUIsettings.filterString_for_availableFeature = "tp";
  mapPropsWorld_precipitation.mapUIsettings.isPresenceData = false;
  mapPropsWorld_precipitation.mapUIsettings.isSequenceMetaData = false;
  mapPropsWorld_precipitation.mapUIsettings.isLongnitude_slider = false;
  mapPropsWorld_precipitation.mapUIsettings.isLatitude_slider = false;
  mapPropsWorld_precipitation.mapUIsettings.isDistance_legend = false;
  mapPropsWorld_precipitation.mapUIsettings.isZoom_slider = false;
  mapPropsWorld_precipitation.mapUIsettings.isLatLngZoomOverlay = true;
  mapPropsWorld_precipitation.mapUIsettings.defaultFeatureName = "tp_"+defaultMonth;
  mapPropsWorld_precipitation.mapUIsettings.defaultDatasetName = "t_2024_climate_data_subset_pop_den_land_use_lat_lon";
  mapPropsWorld_precipitation.mapUIsettings.defaultFeatureColorMap = availableColorMapsNames.interpolateViridis;
  mapPropsWorld_precipitation.isApplyContextData = false;
  mapPropsWorld_precipitation.isSyncMapCoordsOnTheFly_SETTER = false;
  mapPropsWorld_precipitation.isSyncMapCoordsOnTheFly_RECIEVER = true;
  mapPropsWorld_precipitation.isSetIntialContextDataFromComponent = true;
  mapPropsWorld_precipitation.isProjection_equirectangular = true;
  mapPropsWorld_precipitation.mapDataSets = {
    isGridData: true,
    isPresenceData: false,
    isSequenceMetaData: false,
    isCityNames: true,
  };
  mapPropsWorld_precipitation.mapInteractions = {
    disableMouse: true,
    disableScroll: true,
    disableClick: false,
  };

  let  steerMap = JSON.parse(JSON.stringify(mapPropsWorld_precipitation));


  let mapPropsWorld_prediction = new LeafD3MapLayerProps();
  let p2 = mapPropsWorld_prediction
  p2.chartName = 'map_World2';
  p2.dataURL = apiRoutes.FETCH_WORLD_MAP;
  p2.center = mapPropsWorld_precipitation.center;
  p2.zoom = mapPropsWorld_precipitation.zoom;
  p2.mapUIsettings.defaultLayerOpacity = 0.95;
  p2.mapUIsettings.areSettingsOpen = true;
  p2.mapUIsettings.isLongnitude_slider = false;
  p2.mapUIsettings.isLatitude_slider = false;
  p2.mapUIsettings.isZoom_slider = false;
  p2.mapUIsettings.isDatasetSelection_dropdown = false;
  p2.mapUIsettings.isColorMapSelection_dropdown = false;
  p2.mapUIsettings.isFeatureSelection_dropdown = true;
  p2.mapUIsettings.isDatasetSelection_dropdown = false;
  p2.mapUIsettings.filterString_for_availableFeature = "prob";
  p2.mapUIsettings.isLatLngZoomOverlay = false;
  p2.mapUIsettings.isDistance_legend = true;
  p2.mapUIsettings.isColorMap_legend = true;
  p2.mapUIsettings.isCountrySelection_dropdown = false;
  p2.mapUIsettings.isDatePicker = false;
  p2.isStaticAutoFitFullSize = false;
  p2.isProjection_equirectangular = true;
  p2.mapUIsettings.isPresenceDataChecked = true;
  p2.mapUIsettings.presenceDataColor = "rgb(2, 246, 250)";
  p2.mapUIsettings.filterString_for_availableDataset_include = "probability";
  p2.mapUIsettings.defaultFeatureName = "prob_1";
  p2.isApplyContextData = false;
  p2.isApplyTransitions = false;
  p2.isSyncMapCoordsOnTheFly_RECIEVER = true;
  //p2.mapUIsettings.defaultDatasetName =   "t_2019_ocsvm_albopictus_probability_predictions_named";
  p2.mapUIsettings.defaultDatasetName =   "t_2024_monthly_mean_5_ocsvm_albopictus_predictions_2023_mod";
  p2.mapInteractions = {
    disableMouse: true,
    disableScroll: true,
    disableClick: false,
  };
  p2.mapDataSets = {
    isGridData: true,
    isPresenceData: false,
    isSequenceMetaData: false,
    isCityNames: true,
  };
  p2.mapStyles.strokeWidth = 1;

  let mapPropsWorld3_temperature: LeafD3MapLayerProps  = JSON.parse(JSON.stringify(mapPropsWorld_prediction));
  mapPropsWorld3_temperature.chartName = 'map_World3';
  //mapPropsWorld3_temperature.mapUIsettings.defaultDatasetName = "t_2015_climate_data_subset_pop_den_land_use_lat_lon_named_csv";
  mapPropsWorld3_temperature.mapUIsettings.defaultDatasetName = "t_2024_climate_data_subset_pop_den_land_use_lat_lon";
  mapPropsWorld3_temperature.mapUIsettings.defaultFeatureName = "t2m_"+defaultMonth;
  mapPropsWorld3_temperature.mapUIsettings.filterString_for_availableFeature ="t2m";
  mapPropsWorld3_temperature.mapUIsettings.defaultFeatureColorMap = availableColorMapsNames.interpolateRdBu;
  mapPropsWorld3_temperature.mapInteractions = {
    disableMouse: true,
    disableScroll: true,
    disableClick: false,
  };

  let mapPropsWorld_windspeed: LeafD3MapLayerProps  = JSON.parse(JSON.stringify(mapPropsWorld3_temperature));
  mapPropsWorld_windspeed.chartName = 'map_World4';
  mapPropsWorld_windspeed.mapUIsettings.defaultFeatureName = "si10_"+defaultMonth;
  mapPropsWorld_windspeed.mapUIsettings.filterString_for_availableFeature ="si10";
  mapPropsWorld_windspeed.mapUIsettings.defaultFeatureColorMap = availableColorMapsNames.interpolateCividis;

  let mapPropsWorld_dewpoint: LeafD3MapLayerProps  = JSON.parse(JSON.stringify(mapPropsWorld3_temperature));
  mapPropsWorld_dewpoint.chartName = 'map_World5';
  mapPropsWorld_dewpoint.mapUIsettings.defaultFeatureName = "d2m_"+defaultMonth;
  mapPropsWorld_dewpoint.mapUIsettings.filterString_for_availableFeature ="d2m";
  mapPropsWorld_dewpoint.mapUIsettings.defaultFeatureColorMap = availableColorMapsNames.interpolateRdBu;

  p2.isSyncMapCoordsOnTheFly_RECIEVER =  false;
  p2.isSyncMapCoordsOnTheFly_SETTER = true;
  p2.mapInteractions = {
    disableMouse: false,
    disableScroll: false,
    disableClick: false,
  };



  // intitialize data table context
  useInterfaceContext();


  // set up swapy (client side only)
  const swapyRef = useRef<Swapy | null>(null)
  const swapContainerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const container =swapContainerRef.current;
    console.log("container", container)
    if(isSWAPY && container) {
      swapyRef.current = createSwapy(container,{
        animation: 'dynamic', // dynamic or spring or none
        manualSwap: false,
        swapMode: 'hover', //'hover' | 'drop';
        autoScrollOnDrag: true,
        // dragAxis: 'x',
        // dragOnHold: true
      })
      swapyRef.current?.enable(isSWAPY)

      return () => {
        // Destroy the swapy instance on component destroy
        swapyRef.current?.destroy()
      }
    }
  }, []);

    const c = useInterfaceContext();
    useEffect(() => {
    if(c.curMonth === -1) c.setCurMonth(Number(defaultMonth+1));
  }, [ ]);


  // build the page
  return (
     <>
     <InterfaceContextProvider>
     <main className="flex max-h-fit flex-col items-center justify-between " style={{paddingTop: layoutSizes.gapSize}}>
      <ViewMainInfoComponent heading={mainInfoHeading} mdxContent={md.pages.ShowCases.ClimateAndHabitats} />

      {/*** START: grid layout ***/}
      <div ref={swapContainerRef} className={`w-full grid grid-cols-15 md:grid-cols-15`} style={{
              gridTemplateRows: `repeat(auto-fill, minmax(${layoutSizes.rowSpanSize}vh, ${layoutSizes.rowSpanSize}vh))`,
              gap: `${layoutSizes.gapSize}px`,
              height: `calc(160vh - ${layoutSizes.topNavbarHeight}px - ${layoutSizes.gapSize*1}px)`,
               
             paddingRight: `${layoutSizes.gapSize}px`,
             paddingLeft: `${layoutSizes.gapSize}px`,
      }}>
      {/*** Grid Cells ***/}
        <DynamicLineChart featureRaw={"tp_" + defaultMonth}  name={t.rich('card_precipitation', {...t_richConfig})?.toString() || "Precipitation"}/>
        <DynamicLineChart featureRaw={"t2m_" + defaultMonth} name={t.rich('card_temperature', {...t_richConfig})?.toString() || 'Temperature'}/>
        <DynamicLineChart featureRaw={"d2m_" + defaultMonth} name={t.rich('card_dewpoint', {...t_richConfig})?.toString() || "Dew point"}/>
        <DynamicLineChart featureRaw={"si10_" + defaultMonth} name={t.rich('card_windSpeed', {...t_richConfig})?.toString() || "Wind speed"}/>
        {/*<SGridPlotCard rowColSpan={[1,3]} cardProps={new CardPropsClass("Stat1","","","", )}> <ShowDataSet query='country' locale={locale} t={t} /> </SGridPlotCard>
        <SGridPlotCard rowColSpan={[1,3]} cardProps={new CardPropsClass("Stat2","","","",)}> <ShowDataSet query = 'feature' locale={locale} t={t}/> </SGridPlotCard>
        {/*<SGridPlotCard rowColSpan={[1,3]} cardProps={new CardPropsClass("Stat3","","","", )}> <ShowDataSet query = 'colorMap' locale={locale} t={t}/> </SGridPlotCard>
        <SGridPlotCard rowColSpan={[1,3]} cardProps={new CardPropsClass("Stat4","","","", )}> <ShowDataSet query = 'dataSet' locale={locale} t={t}/> </SGridPlotCard>*/}
          <SGridPlotCard rowColSpan={[1,3]} cardProps={new CardPropsClass("Stat1","","","", )}> <ShowDataSet query='dataSet' locale={locale} t={t} /> </SGridPlotCard>
      <SGridPlotCard rowColSpan={[1,3]} cardProps={new CardPropsClass("Stat2","","","", )}> <ShowDataSet query='country' locale={locale} t={t} /> </SGridPlotCard>
      <SGridPlotCard rowColSpan={[1,3]} cardProps={new CardPropsClass("Stat3","","","",)}> <ShowDataSet query = 'hardcodededFeature' locale={locale} t={t}/> </SGridPlotCard>

        <SGridPlotCard rowColSpan={[6,3]} cardProps={new CardPropsClass("Map1",t.rich('card_map_precipitation', {...t_richConfig})?.toString() || 'Precipitation',"","")}><LeafD3MapLayerComponent props={mapPropsWorld_precipitation}/></SGridPlotCard>
         <SGridPlotCard rowColSpan={[6,3]} cardProps={new CardPropsClass("Map3",t.rich('card_map_temperature', {...t_richConfig})?.toString() || 'Temperature',"","")}><LeafD3MapLayerComponent props={mapPropsWorld3_temperature}/></SGridPlotCard>
        <SGridPlotCard rowColSpan={[6,3]} cardProps={new CardPropsClass("Map5",t.rich('card_map_dewpoint', {...t_richConfig})?.toString() || 'Dew point',"","")}><LeafD3MapLayerComponent props={mapPropsWorld_dewpoint}/></SGridPlotCard>
        <SGridPlotCard rowColSpan={[6,3]} cardProps={new CardPropsClass("Map4",t.rich('card_map_windSpeed', {...t_richConfig})?.toString() || 'Wind speed',"","")}><LeafD3MapLayerComponent props={mapPropsWorld_windspeed}/></SGridPlotCard>
        <SGridPlotCard rowColSpan={[6,3]} cardProps={new CardPropsClass("Map2",t.rich('card_map_suitability', {...t_richConfig})?.toString() || 'Habitat Suitability',"","")}><LeafD3MapLayerComponent props={p2}/></SGridPlotCard>

        

      </div>
      </main>
      </InterfaceContextProvider>
     
      <div/>

      </>
    );
  
}


function ShowDataSet({ query, locale, t }: { query: string ; locale: string; t: any }) {
  let c = useInterfaceContext();
  let queryV = query; 

 

  const [isLoading_Metadata, rawMetaData] = useGetJSONData(apiRoutes.getDatasetsMetadata({ LANGID: locale }));

  let metaData = useMemo(() => {
    if (rawMetaData) {
      return rawMetaData as unknown as metaDataT;
    }
    return null;
  }, [rawMetaData]);
  
  let dataSet = new URL("http://blub"+c.curDatasetURL).searchParams.get('relationName');
  let feature = c.curFeature 
  let country = c.mapSelectionObj ? c.mapSelectionObj.properties["name_"+locale] : null;
  let colorMap = c.curColorMap;
  let outVal = null;
  let cardName = "";

  if (queryV === 'dataSet') {
    outVal = dataSet;
    cardName = t.rich('card_dataSet', {...t_richConfig});
  }
  else if (queryV === 'feature') {
    if(metaData === null) return <LoadingSpinner/>;
    if(metaData[feature] != undefined) {
      let unit = metaData[feature].dimension;
      let description = metaData[feature].description;
      outVal = (
      <>
        <div className="text-center">
          {feature} [{unit}]
          <div className="text-sm text-gray-400">{description}</div>
        </div>
      </>
      );
    }
    cardName = t.rich('card_feature', {...t_richConfig});
  }
  else if (queryV === 'country'){
    outVal = country;
    cardName = t.rich('card_country', {...t_richConfig});
  }
  else if (queryV === 'colorMap'){
    outVal = colorMap;
    cardName = t.rich('card_colorMap', {...t_richConfig});
  }
  else if (queryV === 'hardcodededFeature'){
       if(metaData === null) return <LoadingSpinner/>;
       if(metaData[feature] != undefined) {
         let unit = metaData[feature].dimension;
         let description = metaData[feature].description;
         outVal = (
         <>
           <table className="text-center">
             <tbody>
               <tr>
                 <td>{feature} [{unit}]</td>
                 <td className="text-xs pl-1 text-gray-400 wrap-break-word whitespace-pre-line">{description}</td>
               </tr>
             </tbody>
           </table>
         </>
         );
       }
       cardName = t.rich('card_feature', {...t_richConfig});
  }
  return (
    <>
 <div className='text-xs text-gray-800 pt-3 pl-3' >{cardName}</div>
    <div className='flex p-3 pt-0 justify-left items-center h-[78%] overflow-clip'>
      <div className="text-2xl size-fit overflow-hidden text-ellipsis whitespace-nowrap" style={{ maxWidth: '100%' }}>
        {outVal ? outVal : 'N/A'}
      </div>
    </div>
    </>
  ); 
}


function DynamicLineChart({ featureRaw, name }: { featureRaw: string, name: string }) {
  let c = useInterfaceContext();
  const locale = useLocale();
  let t = useTranslations("page_rawDataView.linechart");


  let dataSet = new URL("http://blub"+c.curDatasetURL).searchParams.get('relationName');
  let a3 = c.mapSelectionObj ? c.mapSelectionObj.properties.gu_a3 : 'COL'; 
  let feature = featureRaw;

  
  
  if (!featureRaw.includes("land_use") && !featureRaw.includes("prob_"))
    feature = feature.replace(/_(\d+)/g, "_*");

  if(dataSet === null || feature === null) return (
  <SGridPlotCard rowColSpan={[3,3]} cardProps={new CardPropsClass(featureRaw+"Linechart",name,"","")}> <LoadingSpinner/></SGridPlotCard>);
  
  //let dataURL = apiRoutes.FETCH_DB_DATA+`?relationName=${dataSet}&feature=${feature}&filterBy=iso_a3&filterValue=${a3}`;
  let dataURL = apiRoutes.fetchDbData({ relationName: dataSet, feature: feature });
  const urlParams = new URLSearchParams(dataURL.split('?')[1]);
  const paramsDict: { [key: string]: string } = {};
  urlParams.forEach((value, key) => {
    paramsDict[key] = value;
  });
  let lineChartPorps = new LinechartPorps("Linechart", dataURL , "exampleVar");

  lineChartPorps.chartName = feature+"Linechart";
  lineChartPorps.dataURL = dataURL;
  lineChartPorps.locale =  locale;
  lineChartPorps.translations = t;

  return (
    <>
    <SGridPlotCard rowColSpan={[3,3]} cardProps={new CardPropsClass(featureRaw+"Linechart", name,"","")}> <LinechartComponent ChartPorps={lineChartPorps}/></SGridPlotCard>
    </>
  ); 
}


function LoadingSpinner() {
  return (
    <>
      <div className="flex items-center justify-center h-full w-full">
        <div className="w-16 h-16 border-4 border-t-4  border-gray-200 rounded-full border-t-blue-500 animate-spin"></div>
      </div>
    </>
  );
}