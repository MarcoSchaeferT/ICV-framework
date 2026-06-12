/**
 * useMapLibreCountryPolygons – Renders country polygons as MapLibre GL JS
 * fill+line layers with feature-state for hover/selection/active.
 *
 * Replaces L.geoJSON(mapData, { style, onEachFeature }) from LeafD3Map.tsx
 * MapDrawLayer_CountryPolygons function.
 *
 * Uses:
 * - `fill` layer for country fills with per-feature colors via feature-state
 * - `line` layer for country borders with data-driven width/color
 * - `feature-state` for hover and active (selected) states
 */
import { useEffect, useRef, useCallback } from 'react';
import type { Map as MapLibreMap, GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl';
import type * as GEOjson from 'geojson';

// ─── Source/Layer IDs ───
const COUNTRIES_SOURCE = 'countries-source';
const COUNTRIES_FILL = 'countries-fill';
const COUNTRIES_LINE = 'countries-line';
const OCEAN_SOURCE = 'ocean-mask-source';
const OCEAN_FILL = 'ocean-mask-fill';
const OCEAN_LINE = 'ocean-mask-line';

interface UseMapLibreCountryPolygonsParams {
    map: MapLibreMap | null;
    mapReady: boolean;
    mapData: GEOjson.FeatureCollection;
    isLoading: boolean;
    oceanGeoJSON: GEOjson.FeatureCollection | null;
    /** Base style */
    strokeWidth: number;
    strokeColor: string;
    fillColor: string;
    fillOpacity: number;
    backgroundColor: string;
    /** Locale for translated country names */
    locale: string;
    /** Callbacks */
    onCountryClick?: (feature: GEOjson.Feature, countryName: string, countryCode: string) => void;
    onCountryHover?: (feature: GEOjson.Feature, translatedName: string) => void;
    onCountryLeave?: () => void;
    /** Whether to disable click interactions */
    disableClick?: boolean;
    /** Current selected country identifier (feature properties.name) for active styling */
    selectedCountryName?: string;
}

interface UseMapLibreCountryPolygonsReturn {
    /** ID of the countries fill layer (for registering additional events) */
    countriesFillLayerId: string;
    /** ID of the countries line layer */
    countriesLineLayerId: string;
    /** Apply active style to a feature by name */
    setActiveCountry: (name: string | null) => void;
}

export function useMapLibreCountryPolygons({
    map,
    mapReady,
    mapData,
    isLoading,
    oceanGeoJSON,
    strokeWidth,
    strokeColor,
    fillColor,
    fillOpacity,
    backgroundColor,
    locale,
    onCountryClick,
    onCountryHover,
    onCountryLeave,
    disableClick = false,
    selectedCountryName,
}: UseMapLibreCountryPolygonsParams): UseMapLibreCountryPolygonsReturn {

    const hoveredFeatureId = useRef<number | null>(null);
    const activeFeatureId = useRef<number | null>(null);
    const isSourceAdded = useRef(false);

    // ─── Add/update country polygon source & layers ───
    useEffect(() => {
        if (!map || !mapReady || isLoading) return;
        if (!mapData?.features?.length) {
            // Clean up if no data
            cleanup();
            return;
        }

        // Assign numeric IDs for feature-state
        const dataWithIds: GEOjson.FeatureCollection = {
            ...mapData,
            features: mapData.features.map((f, i) => ({
                ...f,
                id: i,
            })),
        };

        // ─── Countries source ───
        const existingSource = map.getSource(COUNTRIES_SOURCE) as GeoJSONSource | undefined;
        if (existingSource) {
            existingSource.setData(dataWithIds);
        } else {
            map.addSource(COUNTRIES_SOURCE, {
                type: 'geojson',
                data: dataWithIds,
            });
            isSourceAdded.current = true;
        }

        // ─── Fill layer ───
        if (!map.getLayer(COUNTRIES_FILL)) {
            map.addLayer({
                id: COUNTRIES_FILL,
                type: 'fill',
                source: COUNTRIES_SOURCE,
                paint: {
                    'fill-color': [
                        'case',
                        ['boolean', ['feature-state', 'hover'], false],
                        'rgb(29, 73, 217)',
                        fillColor,
                    ],
                    'fill-opacity': [
                        'case',
                        ['boolean', ['feature-state', 'hover'], false],
                        0.5,
                        fillOpacity,
                    ],
                },
            });
        }

        // ─── Line layer ───
        if (!map.getLayer(COUNTRIES_LINE)) {
            map.addLayer({
                id: COUNTRIES_LINE,
                type: 'line',
                source: COUNTRIES_SOURCE,
                paint: {
                    'line-color': [
                        'case',
                        ['boolean', ['feature-state', 'active'], false],
                        'rgb(234, 255, 0)',
                        strokeColor,
                    ],
                    'line-width': [
                        'case',
                        ['boolean', ['feature-state', 'active'], false],
                        strokeWidth + 3,
                        strokeWidth,
                    ],
                },
            });
        }

        // ─── Ocean mask ───
        if (oceanGeoJSON && oceanGeoJSON.features.length > 0) {
            const existingOcean = map.getSource(OCEAN_SOURCE) as GeoJSONSource | undefined;
            if (existingOcean) {
                existingOcean.setData(oceanGeoJSON);
            } else {
                map.addSource(OCEAN_SOURCE, {
                    type: 'geojson',
                    data: oceanGeoJSON,
                });
            }

            if (!map.getLayer(OCEAN_FILL)) {
                map.addLayer({
                    id: OCEAN_FILL,
                    type: 'fill',
                    source: OCEAN_SOURCE,
                    paint: {
                        'fill-color': backgroundColor,
                        'fill-opacity': 1,
                    },
                });
            }

            if (!map.getLayer(OCEAN_LINE)) {
                map.addLayer({
                    id: OCEAN_LINE,
                    type: 'line',
                    source: OCEAN_SOURCE,
                    paint: {
                        'line-color': strokeColor,
                        'line-width': strokeWidth,
                    },
                });
            }
        }

        function cleanup() {
            if (!map) return;
            try {
                [OCEAN_LINE, OCEAN_FILL, COUNTRIES_LINE, COUNTRIES_FILL].forEach(id => {
                    if (map.getLayer(id)) map.removeLayer(id);
                });
                [OCEAN_SOURCE, COUNTRIES_SOURCE].forEach(id => {
                    if (map.getSource(id)) map.removeSource(id);
                });
            } catch { /* map may already be removed */ }
            isSourceAdded.current = false;
        }

        return cleanup;
    }, [map, mapReady, mapData, isLoading, oceanGeoJSON, strokeWidth, strokeColor, fillColor, fillOpacity, backgroundColor]);

    // ─── Mouse interaction events ───
    useEffect(() => {
        if (!map || !mapReady || !map.getLayer(COUNTRIES_FILL)) return;

        const handleClick = (e: MapLayerMouseEvent) => {
            if (disableClick || !e.features?.length) return;
            const feature = e.features[0];
            const props = feature.properties || {};
            const countryName = props.name ?? props.NAME ?? '';
            const countryCode = props.iso_a3 ?? '';
            onCountryClick?.(feature as unknown as GEOjson.Feature, countryName, countryCode);
        };

        const handleMouseMove = (e: MapLayerMouseEvent) => {
            if (!e.features?.length) return;
            const feature = e.features[0];
            const featureId = feature.id as number;

            // Clear previous hover
            if (hoveredFeatureId.current !== null && hoveredFeatureId.current !== featureId) {
                map.setFeatureState(
                    { source: COUNTRIES_SOURCE, id: hoveredFeatureId.current },
                    { hover: false }
                );
            }

            hoveredFeatureId.current = featureId;
            map.setFeatureState(
                { source: COUNTRIES_SOURCE, id: featureId },
                { hover: true }
            );

            // Translate country name
            const props = feature.properties || {};
            const translated =
                props[`NAME_${locale}`] ??
                props[`name_${locale}`] ??
                props.name ??
                '';

            onCountryHover?.(feature as unknown as GEOjson.Feature, translated);
            map.getCanvas().style.cursor = 'pointer';
        };

        const handleMouseLeave = () => {
            if (hoveredFeatureId.current !== null) {
                map.setFeatureState(
                    { source: COUNTRIES_SOURCE, id: hoveredFeatureId.current },
                    { hover: false }
                );
                hoveredFeatureId.current = null;
            }
            onCountryLeave?.();
            map.getCanvas().style.cursor = '';
        };

        map.on('click', COUNTRIES_FILL, handleClick);
        map.on('mousemove', COUNTRIES_FILL, handleMouseMove);
        map.on('mouseleave', COUNTRIES_FILL, handleMouseLeave);

        return () => {
            map.off('click', COUNTRIES_FILL, handleClick);
            map.off('mousemove', COUNTRIES_FILL, handleMouseMove);
            map.off('mouseleave', COUNTRIES_FILL, handleMouseLeave);
        };
    }, [map, mapReady, disableClick, locale, onCountryClick, onCountryHover, onCountryLeave]);

    // ─── Active (selected) country state ───
    const setActiveCountry = useCallback((name: string | null) => {
        if (!map || !mapReady) return;
        const source = map.getSource(COUNTRIES_SOURCE) as GeoJSONSource | undefined;
        if (!source) return;

        // Clear previous active
        if (activeFeatureId.current !== null) {
            try {
                map.setFeatureState(
                    { source: COUNTRIES_SOURCE, id: activeFeatureId.current },
                    { active: false }
                );
            } catch { /* ignore */ }
            activeFeatureId.current = null;
        }

        if (!name || !mapData?.features) return;

        // Find feature by name
        const idx = mapData.features.findIndex((f) => {
            const p = f.properties || {};
            return p.name === name || p.NAME === name || p.admin === name;
        });

        if (idx >= 0) {
            activeFeatureId.current = idx;
            map.setFeatureState(
                { source: COUNTRIES_SOURCE, id: idx },
                { active: true }
            );
        }
    }, [map, mapReady, mapData]);

    // Apply selected country when it changes
    useEffect(() => {
        setActiveCountry(selectedCountryName || null);
    }, [selectedCountryName, setActiveCountry]);

    return {
        countriesFillLayerId: COUNTRIES_FILL,
        countriesLineLayerId: COUNTRIES_LINE,
        setActiveCountry,
    };
}
