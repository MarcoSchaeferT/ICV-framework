import { useEffect, useRef } from 'react';
import type { VisDataT, MapDimensions } from '../types';
import { WebGLGridRenderer, type PolygonStyleOptions } from '../webgl/WebGLGridRenderer';
import type * as GEOjson from 'geojson';

const EMPTY_GRID_DATA = new Map<number, VisDataT>();

/**
 * Parameters for the {@link useWebGLGridLayer} hardware-accelerated grid and polygon hook.
 */
export interface UseWebGLGridLayerParams {
    /** Target Leaflet map instance. */
    map: L.Map | null;
    /** Loaded Leaflet module; retained as an initialization readiness signal. */
    L: typeof import('leaflet') | null;
    /** Optional external redraw/upload trigger. */
    isUpdate?: boolean;
    /** Suppresses grid rendering while data is loading. */
    isLoading: boolean;
    /** Suppresses grid rendering after a data error. */
    hasError: boolean;
    /** Parsed spatial cells keyed by their source grid index. */
    gridData: Map<number, VisDataT>;
    /** Fallback cell height and width in degrees. */
    cellSize: { lat: number; lng: number };
    /** Map container dimensions used until Leaflet reports a valid size. */
    dimensions: MapDimensions;
    /** Feature-value-to-CSS-color function sampled into a GPU texture. */
    colorMap: (value: number) => string;
    /** Grid-layer opacity in the range `[0, 1]`. */
    layerOpacity: number;
    /** Uses equirectangular projection when true, otherwise Web Mercator. */
    isProjection_equirectangular?: boolean;

    // ─── Country Polygons, Borders & GPU Ocean Mask ──────────────────────────
    /** GeoJSON country boundaries used for fills, stencil masking, and picking. */
    mapData?: GEOjson.FeatureCollection | null;
    /** Clips grid fragments to land through the stencil buffer. @defaultValue true */
    useOceanMask?: boolean;
    /** Polygon fill, background, border, hover, and active styles. */
    polygonStyles?: PolygonStyleOptions;
    /** Selected country name or code synchronized from shared application state. */
    selectedCountryName?: string;

    // ─── Interactivity Callbacks ─────────────────────────────────────────────
    /** Fired when a country polygon is clicked. */
    onSelectCountry?: (countryCode: string, feature: GEOjson.Feature) => void;
    /** Fired when a click does not hit any country polygon. */
    onClickBackground?: () => void;
    /** Fired once when the pointer enters a different country polygon. */
    onHoverCountry?: (translatedName: string, feature: GEOjson.Feature, e: L.LeafletMouseEvent) => void;
    /** Fired when the pointer leaves the currently hovered country. */
    onHoverLeave?: () => void;

    /** Locale suffix used for translated GeoJSON name properties. */
    locale?: string;
    /** Suppresses country click selection while preserving hover behavior. */
    disableClick?: boolean;
    /** Enables renderer lifecycle and upload diagnostics. */
    debug?: boolean;
}

/**
 * Adds a WebGL2 grid and country-polygon canvas to a Leaflet map.
 *
 * @remarks
 * The canvas is positioned inside Leaflet's container but ignores pointer
 * events, leaving gestures under Leaflet's control. It renders grid cells,
 * country fills and borders, and optional stencil-based land masking. Map
 * movement updates projection state in animation frames; geometry is uploaded
 * when relevant inputs change. Country hit testing uses retained polygon rings
 * on the CPU, with hover and selection styles rendered by shaders.
 *
 * WebGL context restoration invalidates every program and buffer. The latest
 * inputs are therefore mirrored in refs and replayed into a fresh renderer by
 * `hydrateRendererRef`.
 *
 * @param params - Leaflet instance, grid data, styling, and interaction callbacks.
 * @returns Nothing; the hook manages its canvas and listeners through effects.
 */
export function useWebGLGridLayer({
    map,
    L,
    isUpdate,
    isLoading,
    hasError,
    gridData,
    cellSize,
    dimensions,
    colorMap,
    layerOpacity,
    isProjection_equirectangular,
    mapData,
    useOceanMask = true,
    polygonStyles,
    selectedCountryName,
    onSelectCountry,
    onClickBackground,
    onHoverCountry,
    onHoverLeave,
    locale = 'en',
    disableClick = false,
    debug = false,
}: UseWebGLGridLayerParams): void {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const rendererRef = useRef<WebGLGridRenderer | null>(null);

    // Context restoration and Leaflet event handlers must read current inputs
    // without forcing renderer recreation or capturing stale React values.
    const latestStateRef = useRef({
        map,
        gridData,
        cellSize,
        dimensions,
        colorMap,
        layerOpacity,
        isProjection_equirectangular,
        mapData,
        useOceanMask,
        polygonStyles,
        selectedCountryName,
        isLoading,
        hasError,
    });
    useEffect(() => {
        latestStateRef.current = {
            map,
            gridData,
            cellSize,
            dimensions,
            colorMap,
            layerOpacity,
            isProjection_equirectangular,
            mapData,
            useOceanMask,
            polygonStyles,
            selectedCountryName,
            isLoading,
            hasError,
        };
    }, [
        cellSize,
        colorMap,
        dimensions,
        gridData,
        hasError,
        isLoading,
        isProjection_equirectangular,
        layerOpacity,
        map,
        mapData,
        polygonStyles,
        selectedCountryName,
        useOceanMask,
    ]);

    /** Recomputes projection uniforms from Leaflet and issues one complete frame. */
    const renderViewportRef = useRef((renderer: WebGLGridRenderer) => {
        const current = latestStateRef.current;
        if (!current.map) return;

        const mapSize = current.map.getSize();
        const viewport = mapSize.x > 0 && mapSize.y > 0
            ? { width: mapSize.x, height: mapSize.y }
            : current.dimensions;
        if (viewport.width <= 0 || viewport.height <= 0) return;

        const isEquirectangular = current.isProjection_equirectangular ??
            (current.map.options.crs as { code?: string }).code === 'EPSG:4326';
        renderer.updateViewport(current.map, viewport, isEquirectangular);
        renderer.render();
    });

    /** Replays all CPU-side state after initial creation or context restoration. */
    const hydrateRendererRef = useRef((renderer: WebGLGridRenderer) => {
        const current = latestStateRef.current;
        renderer.setStyles(current.polygonStyles ?? {});
        renderer.setUseOceanMask(current.useOceanMask);
        renderer.setCountriesData(current.mapData ?? null);
        renderer.setSelectedCountryByName(current.selectedCountryName ?? '');
        renderer.setOpacity(current.layerOpacity);

        const renderableGrid = current.isLoading || current.hasError
            ? EMPTY_GRID_DATA
            : current.gridData;
        renderer.setData(renderableGrid, current.cellSize);
        if (renderableGrid.size > 0) renderer.setColorMap(current.colorMap);
        renderViewportRef.current(renderer);
    });

    // Listener registration remains stable while callback and locale values can
    // change on any React render.
    const interactionRef = useRef({
        locale,
        disableClick,
        onSelectCountry,
        onClickBackground,
        onHoverCountry,
        onHoverLeave,
    });
    useEffect(() => {
        interactionRef.current = {
            locale,
            disableClick,
            onSelectCountry,
            onClickBackground,
            onHoverCountry,
            onHoverLeave,
        };
    }, [disableClick, locale, onClickBackground, onHoverCountry, onHoverLeave, onSelectCountry]);

    // ─── 1. Canvas and WebGL Renderer Lifecycle ──────────────────────────────
    useEffect(() => {
        if (!map || !L) return;

        const container = map.getContainer();
        if (!container) return;

        let canvas = canvasRef.current;
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.pointerEvents = 'none';
            canvas.style.zIndex = '350';
            canvas.className = 'webgl-grid-layer-canvas';
            container.appendChild(canvas);
            canvasRef.current = canvas;
        }

        let renderer: WebGLGridRenderer;
        renderer = new WebGLGridRenderer({
            canvas,
            debug,
            onContextRestored: () => hydrateRendererRef.current(renderer),
        });
        rendererRef.current = renderer;
        hydrateRendererRef.current(renderer);

        return () => {
            if (rendererRef.current === renderer) {
                renderer.dispose();
                rendererRef.current = null;
            }
            if (canvasRef.current && canvasRef.current.parentElement) {
                canvasRef.current.parentElement.removeChild(canvasRef.current);
                canvasRef.current = null;
            }
        };
    }, [map, L, debug]);

    // ─── 2. Country Polygons Upload ──────────────────────────────────────────
    useEffect(() => {
        const renderer = rendererRef.current;
        if (!renderer) return;

        renderer.setCountriesData(mapData ?? null);
        renderViewportRef.current(renderer);
    }, [mapData]);

    useEffect(() => {
        const renderer = rendererRef.current;
        if (!renderer) return;

        renderer.setStyles(polygonStyles ?? {});
        renderer.setUseOceanMask(useOceanMask);
        renderViewportRef.current(renderer);
    }, [polygonStyles, useOceanMask]);

    // ─── 3. Selected Country Sync ────────────────────────────────────────────
    useEffect(() => {
        const renderer = rendererRef.current;
        if (!renderer) return;

        renderer.setSelectedCountryByName(selectedCountryName ?? '');
        renderViewportRef.current(renderer);
    }, [mapData, selectedCountryName]);

    // ─── 4. Geometry Grid Data Upload ────────────────────────────────────────
    useEffect(() => {
        const renderer = rendererRef.current;
        if (!renderer) return;

        if (isLoading || hasError || gridData.size === 0) {
            renderer.setData(EMPTY_GRID_DATA, cellSize);
            renderer.setOpacity(layerOpacity);
            renderViewportRef.current(renderer);
            return;
        }

        renderer.setData(gridData, cellSize);
        renderer.setColorMap(colorMap);
        renderer.setOpacity(layerOpacity);
        renderViewportRef.current(renderer);
    }, [
        cellSize,
        colorMap,
        gridData,
        hasError,
        isLoading,
        isUpdate,
        layerOpacity,
    ]);

    // ─── 5. Colormap & Opacity Updates ───────────────────────────────────────
    // ─── 6. Viewport Synchronization on Map Events (Live 60 FPS) ────────────
    useEffect(() => {
        if (!map) return;

        let animationFrame: number | null = null;
        // Leaflet can emit several move/zoom events per frame. Coalescing them
        // avoids redundant uniform uploads and draws while preserving animation.
        const renderSync = () => {
            if (animationFrame !== null) return;
            animationFrame = requestAnimationFrame(() => {
                animationFrame = null;
                const renderer = rendererRef.current;
                if (!renderer || !canvasRef.current) return;
                renderViewportRef.current(renderer);
            });
        };

        const renderImmediately = () => {
            const renderer = rendererRef.current;
            if (!renderer || !canvasRef.current) return;
            renderViewportRef.current(renderer);
        };

        renderImmediately();

        map.on('move', renderSync);
        map.on('zoom', renderSync);
        map.on('viewreset', renderSync);
        map.on('resize', renderSync);

        return () => {
            if (animationFrame !== null) cancelAnimationFrame(animationFrame);
            map.off('move', renderSync);
            map.off('zoom', renderSync);
            map.off('viewreset', renderSync);
            map.off('resize', renderSync);
        };
    }, [map, dimensions, isProjection_equirectangular]);

    // ─── 7. Interactivity (Hover, Click, Point-in-Polygon Hit Testing) ────────
    useEffect(() => {
        if (!map) return;

        let lastHoveredId = -1;

        const handleMouseMove = (e: L.LeafletMouseEvent) => {
            const renderer = rendererRef.current;
            if (!renderer) return;

            // Picking uses CPU polygon rings; the WebGL canvas itself is
            // pointer-transparent and never needs a color-picking framebuffer.
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;
            const hit = renderer.hitTest(lat, lng);

            if (hit) {
                if (map.getContainer()) {
                    map.getContainer().style.cursor = 'pointer';
                }
                renderer.setHoveredCountry(hit.id);
                if (hit.id !== lastHoveredId) {
                    lastHoveredId = hit.id;

                    const feature = hit.feature;
                    const props = feature.properties || {};
                    const interaction = interactionRef.current;
                    const translated =
                        props[`NAME_${interaction.locale}`] ||
                        props[`name_${interaction.locale}`] ||
                        hit.name ||
                        '';

                    interaction.onHoverCountry?.(translated, feature, e);
                }
            } else {
                if (map.getContainer()) {
                    map.getContainer().style.cursor = '';
                }
                if (lastHoveredId !== -1) {
                    lastHoveredId = -1;
                    renderer.setHoveredCountry(-1);
                    interactionRef.current.onHoverLeave?.();
                }
            }
        };

        const handleMouseOut = () => {
            const renderer = rendererRef.current;
            if (!renderer) return;

            if (map.getContainer()) {
                map.getContainer().style.cursor = '';
            }

            if (lastHoveredId !== -1) {
                lastHoveredId = -1;
                renderer.setHoveredCountry(-1);
                interactionRef.current.onHoverLeave?.();
            }
        };

        const handleClick = (e: L.LeafletMouseEvent) => {
            const interaction = interactionRef.current;
            if (interaction.disableClick) return;
            const renderer = rendererRef.current;
            if (!renderer) return;

            const hit = renderer.hitTest(e.latlng.lat, e.latlng.lng);
            if (hit) {
                renderer.setSelectedCountry(hit.id);
                interaction.onSelectCountry?.(hit.code, hit.feature);
            } else if (interaction.onClickBackground) {
                renderer.setSelectedCountry(-1);
                interaction.onClickBackground();
            }
        };

        map.on('mousemove', handleMouseMove);
        map.on('mouseout', handleMouseOut);
        map.on('click', handleClick);

        return () => {
            if (map.getContainer()) {
                map.getContainer().style.cursor = '';
            }
            map.off('mousemove', handleMouseMove);
            map.off('mouseout', handleMouseOut);
            map.off('click', handleClick);
        };
    }, [map]);
}
