import { useState, useEffect, useRef } from "react";


/**
 * Custom hook to manage the resizing of a chart component.
 *
 * @param {string} chartName - The name of the chart element to be resized.
 * @returns {Object} - An object containing the current size of the chart, a function to set the size, and the parent element/grid card of the chart.
 * @property {Object} aSize - The current size of the chart with width and height properties.
 * @property {Function} setSizes - Function to update the size of the chart (handled by SizeHook).
 * @property {HTMLElement | null} element - The parent element/grid card of the chart.
 *
 * @remarks
 * useage:  let {dimensions, setSizes, element, sizeRef } = useChartResizer(props.chartName);
 *          dimensions = dimensions || { width: 0, height: 0 };
 *
 * It is necessary to set the following line in the return of the plot component at the same level as the chart element/div:
 * `<SizeHook element={element} sizeRef={sizeRef} setSize={setSizes}/>`
 *  use "import SizeHook from '../resizer/resizeObserver';"
 */
const useChartResizer = (chartName: string) => {
  
  /*************************
  * **** RESIZER BLOCK *** *
  **************************/
   const [dimensions, setSizes] = useState({ width: 0, height: 0 });
   const [element, setElement] = useState<HTMLElement | null>(null);
   const sizeRef= useRef<{ width: number; height: number } | undefined>(undefined);

  // watch and get the parent div dimensions
  useEffect(() => {
    if (!chartName) return;
    let element = document.getElementById(chartName);
    while (element && element.classList && !element.classList.contains("gridPlotCardContent")) {
      element = element.parentNode as HTMLElement;
    }
    if (element instanceof HTMLElement) {
      setElement(element);
    }
  }, [chartName]);
  return {dimensions, setSizes, element, sizeRef };
};

export default useChartResizer;
