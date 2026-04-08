"use client";

import { useRef, useEffect } from 'react'
import CovidDataStates from '../../components/dataTableClasses/CovidDataStates';
import {apiRoutes } from "../../api_routes";
import { InterfaceContextProvider, useInterfaceContext } from '../../components/contexts/InterfaceContext';
import LeafD3MapGermanyComponent, {LeafD3MapGermanyProps}  from '../../components/plots/maps/leafD3MapGermanyCovid';
import DataTableComponent from '../../components/dataTable';
import SGridPlotCard from '../../components/layout/swapy_gridPlotCard';
import { CardPropsClass } from '../../components/layout/cardWrapper';
import { createSwapy, Swapy } from 'swapy';
import BarchartComponent,{ BarchartPorps } from '@/app/components/plots/barchart/barchart';
import {LoadingSpinner} from '../../components/plots/maps/helpers';
import { useLocale, useTranslations } from 'next-intl';
import { useGetJSONData } from '@/app/hooks/customFetchAndCache';
import { metaDataT } from '@/app/components/plots/metaDataHandler';
import {ViewMainInfoComponent} from '../../components/viewPageMainInfo';
import { useUIContext } from '@/app/components/contexts/UIContext';
import { t_richConfig } from '@/app/const_store';
import { MDXContentProvider } from '../../../../messages/markdown/MDXContentProvider';
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
  let mapPropsGermany = new LeafD3MapGermanyProps();
  mapPropsGermany.chartName = 'map_germany';
  mapPropsGermany.mapDataURL = apiRoutes.FETCH_GERMANY_MAP;
  mapPropsGermany.dataURL = dataURL;
  mapPropsGermany.center = [51.5, 10.5];
  mapPropsGermany.zoom =6.4;
  mapPropsGermany.isApplySelectionsTransition = false;
  mapPropsGermany.mapUIsettings.isLongnitude_slider = false;
  mapPropsGermany.mapUIsettings.isLatitude_slider = false;
  mapPropsGermany.mapUIsettings.isZoom_slider = false;
  mapPropsGermany.mapUIsettings.isColorMapSelection_dropdown = true;
  mapPropsGermany.mapUIsettings.isFeatureSelection_dropdown = true;
  mapPropsGermany.mapUIsettings.isDatasetSelection_dropdown = false;
  mapPropsGermany.mapUIsettings.isDistance_legend = true;
  mapPropsGermany.mapUIsettings.isColorMap_legend = true;
  mapPropsGermany.isProjection_equirectangular = false;
  mapPropsGermany.isStaticAutoFitFullSize = true;

  let covidDataStatesPpros =  new CardPropsClass("Table1","","","");

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
        <SGridPlotCard rowColSpan={[9,4]}  cardProps={new CardPropsClass("Map1","","","")}> <LeafD3MapGermanyComponent props={mapPropsGermany}/> </SGridPlotCard>
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

       {/* <SGridPlotCard rowColSpan={[3,2]}  cardProps={new CardPropsClass("Map2","Map2","","")}> <D3MapComponent D3MapPorps={mapPropsGermany}/> </SGridPlotCard>*/}
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
  let dataSet = "covid_states_dat";

  let feature = featureRaw;
  const [isLoading_Metadata, rawMetaData] = useGetJSONData(apiRoutes.getDatasetsMetadata({ LANGID: locale }));

  const metaData = rawMetaData as unknown as metaDataT;

  if(dataSet === null || feature === null)   return (
  <SGridPlotCard rowColSpan={[4,8]} cardProps={new CardPropsClass(featureRaw+"Linechart",name,"asas","")}> <LoadingSpinner/></SGridPlotCard>);

  let dataURL = apiRoutes.fetchDbData({ relationName: dataSet, feature: c.curFeature });
  let bchartProps = new BarchartPorps("Barchart", dataURL , "exampleVar");

  bchartProps.chartName = feature+"Barchart";
  bchartProps.dataURL = dataURL;
  bchartProps.locale = locale;
  bchartProps.translations = t;
  //bchartProps.isDummyMode = true;

  let featureDescription = " ("+ metaData[c.curFeature]?.description + ")"|| "";

  return (
    <>
      <SGridPlotCard rowColSpan={[4,8]} cardProps={new CardPropsClass((featureRaw+"Barchart") || "NA", c.curFeature|| "NA", featureDescription|| "NA","","")}> <BarchartComponent ChartPorps={bchartProps}/></SGridPlotCard>
    </>
  );
}