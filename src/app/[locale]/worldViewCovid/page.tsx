
"use client";

import { useRef, useEffect } from 'react'
import {apiRoutes } from "@/app/api_routes";
import { InterfaceContextProvider } from '@/components/contexts/InterfaceContext';
import { useRkiPreparation } from '@/app/hooks/useRkiPreparation';
import SGridPlotCard from '@/components/layout/SwapyGridPlotCard';
import { CardPropsClass } from '@/components/layout/CardWrapper';
import LeafD3MapLayerComponent, {LeafD3MapLayerProps}  from '@/components/plots/maps/LeafD3Map';
import { availableColorMapsNames } from '@/components/plots/maps/constants';
import { createSwapy, Swapy } from 'swapy';
import { useTranslations, useLocale } from "next-intl";
import { t_richConfig } from "@/app/const_store";
import { useUIContext } from '@/components/contexts/UIContext';
import { ViewMainInfoComponent } from '@/components/ViewPageMainInfo';
import { MDXContentProvider } from '@messages/markdown/MDXContentProvider';
import { Locale } from '@/i18n/routing';

/**
 * Renders the world COVID-19 linked-view Vis. Interface.
 *
 * @returns Localized world map and companion analytical cards.
 * @remarks Requests the RKI state aggregate before mounting the maps.
 * If preparation fails, the maps remain available with a warning and their
 * existing fallback for Germany values.
 */
export default function Home() {
  const UI_contextT = useUIContext();
  const t = useTranslations("page_covidWorldView");
  const locale = useLocale() as Locale;
  let md = MDXContentProvider[locale];
  const { status: aggregationStatus, error: aggregationError, retry: retryAggregation } = useRkiPreparation(true);

  const layoutSizes = UI_contextT.layoutDims;

  // set up the map props
  let worldMapProsp = LeafD3MapLayerProps();
  let p1 = worldMapProsp;
  p1.chartName = 'map_World';
  p1.dataURL = apiRoutes.FETCH_MAP_DATA.WORLD_MAP;
  //p1.center = [15.3,-17 ];
  //p1.zoom = 7.6;
  p1.center = [20, 14];
  p1.zoom = 2;
  p1.mapUIsettings.isLongitudeSlider = false;
  p1.mapUIsettings.isLatitudeSlider = false;
  p1.mapUIsettings.isZoomSlider = false;
  p1.mapUIsettings.isColorMapSelectionDropdown = true;
  p1.mapUIsettings.isFeatureSelectionDropdown = true;
  p1.mapUIsettings.isDatasetSelectionDropdown = true;
  p1.mapUIsettings.isDistanceLegend = true;
  p1.mapUIsettings.isColorMapLegend = true;
  p1.mapUIsettings.isCountrySelectionDropdown = true;
  p1.mapUIsettings.isDatePicker = true;
  p1.isStaticAutoFitFullSize = false;
  p1.isApplyContextData = false;
  p1.isProjection_equirectangular = true;
  p1.mapUIsettings.filterStringForAvailableDatasetInclude = "epi";
  p1.mapUIsettings.defaultDatasetName = "epidemiology_geography_whole_df_w_geometry";
  p1.mapUIsettings.inCovidDataView = true;
  p1.isApplyTransitions = true;
  p1.mapUIsettings.isSequenceMetaData = false;
  p1.mapUIsettings.defaultFeatureColorMap = availableColorMapsNames.interpolateInferno;
  p1.mapDataSets.isGridData = false;
  p1.mapDataSets.isSequenceMetaData = false;
  p1.mapUIsettings.defaultFeatureName = "cumulative_confirmed";
  p1.isSetIntialContextDataFromComponent = true;
  p1.mapUIsettings.dataFilteringCheckboxes = false;
  p1.mapDataSets.isCityNames = false;
  // Overview map (zoom=2 < 4) => country-level data
  p1.mapUIsettings.isCountryLevelData = true;
  p1.mapUIsettings.isSubregionLevelData = false;
  p1.mapStyles.backgroundColor = "rgb(215, 234, 245)";


  let mapPropsWorld2 = LeafD3MapLayerProps();
  let p2 = mapPropsWorld2;
  p2.chartName = 'map_World2';
  p2.dataURL = apiRoutes.FETCH_MAP_DATA.WORLD_MAP;
  p2.center = [-20, -60];
  p2.zoom = 3.1;
  p2.mapUIsettings.isLongitudeSlider = true;
  p2.mapUIsettings.isLatitudeSlider = true;
  p2.mapUIsettings.isZoomSlider = true;
  p2.mapUIsettings.isColorMapSelectionDropdown = false;
  p2.mapUIsettings.isFeatureSelectionDropdown = false;
  p2.mapUIsettings.isDatasetSelectionDropdown = false;
  p2.mapUIsettings.isDistanceLegend = true;
  p2.mapUIsettings.isColorMapLegend = true;
  p2.mapUIsettings.isCountrySelectionDropdown = false;
  p2.mapUIsettings.isDatePicker = false;
  p2.mapUIsettings.filterStringForAvailableDatasetInclude = p1.mapUIsettings.filterStringForAvailableDatasetInclude;
  p2.mapUIsettings.defaultDatasetName = p1.mapUIsettings.defaultDatasetName;
  p2.isStaticAutoFitFullSize = false;
  p2.isProjection_equirectangular = true;
  p2.isApplyContextData = true;
  p2.mapUIsettings.inCovidDataView = true;
  p2.isApplyTransitions = true;
  p2.mapUIsettings.isSequenceMetaData = false;
  p2.mapUIsettings.defaultFeatureColorMap = availableColorMapsNames.interpolateInferno;
  p2.mapDataSets.isGridData = false;
  p2.mapDataSets.isSequenceMetaData = false;
  p2.mapUIsettings.defaultFeatureName = "cumulative_confirmed";
  p2.mapDataSets.isCityNames = false;
  // Detail map (zoom=4.4 >= 4) => subregion-level data
  p2.mapUIsettings.isCountryLevelData = false;
  p2.mapUIsettings.isSubregionLevelData = true;
  p2.mapStyles.backgroundColor = "rgb(215, 234, 245)";
  p2.mapUIsettings.areSettingsOpen = false;




   // set up swapy (client side only)
     const swapyRef = useRef<Swapy | null>(null)
     const swapContainerRef = useRef<HTMLDivElement>(null)
     useEffect(() => {
       const container =swapContainerRef.current;
       console.log("container", container)
       if (container) {
         swapyRef.current = createSwapy(container,{
           animation: 'dynamic', // dynamic or spring or none
           manualSwap: false,
           swapMode: 'hover', //'hover' | 'drop';;
           autoScrollOnDrag: true,
           // dragAxis: 'x',
           // dragOnHold: true
         })
         swapyRef.current.enable(true)
   
         return () => {
           // Destroy the swapy instance on component destroy
           swapyRef.current?.destroy()
         }
       };
     }, [aggregationStatus]);
  

  // build the page
 
    let d3MapCardProps_overview = CardPropsClass(
      t.rich('headingOverview', {...t_richConfig})?.toString() || '',
      t.rich('headingOverview', {...t_richConfig})?.toString() || '',"","");
    let d3MapCardProps2_overveiwDetail = CardPropsClass(
      t.rich('headingDetailView', {...t_richConfig})?.toString() || '',
      t.rich('headingDetailView', {...t_richConfig})?.toString() || '',"","");

    return (
    <>
      <main className="flex max-h-fit flex-col items-center justify-between " style={{paddingTop: layoutSizes.gapSize}}>
      <InterfaceContextProvider>
      <ViewMainInfoComponent heading={t('mainInfo.heading')} mdxContent={md.pages.CovidWorldView.mainInfo} />
        {aggregationStatus === 'loading' && <p role="status" className="p-6">{t('preparing')}</p>}
        {aggregationStatus === 'error' && (
          <div role="alert" className="p-6">
            <p>{t('preparationError')}: {aggregationError}</p>
            <button type="button" className="mt-2 underline" onClick={retryAggregation}>{t('retry')}</button>
          </div>
        )}
        {aggregationStatus !== 'loading' && <>
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
        </>}
      </InterfaceContextProvider>
      </main>
    </>
  );
}

