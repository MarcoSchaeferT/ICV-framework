/**
 * useMapLibrePosition – Syncs React coordinate state → MapLibre map view.
 *
 * Replaces useMapPosition.ts (Leaflet variant).
 * Only calls map.jumpTo when React state has actually diverged
 * from the current MapLibre center/zoom (prevents feedback loops).
 */
import { useEffect } from 'react';
import { CALCER } from '../../constants';
import type { Map as MapLibreMap } from 'maplibre-gl';

interface UseMapLibrePositionParams {
    map: MapLibreMap | null;
    latitude: number;
    longitude: number;
    zoom: number;
}

export function useMapLibrePosition({ map, latitude, longitude, zoom }: UseMapLibrePositionParams): void {
    useEffect(() => {
        if (!map) return;

        const center = map.getCenter();
        const currentCenterLat = Math.round(center.lat * CALCER) / CALCER;
        const currentCenterLng = Math.round(center.lng * CALCER) / CALCER;
        const currentZoom = Math.round(map.getZoom() * 100) / 100;

        if (currentCenterLat !== latitude || currentCenterLng !== longitude || currentZoom !== zoom) {
            // MapLibre uses [lng, lat] order (GeoJSON convention)
            map.jumpTo({
                center: [longitude, latitude],
                zoom,
            });
        }
    }, [latitude, longitude, zoom, map]);
}
