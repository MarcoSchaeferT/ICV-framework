/**
 * useMapLibreTransition – Animates a fly-to transition using MapLibre's
 * native flyTo() method.
 *
 * Replaces useMapTransition.ts (Leaflet variant that used D3 tweening).
 * MapLibre has built-in flyTo with configurable easing, eliminating the
 * need for D3 SVG transition hacks.
 */
import { useEffect } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';

interface UseMapLibreTransitionParams {
    map: MapLibreMap | null;
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
    /** Callback to update coordinates during/after the transition */
    updateCoordinates: (lat: number, lng: number, zoom: number) => void;
    /** Optional: function to resolve the fly-to center */
    resolveCenter?: (selectionObj: any) => { lat: number; lng: number } | null;
    /** Optional: callback on transition start */
    onTransitionStart?: () => void;
    /** Optional: callback on transition end */
    onTransitionEnd?: () => void;
}

export function useMapLibreTransition({
    map,
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
}: UseMapLibreTransitionParams): void {
    useEffect(() => {
        if (!map || !isEnabled) return;

        let curCenter: { lat: number; lng: number } | null = null;

        // Use custom resolver if provided
        if (resolveCenter) {
            curCenter = resolveCenter(selectionObj);
        } else {
            // Fallback: compute center from geometry bounds
            const geometry = selectionObj.geometry;
            if (geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon') {
                const coords = geometry.type === 'Polygon'
                    ? geometry.coordinates[0]
                    : geometry.coordinates.flat(2);

                if (coords && coords.length > 0) {
                    let sumLat = 0, sumLng = 0;
                    const flatCoords = geometry.type === 'Polygon'
                        ? geometry.coordinates[0]
                        : geometry.coordinates.flatMap(p => p[0]);

                    for (const coord of flatCoords) {
                        sumLng += coord[0];
                        sumLat += coord[1];
                    }
                    curCenter = {
                        lat: sumLat / flatCoords.length,
                        lng: sumLng / flatCoords.length,
                    };
                }
            }
        }

        if (!curCenter || curCenter.lat === undefined || curCenter.lng === undefined) return;

        // Parabolic easing: zoom out at midpoint, zoom back in
        // Replicates the D3 tween behavior from the Leaflet version
        const parabolicEasing = (t: number): number => {
            // Zoom out then back in: 1 - (2t - 1)^2
            return 1 - Math.pow(2 * t - 1, 2);
        };

        onTransitionStart?.();

        // Use MapLibre's native flyTo – eliminates D3 SVG tween entirely
        map.flyTo({
            center: [curCenter.lng, curCenter.lat],
            zoom: zoom < 3.2 ? zoom : zoom * 0.6,
            duration,
            essential: true, // Not affected by prefers-reduced-motion
        });

        // Listen for transition end
        const handleMoveEnd = () => {
            const center = map.getCenter();
            const newZoom = map.getZoom();
            updateCoordinates(center.lat, center.lng, newZoom);
            onTransitionEnd?.();
            map.off('moveend', handleMoveEnd);
        };

        map.once('moveend', handleMoveEnd);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectionObj]);
}
