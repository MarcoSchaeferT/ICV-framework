/**
 * useMapLibreResize – Calls map.resize() when container dimensions change.
 *
 * Replaces useMapResize.ts (Leaflet variant).
 * Uses a debounce timer to avoid rapid resize calls.
 */
import { useEffect, useRef } from 'react';
import type { MapDimensions } from '../../types';
import type { Map as MapLibreMap } from 'maplibre-gl';

interface UseMapLibreResizeParams {
    map: MapLibreMap | null;
    dimensions: MapDimensions;
}

export function useMapLibreResize({ map, dimensions }: UseMapLibreResizeParams): void {
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!map) return;
        if (dimensions.width && dimensions.height) {
            if (timer.current !== null) {
                clearTimeout(timer.current);
            }
            timer.current = setTimeout(() => {
                map.resize();
            }, 100);
        }
    }, [dimensions, map]);
}
