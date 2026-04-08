
"use client";

import { useRef, useEffect } from 'react'
import {apiRoutes } from "@/app/api_routes";
import React from 'react';
import { InterfaceContextProvider, useInterfaceContext } from '@/app/components/contexts/InterfaceContext';
import SGridPlotCard from '@/app/components/layout/swapy_gridPlotCard';
import { CardPropsClass } from '@/app/components/layout/cardWrapper';
import LeafD3MapLayerComponent, {LeafD3MapLayerProps}  from '@/app/components/plots/maps/leafD3Map';
import { createSwapy, Swapy } from 'swapy';
import { MDXContentProvider } from '../../../../../../messages/markdown/MDXContentProvider';
import {ViewMainInfoComponent} from '@/app/components/viewPageMainInfo';
import { Locale, useLocale, useTranslations } from "next-intl";
import { t_richConfig } from "@/app/const_store";
import { availableColorMapsNames } from '@/app/components/plots/maps/constants';
import { useUIContext } from '@/app/components/contexts/UIContext';


const isSWAPY = true;

export default function Home() {

const t = useTranslations("page_home.ShowCases.page_USA_Habitats_Sightings");
const locale = useLocale() as Locale;
let md = MDXContentProvider[locale];

 const UI_contextT = useUIContext();
 const layoutSizes = UI_contextT.layoutDims;

  // set up the map props
  let worldMapProsp = new LeafD3MapLayerProps();
  let p1 = worldMapProsp;
  p1.chartName = 'map_World';
  p1.mapDataURL = apiRoutes.FETCH_USA_MAP;
  //p1.center = [15.3,-17 ];
  //p1.zoom = 7.6;
  p1.center = [38.8, -95.2];
  p1.zoom = 5.1;
  p1.isSetIntialContextDataFromComponent = true;
  p1.mapUIsettings.isLongnitude_slider = false;
  p1.mapUIsettings.isLatitude_slider = false;
  p1.mapUIsettings.isZoom_slider = false;
  p1.mapUIsettings.isLatLngZoomOverlay = true;
  p1.mapUIsettings.isColorMapSelection_dropdown = false;
  p1.mapUIsettings.isFeatureSelection_dropdown = false;
  p1.mapUIsettings.isDatasetSelection_dropdown = true;
  p1.mapUIsettings.isDistance_legend = true;
  p1.mapUIsettings.isColorMap_legend = true;
  p1.mapUIsettings.isCountrySelection_dropdown = false;
  p1.mapUIsettings.isDatePicker = false;
  p1.mapUIsettings.isAutoHideSettingsToggle = false;
  p1.mapUIsettings.isSettingsBelndAnimation = false;
  p1.isStaticAutoFitFullSize = false;
  p1.isApplyContextData = false;  
  p1.isProjection_equirectangular = false;
  p1.mapUIsettings.filterString_for_availableDataset_include = "probability";
  p1.mapUIsettings.defaultDatasetName = "t_2019_ocsvm_albopictus_probability_predictions_named";
  p1.mapUIsettings.defaultFeatureName = "prob_1";
  p1.mapUIsettings.defaultFeatureColorMap = availableColorMapsNames.interpolateViridis;
  p1.mapUIsettings.isPresenceData = true;
  p1.mapUIsettings.isPresenceDataChecked = true;
  p1.mapUIsettings.presenceDataColor = "rgb(255, 128, 0)";
  p1.mapUIsettings.isSequenceMetaData = true;
  p1.mapInteractions = {
    disableMouse: true,
    disableScroll: true
  };
  p1.mapDataSets = {
    isGridData: true,
    isPresenceData: true,
    isSequenceMetaData: false
  };
  

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

    let d3MapCardProps_overview = new CardPropsClass(
      t.rich('headingOverview', {...t_richConfig})?.toString() || '',
      t.rich('headingOverview', {...t_richConfig})?.toString() || '',"","");
      d3MapCardProps_overview.infoCard = {content: md.pages.PredictionView.overview.Info, footer: undefined};
    let d3MapCardProps2_overveiwDetail = new CardPropsClass(
      t.rich('headingDetailView', {...t_richConfig})?.toString() || '',
      t.rich('headingDetailView', {...t_richConfig})?.toString() || '',"","");

   // build the page
    return (
    <>
      <main className="flex max-h-fit flex-col items-center justify-between " style={{paddingTop: layoutSizes.gapSize}}>
      <InterfaceContextProvider>
      <ViewMainInfoComponent heading={mainInfoHeading} mdxContent={md.pages.ShowCases.USAHabitatsSightings} />
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
            </div>
      </InterfaceContextProvider>
      </main>
    </>
  );
}



