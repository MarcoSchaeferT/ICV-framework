
"use client";

import { useRef, createRef, useEffect, useState } from 'react'
import {apiRoutes } from "../../api_routes";
import React from 'react';
import { InterfaceContextProvider, useInterfaceContext, interfaceContextI } from '../../components/contexts/InterfaceContext';
import SGridPlotCard from '../../components/layout/swapy_gridPlotCard';
import { CardPropsClass } from '../../components/layout/cardWrapper';
import LeafD3MapLayerComponent, {LeafD3MapLayerProps}  from '../../components/plots/maps/leafD3Map';
import { availableColorMapsNames } from '@/app/components/plots/maps/constants';
import { createSwapy, Swapy } from 'swapy';
import { useTranslations } from "next-intl";
import { t_richConfig } from "../../const_store";
import * as d3 from 'd3';
import { useUIContext } from '@/app/components/contexts/UIContext';
import { ViewMainInfoComponent } from '@/app/components/viewPageMainInfo';
import { MDXContentProvider } from '../../../../messages/markdown/MDXContentProvider';
import { Locale } from '@/i18n/routing';
import { useLocale } from 'next-intl';


const isSWAPY = true;

export default function Home() {

const t = useTranslations("page_covidWorldView");
const locale = useLocale() as Locale;
let md = MDXContentProvider[locale];

 const UI_contextT = useUIContext();
 const layoutSizes = UI_contextT.layoutDims;

  // set up the map props
  let worldMapProsp = new LeafD3MapLayerProps();
  let p1 = worldMapProsp;
  p1.chartName = 'map_World';
  p1.dataURL = apiRoutes.FETCH_WORLD_MAP;
  //p1.center = [15.3,-17 ];
  //p1.zoom = 7.6;
  p1.center = [20, 14];
  p1.zoom = 2;
  p1.mapUIsettings.isLongnitude_slider = false;
  p1.mapUIsettings.isLatitude_slider = false;
  p1.mapUIsettings.isZoom_slider = false;
  p1.mapUIsettings.isColorMapSelection_dropdown = true;
  p1.mapUIsettings.isFeatureSelection_dropdown = true;
  p1.mapUIsettings.isDatasetSelection_dropdown = true;
  p1.mapUIsettings.isDistance_legend = true;
  p1.mapUIsettings.isColorMap_legend = true;
  p1.mapUIsettings.isCountrySelection_dropdown = true;
  p1.mapUIsettings.isDatePicker = true;
  p1.isStaticAutoFitFullSize = false;
  p1.isApplyContextData = false;
  p1.isProjection_equirectangular = true;
  p1.mapUIsettings.filterString_for_availableDataset_include = "epi";
  p1.mapUIsettings.defaultDatasetName = "epidemiology_geography_df_1_2_w_geometry";
  p1.mapUIsettings.inCovidDataView = true;
  p1.isApplyTransitions = false;
  p1.mapUIsettings.isSequenceMetaData = false;
  p1.mapUIsettings.defaultFeatureColorMap = availableColorMapsNames.interpolateInferno;
  p1.mapDataSets.isGridData = false;
  p1.mapDataSets.isSequenceMetaData = false;
  p1.mapUIsettings.defaultFeatureName = "new_deceased";
  p1.mapUIsettings.dataFilteringCheckboxes = false;
  p1.mapDataSets.isCityNames = false;
  // Overview map (zoom=2 < 4) => country-level data
  p1.mapUIsettings.isCountryLevelData = true;
  p1.mapUIsettings.isSubregionLevelData = false;


  let mapPropsWorld2 = new LeafD3MapLayerProps();
  let p2 = mapPropsWorld2;
  p2.chartName = 'map_World2';
  p2.dataURL = apiRoutes.FETCH_WORLD_MAP;
  p2.center = [-20, -60];
  p2.zoom = 3.0;
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
  p2.mapUIsettings.filterString_for_availableDataset_include = p1.mapUIsettings.filterString_for_availableDataset_include;
  p2.isStaticAutoFitFullSize = false;
  p2.isProjection_equirectangular = true;
  p2.isApplyContextData = true;
  p2.mapUIsettings.inCovidDataView = true;
  p2.isApplyTransitions = true;
  p2.mapUIsettings.isSequenceMetaData = false;
  p2.mapUIsettings.defaultFeatureColorMap = availableColorMapsNames.interpolateInferno;
  p2.mapDataSets.isGridData = false;
  p2.mapDataSets.isSequenceMetaData = false;
  p2.mapUIsettings.defaultFeatureName = "new_deceased";
  p2.mapDataSets.isCityNames = false;
  // Detail map (zoom=4.4 >= 4) => subregion-level data
  p2.mapUIsettings.isCountryLevelData = false;
  p2.mapUIsettings.isSubregionLevelData = true;




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
           swapMode: 'hover', //'hover' | 'drop';;
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
 
    let d3MapCardProps_overview = new CardPropsClass(
      t.rich('headingOverview', {...t_richConfig})?.toString() || '',
      t.rich('headingOverview', {...t_richConfig})?.toString() || '',"","");
    let d3MapCardProps2_overveiwDetail = new CardPropsClass(
      t.rich('headingDetailView', {...t_richConfig})?.toString() || '',
      t.rich('headingDetailView', {...t_richConfig})?.toString() || '',"","");

    return (
    <>
      <main className="flex max-h-fit flex-col items-center justify-between " style={{paddingTop: layoutSizes.gapSize}}>
      <InterfaceContextProvider>
      <ViewMainInfoComponent heading={t('mainInfo.heading')} mdxContent={md.pages.CovidWorldView.mainInfo} />
        {/*** START: grid layout ***/}
        <div ref={swapContainerRef} className={`w-full grid grid-cols-6 `} style={{
              gridTemplateRows: `repeat(auto-fill, minmax(${layoutSizes.rowSpanSize}vh, ${layoutSizes.rowSpanSize}vh))`,
              gap: `${layoutSizes.gapSize}px`,
              height: `calc(110vh - ${layoutSizes.topNavbarHeight}px - ${layoutSizes.gapSize}px)`,
              
             paddingRight: `${layoutSizes.gapSize}px`,
             paddingLeft: `${layoutSizes.gapSize}px`,
            }}>
              {/*** Grid Cells ***/}

              <SGridPlotCard rowColSpan={[9,4]}  cardProps={d3MapCardProps_overview}><LeafD3MapLayerComponent props={worldMapProsp}/></SGridPlotCard>
              <SGridPlotCard rowColSpan={[9,2]}  cardProps={d3MapCardProps2_overveiwDetail}><LeafD3MapLayerComponent props={mapPropsWorld2}/></SGridPlotCard>

            </div>
      </InterfaceContextProvider>
      </main>
    </>
  );
}

