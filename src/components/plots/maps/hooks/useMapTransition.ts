/**
 * useMapTransition – Animates a fly-to transition using D3 tweening.
 *
 * Uses a parabolic easing curve for zoom (zoom out then back in) while
 * linearly interpolating lat/lng.
 */
import { useEffect } from 'react';
import * as d3 from 'd3';

interface UseMapTransitionParams {
    map: L.Map | null;
    L: typeof import('leaflet') | null;
    /** Whether transitions are enabled for this component instance */
    isEnabled: boolean;
    /** The selection/feature object that triggers a transition when it changes */
    selectionObj: { geometry: GeoJSON.Geometry; properties: Record<string, any> };
    /** Current map coordinates */
    latitude: number;
    longitude: number;
    zoom: number;
    /** Duration of the transition in ms */
    duration: number;
    /** Callback to update coordinates during the tween */
    updateCoordinates: (lat: number, lng: number, zoom: number) => void;
    /** Optional: function to resolve the fly-to center (for world map variant) */
    resolveCenter?: (selectionObj: any) => { lat: number; lng: number } | null;
    /** Optional: callback on transition start */
    onTransitionStart?: () => void;
    /** Optional: callback on transition end */
    onTransitionEnd?: () => void;
}

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
