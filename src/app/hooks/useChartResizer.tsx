import { useState, useEffect, useRef } from "react";


/**
 * Dynamic container resizing hook for ICV dashboard plot cards.
 *
 * Traverses up the DOM tree starting from an element with ID `chartName` until it locates the outer dashboard card container
 * (`.gridPlotCardContent`). Tracks element pixel width and height changes.
 *
 * @param chartName - DOM element ID string identifying the chart container.
 * @returns Object containing `dimensions` (`{ width, height }`), `setSizes` state dispatcher, parent `element` node, and mutable `sizeRef`.
 *
 * @remarks
 * **Card Resizer Pipeline:**
 * Combined with `<SizeHook />` (`src/app/hooks/useResizeObserver.tsx`), this hook allows visualization widgets (maps, bar charts, line plots)
 * to automatically resize when dashboard layout grid cards are resized or swapped by `swapy`.
 *
 * @see {@link SizeHook} for the accompanying ResizeObserver component helper.
 * @see {@link useMapResize} for debounced Leaflet size invalidation consuming these dimensions.
 * @see {@link LeafD3Map} for Leaflet map component consuming container resizes.
 *
 * @example
 * ```tsx
 * function HabitatMapWidget({ chartId }: { chartId: string }) {
 *   const { dimensions, setSizes, element, sizeRef } = useChartResizer(chartId);

 *   return (
 *     <div id={chartId} className="size-full">
 *       <SizeHook element={element} sizeRef={sizeRef} setSize={setSizes} />
 *       <LeafD3Map width={dimensions.width} height={dimensions.height} />
 *     </div>
 *   );
 * }
 * ```
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

/** Default export for the dashboard card-resizing hook. */
export default useChartResizer;

