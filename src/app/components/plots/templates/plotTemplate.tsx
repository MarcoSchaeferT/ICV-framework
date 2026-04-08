
"use client";
import React, { use, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {interfaceContextI, useInterfaceContext} from '../../contexts/InterfaceContext';
import {PrintDataLoadingERRORs, handleLoadDataERROR } from '../../../helpers';
import {useGetJSONData} from '../../../hooks/customFetchAndCache';

import SizeHook from '../../../hooks/resizeObserver';
import useChartResizer from '../../../hooks/customPlotHooks';


class ExampleChartPorps {
    chartName: string
    dataURL: any; // or you can use a more specific type like GeoJSON.FeatureCollection if you have the type definitions
    exampleVar: any;

    constructor(chartName: string, dataURL: string, exampleVar?: any) {
        this.chartName = chartName;
        this.dataURL = dataURL || null;
        this.exampleVar = null;
    }
}


const D3ExampleChartComponent = ({ChartPorps}: {ChartPorps: ExampleChartPorps}) => {
   
  let props = ChartPorps;

  /********************
  * *** LOAD DATA *** *
  *********************/
  let collectDataLoadingEROORS = [];
  const [isDataLoading, rawData] = useGetJSONData(props.dataURL);
  const data = rawData as any;
  collectDataLoadingEROORS.push(handleLoadDataERROR(isDataLoading, data));

  /*************************
  * *** DECTECT REZISE *** *
  **************************/
  let {dimensions, setSizes, element, sizeRef } = useChartResizer(props.chartName);
  dimensions = dimensions || { width: 0, height: 0 };
  
  /******************************
  * *** THE PLOT DEFINITION *** *
  *******************************/
  useEffect(() => {

    // remove the old svg
    d3.select("#"+props.chartName).select("svg").remove();

    // set the dimensions and margins of the graph
    let margin = { top: 0, right: 0, bottom: 0, left: 0};
    let width = dimensions.width - margin.left - margin.right;
    let height = dimensions.height - margin.top - margin.bottom;

    // add new svg
    let svg = d3.select("#" + props.chartName)
    .append("svg")
    .attr("width", width )
    .attr("height", height )
    .append("g")
    .attr("transform",
        "translate(" + margin.left + "," + margin.top + ")");
    
    // plot content
    svg.append("text")
    .attr("x", width / 2)
    .attr("y", height / 2)
    .attr("text-anchor", "middle")
    .text("Example D3 SVG");

    svg.append("text")
    .attr("x", width / 2 )
    .attr("y", height / 2 + 20)
    .attr("text-anchor", "middle")
    .text("x: " + Math.round(width) + " y: " + Math.round(height))

    svg.append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "none")
    .attr("stroke", "black")
    .attr("stroke-width", 5);
    }, [dimensions, props.chartName]);



  /**************************
  * *** PAGE DEFINITION *** *
  ***************************/
  return (
      <>
          <PrintDataLoadingERRORs listOfERRORs={collectDataLoadingEROORS}/>
          <SizeHook element={element} sizeRef={sizeRef} setSize={setSizes}/>
          <div className='flex h-full' id={props.chartName}></div>
      </>
  );

};

export default  D3ExampleChartComponent;
export { ExampleChartPorps };
