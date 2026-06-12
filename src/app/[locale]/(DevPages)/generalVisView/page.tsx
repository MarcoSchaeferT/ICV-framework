
"use client";

import { useRef, useEffect } from 'react'
import {apiRoutes } from "@/app/api_routes";
import React from 'react';
import { InterfaceContextProvider, useInterfaceContext } from '@/components/contexts/InterfaceContext';
import SGridPlotCard from '@/components/layout/SwapyGridPlotCard';
import { CardPropsClass } from '@/components/layout/CardWrapper';
import LeafD3MapLayerComponent, {LeafD3MapLayerProps}  from '@/components/plots/maps/LeafD3Map';
import { createSwapy, Swapy } from 'swapy';
import { MDXContentProvider } from '@messages/markdown/MDXContentProvider';
import {ViewMainInfoComponent} from '@/components/ViewPageMainInfo';
import { Locale, useLocale, useTranslations } from "next-intl";
import { t_richConfig } from "@/app/const_store";
import { useUIContext } from '@/components/contexts/UIContext';
import { availableColorMapsNames } from '@/components/plots/maps/constants';


const isSWAPY = true;

export default function Home() {

const t = useTranslations("page_predictionView");
const locale = useLocale() as Locale;
let MDX = MDXContentProvider[locale];

 const UI_contextT = useUIContext();
 const layoutSizes = UI_contextT.layoutDims;

  // set up the map props
  let worldMapProsp = LeafD3MapLayerProps();
  let p1 = worldMapProsp;
  p1.chartName = 'map_World';
  p1.mapDataURL = apiRoutes.FETCH_MAP_DATA.WORLD_MAP;
  p1.center = [14, 15.6];
  p1.zoom = 2.2;
  p1.isSetIntialContextDataFromComponent = true;
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
  p1.mapUIsettings.isAutoHideSettingsToggle = true;
  p1.mapUIsettings.isSettingsBlendAnimation = true;
  p1.mapUIsettings.isAutoHideSettingsToggle = false;
  p1.mapUIsettings.defaultDonutSize = 25;
  p1.isStaticAutoFitFullSize = false;
  p1.isApplyContextData = false;
  p1.isApplyTransitions = false;
  p1.isProjection_equirectangular = true;
  p1.mapUIsettings.filterStringForAvailableDatasetInclude = "";
  p1.mapUIsettings.defaultDatasetName = "t_2024_monthly_mean_4_ocsvm_aegypti_predictions_2023_mod_sim";
    p1.mapUIsettings.defaultFeatureName = "cv";
    p1.mapUIsettings.isSequenceMetaDataChecked = false;
  p1.mapUIsettings.isPresenceData = true;
  p1.mapUIsettings.defaultFeatureColorMap = availableColorMapsNames.interpolateRdBu;
  p1.mapUIsettings.areSettingsOpen = false;
  p1.mapDataSets.isCityNames = false;
  p1.mapUIsettings.defaultLayerOpacity = 1.0;
  p1.mapUIsettings.isSequenceMetaData = true;
    p1.mapUIsettings.presenceDataColor = "#40e9ff";
  p1.mapInteractions = {
    disableMouse: false,
    disableScroll: false
  };

  let worldMapProsp2 = LeafD3MapLayerProps();
  let p2 = worldMapProsp2;
  p2.chartName = 'map_World_2';
  p2.mapDataURL = apiRoutes.FETCH_MAP_DATA.WORLD_MAP;
  p2.center = [17.3, -80.3];
  p2.zoom = 4.3;
  p2.mapUIsettings.isLongitudeSlider = false;
  p2.mapUIsettings.isLatitudeSlider = false;
  p2.mapUIsettings.isZoomSlider = false;
  p2.mapUIsettings.isLatLngZoomOverlay = true;
  p2.mapUIsettings.isColorMapSelectionDropdown = true;
  p2.mapUIsettings.isFeatureSelectionDropdown = true;
  p2.mapUIsettings.isDatasetSelectionDropdown = true;
  p2.mapUIsettings.isDistanceLegend = true;
  p2.mapUIsettings.isColorMapLegend = true;
  p2.mapUIsettings.isCountrySelectionDropdown = false;
  p2.mapUIsettings.isDatePicker = false;
  p2.mapUIsettings.isAutoHideSettingsToggle = true;
  p2.mapUIsettings.isSettingsBlendAnimation = true;
  p2.mapUIsettings.isAutoHideSettingsToggle = false;
  p2.isStaticAutoFitFullSize = false;
  p2.isApplyContextData = true;
  p2.isApplyTransitions = false;
  p2.isProjection_equirectangular = true;
  p2.mapUIsettings.filterStringForAvailableDatasetInclude = "";
  p2.mapUIsettings.defaultDatasetName = "t_2024_monthly_mean_2_ocsvm_aegypti_predictions_2023_mod";
  p2.mapUIsettings.defaultFeatureName = "prob_1";
  p2.mapUIsettings.isSequenceMetaDataChecked = true;
  p2.mapUIsettings.isPresenceData = true;
  p2.mapUIsettings.isSequenceMetaData = true;
  p2.mapUIsettings.presenceDataColor = p1.mapUIsettings.presenceDataColor
  p2.mapInteractions = {
    disableMouse: false,
    disableScroll: false
  };


  let mainInfoHeading = t.rich('mainInfo.heading', {...t_richConfig}) || '';
  let mainInfoContent = t.rich('mainInfo.content', {...t_richConfig}) || '';

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
  const footer: React.FC = () => (
    "Hello Test"
   
  );

    let d3MapCardProps_overview = CardPropsClass(
      t.rich('headingOverview', {...t_richConfig})?.toString() || '',
      t.rich('headingOverview', {...t_richConfig})?.toString() || '',"","");
      d3MapCardProps_overview.infoCard = {content: MDX.pages.PredictionView.overview.Info, footer: undefined};
      d3MapCardProps_overview.infoCardInteraction = {content: MDX.pages.PredictionView.overview.Interaction, footer: undefined};

      let d3MapCardProps_overview2 = CardPropsClass(
      t.rich('headingDetailView', {...t_richConfig})?.toString() || '',
      t.rich('headingDetailView', {...t_richConfig})?.toString() || '',"","");
      d3MapCardProps_overview2.infoCard = {content: MDX.pages.PredictionView.detailView.Info, footer: undefined};
      d3MapCardProps_overview2.infoCardInteraction = {content: MDX.pages.PredictionView.detailView.Interaction, footer: undefined};
    
     // build the page
    return (
    <>
      <main className="flex max-h-fit flex-col items-center justify-between " style={{paddingTop: layoutSizes.gapSize}}>
      <InterfaceContextProvider>
        {/*** START: grid layout ***/}
        <div ref={swapContainerRef} className={`grid grid-cols-6 w-full`} style={{
              gridTemplateRows: `repeat(auto-fill, minmax(${layoutSizes.rowSpanSize}vh, ${layoutSizes.rowSpanSize}vh))`,
              gap: `${layoutSizes.gapSize}px`,
              height: `calc(110vh - ${layoutSizes.topNavbarHeight}px - ${layoutSizes.gapSize}px)`,
             paddingRight: `${layoutSizes.gapSize}px`,
             paddingLeft: `${layoutSizes.gapSize}px`,

        
            }}>
          {/*** Grid Cells ***/}
          <SGridPlotCard rowColSpan={[9,6]}  cardProps={d3MapCardProps_overview}><LeafD3MapLayerComponent props={worldMapProsp}/></SGridPlotCard>
           <SGridPlotCard rowColSpan={[9,1]}  cardProps={d3MapCardProps_overview2}><LeafD3MapLayerComponent props={worldMapProsp2}/></SGridPlotCard>
        </div>
      </InterfaceContextProvider>
      </main>
    </>
  );
}



