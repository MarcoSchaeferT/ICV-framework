
import React from 'react';


// modified version of: https://www.npmjs.com/package/@react-hook/resize-observer
import useResizeObserver from "@react-hook/resize-observer";
import { useDebounceCallback } from "@react-hook/debounce";

/**
 * Pixel dimensions structure returned by resize observers.
 *
 * @example
 * ```ts
 * import type { Size } from "@/framework";
 *
 * const mapCardSize: Size = { width: 960, height: 640 };
 * ```
 */
export interface Size {
    /** Width in pixels */
    width: number;
    /** Height in pixels */
    height: number;
}

/**
 * Debounced `ResizeObserver` hook for tracking DOM element dimensions with 1000 ms delay.
 *
 * @param element - Target DOM HTMLElement to observe.
 * @returns The most recently observed size, or `undefined` before the first
 * debounced observation (including when `element` is null).
 *
 * @see {@link useChartResizer} for plot card resizing pipeline integration.
 */
export const useSizeWatchDebounced = (element: HTMLElement | null): Size | undefined => {
    const [size, setSize] = React.useState<Size>();

    const onResize = useDebounceCallback(setSize, 1000);

    useResizeObserver(element, (entry) => onResize(entry.contentRect));

    return size;
};


/**
 * React Component observer bridge pairing with {@link useChartResizer}.
 *
 * Observes the supplied element and dispatches dimension updates to parent state.
 *
 * @param props - Object containing target `element`, mutable `sizeRef`, and `setSize` dispatcher.
 * @returns `null`; the component renders no visible element.
 *
 * @remarks
 * Rendered side-by-side with plot elements inside grid card components. Modifies `sizeRef.current` and invokes `setSize`
 * whenever container bounds change.
 *
 * @see {@link useChartResizer} for the primary container resizer hook.
 * @see {@link useMapResize} for debounced Leaflet map viewport invalidation.
 *
 * @example
 * ```tsx
 * import { SizeHook, useChartResizer } from "@/framework";
 *
 * function ObservedCard() {
 *   const { dimensions, element, sizeRef, setSizes } = useChartResizer("observed-card");
 *   return (
 *     <div className="gridPlotCardContent">
 *       <SizeHook element={element} sizeRef={sizeRef} setSize={setSizes} />
 *       <div id="observed-card">Width: {dimensions.width}px</div>
 *     </div>
 *   );
 * }
 * ```
 */
const SizeHook = ({
    element,
    sizeRef,
    setSize,
}: {
    element: HTMLElement | null;
    sizeRef: React.MutableRefObject<Size | undefined>;
    setSize: React.Dispatch<React.SetStateAction<Size>>;
}) => {
    const handleResize = React.useCallback((entry: ResizeObserverEntry) => {
        const nextSize = {
            width: entry.contentRect.width,
            height: entry.contentRect.height,
        };
        const previousSize = sizeRef.current;

        if (
            previousSize?.width === nextSize.width &&
            previousSize?.height === nextSize.height
        ) {
            return;
        }

        sizeRef.current = nextSize;
        setSize(nextSize);
    }, [setSize, sizeRef]);

    useResizeObserver(element, handleResize);
    return null;
};

/** Default export for the ResizeObserver bridge used by Vis. Interface visualizations. */
export default SizeHook;
