import { useEffect, useRef } from 'react';
import type { MapDimensions } from '../types';

/**
 * Parameters for the {@link useMapResize} hook.
 *
 * @example
 * ```ts
 * import type { UseMapResizeParams } from "@/framework";
 *
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
 * The timer starts only for non-zero dimensions and is replaced on subsequent
 * dimension changes. It does not measure the container itself.
 *
 * @example
 * ```tsx
 * import { useMap } from "react-leaflet";
 * import { useMapResize, type MapDimensions } from "@/framework";
 *
 * // Render below a React-Leaflet MapContainer with dimensions from the card.
 * function MapResizeSync({ dimensions }: { dimensions: MapDimensions }) {
 *   const map = useMap();
 *   useMapResize({ map, dimensions });
 *   return null;
 * }
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

