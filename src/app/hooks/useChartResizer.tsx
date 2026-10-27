import { useState, useRef, useCallback, useSyncExternalStore } from "react";


/**
 * Dynamic container resizing hook for ICV Vis. Interface plot cards.
 *
 * Traverses up the DOM tree starting from an element with ID `chartName` until it locates the outer Vis. Interface card container
 * (`.gridPlotCardContent`). Tracks element pixel width and height changes.
 *
 * @param chartName - DOM element ID string identifying the chart container.
 * @returns Object containing `dimensions` (`{ width, height }`), `setSizes` state dispatcher, parent `element` node, and mutable `sizeRef`.
 *
 * @remarks
 * **Card Resizer Pipeline:**
 * Combined with `<SizeHook />` (`src/app/hooks/useResizeObserver.tsx`), this hook allows visualization widgets (maps, bar charts, line plots)
 * to automatically resize when Vis. Interface layout grid cards are resized or swapped by `swapy`.
 *
 * @see {@link SizeHook} for the accompanying ResizeObserver component helper.
 * @see {@link useMapResize} for debounced Leaflet size invalidation consuming these dimensions.
 * @see {@link LeafD3MapLayerProps} for the Leaflet layer contract consuming container resizes.
 *
 * @example
 * ```tsx
 * import { useChartResizer, SizeHook } from "@/framework";
 *
 * function HabitatMapCard() {
 *   const { dimensions, setSizes, element, sizeRef } = useChartResizer("habitat-map");
 *   return (
 *     <div className="gridPlotCardContent">
 *       <div id="habitat-map">
 *         <SizeHook element={element} sizeRef={sizeRef} setSize={setSizes} />
 *         <span>{dimensions.width} × {dimensions.height} px</span>
 *       </div>
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
   const sizeRef= useRef<{ width: number; height: number } | undefined>(undefined);

  const getContainer = useCallback((): HTMLElement | null => {
    if (!chartName) return null;
    let element: HTMLElement | null = document.getElementById(chartName);
    while (element && !element.classList.contains("gridPlotCardContent")) {
      element = element.parentElement;
    }
    return element;
  }, [chartName]);

  const subscribe = useCallback((onStoreChange: () => void) => {
    if (getContainer()) return () => {};
    const observer = new MutationObserver(() => {
      if (getContainer()) {
        observer.disconnect();
        onStoreChange();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [getContainer]);

  const element = useSyncExternalStore(subscribe, getContainer, () => null);
  return {dimensions, setSizes, element, sizeRef };
};

/** Default export for the Vis. Interface card-resizing hook. */
export default useChartResizer;

