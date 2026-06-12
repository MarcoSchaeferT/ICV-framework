/**
 * useMapLibrePresenceLayer – Renders presence data points as a MapLibre GL JS
 * circle layer with data-driven radius and color.
 *
 * Replaces the D3 SVG circle overlay from LeafD3Map.tsx DrawPresenceData.
 * All circles are rendered on the GPU via WebGL — zero DOM overhead.
 */
import { useEffect, useRef } from 'react';
import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';

const PRESENCE_SOURCE = 'presence-data-source';
const PRESENCE_LAYER = 'presence-circle-layer';

interface PresenceDataPoint {
    geometry: [number, number]; // [lat, lng]
    feature: string | number;
    country_name?: string;
    subregion_name?: string;
}

interface UseMapLibrePresenceLayerParams {
    map: MapLibreMap | null;
    mapReady: boolean;
    /** Whether presence data should be shown */
    isEnabled: boolean;
    /** Whether data is still loading */
    isLoading: boolean;
    /** Parsed presence data points */
    presenceData: PresenceDataPoint[];
    /** Color for presence dots (CSS color string or function) */
    presenceColor: string;
    /** Color map function for data-driven coloring */
    colorMap?: (value: number) => string;
    /** Layer opacity */
    opacity?: number;
    /** Circle radius in pixels */
    radius?: number;
    /** Whether to use data-driven radius based on feature value */
    dataDrivenRadius?: boolean;
    /** Max feature value for normalizing circle sizes */
    maxFeaturePerCountry?: Record<string, number>;
}

export function useMapLibrePresenceLayer({
    map,
    mapReady,
    isEnabled,
    isLoading,
    presenceData,
    presenceColor,
    colorMap,
    opacity = 0.8,
    radius = 5,
    dataDrivenRadius = false,
    maxFeaturePerCountry,
}: UseMapLibrePresenceLayerParams): void {
    const isSourceAdded = useRef(false);

    useEffect(() => {
        if (!map || !mapReady) return;

        // If not enabled, remove layer
        if (!isEnabled || isLoading || presenceData.length === 0) {
            cleanupLayers();
            return;
        }

        // Convert presence data to GeoJSON
        const features: GeoJSON.Feature[] = presenceData.map((d, i) => {
            const [lat, lng] = d.geometry;
            const featureVal = typeof d.feature === 'string' ? parseFloat(d.feature) : d.feature;
            const color = colorMap ? colorMap(featureVal) : presenceColor;

            return {
                type: 'Feature',
                id: i,
                properties: {
                    value: featureVal,
                    fillColor: color,
                    country_name: d.country_name || '',
                    subregion_name: d.subregion_name || '',
                },
                geometry: {
                    type: 'Point',
                    coordinates: [lng, lat], // GeoJSON: [lng, lat]
                },
            };
        });

        const geojson: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features,
        };

        // Add or update source
        const existingSource = map.getSource(PRESENCE_SOURCE) as GeoJSONSource | undefined;
        if (existingSource) {
            existingSource.setData(geojson);
        } else {
            map.addSource(PRESENCE_SOURCE, {
                type: 'geojson',
                data: geojson,
            });
            isSourceAdded.current = true;
        }

        // Create or update layer
        if (!map.getLayer(PRESENCE_LAYER)) {
            map.addLayer({
                id: PRESENCE_LAYER,
                type: 'circle',
                source: PRESENCE_SOURCE,
                paint: {
                    'circle-color': ['get', 'fillColor'],
                    'circle-radius': dataDrivenRadius
                        ? [
                            'interpolate', ['linear'],
                            ['get', 'value'],
                            0, 3,
                            100, radius,
                            1000, radius * 2,
                          ]
                        : radius,
                    'circle-opacity': opacity,
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#000000',
                    'circle-stroke-opacity': 0.3,
                },
            });
        } else {
            // Update paint properties if layer exists
            map.setPaintProperty(PRESENCE_LAYER, 'circle-opacity', opacity);
            map.setPaintProperty(PRESENCE_LAYER, 'circle-color', ['get', 'fillColor']);
        }

        function cleanupLayers() {
            if (!map) return;
            try {
                if (map.getLayer(PRESENCE_LAYER)) map.removeLayer(PRESENCE_LAYER);
                if (map.getSource(PRESENCE_SOURCE)) map.removeSource(PRESENCE_SOURCE);
            } catch { /* map may already be removed */ }
            isSourceAdded.current = false;
        }

        return cleanupLayers;
    }, [map, mapReady, isEnabled, isLoading, presenceData, presenceColor, colorMap, opacity, radius, dataDrivenRadius]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (map && isSourceAdded.current) {
                try {
                    if (map.getLayer(PRESENCE_LAYER)) map.removeLayer(PRESENCE_LAYER);
                    if (map.getSource(PRESENCE_SOURCE)) map.removeSource(PRESENCE_SOURCE);
                } catch { /* ignore */ }
                isSourceAdded.current = false;
            }
        };
    }, [map]);
}
