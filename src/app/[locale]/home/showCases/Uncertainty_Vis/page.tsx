
"use client";

import React, { useRef, useEffect } from 'react'
import {apiRoutes } from "@/app/api_routes";
import { InterfaceContextProvider } from '@/components/contexts/InterfaceContext';
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
import { UncertaintyChart, UncertaintyDataProvider } from './UncertaintyCharts';

const isSWAPY = true;

/**
 * Renders the cell-linked uncertainty-quantification showcase.
 *
 * @returns A coefficient-of-variation map and two interactive chart cards.
 *
 * @remarks
 * The map initially selects the `cv` feature of an `aegypti` prediction
 * relation. Selecting a grid cell updates its database row ID in
 * `InterfaceContext`, which drives the shared seasonal uncertainty and calibration
 * JSON request. Each chart registers its own loading task within a Swapy card.
 *
 * @see {@link UncertaintyChart} for the cell-linked Recharts views.
 */
export default function Home() {

const t = useTranslations("page_home.ShowCases.page_Uncertainty_Vis");
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
  p1.isApplyTransitions = true;
  p1.isProjection_equirectangular = true;
  p1.mapUIsettings.filterStringForAvailableDatasetInclude = "_sim";
  p1.mapUIsettings.defaultDatasetName = "t_2024_monthly_mean_4_ocsvm_aegypti_predictions_2023_mod_sim";
    p1.mapUIsettings.defaultFeatureName = "cv";
    p1.mapUIsettings.isSequenceMetaDataChecked = false;
  p1.mapUIsettings.isPresenceData = true;
  p1.mapUIsettings.defaultFeatureColorMap = availableColorMapsNames.interpolateRdBu;
  p1.mapUIsettings.areSettingsOpen = true;
  p1.mapDataSets.isCityNames = false;
  p1.mapUIsettings.defaultLayerOpacity = 1.0;
  p1.mapUIsettings.isSequenceMetaData = false;
  p1.mapUIsettings.isPresenceData = false;
    p1.mapUIsettings.presenceDataColor = "#40e9ff";
  p1.mapInteractions = {
    disableMouse: false,
    disableScroll: false
  };

  const getTranslation = (key: string, fallback: string) => {
    try {
      if (t.has(key as any)) {
        return t.rich(key as any, { ...t_richConfig })?.toString() || fallback;
      }
    } catch {
      // Fallback if key is not yet loaded in next-intl dev cache
    }
    return fallback;
  };

  let generalCardPorps = CardPropsClass("xai_1", getTranslation('temporalUncertaintyPlot', 'Temporal Uncertainty'), "","")
  let generalCardPorps2 = CardPropsClass("xai_2", getTranslation('calibrationPlot', 'Probabilistic Calibration Plot'), "","")

  let mainInfoHeading = getTranslation('mainInfo.heading', 'Uncertainty Visualization');

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
      getTranslation('coefficientMap', 'Global Coefficient of Variation Map'),
      getTranslation('coefficientMap', 'Global Coefficient of Variation Map'),"","");
      d3MapCardProps_overview.infoCard = {content: MDX.DummyContent, footer: undefined};
      d3MapCardProps_overview.infoCardInteraction = {content: MDX.DummyContent, footer: undefined};

    
     // build the page
    return (
    <>
   
      <main className="flex max-h-fit flex-col items-center justify-between " style={{paddingTop: layoutSizes.gapSize}}>
      <InterfaceContextProvider>
         <ViewMainInfoComponent heading={mainInfoHeading} mdxContent={MDX.pages.ShowCases.Uncertainty_Vis} />
         <UncertaintyDataProvider>
        {/*** START: grid layout ***/}
        <div ref={swapContainerRef} className={`grid grid-cols-6 w-full`} style={{
              gridTemplateRows: `repeat(auto-fill, minmax(${layoutSizes.rowSpanSize}vh, ${layoutSizes.rowSpanSize}vh))`,
              gap: `${layoutSizes.gapSize}px`,
              height: `calc(120vh - ${layoutSizes.topNavbarHeight}px - ${layoutSizes.gapSize}px)`,
             paddingRight: `${layoutSizes.gapSize}px`,
             paddingLeft: `${layoutSizes.gapSize}px`,

        
            }}>
          {/*** Grid Cells ***/}
            
            
             <SGridPlotCard rowColSpan={[4,3]}  cardProps={generalCardPorps}>
               <UncertaintyChart kind="temporal" />
             </SGridPlotCard>
             <SGridPlotCard rowColSpan={[4,3]}  cardProps={generalCardPorps2}>
                <UncertaintyChart kind="calibration" />
             </SGridPlotCard>
            <SGridPlotCard rowColSpan={[5,6]}  cardProps={d3MapCardProps_overview}><LeafD3MapLayerComponent props={worldMapProsp}/></SGridPlotCard>
        </div>
         </UncertaintyDataProvider>
      </InterfaceContextProvider>
      </main>
    </>
  );
}
