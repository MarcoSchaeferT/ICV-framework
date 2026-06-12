/**
 * useMapResize – Calls map.invalidateSize() when container dimensions change.
 *
 * Uses a debounce timer to avoid rapid invalidateSize calls during resize.
 */
import { useEffect, useRef } from 'react';
import type { MapDimensions } from '../types';

interface UseMapResizeParams {
    map: L.Map | null;
    dimensions: MapDimensions;
}

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
