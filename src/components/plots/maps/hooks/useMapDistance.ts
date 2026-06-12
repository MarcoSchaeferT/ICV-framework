/**
 * useMapDistance – Calculates the on-screen pixel distance of 1 km
 * using a configurable D3 geo projection.
 *
 * The projection factory is passed as a parameter so callers can choose
 * between e.g. `d3.geoEquirectangular`, `d3.geoMercator`, etc.
 * Defaults to `d3.geoEquirectangular` if not provided.
 *
 * The result is stored in the provided ref so imperative drawing code
 * can access it without triggering additional renders.
 */
import { useEffect } from 'react';
import * as d3 from 'd3';
import type { MapDimensions } from '../types';

/** Factory function that returns a fresh D3 geo projection instance */
type GeoProjectionFactory = () => d3.GeoProjection;

interface UseMapDistanceParams {
    map: L.Map | null;
    longitude: number;
    latitude: number;
    zoom: number;
    dimensions: MapDimensions;
    /** Mutable ref where the computed pixels-per-km value is stored */
    screenDistanceOneKMRef: React.MutableRefObject<number>;
    /**
     * D3 geo projection factory (e.g. `d3.geoEquirectangular`, `d3.geoMercator`).
     * Called on every recalculation to obtain a fresh, unconfigured projection.
     * Defaults to `d3.geoEquirectangular`.
     */
    projectionFactory?: GeoProjectionFactory;
    /** Additional dependency values that should trigger recalculation */
    extraDeps?: unknown[];
}

export function useMapDistance({
    map,
    longitude,
    latitude,
    zoom,
    dimensions,
    screenDistanceOneKMRef,
    projectionFactory = d3.geoEquirectangular,
    extraDeps = [],
}: UseMapDistanceParams): void {
    useEffect(() => {
        if (!map) return;

        const projection = projectionFactory()
            .center([longitude, latitude])
            .scale((dimensions.width / (2 * Math.PI)) * Math.pow(2, zoom))
            .translate([dimensions.width / 2, dimensions.height / 2]);

        // 1 degree latitude ≈ 111.321 km
        const point1 = projection([0, 0]) || [0, 0];
        const point2 = projection([0, 1]) || [0, 0];
        const distanceInPixels = Math.abs(point2[1] - point1[1]) / 111.321;

        screenDistanceOneKMRef.current = distanceInPixels;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoom, map, ...extraDeps]);
}
