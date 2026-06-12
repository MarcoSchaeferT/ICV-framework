
"use client";

import { useRef, useEffect, useState } from 'react'
import {apiRoutes } from "@/app/api_routes";
import React from 'react';
import { InterfaceContextProvider, useInterfaceContext, interfaceContextI } from '@/components/contexts/InterfaceContext';
import SGridPlotCard from '@/components/layout/SwapyGridPlotCard';
import { CardPropsClass } from '@/components/layout/CardWrapper';
import LeafD3MapLayerComponent, {LeafD3MapLayerProps}  from '@/components/plots/maps/LeafD3Map';
import { createSwapy, Swapy } from 'swapy';
import { MDXContentProvider } from '@messages/markdown/MDXContentProvider';
import {ViewMainInfoComponent} from '@/components/ViewPageMainInfo';
import { Locale, useLocale, useTranslations } from "next-intl";
import { t_richConfig } from "@/app/const_store";
import { useUIContext } from '@/components/contexts/UIContext';


const isSWAPY = true;

export default function Home() {

const t = useTranslations("page_home.ShowCases.page_Suitable_Mosquito_Habitats");
const locale = useLocale() as Locale;
let md = MDXContentProvider[locale];

 const UI_contextT = useUIContext();
 const layoutSizes = UI_contextT.layoutDims;

  // set up the map props
  let worldMapProsp = LeafD3MapLayerProps();
  let p1 = worldMapProsp;
  p1.chartName = 'map_World';
  p1.dataURL = apiRoutes.FETCH_MAP_DATA.WORLD_MAP;
  //p1.center = [15.3,-17 ];
  //p1.zoom = 7.6;
  p1.center = [27.8, 15.8];
  p1.zoom = 2.8;
  p1.mapUIsettings.isLongitudeSlider = false;
  p1.mapUIsettings.isLatitudeSlider = false;
  p1.mapUIsettings.isZoomSlider = false;
  p1.mapUIsettings.isLatLngZoomOverlay = true;
  p1.mapUIsettings.isColorMapSelectionDropdown = false;
  p1.mapUIsettings.isFeatureSelectionDropdown = false;
  p1.mapUIsettings.isDatasetSelectionDropdown = true;
  p1.mapUIsettings.isCountrySelectionDropdownMapBased = false;
  p1.mapUIsettings.isCountrySelectionDropdown = false;
  p1.mapUIsettings.isDistanceLegend = true;
  p1.mapUIsettings.isColorMapLegend = true;
  p1.mapUIsettings.isDatePicker = false;
  p1.mapUIsettings.isAutoHideSettingsToggle = false;
  p1.mapUIsettings.isSettingsBlendAnimation = false;
  p1.isStaticAutoFitFullSize = false;
  p1.isApplyContextData = false;
  p1.isApplyTransitions = false;
  p1.isProjection_equirectangular = false;
  p1.mapUIsettings.filterStringForAvailableDatasetInclude = "probability";
  p1.mapUIsettings.defaultDatasetName = "t_2019_ocsvm_albopictus_probability_predictions_named";
  p1.mapUIsettings.defaultFeatureName = "prob_1";
  p1.mapUIsettings.isPresenceData = true;
  p1.mapUIsettings.isPresenceDataChecked = true;
  p1.mapUIsettings.presenceDataColor = "rgb(2, 246, 250)";
  p1.mapUIsettings.isSequenceMetaData = true;
  p1.mapInteractions = {
    disableMouse: false,
    disableScroll: false,
  };
  p1.mapDataSets = {
    isGridData: true,
    isPresenceData: false,
    isSequenceMetaData: false,
  };
  p1.mapStyles.strokeWidth = 2; 
  

  let mapPropsWorld2 = LeafD3MapLayerProps();
  let p2 = mapPropsWorld2
  p2.chartName = 'map_World2';
  p2.dataURL = apiRoutes.FETCH_MAP_DATA.WORLD_MAP;
  p2.center = [52.0, 10.1];
  p2.zoom = 6.0;
  p2.mapUIsettings.areSettingsOpen = true;
  p2.mapUIsettings.isLongitudeSlider = false;
  p2.mapUIsettings.isLatitudeSlider = false;
  p2.mapUIsettings.isZoomSlider = false;
  p2.mapUIsettings.isColorMapSelectionDropdown = false;
  p2.mapUIsettings.isFeatureSelectionDropdown = false;
  p2.mapUIsettings.isDatasetSelectionDropdown = false;
  p2.mapUIsettings.isDistanceLegend = true;
  p2.mapUIsettings.isColorMapLegend = true;
  p2.mapUIsettings.isCountrySelectionDropdownMapBased = true;
  p2.mapUIsettings.isCountrySelectionDropdown = false;
  p2.mapUIsettings.isDatePicker = false;
  p2.isStaticAutoFitFullSize = false;
  p2.isProjection_equirectangular = false;
  p2.mapUIsettings.isPresenceDataChecked = true;
  p2.mapUIsettings.presenceDataColor = "rgb(2, 246, 250)";
  p2.mapUIsettings.filterStringForAvailableDatasetInclude = "probability";
  p2.mapUIsettings.defaultDatasetName = "";
  p2.mapUIsettings.defaultFeatureName = "prob_1";
  p2.isApplyContextData = false;
  p2.mapUIsettings.defaultDatasetName =   p1.mapUIsettings.defaultDatasetName ;
  p2.mapInteractions = {
    disableMouse: true,
    disableScroll: true,
  };
 p2.mapDataSets = {
    isGridData: true,
    isPresenceData: true,
    isSequenceMetaData: false,
  };
  p2.mapStyles.strokeWidth = 3; 

  let mainInfoHeading = t('mainInfo.heading');

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
  

    let d3MapCardProps_overview = CardPropsClass(
      t.rich('headingOverview', {...t_richConfig})?.toString() || '',
      t.rich('headingOverview', {...t_richConfig})?.toString() || '',"","");
      d3MapCardProps_overview.infoCard = {content: md.pages.PredictionView.overview.Info, footer: undefined};
    let d3MapCardProps2_overveiwDetail = CardPropsClass(
      t.rich('headingDetailView', {...t_richConfig})?.toString() || '',
      t.rich('headingDetailView', {...t_richConfig})?.toString() || '',"","");
    
     // build the page
   return (
    <>
     <main className="flex max-h-fit flex-col items-center justify-between " style={{paddingTop: layoutSizes.gapSize}}>
      <InterfaceContextProvider>
      <ViewMainInfoComponent heading={mainInfoHeading} mdxContent={md.pages.ShowCases.SuitableMosquitoHabitats} />
        {/*** START: grid layout ***/}
        <div ref={swapContainerRef} className={`w-full grid grid-cols-6 `} style={{
              gridTemplateRows: `repeat(auto-fill, minmax(${layoutSizes.rowSpanSize}vh, ${layoutSizes.rowSpanSize}vh))`,
              gap: `${layoutSizes.gapSize}px`,
              height: `calc(110vh - ${layoutSizes.topNavbarHeight}px - ${layoutSizes.gapSize}px)`,
              
             paddingRight: `${layoutSizes.gapSize}px`,
             paddingLeft: `${layoutSizes.gapSize}px`,
            }}>
          {/*** Grid Cells ***/}
          <SGridPlotCard rowColSpan={[9,6]}  cardProps={d3MapCardProps_overview}><LeafD3MapLayerComponent props={worldMapProsp}/></SGridPlotCard>
          {/*<SGridPlotCard rowColSpan={[9,3]}  cardProps={d3MapCardProps2_overveiwDetail}><LeafD3MapLayerComponent props={mapPropsWorld2}/></SGridPlotCard>*/}
        </div>
      </InterfaceContextProvider>
      </main>
    </>
  );
}

