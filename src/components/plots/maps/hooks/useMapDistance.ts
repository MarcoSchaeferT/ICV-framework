import { useEffect } from 'react';
import * as d3 from 'd3';
import type { MapDimensions } from '../types';

/**
 * Factory function returning a fresh D3 geographical projection instance.
 *
 * @example
 * ```ts
 * const projectionFactory: GeoProjectionFactory = () => d3.geoEquirectangular();
 * ```
 */
export type GeoProjectionFactory = () => d3.GeoProjection;

/**
 * Parameters for the {@link useMapDistance} hook.
 *
 * @example
 * ```ts
 * const params: UseMapDistanceParams = {
 *   map: null,
 *   longitude: 13.405,
 *   latitude: 52.52,
 *   zoom: 6,
 *   dimensions: { width: 960, height: 640 },
 *   screenDistanceOneKMRef: { current: 0 },
 * };
 * ```
 */
export interface UseMapDistanceParams {
    /** Target Leaflet map instance */
    map: L.Map | null;
    /** Viewport center longitude in degrees */
    longitude: number;
    /** Viewport center latitude in degrees */
    latitude: number;
    /** Map zoom level */
    zoom: number;
    /** Map container pixel width and height */
    dimensions: MapDimensions;
    /** Mutable ref storing the calculated pixels-per-kilometer scale ratio */
    screenDistanceOneKMRef: React.MutableRefObject<number>;
    /**
     * Optional D3 geo projection factory function.
     * @default `d3.geoEquirectangular`
     */
    projectionFactory?: GeoProjectionFactory;
    /** Additional react dependencies triggering scale updates */
    extraDeps?: unknown[];
}

/**
 * Calculates on-screen pixel length corresponding to 1 kilometer using D3 spatial projections.
 *
 * Computes pixels per kilometer based on latitude displacement ($1^\circ \text{ lat} \approx 111.321\text{ km}$)
 * and writes the result into `screenDistanceOneKMRef` without triggering component re-renders.
 *
 * @param params - Configuration containing viewport coordinates, zoom, container dimensions, and output ref.
 *
 * @remarks
 * Imperial and metric scale bar legends (`scale-bar` / `LatLngZoomLegend`) require live physical ground distance mappings.
 * Writing directly to a React mutable ref allows D3 SVG scale bar drawing code to query pixel ratios at 60 fps without
 * invoking React component state setters.
 *
 * @example
 * ```tsx
 * const distRef = useRef<number>(0);
 * useMapDistance({
 *   map,
 *   longitude: 13.405,
 *   latitude: 52.52,
 *   zoom: 6,
 *   dimensions: { width: 800, height: 600 },
 *   screenDistanceOneKMRef: distRef,
 * });
 * ```
 */
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

