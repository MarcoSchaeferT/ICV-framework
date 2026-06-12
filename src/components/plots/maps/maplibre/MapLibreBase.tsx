/**
 * MapLibreBase – SSR-safe MapLibre GL JS container component.
 *
 * Replaces BaseMap.tsx (Leaflet MapContainer wrapper).
 * Uses single-initialization pattern with deterministic cleanup
 * to prevent WebGL context memory leaks.
 *
 * MUST be imported via next/dynamic with ssr: false at the page level.
 */
'use client';
import React, { useEffect, useRef, useCallback } from 'react';
import type { Map as MapLibreMap, MapOptions } from 'maplibre-gl';

export interface MapLibreBaseProps {
    /** Unique ID for the map container div */
    chartName: string;
    /** Center coordinates [longitude, latitude] – MapLibre convention */
    center: [number, number];
    /** Initial zoom level */
    zoom: number;
    /** Ref to expose the MapLibre map instance to parent components */
    mapRef: React.MutableRefObject<MapLibreMap | null>;
    /** Callback fired once the map is fully loaded and ready */
    onMapReady?: (map: MapLibreMap) => void;
    /** Whether to use equirectangular projection (handled via coordinate reprojection) */
    isProjection_equirectangular?: boolean;
    /** Optional inline styles for the container */
    style?: React.CSSProperties;
    /** Optional CSS class for the container */
    className?: string;
    /** Children rendered inside the map container (overlays, legends, etc.) */
    children?: React.ReactNode;
    /** Optional: Disable scroll wheel zoom */
    scrollWheelZoom?: boolean;
    /** Optional: Disable double click zoom */
    doubleClickZoom?: boolean;
    /** Optional: Disable dragging */
    dragging?: boolean;
    /** Background color when no tiles are loaded */
    backgroundColor?: string;
}

const MapLibreBase: React.FC<MapLibreBaseProps> = ({
    chartName,
    center,
    zoom,
    mapRef,
    onMapReady,
    isProjection_equirectangular = false,
    style,
    className = 'size-full absolute z-0',
    children,
    scrollWheelZoom = true,
    doubleClickZoom = false,
    dragging = true,
    backgroundColor = '#ffffff',
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const isInitialized = useRef(false);

    useEffect(() => {
        if (isInitialized.current || !containerRef.current) return;
        isInitialized.current = true;

        let map: MapLibreMap;

        import('maplibre-gl').then((maplibregl) => {
            // Import CSS for proper rendering
            import('maplibre-gl/dist/maplibre-gl.css');

            map = new maplibregl.Map({
                container: containerRef.current!,
                // Empty style – tileless rendering (current behavior preserved)
                style: {
                    version: 8,
                    sources: {},
                    layers: [
                        {
                            id: 'background',
                            type: 'background',
                            paint: {
                                'background-color': backgroundColor,
                            },
                        },
                    ],
                },
                center: center, // [lng, lat]
                zoom: zoom,
                attributionControl: false,
                // Interaction controls
                scrollZoom: scrollWheelZoom,
                doubleClickZoom: doubleClickZoom,
                dragPan: dragging,
                dragRotate: false, // 2D map only
                pitchWithRotate: false,
                touchZoomRotate: true,
                // Fine-grained zoom
                // MapLibre doesn't have zoomDelta/zoomSnap like Leaflet,
                // but scrollZoom can be configured after init
            });

            mapRef.current = map;

            map.on('load', () => {
                onMapReady?.(map);
            });
        });

        // CRITICAL: Deterministic cleanup prevents WebGL context + event listener leaks
        return () => {
            if (map) {
                map.remove(); // Destroys WebGL context, removes all event listeners
                mapRef.current = null;
            }
            isInitialized.current = false;
        };
    }, []); // Empty deps – mount once, never re-initialize

    return (
        <div
            ref={containerRef}
            id={chartName}
            className={className}
            style={{ backgroundColor, ...style }}
        >
            {children}
        </div>
    );
};

export default MapLibreBase;
