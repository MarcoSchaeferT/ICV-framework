/**
 * useMapLibreCapitals – Renders capital city markers and labels as MapLibre
 * symbol + circle layers.
 *
 * Replaces MapDrawLayer_Captials from LeafD3Map.tsx using L.circleMarker + L.divIcon.
 * All rendering is GPU-accelerated via WebGL.
 */
import { useEffect, useRef } from 'react';
import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';
import type * as GEOjson from 'geojson';

const CAPITALS_SOURCE = 'capitals-source';
const CAPITALS_CIRCLE_LAYER = 'capitals-circles';
const CAPITALS_LABEL_LAYER = 'capitals-labels';

interface UseMapLibreCapitalsParams {
    map: MapLibreMap | null;
    mapReady: boolean;
    capitalsData: GEOjson.FeatureCollection | null;
    isLoading: boolean;
    isEnabled: boolean;
    locale: string;
    /** Zoom level above which labels are shown */
    labelZoomThreshold?: number;
}

export function useMapLibreCapitals({
    map,
    mapReady,
    capitalsData,
    isLoading,
    isEnabled,
    locale,
    labelZoomThreshold = 3.9,
}: UseMapLibreCapitalsParams): void {
    const isSourceAdded = useRef(false);

    useEffect(() => {
        if (!map || !mapReady || isLoading || !isEnabled || !capitalsData?.features?.length) {
            return;
        }

        // Transform features to include localized title
        const processedData: GEOjson.FeatureCollection = {
            type: 'FeatureCollection',
            features: capitalsData.features
                .filter(f => {
                    const coords = (f.geometry as GEOjson.Point)?.coordinates;
                    return Array.isArray(coords) && coords.length >= 2 &&
                        Number.isFinite(coords[0]) && Number.isFinite(coords[1]);
                })
                .map((f, i) => ({
                    ...f,
                    id: i,
                    properties: {
                        ...f.properties,
                        localizedTitle: (f.properties as any)?.title?.[locale] ||
                                       (f.properties as any)?.title?.en || '',
                    },
                })),
        };

        // Add or update source
        const existingSource = map.getSource(CAPITALS_SOURCE) as GeoJSONSource | undefined;
        if (existingSource) {
            existingSource.setData(processedData);
        } else {
            map.addSource(CAPITALS_SOURCE, {
                type: 'geojson',
                data: processedData,
            });
            isSourceAdded.current = true;
        }

        // Circle markers
        if (!map.getLayer(CAPITALS_CIRCLE_LAYER)) {
            map.addLayer({
                id: CAPITALS_CIRCLE_LAYER,
                type: 'circle',
                source: CAPITALS_SOURCE,
                paint: {
                    'circle-radius': 3,
                    'circle-color': '#000000',
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#000000',
                },
            });
        }

        // Text labels (visible above zoom threshold)
        if (!map.getLayer(CAPITALS_LABEL_LAYER)) {
            map.addLayer({
                id: CAPITALS_LABEL_LAYER,
                type: 'symbol',
                source: CAPITALS_SOURCE,
                layout: {
                    'text-field': ['get', 'localizedTitle'],
                    'text-size': 12,
                    'text-offset': [0.5, 0],
                    'text-anchor': 'left',
                    'text-allow-overlap': false,
                    'text-optional': true,
                },
                paint: {
                    'text-color': '#000000',
                    'text-halo-color': 'rgba(255, 255, 255, 0.9)',
                    'text-halo-width': 1.5,
                },
                minzoom: labelZoomThreshold,
            });
        }

        return () => {
            if (!map) return;
            try {
                if (map.getLayer(CAPITALS_LABEL_LAYER)) map.removeLayer(CAPITALS_LABEL_LAYER);
                if (map.getLayer(CAPITALS_CIRCLE_LAYER)) map.removeLayer(CAPITALS_CIRCLE_LAYER);
                if (map.getSource(CAPITALS_SOURCE)) map.removeSource(CAPITALS_SOURCE);
            } catch { /* ignore */ }
            isSourceAdded.current = false;
        };
    }, [map, mapReady, capitalsData, isLoading, isEnabled, locale, labelZoomThreshold]);
}
