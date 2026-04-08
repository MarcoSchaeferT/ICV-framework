
"use client";

import { useRef, useEffect } from 'react'
import {apiRoutes } from "../../api_routes";
import React from 'react';
import { InterfaceContextProvider, useInterfaceContext } from '../../components/contexts/InterfaceContext';
import SGridPlotCard from '../../components/layout/swapy_gridPlotCard';
import { CardPropsClass } from '../../components/layout/cardWrapper';
import LeafD3MapLayerComponent, {LeafD3MapLayerProps}  from '../../components/plots/maps/leafD3Map';
import { createSwapy, Swapy } from 'swapy';
import { MDXContentProvider } from '../../../../messages/markdown/MDXContentProvider';
import {ViewMainInfoComponent} from '../../components/viewPageMainInfo';
import { Locale, useLocale, useTranslations } from "next-intl";
import { t_richConfig } from "../../const_store";
import { useUIContext } from '@/app/components/contexts/UIContext';
import { availableColorMapsNames } from '@/app/components/plots/maps/constants';


const isSWAPY = true;

export default function Home() {

const t = useTranslations("page_predictionView");
const locale = useLocale() as Locale;
let MDX = MDXContentProvider[locale];

 const UI_contextT = useUIContext();
 const layoutSizes = UI_contextT.layoutDims;

  // set up the map props
  let worldMapProsp = new LeafD3MapLayerProps();
  let p1 = worldMapProsp;
  p1.chartName = 'map_World';
  p1.mapDataURL = apiRoutes.FETCH_WORLD_MAP;
  p1.center = [14, 15.6];
  p1.zoom = 2.2;
  p1.isSetIntialContextDataFromComponent = true;
  p1.mapUIsettings.isLongnitude_slider = false;
  p1.mapUIsettings.isLatitude_slider = false;
  p1.mapUIsettings.isZoom_slider = false;
  p1.mapUIsettings.isLatLngZoomOverlay = true;
  p1.mapUIsettings.isColorMapSelection_dropdown = true;
  p1.mapUIsettings.isFeatureSelection_dropdown = true;
  p1.mapUIsettings.isDatasetSelection_dropdown = true;
  p1.mapUIsettings.isDistance_legend = true;
  p1.mapUIsettings.isColorMap_legend = true;
  p1.mapUIsettings.isCountrySelection_dropdown = false;
  p1.mapUIsettings.isDatePicker = false;
  p1.mapUIsettings.isAutoHideSettingsToggle = true;
  p1.mapUIsettings.isSettingsBelndAnimation = true;
  p1.mapUIsettings.isAutoHideSettingsToggle = false;
  p1.mapUIsettings.defaultDonutSize = 25;
  p1.isStaticAutoFitFullSize = false;
  p1.isApplyContextData = false;
  p1.isApplyTransitions = false;
  p1.isProjection_equirectangular = true;
  p1.mapUIsettings.filterString_for_availableDataset_include = "";
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

  let worldMapProsp2 = new LeafD3MapLayerProps();
  let p2 = worldMapProsp2;
  p2.chartName = 'map_World_2';
  p2.mapDataURL = apiRoutes.FETCH_WORLD_MAP;
  p2.center = [17.3, -80.3];
  p2.zoom = 4.3;
  p2.mapUIsettings.isLongnitude_slider = false;
  p2.mapUIsettings.isLatitude_slider = false;
  p2.mapUIsettings.isZoom_slider = false;
  p2.mapUIsettings.isLatLngZoomOverlay = true;
  p2.mapUIsettings.isColorMapSelection_dropdown = true;
  p2.mapUIsettings.isFeatureSelection_dropdown = true;
  p2.mapUIsettings.isDatasetSelection_dropdown = true;
  p2.mapUIsettings.isDistance_legend = true;
  p2.mapUIsettings.isColorMap_legend = true;
  p2.mapUIsettings.isCountrySelection_dropdown = false;
  p2.mapUIsettings.isDatePicker = false;
  p2.mapUIsettings.isAutoHideSettingsToggle = true;
  p2.mapUIsettings.isSettingsBelndAnimation = true;
  p2.mapUIsettings.isAutoHideSettingsToggle = false;
  p2.isStaticAutoFitFullSize = false;
  p2.isApplyContextData = true;
  p2.isApplyTransitions = false;
  p2.isProjection_equirectangular = true;
  p2.mapUIsettings.filterString_for_availableDataset_include = "";
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

    let d3MapCardProps_overview = new CardPropsClass(
      t.rich('headingOverview', {...t_richConfig})?.toString() || '',
      t.rich('headingOverview', {...t_richConfig})?.toString() || '',"","");
      d3MapCardProps_overview.infoCard = {content: MDX.pages.PredictionView.overview.Info, footer: undefined};
      d3MapCardProps_overview.infoCardInteraction = {content: MDX.pages.PredictionView.overview.Interaction, footer: undefined};

      let d3MapCardProps_overview2 = new CardPropsClass(
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



