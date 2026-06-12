/**
 * useMapLibreGridLayer – Renders grid-cell data as a MapLibre GL JS `fill` layer.
 *
 * Replaces useCanvasGridLayer.ts (Canvas 2D → toDataURL → L.imageOverlay).
 * All grid cells are rendered directly by the GPU via WebGL triangle tessellation.
 * Zero main-thread rasterization.
 *
 * Performance: eliminates ~15ms per frame of main-thread blocking (canvas.toDataURL).
 */
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { VisDataT, MapDimensions } from '../../types';
import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';

interface UseMapLibreGridLayerParams {
    map: MapLibreMap | null;
    /** Toggle to trigger re-render (typically toggled by the debounce hook) */
    isUpdate: boolean;
    /** Whether the source data is still loading */
    isLoading: boolean;
    /** Whether there was an error loading data */
    hasError: boolean;
    /** Parsed grid data */
    gridData: Map<number, VisDataT>;
    /** Container dimensions (unused by MapLibre but kept for API compat) */
    dimensions: MapDimensions;
    /** Color mapping function: feature value → CSS color string */
    colorMap: (value: number) => string;
    /** Current layer opacity (0–1) */
    layerOpacity: number;
    /** Transition duration in ms (unused by MapLibre — kept for API compat) */
    transitionDuration?: number;
    /** Enable debug logging */
    debug?: boolean;
}

const SOURCE_ID = 'grid-data-source';
const LAYER_ID = 'grid-fill-layer';

export function useMapLibreGridLayer({
    map,
    isUpdate,
    isLoading,
    hasError,
    gridData,
    dimensions,
    colorMap,
    layerOpacity,
    transitionDuration = 0,
    debug = false,
}: UseMapLibreGridLayerParams): void {
    const isSourceAdded = useRef(false);

    useEffect(() => {
        if (!map) return;
        if (isLoading || hasError || gridData.size === 0) return;
        if (!map.isStyleLoaded()) {
            // Wait for style to load before adding sources/layers
            const onStyleLoad = () => {
                addOrUpdateGridLayer();
            };
            map.once('style.load', onStyleLoad);
            return () => { map.off('style.load', onStyleLoad); };
        } else {
            addOrUpdateGridLayer();
        }

        function addOrUpdateGridLayer() {
            if (!map) return;

            // Convert Map<index, VisDataT> → GeoJSON FeatureCollection
            // Each grid cell becomes a Polygon feature with its value as a property
            const features: GeoJSON.Feature[] = [];
            let featureId = 0;

            for (const [key, d] of gridData) {
                if (!d.geometry || d.geometry.length < 4) continue;

                // Current geometry: [[lat, lng], ...] — convert to GeoJSON [lng, lat]
                const ring = d.geometry.map(([lat, lng]) => [lng, lat]);

                // Ensure ring is closed
                if (ring.length > 0 &&
                    (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
                    ring.push([...ring[0]]);
                }

                // Pre-compute the color string for this cell
                const fillColor = colorMap(Number(d.feature));

                features.push({
                    type: 'Feature',
                    id: featureId++,
                    properties: {
                        cellId: key,
                        value: Number(d.feature),
                        fillColor: fillColor,
                    },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [ring],
                    },
                });
            }

            const geojson: GeoJSON.FeatureCollection = {
                type: 'FeatureCollection',
                features,
            };

            if (debug) {
                console.log(`[useMapLibreGridLayer] ${features.length} grid cells → GeoJSON`);
            }

            // Update existing source or create new
            const existingSource = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
            if (existingSource) {
                existingSource.setData(geojson);
            } else {
                map.addSource(SOURCE_ID, {
                    type: 'geojson',
                    data: geojson,
                });
                isSourceAdded.current = true;
            }

            // Create layer if it doesn't exist
            if (!map.getLayer(LAYER_ID)) {
                map.addLayer({
                    id: LAYER_ID,
                    type: 'fill',
                    source: SOURCE_ID,
                    paint: {
                        // Use pre-computed color from properties
                        'fill-color': ['get', 'fillColor'],
                        'fill-opacity': layerOpacity,
                    },
                });
            } else {
                // Update opacity if changed
                map.setPaintProperty(LAYER_ID, 'fill-opacity', layerOpacity);
            }
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isUpdate, map]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (map && isSourceAdded.current) {
                try {
                    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
                    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
                } catch {
                    // Map may already be removed
                }
                isSourceAdded.current = false;
            }
        };
    }, [map]);
}
