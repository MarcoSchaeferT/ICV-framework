
"use client";

import { useRef, useEffect, useMemo } from 'react'
import {apiRoutes } from "../../api_routes";
import React from 'react';
import { InterfaceContextProvider, useInterfaceContext } from '../../components/contexts/InterfaceContext';
import SGridPlotCard from '../../components/layout/swapy_gridPlotCard';
import { CardPropsClass } from '../../components/layout/cardWrapper';
import LeafD3MapLayerComponent, {LeafD3MapLayerProps}  from '../../components/plots/maps/leafD3Map';
import { createSwapy, Swapy } from 'swapy';
import LinechartComponent, { LinechartPorps } from '@/app/components/plots/linechart/linechart';

import { useLocale ,useTranslations } from "next-intl";
import { t_richConfig } from "../../const_store";
import { useGetJSONData } from "../../hooks/customFetchAndCache";
import { metaDataT } from '@/app/components/plots/metaDataHandler';
import { MDXContentProvider } from '../../../../messages/markdown/MDXContentProvider';
import { Locale } from "@/i18n/routing";
import {ViewMainInfoComponent} from '../../components/viewPageMainInfo';
import * as d3 from 'd3';
import { useUIContext } from '@/app/components/contexts/UIContext';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"



const isSWAPY = true;

export default function Home() {

  const locale = useLocale() as Locale;
  let md = MDXContentProvider[locale];
  const t = useTranslations("page_rawDataView.pageContent");

  const UI_contextT = useUIContext();
  const layoutSizes = UI_contextT.layoutDims;

  let mainInfoHeading = t('mainInfo.heading');

  let mapPropsWorld1 = new LeafD3MapLayerProps();
  mapPropsWorld1.chartName = 'map_World';
  mapPropsWorld1.dataURL = apiRoutes.FETCH_WORLD_MAP;
  mapPropsWorld1.center = [20, 14];
  mapPropsWorld1.zoom = 2;
  mapPropsWorld1.center = [-0.8, -76.6];
  mapPropsWorld1.zoom = 8.2;
  mapPropsWorld1.mapUIsettings.isColorMap_legend = true;
  mapPropsWorld1.mapUIsettings.isCountrySelection_dropdown = false;
  mapPropsWorld1.mapUIsettings.isDatePicker = false;
  mapPropsWorld1.mapUIsettings.filterString_for_availableDataset_include = "climate_data";
  mapPropsWorld1.mapUIsettings.filterString_for_availableDataset_exclude = "proba";
  mapPropsWorld1.mapUIsettings.isPresenceData = true;
  mapPropsWorld1.mapUIsettings.isSequenceMetaData = true;
  mapPropsWorld1.mapUIsettings.isLongnitude_slider = false;
  mapPropsWorld1.mapUIsettings.isLatitude_slider = false;
  mapPropsWorld1.mapUIsettings.isZoom_slider = false;
  mapPropsWorld1.isApplyContextData = false;
  mapPropsWorld1.isProjection_equirectangular = true;
  mapPropsWorld1.isSetIntialContextDataFromComponent = true;

  let mapPropsWorld2 = new LeafD3MapLayerProps();
    let p2 = mapPropsWorld2
    p2.chartName = 'map_World2';
    p2.dataURL = apiRoutes.FETCH_WORLD_MAP;
    p2.center = [11.53, 44.45];
    p2.zoom = 4.4;
    p2.mapUIsettings.areSettingsOpen = false;
    p2.mapUIsettings.isLongnitude_slider = true;
    p2.mapUIsettings.isLatitude_slider = true;
    p2.mapUIsettings.isZoom_slider = true;
    p2.mapUIsettings.isColorMapSelection_dropdown = false;
    p2.mapUIsettings.isFeatureSelection_dropdown = false;
    p2.mapUIsettings.isDatasetSelection_dropdown = false;
    p2.mapUIsettings.isDistance_legend = true;
    p2.mapUIsettings.isColorMap_legend = true;
    p2.mapUIsettings.isCountrySelection_dropdown = false;
    p2.mapUIsettings.isDatePicker = false;
    p2.isStaticAutoFitFullSize = false;
    p2.isProjection_equirectangular = true;
    p2.isApplyContextData = true;
    p2.isApplyTransitions = true;
   // p2.mapUIsettings.defaultDatasetName =   p1.mapUIsettings.defaultDatasetName ;
    p2.mapInteractions = {
      disableMouse: true,
      disableScroll: true,
    };

     let d3MapCardProps2_overveiwDetail = new CardPropsClass(
          t.rich('tab_detailView', {...t_richConfig})?.toString() || '',
          "","","");
  

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
    };
  }, []);

  // build the page

  return (
     <>
     <InterfaceContextProvider>
      <main className="flex max-h-fit flex-col items-center justify-between " style={{paddingTop: layoutSizes.gapSize}}>
        <ViewMainInfoComponent heading={mainInfoHeading} mdxContent={md.pages.RawDataView.mainInfo} />

        {/*** START: grid layout ***/}
        <div ref={swapContainerRef} className={`w-full grid grid-cols-12 md:grid-cols-12`} style={{
                gridTemplateRows: `repeat(auto-fill, minmax(${layoutSizes.rowSpanSize}vh, ${layoutSizes.rowSpanSize}vh))`,
                gap: `${layoutSizes.gapSize}px`,
                height: `calc(120vh - ${layoutSizes.topNavbarHeight}px - ${layoutSizes.gapSize*1}px)`,
         
            paddingRight: `${layoutSizes.gapSize}px`,
             paddingLeft: `${layoutSizes.gapSize}px`,


        }}>
        {/*** Grid Cells ***/}

          <SGridPlotCard rowColSpan={[1,3]} cardProps={new CardPropsClass("Stat1","","","", )}> <ShowDataSet query='country' locale={locale} t={t} /> </SGridPlotCard>
          <SGridPlotCard rowColSpan={[1,3]} cardProps={new CardPropsClass("Stat2","","","",)}> <ShowDataSet query = 'feature' locale={locale} t={t}/> </SGridPlotCard>
          <SGridPlotCard rowColSpan={[1,3]} cardProps={new CardPropsClass("Stat3","","","", )}> <ShowDataSet query = 'colorMap' locale={locale} t={t}/> </SGridPlotCard>
          <SGridPlotCard rowColSpan={[1,3]} cardProps={new CardPropsClass("Stat4","","","", )}> <ShowDataSet query = 'dataSet' locale={locale} t={t}/> </SGridPlotCard>

          <SGridPlotCard rowColSpan={[8,6]} cardProps={new CardPropsClass("Map1","Map View","","")}><LeafD3MapLayerComponent props={mapPropsWorld1}/></SGridPlotCard>
           <SGridPlotCard rowColSpan={[8,6]} cardProps={new CardPropsClass("Map14","","","")}>
          <Tabs className="size-full flex flex-col h-full" defaultValue="account">
            <TabsList className='justify-start flex bg-gray-400 text-white rounded-t-md rounded-b-none border-b border-gray-200 h-10'>
              <TabsTrigger className='bg-gray-300 text-gray-500' value="account"> {t.rich('tab_linecharts', {...t_richConfig})?.toString()} </TabsTrigger>
              <TabsTrigger className='bg-gray-300 text-gray-500 ml-2'  value="password">{t.rich('tab_detailView', {...t_richConfig})?.toString()}</TabsTrigger>
            </TabsList>
            <TabsContent className=" size-full" value="account">
              <div
                className="grid grid-cols-6 grid-rows-8 gap-4 h-full w-full"
                style={{
                  height: "100%",
                  width: "100%",
                }}
              >
                <DynamicLineChart
                  featureRaw="t2m_1"
                  name={t.rich('card_temperature', {...t_richConfig})?.toString() || 'Temperature'}
                />
                <DynamicLineChart
                  featureRaw="d2m_1"
                  name={t.rich('card_dewpoint', {...t_richConfig})?.toString() || "Dew point"}
                />
                <DynamicLineChart
                  featureRaw="tp_1"
                  name={t.rich('card_precipitation', {...t_richConfig})?.toString() || "Precipitation"}
                />
                <DynamicLineChart
                  featureRaw="si10_1"
                  name={t.rich('card_windSpeed', {...t_richConfig})?.toString() || "Wind speed"}
                />
              </div>
            </TabsContent>
            <TabsContent className=" size-full" value="password">
               <div
                className="grid grid-cols-3 grid-rows-9 gap-2 h-full w-full"
                style={{
                  height: "100%",
                  width: "100%",
                }}
              >
               <SGridPlotCard rowColSpan={[9,3]}  cardProps={d3MapCardProps2_overveiwDetail}><LeafD3MapLayerComponent props={mapPropsWorld2}/></SGridPlotCard>
               </div>
            </TabsContent>
    
        </Tabs>
        </SGridPlotCard>

        </div>
        </main>
      </InterfaceContextProvider>
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
  let country = c.mapSelectionObj ? c.mapSelectionObj.properties["name_"+locale]  : null;
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
  else if (queryV === 'country'){
    outVal = country;
    cardName = t.rich('card_country', {...t_richConfig});
  }
  else if (queryV === 'colorMap'){
    outVal = colorMap.replace(/interpolate/g, ' ');
    cardName = t.rich('card_colorMap', {...t_richConfig});
    if (colorMap && (d3 as any)[colorMap]) {
      const scale = (d3 as any)[colorMap];
      const colors = Array.from({ length: 0 }, (_, i) => scale(i / 50));
      outVal = (
        <div className="flex items-center gap-1">
          <span>{colorMap.replace(/interpolate/g, ' ')}</span>
          <div className="flex ml-2 pt-1">
            {colors.map((c, idx) => (
              <div key={idx} style={{ background: c, width: 2, height: 10, borderRadius: 0,  }} />
            ))}
          </div>
        </div>
      );
    }
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
  <SGridPlotCard rowColSpan={[4,3]} cardProps={new CardPropsClass(featureRaw+"Linechart",name,"","")}> <LoadingSpinner/></SGridPlotCard>);

  let dataURL = apiRoutes.fetchDbData({ relationName: dataSet, feature: feature, filterBy: "iso_a3", filterValue: a3 });
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
    <SGridPlotCard rowColSpan={[4,3]} cardProps={new CardPropsClass(featureRaw+"Linechart", name,"","")}> <LinechartComponent ChartPorps={lineChartPorps}/></SGridPlotCard>
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