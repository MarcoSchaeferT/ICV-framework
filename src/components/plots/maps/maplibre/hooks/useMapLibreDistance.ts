/**
 * useMapLibreDistance – Calculates the on-screen pixel distance of 1 km
 * using MapLibre's native coordinate projection.
 *
 * Replaces useMapDistance.ts (Leaflet variant that used D3 geo projections).
 * Uses map.project() for direct coordinate→pixel conversion.
 */
import { useEffect } from 'react';
import type { MapDimensions } from '../../types';
import type { Map as MapLibreMap } from 'maplibre-gl';

interface UseMapLibreDistanceParams {
    map: MapLibreMap | null;
    longitude: number;
    latitude: number;
    zoom: number;
    dimensions: MapDimensions;
    /** Mutable ref where the computed pixels-per-km value is stored */
    screenDistanceOneKMRef: React.MutableRefObject<number>;
    /** Additional dependency values that should trigger recalculation */
    extraDeps?: unknown[];
}

export function useMapLibreDistance({
    map,
    longitude,
    latitude,
    zoom,
    dimensions,
    screenDistanceOneKMRef,
    extraDeps = [],
}: UseMapLibreDistanceParams): void {
    useEffect(() => {
        if (!map) return;

        // Use MapLibre's native project() for coordinate → pixel conversion
        // 1 degree latitude ≈ 111.321 km
        // We measure the pixel distance of (1 / 111.321) degrees ≈ 1 km
        const oneKmInDegrees = 1 / 111.321;

        const point1 = map.project([longitude, latitude]);
        const point2 = map.project([longitude, latitude + oneKmInDegrees]);

        const distanceInPixels = Math.abs(point2.y - point1.y);
        screenDistanceOneKMRef.current = distanceInPixels;

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoom, map, ...extraDeps]);
}
