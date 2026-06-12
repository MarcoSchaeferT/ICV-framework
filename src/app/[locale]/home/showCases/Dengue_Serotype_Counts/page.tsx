
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
import { Locale } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { t_richConfig } from "@/app/const_store";
import { useUIContext } from '@/components/contexts/UIContext';


const isSWAPY = true;

export default function Home() {

const t = useTranslations("page_home.ShowCases.page_Dengue_Serotype_Counts");
const locale = useLocale() as Locale;
let md = MDXContentProvider[locale];

  const UI_contextT = useUIContext();
  const layoutSizes = UI_contextT.layoutDims;

  // set up the map props
  let worldMapProsp = LeafD3MapLayerProps();
  let p1 = worldMapProsp;
  p1.chartName = 'map_World';
  p1.dataURL = apiRoutes.FETCH_MAP_DATA.WORLD_MAP;
  p1.center = [14.9, -76.91];
  p1.zoom = 4.1;
  p1.mapUIsettings.isLongitudeSlider = false;
  p1.mapUIsettings.isLatitudeSlider = false;
  p1.mapUIsettings.isZoomSlider = false;
  p1.mapUIsettings.isLatLngZoomOverlay = true;
  p1.mapUIsettings.isColorMapSelectionDropdown = true;
  p1.mapUIsettings.isFeatureSelectionDropdown = true;
  p1.mapUIsettings.isDatasetSelectionDropdown = true;
  p1.mapUIsettings.isDistanceLegend = true;
  p1.mapUIsettings.isColorMapLegend = true;
  p1.mapUIsettings.isCountrySelectionDropdown = false;
  p1.mapUIsettings.isDatePicker = false;
  p1.mapUIsettings.isAutoHideSettingsToggle = false;
  p1.mapUIsettings.isSettingsBlendAnimation = false;
  p1.mapUIsettings.defaultLayerOpacity = 0.42;
  p1.isStaticAutoFitFullSize = false;
  p1.isApplyContextData = false;  
  p1.isProjection_equirectangular = true;
  p1.mapUIsettings.filterStringForAvailableDatasetInclude = "t_2019_ocsvm";
  p1.mapUIsettings.defaultDatasetName = "t_2019_ocsvm_albopictus_probability_predictions_named";
  p1.mapUIsettings.defaultFeatureName = "prob_1";
  p1.mapUIsettings.filterStringForAvailableFeature = "prob_1";
  p1.mapUIsettings.isPresenceData = true;
  p1.mapUIsettings.isPresenceDataChecked = false;
  p1.mapUIsettings.isSequenceMetaData = true;
  p1.mapUIsettings.isSequenceMetaDataChecked = true;
  p1.mapUIsettings.defaultDonutSize = 40;
  p1.mapInteractions = {
    disableMouse: true,
    disableScroll: true
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
      <ViewMainInfoComponent heading={mainInfoHeading} mdxContent={md.pages.ShowCases.DengueSerotypeCounts} />
        {/*** START: grid layout ***/}
        <div ref={swapContainerRef} className={`w-full grid grid-cols-6 `} style={{
              gridTemplateRows: `repeat(auto-fill, minmax(${layoutSizes.rowSpanSize}vh, ${layoutSizes.rowSpanSize}vh))`,
              gap: `${layoutSizes.gapSize}px`,
              height: `calc(110vh - ${layoutSizes.topNavbarHeight}px - ${layoutSizes.gapSize}px)`,
               
             paddingRight: `${layoutSizes.gapSize}px`,
             paddingLeft: `${layoutSizes.gapSize}px`,
            }}>
              {/*** Grid Cells ***/}
             
              <SGridPlotCard rowColSpan={[9,6]}  cardProps={d3MapCardProps_overview}><LeafD3MapLayerComponent props={p1}/></SGridPlotCard>
            ´

            </div>
      </InterfaceContextProvider>
      </main>
    </>
  );
}



