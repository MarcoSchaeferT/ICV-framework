import { useEffect } from 'react';
import { CALCER } from '../constants';

/**
 * Parameters for the {@link useMapPosition} hook.
 *
 * @example
 * ```ts
 * import type { UseMapPositionParams } from "@/framework";
 *
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
 * Compares Leaflet's current center and zoom with target values after rounding
 * the current view to reduce redundant updates.
 *
 * @param params - Configuration containing map instance, latitude, longitude, and zoom.
 *
 * @remarks
 * Skips `setView()` while Leaflet reports an active drag or zoom animation.
 * Center coordinates are rounded using `CALCER`, and zoom to two decimal
 * places, before exact comparison with the requested values.
 *
 * @example
 * ```tsx
 * import { useMap } from "react-leaflet";
 * import { useMapPosition } from "@/framework";
 *
 * function MapPositionSync() {
 *   const map = useMap();
 *   useMapPosition({ map, latitude: 52.52, longitude: 13.405, zoom: 6 });
 *   return null;
 * }
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

