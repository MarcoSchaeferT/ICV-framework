
import React, { use, useEffect, useMemo } from 'react';


// modified version of: https://www.npmjs.com/package/@react-hook/resize-observer
import useResizeObserver from "@react-hook/resize-observer";
import { useDebounceCallback } from "@react-hook/debounce";

/**
 * Pixel dimensions structure returned by resize observers.
 *
 * @example
 * ```ts
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
 * Internal helper hook listening to DOM element `ResizeObserver` events.
 *
 * @param element - Target DOM HTMLElement to observe.
 * @returns Element size object matching {@link Size}, or undefined if element is null.
 *
 * @see {@link useSizeWatchDebounced} for debounced observer variant.
 * @see {@link SizeHook} for React component wrapper.
 */
const useSizeWatch = (element: HTMLElement | null): Size | undefined => {
    const [size, setSize] = React.useState<Size>();

    React.useLayoutEffect(() => {
        if (element) {
            setSize(element.getBoundingClientRect());
        }
    }, [element]);

    useResizeObserver(element, (entry) => setSize(entry.contentRect));

    return size;
};


/**
 * Debounced `ResizeObserver` hook for tracking DOM element dimensions with 1000 ms delay.
 *
 * @param element - Target DOM HTMLElement to observe.
 * @returns Element size object matching {@link Size}, or undefined if element is null.
 *
 * @see {@link useSizeWatch} for synchronous observer variant.
 * @see {@link useChartResizer} for plot card resizing pipeline integration.
 */
export const useSizeWatchDebounced = (element: HTMLElement | null): Size | undefined => {
    const [size, setSize] = React.useState<Size>();

    const onResize = useDebounceCallback(setSize, 1000);

    useEffect(() => {
        if (element) {
            setSize(element.getBoundingClientRect());
        }
    }, [element]);

    useResizeObserver(element, (entry) => onResize(entry.contentRect));

    return size;
};


/**
 * React Component observer bridge pairing with {@link useChartResizer}.
 *
 * Attaches a `ResizeObserver` to the parent `.gridPlotCardContent` element and dispatches dimension updates
 * to the parent component state.
 *
 * @param props - Object containing target `element`, mutable `sizeRef`, and `setSize` dispatcher.
 * @returns An empty React fragment `<></>`.
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
 * <SizeHook element={element} sizeRef={sizeRef} setSize={setSizes} />
 * ```
 */
const SizeHook = ({element, sizeRef, setSize}: {element: HTMLElement | null, sizeRef: any, setSize: any})  => {

    sizeRef.current = useSizeWatch(element);

    useEffect(() => {
        sizeRef.current = sizeRef.current
        setSize(sizeRef.current);
    });

    return(<></>);

};

/** Default export for the ResizeObserver bridge used by dashboard visualizations. */
export default SizeHook;
