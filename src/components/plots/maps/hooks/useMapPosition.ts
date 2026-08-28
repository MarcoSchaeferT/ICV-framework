import { useEffect } from 'react';
import { CALCER } from '../constants';

/**
 * Parameters for the {@link useMapPosition} hook.
 *
 * @example
 * ```ts
 * const berlinViewport: UseMapPositionParams = {
 *   map: null,
 *   latitude: 52.52,
 *   longitude: 13.405,
 *   zoom: 6,
 * };
 * ```
 */
export interface UseMapPositionParams {
    /** Target Leaflet map instance */
    map: L.Map | null;
    /** Target viewport latitude coordinate in degrees */
    latitude: number;
    /** Target viewport longitude coordinate in degrees */
    longitude: number;
    /** Target map zoom level */
    zoom: number;
}

/**
 * Synchronizes React viewport coordinate state with a Leaflet map instance.
 *
 * Compares current Leaflet center and zoom against target state values using fixed-precision
 * rounding (`CALCER`) to eliminate feedback loops between Leaflet move events and React state updates.
 *
 * @param params - Configuration containing map instance, latitude, longitude, and zoom.
 *
 * @remarks
 * Uncontrolled calls to `map.setView()` on every render cycle cause severe map canvas tearing
 * and recursive event dispatch loops. This hook performs precision checks prior to calling
 * `map.setView()`, ensuring Leaflet re-centers only when coordinates meaningfully diverge.
 *
 * @example
 * ```tsx
 * const map = useMap();
 * useMapPosition({ map, latitude: 52.52, longitude: 13.405, zoom: 6 });
 * ```
 */
export function useMapPosition({ map, latitude, longitude, zoom }: UseMapPositionParams): void {
    useEffect(() => {
        if (!map) return;

        // If the map is currently animating zoom, zooming, or being dragged by the user,
        // do not call map.setView() — it would abort the user's gesture!
        const isInteracting =
            (map as any)._animatingZoom ||
            (map as any)._zooming ||
            Boolean(map.dragging && (map.dragging as any)._draggable && (map.dragging as any)._draggable._moving);

        if (isInteracting) return;

        const currentCenterLat = Math.round(map.getCenter().lat * CALCER) / CALCER;
        const currentCenterLng = Math.round(map.getCenter().lng * CALCER) / CALCER;
        const currentZoom = Math.round(map.getZoom() * 100) / 100;

        if (currentCenterLat !== latitude || currentCenterLng !== longitude || currentZoom !== zoom) {
            map.setView([latitude, longitude], zoom);
        }
    }, [latitude, longitude, zoom, map]);
}

