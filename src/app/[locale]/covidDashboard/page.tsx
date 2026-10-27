"use client";

import { useRef, useEffect } from 'react'
import { COVID_STATES_RELATION } from '@/app/covidStates';
import {apiRoutes } from "@/app/api_routes";
import { useRkiPreparation } from '@/app/hooks/useRkiPreparation';
import { InterfaceContextProvider, useInterfaceContext } from '@/components/contexts/InterfaceContext';
import LeafD3MapGermanyComponent, {LeafD3MapGermanyProps}  from '@/components/plots/maps/LeafD3MapGermanyCovid';
import CovidStateTable from '@/components/CovidStateTable';
import SGridPlotCard from '@/components/layout/SwapyGridPlotCard';
import { CardPropsClass } from '@/components/layout/CardWrapper';
import { createSwapy, Swapy } from 'swapy';
import BarchartComponent,{ BarchartProps } from '@/components/plots/barchart/barchart';
import { useLocale, useTranslations } from 'next-intl';
import { useGetJSONData } from '@/app/hooks/useFetchAndCache';
import { metaDataT } from '@/components/plots/MetaDataHandler';
import {ViewMainInfoComponent} from '@/components/ViewPageMainInfo';
import { useUIContext } from '@/components/contexts/UIContext';
import { t_richConfig } from '@/app/const_store';
import { MDXContentProvider } from '@messages/markdown/MDXContentProvider';
import { Locale } from '@/i18n/routing';


/**
 * Renders the supported Germany COVID-19 Vis. Interface using linked Leaflet, table, and bar-chart views.
 *
 * @returns Localized epidemiological Vis. Interface content.
 * @remarks Prepares the current RKI aggregate with a POST command before mounting
 * the linked views. A failed command leaves a retry action visible.
 */
export default function Home() {
  const UI_contextT = useUIContext();
  const t = useTranslations("page_covidDashboard");
  const locale = useLocale() as Locale;
  let md = MDXContentProvider[locale];
  let dataURL = apiRoutes.fetchDbData({ relationName: COVID_STATES_RELATION, feature: "" });
  const { status: aggregationStatus, error: aggregationError, retry: retryAggregation } = useRkiPreparation(true);

  const layoutSizes = UI_contextT.layoutDims;

  // set up the map props
  let mapPropsGermany = LeafD3MapGermanyProps();
  mapPropsGermany.chartName = 'map_germany';
  mapPropsGermany.mapDataURL = apiRoutes.FETCH_MAP_DATA.GERMANY_MAP_STATES;
  mapPropsGermany.dataURL = dataURL;
  mapPropsGermany.center = [51.5, 10.5];
  mapPropsGermany.zoom =6.4;
  mapPropsGermany.isApplySelectionsTransition = false;
  mapPropsGermany.mapUIsettings.isLongitudeSlider = false;
  mapPropsGermany.mapUIsettings.isLatitudeSlider = false;
  mapPropsGermany.mapUIsettings.isZoomSlider = false;
  mapPropsGermany.mapUIsettings.isColorMapSelectionDropdown = true;
  mapPropsGermany.mapUIsettings.isFeatureSelectionDropdown = true;
  mapPropsGermany.mapUIsettings.isDatasetSelectionDropdown = false;
  mapPropsGermany.mapUIsettings.isDistanceLegend = true;
  mapPropsGermany.mapUIsettings.isColorMapLegend = true;
  mapPropsGermany.mapUIsettings.isDatePicker = true;
  mapPropsGermany.mapUIsettings.defaultFeatureName = "accudeaths";
  mapPropsGermany.isProjection_equirectangular = false;
  mapPropsGermany.isStaticAutoFitFullSize = true;
  mapPropsGermany.isSetIntialContextDataFromComponent = true;

 

  let mapCardProps = CardPropsClass(
    "Map1",
    t.rich('mapCard.title', { ...t_richConfig })?.toString() || 'Germany Map View',
    t.rich('mapCard.description', { ...t_richConfig })?.toString() || '',
    ""
  );

  let covidDataStatesPpros = CardPropsClass(
    "Table1",
    t.rich('tableCard.title', { ...t_richConfig })?.toString() || 'Federal States Data Table',
    t.rich('tableCard.description', { ...t_richConfig })?.toString() || '',
    ""
  );

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
  return (
  <>
   <main className="flex max-h-fit flex-col items-center justify-between " style={{paddingTop: layoutSizes.gapSize}}>
    <InterfaceContextProvider>
      <ViewMainInfoComponent heading={t('mainInfo.heading')} mdxContent={md.pages.ShowCases.HistoricalDataCOVID} />

      {aggregationStatus === 'loading' && <p role="status" className="p-6">{t('preparing')}</p>}
      {aggregationStatus === 'error' && (
        <div role="alert" className="p-6">
          <p>{t('preparationError')}: {aggregationError}</p>
          <button type="button" className="mt-2 underline" onClick={retryAggregation}>{t('retry')}</button>
        </div>
      )}
      {aggregationStatus === 'ready' && <>
      {/*** START: grid layout ***/}
      <div ref={swapContainerRef} className={`w-full grid grid-cols-12 md:grid-cols-12 pl-0`} style={{
              gridTemplateRows: `repeat(auto-fill, minmax(${layoutSizes.rowSpanSize}vh, ${layoutSizes.rowSpanSize}vh))`,
              gap: `${layoutSizes.gapSize}px`,
              height: `calc(140vh - ${layoutSizes.topNavbarHeight}px - ${layoutSizes.gapSize*4}px)`,
                    paddingRight: `${layoutSizes.gapSize}px`,
             paddingLeft: `${layoutSizes.gapSize}px`,
      }}>

        {/*** Grid Cells ***/}
        <SGridPlotCard rowColSpan={[9,4]} cardProps={mapCardProps}> <LeafD3MapGermanyComponent props={mapPropsGermany}/> </SGridPlotCard>
        <SGridPlotCard rowColSpan={[5,8]} cardProps={covidDataStatesPpros}>
          <CovidStateTable cardProps={covidDataStatesPpros} />
        </SGridPlotCard>
       <DynamicBarChart featureRaw="accucasesperweek" />

       {/* <SGridPlotCard rowColSpan={[3,2]}  cardProps={CardPropsClass("Map2","Map2","","")}> <D3MapComponent D3MapPorps={mapPropsGermany}/> </SGridPlotCard>*/}
      </div>
      </>}
    </InterfaceContextProvider>
    </main>
    </>
  );
}

/**
 * Renders the COVID-19 state distribution for the active feature and date.
 *
 * @param featureRaw - Stable feature identifier used for the card and chart IDs.
 * @returns A bar-chart card linked to the map's current context selection.
 * @remarks Metadata labels are fetched through `useGetJSONData`. Changes to
 * `curFeature` or `targetDate` rebuild the aggregated database request.
 */
function DynamicBarChart({ featureRaw }: { featureRaw: string }) {
  let c = useInterfaceContext();
  const locale = useLocale();
  const t = useTranslations("covid_view_barchart");
  const tPage = useTranslations("page_covidDashboard");
  const [, rawMetaData] = useGetJSONData(apiRoutes.getDatasetsMetadata({ LANGID: locale }));

  const metaData = rawMetaData as unknown as metaDataT;

  const dataURL = apiRoutes.fetchDbData({ relationName: COVID_STATES_RELATION, feature: c.curFeature, targetDate: c.targetDate });
  const bchartProps = BarchartProps(featureRaw + "Barchart", dataURL, locale, t);

  const curFeatureMeta = metaData && c.curFeature ? metaData[c.curFeature] : undefined;

  const headline = c.curFeature 
    ? (curFeatureMeta?.description ? `${c.curFeature} - ${curFeatureMeta.description}` : c.curFeature)
    : (tPage.rich('barCard.title', { ...t_richConfig })?.toString() || 'Feature Distribution');

  const description = curFeatureMeta?.dimension 
    ? `${tPage.rich('barCard.description', { ...t_richConfig })?.toString() || ''} [${curFeatureMeta.dimension}]`.trim()
    : (tPage.rich('barCard.description', { ...t_richConfig })?.toString() || '');

  return (
    <>
      <SGridPlotCard rowColSpan={[4,8]} cardProps={CardPropsClass((featureRaw+"Barchart") || "Barchart", headline, description, "")}>
        <BarchartComponent chartProps={bchartProps}/>
      </SGridPlotCard>
    </>
  );
}
