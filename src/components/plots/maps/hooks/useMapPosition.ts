/**
 * useMapPosition – Syncs React coordinate state → with Leaflet map view.
 *
 * Only calls map.setView when the React state has actually diverged
 * from the current Leaflet center/zoom (prevents feedback loops).
 */
import { useEffect } from 'react';
import { CALCER } from '../constants';

interface UseMapPositionParams {
    map: L.Map | null;
    latitude: number;
    longitude: number;
    zoom: number;
}

export function useMapPosition({ map, latitude, longitude, zoom }: UseMapPositionParams): void {
    useEffect(() => {
        if (!map) return;

        const currentCenterLat = Math.round(map.getCenter().lat * CALCER) / CALCER;
        const currentCenterLng = Math.round(map.getCenter().lng * CALCER) / CALCER;
        const currentZoom = Math.round(map.getZoom() * 100) / 100;

        if (currentCenterLat !== latitude || currentCenterLng !== longitude || currentZoom !== zoom) {
            map.setView([latitude, longitude], zoom);
        }
    }, [latitude, longitude, zoom, map]);
}
