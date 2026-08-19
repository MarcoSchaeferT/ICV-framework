import { useEffect, useRef } from 'react';
import type { MapDimensions } from '../types';

/**
 * Parameters for the {@link useMapResize} hook.
 *
 * @example
 * ```ts
 * const resize: UseMapResizeParams = {
 *   map: null,
 *   dimensions: { width: 960, height: 640 },
 * };
 * ```
 */
export interface UseMapResizeParams {
    /** Target Leaflet map instance */
    map: L.Map | null;
    /** Current container dimensions containing width and height in pixels */
    dimensions: MapDimensions;
}

/**
 * Recalculates Leaflet map viewport dimensions when container dimensions change.
 *
 * Employs a 100 ms debounce timer to coalesce rapid resize events (e.g. window resizing or grid card dragging)
 * before calling `map.invalidateSize()`.
 *
 * @param params - Object containing Leaflet map instance and container dimensions.
 *
 * @remarks
 * Calling `map.invalidateSize()` synchronously on every resize event causes main-thread frame drops,
 * SVG layout reflows, and canvas tile flickering. Debouncing by 100 ms ensures smooth grid card resizing
 * across multi-view dashboard layouts.
 *
 * @example
 * ```tsx
 * const { dimensions } = useChartResizer("habitat-map");
 * useMapResize({ map, dimensions });
 * ```
 */
export function useMapResize({ map, dimensions }: UseMapResizeParams): void {
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!map) return;
        if (dimensions.width && dimensions.height) {
            if (timer.current !== null) {
                clearTimeout(timer.current);
            }
            timer.current = setTimeout(() => {
                map.invalidateSize();
            }, 100);
        }
    }, [dimensions, map]);
}

