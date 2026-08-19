import { useEffect } from 'react';
import * as d3 from 'd3';

/**
 * Parameters for the {@link useMapTransition} hook.
 *
 * @example
 * ```ts
 * const transition: UseMapTransitionParams = {
 *   map: null,
 *   L: null,
 *   isEnabled: true,
 *   selectionObj: {
 *     geometry: { type: "Point", coordinates: [13.405, 52.52] },
 *     properties: { country: "Germany" },
 *   },
 *   latitude: 52.52,
 *   longitude: 13.405,
 *   zoom: 6,
 *   duration: 1800,
 *   updateCoordinates: () => undefined,
 * };
 * ```
 */
export interface UseMapTransitionParams {
    /** Target Leaflet map instance */
    map: L.Map | null;
    /** Imported Leaflet module instance */
    L: typeof import('leaflet') | null;
    /** Flag to enable or bypass animated fly-to transitions */
    isEnabled: boolean;
    /** GeoJSON selection feature triggering the transition upon change */
    selectionObj: { geometry: GeoJSON.Geometry; properties: Record<string, any> };
    /** Current map viewport latitude in degrees */
    latitude: number;
    /** Current map viewport longitude in degrees */
    longitude: number;
    /** Current map zoom level */
    zoom: number;
    /** Transition animation duration in milliseconds (e.g. 1800 ms) */
    duration: number;
    /** Callback updating React coordinate state on each tween frame */
    updateCoordinates: (lat: number, lng: number, zoom: number) => void;
    /** Optional custom resolver returning the target center point for non-standard geometries */
    resolveCenter?: (selectionObj: any) => { lat: number; lng: number } | null;
    /** Optional hook triggered when transition starts (sets tile transition guards) */
    onTransitionStart?: () => void;
    /** Optional hook triggered when transition completes (fires clean tile redraws) */
    onTransitionEnd?: () => void;
}

/**
 * Animates camera `flyTo` spatial transitions using D3 interpolators and parabolic zoom curves.
 *
 * Linearly interpolates latitude and longitude coordinates while applying a parabolic easing curve
 * to zoom out at the animation midpoint and zoom back in at the target location.
 *
 * @param params - Configuration including map instance, selection object, duration, and transition callbacks.
 *
 * @remarks
 * Smooth camera movement across continental scale datasets requires continuous frame updates.
 * To prevent 60 fps main-thread tile redraw stalls during the tween, `onTransitionStart` sets `isTransitioningRef.current = true`
 * to return blank canvas tiles. A single clean redraw fires inside `onTransitionEnd`.
 *
 * @example
 * ```tsx
 * useMapTransition({
 *   map,
 *   L,
 *   isEnabled: true,
 *   selectionObj: countryFeature,
 *   latitude: 9.7,
 *   longitude: 52.0,
 *   zoom: 2,
 *   duration: 1800,
 *   updateCoordinates: (lat, lng, z) => setCoords({ lat, lng, zoom: z }),
 *   onTransitionStart: () => { gridTransitionRef.current = true; },
 *   onTransitionEnd: () => { gridTransitionRef.current = false; layer.redraw(); },
 * });
 * ```
 */
export function useMapTransition({
    map,
    L,
    isEnabled,
    selectionObj,
    latitude,
    longitude,
    zoom,
    duration,
    updateCoordinates,
    resolveCenter,
    onTransitionStart,
    onTransitionEnd,
}: UseMapTransitionParams): void {
    useEffect(() => {
        if (!map || !isEnabled) return;

        let curCenter: { lat: number; lng: number } | null = null;

        // Use custom resolver if provided, otherwise fall back to L.geoJSON bounds
        if (resolveCenter) {
            curCenter = resolveCenter(selectionObj);
        } else if (L) {
            const geometry = selectionObj.geometry;
            if (geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon') {
                curCenter = L.geoJSON(geometry as any).getBounds().getCenter();
            }
        }

        if (!curCenter || curCenter.lat === undefined || curCenter.lng === undefined) return;

        const svg = d3.select(map.getContainer()).select('svg');
        const interpolateLat = d3.interpolate(latitude, curCenter.lat);
        const interpolateLong = d3.interpolate(longitude, curCenter.lng);
        const interpolateZoom = d3.interpolate(zoom, zoom * 0.6);

        svg.transition()
            .duration(duration)
            .on('start', () => {
                onTransitionStart?.();
            })
            .on('end', () => {
                onTransitionEnd?.();
            })
            .tween('coordinates', () => (t) => {
                // Parabolic easing: zoom out at midpoint, zoom back in
                const prarbT = (x: number): number => x * x;
                const tnew = 1 - prarbT(t * 2 - 1.0);

                let newZoom: number;
                if (zoom > 0.1) {
                    newZoom = zoom; // Don't animate zoom for low zoom levels
                } else {
                    newZoom = interpolateZoom(tnew);
                }

                const newLat = interpolateLat(t);
                const newLong = interpolateLong(t);
                updateCoordinates(newLat, newLong, newZoom);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectionObj]);
}

