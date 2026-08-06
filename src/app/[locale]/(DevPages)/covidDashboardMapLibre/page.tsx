"use client";

import { useRef, useEffect } from 'react'
import CovidDataStates from '@/components/dataTableClasses/CovidDataStates';
import {apiRoutes } from "@/app/api_routes";
import { InterfaceContextProvider, useInterfaceContext } from '@/components/contexts/InterfaceContext';
import dynamic from 'next/dynamic';
import { MapLibreGermanyMapProps } from '@/components/plots/maps/maplibre/MapLibreGermanyMap';
const MapLibreGermanyMap = dynamic(
    () => import('@/components/plots/maps/maplibre/MapLibreGermanyMap'),
    { 
        ssr: false, 
        loading: () => (
            <div className="flex items-center justify-center h-full w-full">
                <div className="w-16 h-16 border-4 border-t-4 border-gray-200 rounded-full border-t-blue-500 animate-spin"></div>
            </div>
        )
    }
);
import DataTableComponent from '@/components/DataTable';
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


const isSWAPY = true;

export default function Home() {
  const t = useTranslations("page_covidDashboard");
  const locale = useLocale() as Locale;
  let md = MDXContentProvider[locale];
  let c = useInterfaceContext();
  let dataSet = "covid_states_dat";
  let dataURL = apiRoutes.fetchDbData({ relationName: dataSet, feature: "" });

  const UI_contextT = useUIContext();
  const layoutSizes = UI_contextT.layoutDims;

  // set up the map props
  let mapPropsGermany = MapLibreGermanyMapProps();
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
  mapPropsGermany.isProjection_equirectangular = false;
  mapPropsGermany.isStaticAutoFitFullSize = true;

 

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

  // build the page
  return (
  <>
   <main className="flex max-h-fit flex-col items-center justify-between " style={{paddingTop: layoutSizes.gapSize}}>
    <InterfaceContextProvider>
      <ViewMainInfoComponent heading={t('mainInfo.heading')} mdxContent={md.pages.ShowCases.HistoricalDataCOVID} />

      {/*** START: grid layout ***/}
      <div ref={swapContainerRef} className={`w-full grid grid-cols-12 md:grid-cols-12 pl-0`} style={{
              gridTemplateRows: `repeat(auto-fill, minmax(${layoutSizes.rowSpanSize}vh, ${layoutSizes.rowSpanSize}vh))`,
              gap: `${layoutSizes.gapSize}px`,
              height: `calc(140vh - ${layoutSizes.topNavbarHeight}px - ${layoutSizes.gapSize*4}px)`,
                    paddingRight: `${layoutSizes.gapSize}px`,
             paddingLeft: `${layoutSizes.gapSize}px`,
      }}>

        {/*** Grid Cells ***/}
        <SGridPlotCard rowColSpan={[9,4]} cardProps={mapCardProps}> <MapLibreGermanyMap props={mapPropsGermany}/> </SGridPlotCard>
        <SGridPlotCard rowColSpan={[5,8]} cardProps={covidDataStatesPpros}>
          <DataTableComponent
          cardProps={covidDataStatesPpros}
          refDataTableClass={CovidDataStates}
          onClickEvent={(row,key, dataTableCONTEXT)=>{
              dataTableCONTEXT.setTableRow(row);
              let mapID = CovidDataStates.mapperFunctions.mapper__TableMap__ID_to_ID(Number(row["id"])+1)
              dataTableCONTEXT.setSelectedStateID(mapID);
            }
          }  />
        </SGridPlotCard>
       <DynamicBarChart featureRaw="accucasesperweek" name="accuCasesPerWeek "/>

       {/* <SGridPlotCard rowColSpan={[3,2]}  cardProps={CardPropsClass("Map2","Map2","","")}> <D3MapComponent D3MapPorps={mapPropsGermany}/> </SGridPlotCard>*/}
        {/*<div className={`${leftDataTableStyle}`}><CardWrapper headline={"Covid Data Districts"} component={<DataTableCovid constructor={CovidDataDistricts}  />} /></div>*/}
      </div>
    </InterfaceContextProvider>
    </main>
    </>
  );
}

function DynamicBarChart({ featureRaw, name }: { featureRaw: string, name: string }) {
  let c = useInterfaceContext();
  const locale = useLocale();
  const t = useTranslations("covid_view_barchart");
  const tPage = useTranslations("page_covidDashboard");
  let dataSet = "covid_states_dat";

  let feature = featureRaw;
  const [isLoading_Metadata, rawMetaData] = useGetJSONData(apiRoutes.getDatasetsMetadata({ LANGID: locale }));

  const metaData = rawMetaData as unknown as metaDataT;

  if(dataSet === null || feature === null)   return (
    <SGridPlotCard rowColSpan={[4,8]} cardProps={CardPropsClass(featureRaw+"Barchart", name, "", "")}> ERROR </SGridPlotCard>
  );

  let dataURL = apiRoutes.fetchDbData({ relationName: dataSet, feature: c.curFeature });
  let bchartProps = BarchartProps("Barchart", dataURL , "exampleVar");

  bchartProps.chartName = feature+"Barchart";
  bchartProps.dataURL = dataURL;
  bchartProps.locale = locale;
  bchartProps.translations = t;

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