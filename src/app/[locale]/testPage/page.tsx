"use client";

import { useRef, useEffect, useState } from 'react'
import CovidDataStates from '../../components/dataTableClasses/CovidDataStates';
import CovidDataDistricts from '../../components/dataTableClasses/CovidDataDistricts';
import {apiRoutes } from "../../api_routes";
import { InterfaceContextProvider, useInterfaceContext, interfaceContextI } from '../../components/contexts/InterfaceContext';
import LeafD3MapLayerComponent, {LeafD3MapLayerProps}  from '../../components/plots/maps/leafD3Map';
import LeafD3MapGermanyComponent, {LeafD3MapGermanyProps}  from '../../components/plots/maps/leafD3MapGermanyCovid';
import DataTableComponent from '../../components/dataTable';
import SGridPlotCard from '../../components/layout/swapy_gridPlotCard';
import { CardPropsClass } from '../../components/layout/cardWrapper';
import { createSwapy, Swapy } from 'swapy';

// chart imports
import D3ExampleChartComponent, { ExampleChartPorps } from '@/app/components/plots/templates/plotTemplate';
import BarchartComponent, {BarchartPorps} from '../../components/plots/barchart/barchart';
import LinechartComponent, {LinechartPorps} from '@/app/components/plots/linechart/linechart';
import PieChartComponent, {PieChartPorps} from '@/app/components/plots/piechart/piechart';
import { useUIContext } from '@/app/components/contexts/UIContext';


const isSWAPY = true;

export default function Home() {

 const UI_contextT = useUIContext();
 const layoutSizes = UI_contextT.layoutDims;

  // set up the map props
  let dataSet = "covid_states_dat";
  let feature = "accucasesperweek";
  let dataURL = apiRoutes.fetchDbData({ relationName: dataSet, feature: "" });
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
  mapPropsGermany.mapUIsettings.isFeatureSelection_dropdown = false;
  mapPropsGermany.mapUIsettings.isDatasetSelection_dropdown = false;
  mapPropsGermany.mapUIsettings.isDistance_legend = true;
  mapPropsGermany.mapUIsettings.isColorMap_legend = true;
  mapPropsGermany.isProjection_equirectangular = false;
  mapPropsGermany.isStaticAutoFitFullSize = true;


  let mapPropsGermany2 = new LeafD3MapGermanyProps();
  mapPropsGermany2.chartName = 'map_germany2';
  mapPropsGermany2.mapDataURL = apiRoutes.FETCH_GERMANY_MAP;
  mapPropsGermany2.dataURL = dataURL;
  mapPropsGermany2.center = [51.5, 10.5];
  mapPropsGermany2.zoom =6.4;
  mapPropsGermany2.isApplySelectionsTransition = false;
  mapPropsGermany2.mapUIsettings.isLongnitude_slider = false;
  mapPropsGermany2.mapUIsettings.isLatitude_slider = false;
  mapPropsGermany2.mapUIsettings.isZoom_slider = false;
  mapPropsGermany2.mapUIsettings.isColorMapSelection_dropdown = false;
  mapPropsGermany2.mapUIsettings.isFeatureSelection_dropdown = false;
  mapPropsGermany2.mapUIsettings.isDatasetSelection_dropdown = false;
  mapPropsGermany2.mapUIsettings.isDistance_legend = false;
  mapPropsGermany2.mapUIsettings.isColorMap_legend = false;
  mapPropsGermany2.isProjection_equirectangular = true;
  mapPropsGermany2.isStaticAutoFitFullSize = true;
  
  
  let mapPropsWorld = new LeafD3MapLayerProps();
  mapPropsWorld.chartName = 'map_World';
  mapPropsWorld.dataURL = apiRoutes.FETCH_WORLD_MAP;
  mapPropsWorld.center = [11, 52.3];
  mapPropsWorld.zoom = 0.4;
  mapPropsWorld.isApplyContextData = false;
  mapPropsWorld.isProjection_equirectangular = true;
  let covidDataStatesPpros =  new CardPropsClass("Table1","","","");

  let d3ExampleProps1 = new ExampleChartPorps("Example1", apiRoutes.getDatasetsMetadata({ LANGID: "en" }), "exampleVar1");
  let d3ExampleProps2 = new ExampleChartPorps("Example2", apiRoutes.getDatasetsMetadata({ LANGID: "en" }), "exampleVar2");
  let d3ExampleProps3 = new ExampleChartPorps("Example3", apiRoutes.getDatasetsMetadata({ LANGID: "en" }), "exampleVar3");
  let d3ExampleProps4 = new ExampleChartPorps("Example4", apiRoutes.getDatasetsMetadata({ LANGID: "en" }), "exampleVar4");
  let d3ExampleProps5 = new ExampleChartPorps("Example5", apiRoutes.getDatasetsMetadata({ LANGID: "en" }), "exampleVar5");
  let BarchartProps6 = new BarchartPorps("Example6", "apiRoutes.GET_DATASETS_METADATA", "","", true);
  let LinechartProps1 = new LinechartPorps("Linechart1", "A", "exampleVar1");
  LinechartProps1.isDummyMode = true;

  let PieChartProps1 = new PieChartPorps("Piechart1", [], "exampleVar1");
  PieChartProps1.data = [
    { name: "Group A", value: 400 },
    { name: "Group B", value: 300 },
    { name: "Group C", value: 300 },
    { name: "Group D", value: 200 },
  ];
  PieChartProps1.isDummyMode = false;

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
    

  
  // build the page
  return (
  <>
    <main className="flex max-h-fit flex-col items-center justify-between p-4">
    <InterfaceContextProvider>
      <HandleLinking />
      {/*** START: grid layout ***/}
      <div ref={swapContainerRef} className={`w-full grid grid-cols-12 md:grid-cols-12 pl-0`} style={{
              gridTemplateRows: `repeat(auto-fill, minmax(${layoutSizes.rowSpanSize}vh, ${layoutSizes.rowSpanSize}vh))`,
              gap: `${layoutSizes.gapSize}px`,
              height: '200vh',
             
             paddingRight: `${layoutSizes.gapSize}px`,
             paddingLeft: `${layoutSizes.gapSize}px`,
      }}>

        {/*** Grid Cells ***/}
         <SGridPlotCard rowColSpan={[6,6]} cardProps={new CardPropsClass("piechart1","Heading","Sub Heading","Footer")}> <PieChartComponent ChartProps={PieChartProps1} /> 
        </SGridPlotCard>
        <SGridPlotCard rowColSpan={[2,2]} cardProps={new CardPropsClass("Plot1","","","")}> <D3ExampleChartComponent ChartPorps={d3ExampleProps4}/> </SGridPlotCard>
        <SGridPlotCard rowColSpan={[2,3]} cardProps={new CardPropsClass("Plot1.1","","","")}> <D3ExampleChartComponent ChartPorps={d3ExampleProps1}/> </SGridPlotCard>
        <SGridPlotCard rowColSpan={[4,5]}  cardProps={new CardPropsClass("Map2","Map2","","")}> <LeafD3MapLayerComponent props={mapPropsWorld}/> </SGridPlotCard>
       <SGridPlotCard rowColSpan={[4,2]}  cardProps={new CardPropsClass("Map1","","","")}> <LeafD3MapGermanyComponent props={mapPropsGermany2}/> </SGridPlotCard>
        <SGridPlotCard rowColSpan={[2,3]} cardProps={new CardPropsClass("Plot2","","","")}> <D3ExampleChartComponent ChartPorps={d3ExampleProps2}/> </SGridPlotCard>
        <SGridPlotCard rowColSpan={[2,2]} cardProps={new CardPropsClass("Plot3","","","")}> <D3ExampleChartComponent ChartPorps={d3ExampleProps3}/> </SGridPlotCard>
        <SGridPlotCard rowColSpan={[4,4]}  cardProps={new CardPropsClass("Map3","","","")}> <LeafD3MapGermanyComponent props={mapPropsGermany}/> </SGridPlotCard>
        <SGridPlotCard rowColSpan={[4,8]} cardProps={covidDataStatesPpros}>
          <DataTableComponent
          cardProps={covidDataStatesPpros}
          refDataTableClass={CovidDataStates}
          onClickEvent={(row,id, dataTableCONTEXT)=>{
              dataTableCONTEXT.setTableRow(row);
            }
          }  />
        </SGridPlotCard>
        <SGridPlotCard rowColSpan={[2,12]} cardProps={new CardPropsClass("Plot4","Heading","Sub Heading","Footer")}> <D3ExampleChartComponent ChartPorps={d3ExampleProps5}/> </SGridPlotCard>

        
        <SGridPlotCard rowColSpan={[4,6]} cardProps={new CardPropsClass("Plot5","Heading","Sub Heading","Footer")}> <BarchartComponent ChartPorps={BarchartProps6} /> 
        </SGridPlotCard>
        <SGridPlotCard rowColSpan={[4,6]} cardProps={new CardPropsClass("linechart1","Heading","Sub Heading","Footer")}> <LinechartComponent ChartPorps={LinechartProps1} /> 
        </SGridPlotCard>
         

        {/*<div className={`${leftDataTableStyle}`}><CardWrapper headline={"Covid Data Districts"} component={<DataTableCovid constructor={CovidDataDistricts}  />} /></div>*/}
      </div>
    </InterfaceContextProvider>
    </main>
    <div/>
    </>
  );
}

function HandleLinking() {
  let c = useInterfaceContext();
  useEffect(() => {
    if(c.selectedTableName === "CovidDataStates") {
      let selBundesland = CovidDataStates.getStateBundesland(c.selectedTableRow);
      let stateId = CovidDataStates.mapperFunctions.Map__State_to_ID(selBundesland);
      c.setSelectedStateID(stateId);
    }
  }, [c.selectedTableRow, c.selectedTableName]);
  return(
    <>
    </>
    );
}