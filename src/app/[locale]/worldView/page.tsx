
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
  p1.center = [20, 14];
  p1.zoom = 2.8;
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
  p1.mapUIsettings.isSettingsBlendAnimation = true;
  p1.isStaticAutoFitFullSize = false;
  p1.isApplyContextData = false;
  p1.isApplyTransitions = true;
  p1.isProjection_equirectangular = true;
  p1.mapUIsettings.filterStringForAvailableDatasetInclude = ["month", "probability"];
  p1.mapUIsettings.defaultDatasetName = "t_2024_monthly_mean_4_ocsvm_aegypti_predictions_2023_mod_sim";
  p1.mapUIsettings.defaultFeatureName = "prob_1";
  p1.mapUIsettings.isPresenceData = true;
  p1.mapUIsettings.isSequenceMetaData = true;
  p1.mapUIsettings.presenceDataColor = "rgb(255, 128, 0)";
  p1.mapInteractions = {
    disableMouse: false,
    disableScroll: false
  };
  p1.mapStyles.backgroundColor = "rgb(215, 234, 245)";
   

  let mapPropsWorld2 = LeafD3MapLayerProps();
  let p2 = mapPropsWorld2
  p2.chartName = 'map_World2';
  p2.dataURL = apiRoutes.FETCH_MAP_DATA.WORLD_MAP;
  p2.center = [8.7, 10.3];
  p2.zoom = 0.1;
  p2.mapUIsettings.areSettingsOpen = false;
  p2.mapUIsettings.isLongitudeSlider = false;
  p2.mapUIsettings.isLatitudeSlider = false;
  p2.mapUIsettings.isZoomSlider = false;
  p2.mapUIsettings.isLatLngZoomOverlay = false;
  p2.mapUIsettings.isColorMapSelectionDropdown = false;
  p2.mapUIsettings.isFeatureSelectionDropdown = false;
  p2.mapUIsettings.isDatasetSelectionDropdown = false;
  p2.mapUIsettings.defaultFeatureName = "prob_1";
  p2.mapUIsettings.isDistanceLegend = false;
  p2.mapUIsettings.isColorMapLegend = false;
  p2.mapUIsettings.isCountrySelectionDropdown = false;
  p2.mapUIsettings.isDatePicker = false;
  p2.mapUIsettings.isAutoHideSettingsToggle = true;
  p2.isStaticAutoFitFullSize = false;
  p2.isProjection_equirectangular = true;
  p2.mapUIsettings.presenceDataColor = "rgb(255, 128, 0)";
  p2.isApplyContextData = true;
  p2.isApplyTransitions = false;
  p2.mapUIsettings.defaultDatasetName =   p1.mapUIsettings.defaultDatasetName ;
  p2.mapInteractions = {
    disableMouse: true,
    disableScroll: true,
  };
  p2.mapDataSets = {
    isGridData: true,
    isPresenceData: false,
    isSequenceMetaData: false,
    isCityNames: false,
  }
  p2.isStaticAutoFitFullSize = false;
  p2.isProjection_equirectangular = true;
  p2.mapStyles.backgroundColor = "rgb(215, 234, 245)";
  p2.mapStyles.isTooltopVisible = false;
  p2.mapStyles.isMapMarkerTooltipVisible = true;

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

    let d3MapCardProps2_overveiwDetail = CardPropsClass(
      t.rich('headingOverview', {...t_richConfig})?.toString() || '',
      t.rich('headingOverview', {...t_richConfig})?.toString() || '',"","");
      
    let d3MapCardProps_overview = CardPropsClass(
      t.rich('headingDetailView', {...t_richConfig})?.toString() || '',
     t.rich('headingDetailView', {...t_richConfig})?.toString()||"","","");
      d3MapCardProps2_overveiwDetail.infoCard = {content: MDX.pages.PredictionView.detailView.Info, footer: undefined};
      d3MapCardProps2_overveiwDetail.infoCardInteraction = {content: undefined, footer: undefined};

      d3MapCardProps_overview.infoCard = {content: MDX.pages.PredictionView.overview.Info, footer: undefined};
      d3MapCardProps_overview.infoCardInteraction = {content: MDX.pages.PredictionView.overview.Interaction, footer: undefined};

     // build the page
    return (
    <>
      <main className="flex max-h-fit flex-col items-center justify-between " style={{paddingTop: layoutSizes.gapSize}}>
      <InterfaceContextProvider>
      <ViewMainInfoComponent heading={mainInfoHeading} mdxContent={MDX.pages.PredictionView.mainInfo} />
        {/*** START: grid layout ***/}
        <div ref={swapContainerRef} className={`grid grid-cols-6 w-full`} style={{
              gridTemplateRows: `repeat(auto-fill, minmax(${layoutSizes.rowSpanSize}vh, ${layoutSizes.rowSpanSize}vh))`,
              gap: `${layoutSizes.gapSize}px`,
              height: `calc(110vh - ${layoutSizes.topNavbarHeight}px - ${layoutSizes.gapSize}px)`,
             paddingRight: `${layoutSizes.gapSize}px`,
             paddingLeft: `${layoutSizes.gapSize}px`,

            }}>
          {/*** Grid Cells ***/}
          <SGridPlotCard rowColSpan={[9,6]} cardProps={d3MapCardProps_overview}>
            {/* Main world map */}
            <LeafD3MapLayerComponent props={worldMapProsp}/>
            {/* Google-Maps-style overview minimap overlay.
                NOTE: gridPlotCardContent class on the inner wrapper is REQUIRED by
                useChartResizer so Leaflet can measure its container correctly. */}
            <div
              className="absolute overflow-hidden rounded-[10px] border-2 border-white/55 shadow-[0_4px_10px_rgba(0,0,0,0.45)]"
              style={{
                bottom: 50,
                left: 4,
                width: 450,
                height: 230,
                zIndex: 800,
                backdropFilter: 'blur(2px)',
              }}
            >
              {/* Label pill — non-interactive, floats above the minimap */}
              <div
                className="absolute top-1.5 left-2 pointer-events-none select-none rounded-full px-2 py-0.5 text-white font-semibold tracking-widest"
                style={{
                  zIndex: 900,
                  fontSize: 10,
                  background: 'rgba(20,20,30,0.72)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                {d3MapCardProps2_overveiwDetail.headline || 'Overview'}
              </div>
              {/* gridPlotCardContent class REQUIRED by useChartResizer —
                  position:relative + explicit px dims let MapContainer's "size-full absolute"
                  resolve to real pixels via getBoundingClientRect. */}
              <div
                className="gridPlotCardContent relative pointer-events-none"
                style={{ width: 450, height: 230 }}
              >
                <LeafD3MapLayerComponent props={mapPropsWorld2}/>
              </div>
            </div>
          </SGridPlotCard>
        </div>
      </InterfaceContextProvider>
      </main>
    </>
  );
}



