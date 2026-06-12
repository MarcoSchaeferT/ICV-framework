
"use client";
import React, { use, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {interfaceContextI, useInterfaceContext} from '@/components/contexts/InterfaceContext';
import {PrintDataLoadingErrors, handleLoadDataError } from '@/app/helpers';
import {useGetJSONData} from '@/app/hooks/useFetchAndCache';

import SizeHook from '@/app/hooks/useResizeObserver';
import useChartResizer from '@/app/hooks/useChartResizer';


export interface ExampleChartProps {
    chartName: string;
    dataURL: string;
    exampleVar?: any;
}

export function ExampleChartProps(
    chartName: string,
    dataURL = "",
    exampleVar: any = null
): ExampleChartProps {
    return {
        chartName,
        dataURL,
        exampleVar
    };
}


const D3ExampleChartComponent = ({chartProps}: {chartProps: ExampleChartProps}) => {
   
  let props = chartProps;

  /********************
  * *** LOAD DATA *** *
  *********************/
  let collectDataLoadingErrors = [];
  const [isDataLoading, rawData] = useGetJSONData(props.dataURL);
  const data = rawData as any;
  collectDataLoadingErrors.push(handleLoadDataError(isDataLoading, data));

  /*************************
  * *** DETECT RESIZE *** *
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
          <PrintDataLoadingErrors listOfErrors={collectDataLoadingErrors}/>
          <SizeHook element={element} sizeRef={sizeRef} setSize={setSizes}/>
          <div className='flex h-full' id={props.chartName}></div>
      </>
  );

};

export default  D3ExampleChartComponent;
