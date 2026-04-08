
"use client";

import { useRef, useEffect, useState } from 'react'
import {apiRoutes } from "../../../../api_routes";
import React from 'react';
import { InterfaceContextProvider, useInterfaceContext } from '../../../../components/contexts/InterfaceContext';
import SGridPlotCard from '../../../../components/layout/swapy_gridPlotCard';
import { CardPropsClass } from '../../../../components/layout/cardWrapper';
import LeafD3MapLayerComponent, {LeafD3MapLayerProps}  from '../../../../components/plots/maps/leafD3Map';
import { createSwapy, Swapy } from 'swapy';
import { MDXContentProvider } from '../../../../../../messages/markdown/MDXContentProvider';
import {ViewMainInfoComponent} from '../../../../components/viewPageMainInfo';
import { Locale, useLocale, useTranslations } from "next-intl";
import { t_richConfig } from "../../../../const_store";
import { useUIContext } from '@/app/components/contexts/UIContext';
import { availableColorMapsNames } from '@/app/components/plots/maps/constants';
import { LoadingSpinner } from '@/app/components/plots/maps/helpers';


const isSWAPY = true;

export default function Home() {

const t = useTranslations("page_home.ShowCases.page_Uncertainty_Vis");
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
  p1.mapUIsettings.filterString_for_availableDataset_include = "_sim";
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

  let generalCardPorps = new CardPropsClass("xai_1", t("temporalUncertaintyPlot"), "","")
  let generalCardPorps2 = new CardPropsClass("xai_2", t("calibrationPlot"), "","")

 

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


    let d3MapCardProps_overview = new CardPropsClass(t("coefficientMap"),
      t("coefficientMap"),"","");
      d3MapCardProps_overview.infoCard = {content: MDX.DummyContent, footer: undefined};
      d3MapCardProps_overview.infoCardInteraction = {content: MDX.DummyContent, footer: undefined};

    
     // build the page
    return (
    <>
   
      <main className="flex max-h-fit flex-col items-center justify-between " style={{paddingTop: layoutSizes.gapSize}}>
      <InterfaceContextProvider>
         <ViewMainInfoComponent heading={mainInfoHeading} mdxContent={MDX.pages.ShowCases.Uncertainty_Vis} />
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
               {/* eslint-disable-next-line @next/next/no-img-element */}
              <UncertaintySvgComponent fileName="seasonal_uncertainty_cell.svg"/>
             </SGridPlotCard>
             <SGridPlotCard rowColSpan={[4,3]}  cardProps={generalCardPorps2}>
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <UncertaintySvgComponent fileName="seasonal_calibration_cell.svg"/>
             </SGridPlotCard>
            <SGridPlotCard rowColSpan={[5,6]}  cardProps={d3MapCardProps_overview}><LeafD3MapLayerComponent props={worldMapProsp}/></SGridPlotCard>
        </div>
      </InterfaceContextProvider>
      </main>
    </>
  );
}



function UncertaintySvgComponent({fileName}: {fileName: string}) {

  const contexT = useInterfaceContext();
  const rowID = contexT.dbRowID_of_selectedGridcellID;

  const [isLoading, setIsLoading] = useState(false);
  const initialSrc = rowID !== -1 ? apiRoutes.getUncertaintySvg({ filename: fileName, cellID: rowID }) : "";
  const [displayedSrc, setDisplayedSrc] = useState(initialSrc);
  const pendingRowID = useRef(rowID);
  const prevRowID = useRef(rowID);
  const loadKey = useRef(0);

  // Detect when a new cell is selected
  useEffect(() => {
    if (rowID !== prevRowID.current && rowID !== -1) {
      prevRowID.current = rowID;
      pendingRowID.current = rowID;
      loadKey.current += 1;  // invalidate any in-flight loads
      setIsLoading(true);
      console.log("rowID", rowID, "fileName", fileName);
    }
  }, [rowID]);

  const pendingSrc = (isLoading && rowID !== -1)
    ? apiRoutes.getUncertaintySvg({ filename: fileName, cellID: rowID })
    : "";

  // Capture the current key for the onLoad closure
  const currentKey = loadKey.current;

  return (
    <div className="relative w-full h-full">
      {/* Show current (or previous) image */}
      {displayedSrc && (
        <img
          src={displayedSrc}
          alt={fileName}
          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '8px' }}
          className={isLoading ? "opacity-40 transition-opacity duration-300" : "transition-opacity duration-300"}
        />
      )}

      {/* Preload new image (hidden) — swap in only if still the latest request */}
      {isLoading && pendingSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={currentKey}
          src={pendingSrc}
          alt=""
          className="hidden"
          onLoad={() => {
            if (loadKey.current === currentKey) {
              setDisplayedSrc(pendingSrc);
              setIsLoading(false);
            }
          }}
          onError={() => {
            if (loadKey.current === currentKey) {
              setIsLoading(false);
            }
          }}
        />
      )}

      {/* Loading spinner overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/30 backdrop-blur-[1px] z-10">
          <LoadingSpinner />
        </div>
      )}
    </div>
  );
}
