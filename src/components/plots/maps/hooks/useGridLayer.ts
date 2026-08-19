import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import type { VisDataT } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Internal spatial grid cell descriptor for tile rendering */
interface GridCell {
    /** North (top) edge latitude in degrees */
    lat: number;
    /** West (left) edge longitude in degrees */
    lng: number;
    /** Cell height in latitude degrees */
    dLat: number;
    /** Cell width in longitude degrees */
    dLng: number;
    /** Numerical feature value */
    value: number;
}

/** Spatial bucket index structure providing $O(k)$ tile bounding box queries */
interface SpatialIndex {
    /** Query cells intersecting a tile's latitude/longitude bounding box */
    query(minLat: number, maxLat: number, minLng: number, maxLng: number): GridCell[];
    /** Total indexed grid cell count */
    size: number;
}

/**
 * Parameters for the {@link useGridLayer} tile rendering hook.
 *
 * @example
 * ```ts
 * const params: UseGridLayerParams = {
 *   map: null,
 *   L: null,
 *   gridData: new Map(),
 *   cellSize: { lat: 0.25, lng: 0.25 },
 *   colorMap: (value) => d3.interpolateViridis(value),
 *   layerOpacity: 0.85,
 *   isLoading: false,
 *   hasError: false,
 * };
 * ```
 */
export interface UseGridLayerParams {
    /** Target Leaflet map instance */
    map: L.Map | null;
    /** Imported Leaflet module instance */
    L: typeof import('leaflet') | null;
    /** Parsed grid cell data Map from {@link useGridDataParser} */
    gridData: Map<number, VisDataT>;
    /** Grid cell angular dimensions in degrees `{ lat, lng }` */
    cellSize: { lat: number; lng: number };
    /** D3 color interpolator function projecting numerical feature values to CSS color strings */
    colorMap: (value: number) => string;
    /** Spatial tile layer alpha opacity (0 to 1) */
    layerOpacity: number;
    /** Whether dataset query is loading */
    isLoading: boolean;
    /** Whether data loading failed */
    hasError: boolean;
    /**
     * Set true by {@link useMapTransition}'s `onTransitionStart`, false by `onTransitionEnd`.
     * Forces `createTile()` to return blank canvas tiles during D3 camera tweens to maintain 60 fps.
     */
    isTransitioningRef?: React.MutableRefObject<boolean>;
    /**
     * Set true during active map zoom interactions.
     * Prevents tile pruning overhead during zoom pinches.
     */
    isZoomingRef?: React.MutableRefObject<boolean>;
    /**
     * Flag indicating active D3 map camera transition. Removes grid layer from Leaflet map during transitions.
     */
    isTransitioning?: boolean;
    /**
     * Mutable ref storing the layer `redraw()` callback. Executed once inside `onTransitionEnd` for a clean repaint.
     */
    redrawRef?: React.MutableRefObject<() => void>;
}

// ─── Spatial Index ────────────────────────────────────────────────────────────

/**
 * Constructs a 2.0-degree spatial bucket index (`SpatialIndex`) over a grid cell dataset.
 *
 * Partitions global coordinates into 2.0-degree latitude/longitude spatial buckets. Reduces tile bounding box lookup complexity from $O(N)$ to $O(k)$.
 *
 * @param gridData - Parsed grid cell Map matching {@link VisDataT}.
 * @param cellSize - Angular cell width and height `{ lat, lng }`.
 * @returns Spatial index object providing `query()` bounding box search method.
 *
 * @see {@link useGridLayer} for tile canvas rendering using this spatial index.
 */
function buildSpatialIndex(
    gridData: Map<number, VisDataT>,
    cellSize: { lat: number; lng: number }
): SpatialIndex {
    const buckets = new Map<string, GridCell[]>();
    const RESOLUTION = 2.0; // 2-degree bucket size
    let count = 0;

    for (const [, d] of gridData) {
        if (!d.geometry || d.geometry.length < 4) continue;
        const cell: GridCell = {
            lat: d.geometry[0][0],
            lng: d.geometry[0][1],
            dLat: cellSize.lat,
            dLng: cellSize.lng,
            value: d.feature,
        };
        count++;

        // Determine bucket indices spanning this cell
        const minLatIdx = Math.floor((cell.lat - cell.dLat) / RESOLUTION);
        const maxLatIdx = Math.floor(cell.lat / RESOLUTION);
        const minLngIdx = Math.floor(cell.lng / RESOLUTION);
        const maxLngIdx = Math.floor((cell.lng + cell.dLng) / RESOLUTION);

        for (let latIdx = minLatIdx; latIdx <= maxLatIdx; latIdx++) {
            for (let lngIdx = minLngIdx; lngIdx <= maxLngIdx; lngIdx++) {
                const key = `${latIdx},${lngIdx}`;
                let bucket = buckets.get(key);
                if (!bucket) {
                    bucket = [];
                    buckets.set(key, bucket);
                }
                bucket.push(cell);
            }
        }
    }

    return {
        query(minLat, maxLat, minLng, maxLng): GridCell[] {
            const result = new Set<GridCell>();
            const minLatIdx = Math.floor(minLat / RESOLUTION);
            const maxLatIdx = Math.floor(maxLat / RESOLUTION);
            const minLngIdx = Math.floor(minLng / RESOLUTION);
            const maxLngIdx = Math.floor(maxLng / RESOLUTION);

            for (let latIdx = minLatIdx; latIdx <= maxLatIdx; latIdx++) {
                for (let lngIdx = minLngIdx; lngIdx <= maxLngIdx; lngIdx++) {
                    const bucket = buckets.get(`${latIdx},${lngIdx}`);
                    if (bucket) {
                        for (const c of bucket) {
                            if (c.lat > minLat && c.lat - c.dLat < maxLat &&
                                c.lng + c.dLng > minLng && c.lng < maxLng) {
                                result.add(c);
                            }
                        }
                    }
                }
            }
            return Array.from(result);
        },
        size: count,
    };
}

// ─── Tile renderer ────────────────────────────────────────────────────────────

/**
 * Renders grid cells onto an individual 256x256 pixel HTML5 `<canvas>` tile element.
 *
 * @param canvas - Target HTML5 canvas element.
 * @param cells - List of grid cells intersecting tile bounds.
 * @param minLat - Minimum latitude of tile.
 * @param maxLat - Maximum latitude of tile.
 * @param minLng - Minimum longitude of tile.
 * @param maxLng - Maximum longitude of tile.
 * @param opacity - Layer alpha opacity.
 * @param colorMap - D3 color interpolator function.
 */
function renderTileCanvas(
    canvas: HTMLCanvasElement,
    cells: GridCell[],
    minLat: number, maxLat: number,
    minLng: number, maxLng: number,
    opacity: number,
    colorMap: (v: number) => string
): void {
    const ctx = canvas.getContext('2d');
    if (!ctx || cells.length === 0) return;
    const tileW = canvas.width;
    const tileH = canvas.height;
    const lngSpan = maxLng - minLng;
    const latSpan = maxLat - minLat;
    ctx.clearRect(0, 0, tileW, tileH);
    for (const cell of cells) {
        const px = ((cell.lng - minLng) / lngSpan) * tileW;
        const py = ((maxLat - cell.lat) / latSpan) * tileH;
        const pw = (cell.dLng / lngSpan) * tileW;
        const ph = (cell.dLat / latSpan) * tileH;
        const base = d3.color(colorMap(cell.value));
        if (!base) continue;
        ctx.fillStyle = base.copy({ opacity }).toString();
        ctx.fillRect(px, py, Math.max(pw + 0.5, 1), Math.max(ph + 0.5, 1));
    }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * High-performance spatial raster tile layer hook extending Leaflet `L.GridLayer`.
 *
 * Renders spatial grid datasets onto dynamic 256×256 HTML5 `<canvas>` tiles projected in equirectangular CRS.
 *
 * @param params - Configuration parameters matching {@link UseGridLayerParams}.
 *
 * @remarks
 * **Tile Rendering Engine & Transition Guard Architecture:**
 * 1. **2.0-Degree Spatial Indexing:** Builds a spatial bucket index (`buildSpatialIndex`) once when dataset changes. Per-tile query time is $O(k)$.
 * 2. **Pointer Event Pass-Through:** Sets `canvas.style.pointerEvents = 'none'` on individual canvas tile elements so mouse hover/click gestures pass directly through to Leaflet base maps.
 * 3. **D3 Transition Guard:** During animated camera `flyTo` transitions (`isTransitioningRef.current === true`), `createTile()` returns blank canvas elements instantly, bypassing expensive canvas repaints and maintaining main-thread 60 fps frame rates.
 * 4. **Clean Redraw:** Triggers a single `layer.redraw()` execution via `redrawRef` upon transition completion (`onTransitionEnd`).
 *
 * @see {@link LeafD3Map} for primary Leaflet spatial map consumer component.
 * @see {@link useGridDataParser} for input data parsing.
 * @see {@link useMapTransition} for transition guard trigger integration.
 * @see {@link VisDataT} for spatial data record contract.
 *
 * @example
 * ```tsx
 * useGridLayer({
 *   map,
 *   L,
 *   gridData,
 *   cellSize: { lat: 0.25, lng: 0.25 },
 *   colorMap: (v) => d3.interpolateInferno(v),
 *   layerOpacity: 0.85,
 *   isLoading: false,
 *   hasError: false,
 *   isTransitioningRef,
 *   redrawRef,
 * });
 * ```
 */
export function useGridLayer({
    map, L, gridData, cellSize, colorMap, layerOpacity,
    isLoading, hasError,
    isTransitioningRef,
    isZoomingRef,
    redrawRef,
    isTransitioning,
}: UseGridLayerParams): void {
    const layerRef = useRef<L.GridLayer | null>(null);
    const colorMapRef = useRef(colorMap);
    const opacityRef = useRef(layerOpacity);
    colorMapRef.current = colorMap;
    opacityRef.current = layerOpacity;

    // ── Spatial index: rebuild only when data changes ─────────────────────────
    const spatialIndex = useMemo<SpatialIndex | null>(() => {
        if (isLoading || hasError || gridData.size === 0 || !cellSize.lat || !cellSize.lng)
            return null;
        return buildSpatialIndex(gridData, cellSize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gridData, cellSize.lat, cellSize.lng, isLoading, hasError]);

    // ── Create GridLayer ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!map || !L || !spatialIndex || spatialIndex.size === 0) return;

        if (layerRef.current) {
            map.removeLayer(layerRef.current);
            layerRef.current = null;
        }

        const index = spatialIndex;

        const EqGridLayer = L.GridLayer.extend({
            createTile(this: L.GridLayer, coords: L.Coords): HTMLElement {
                const sz = this.getTileSize();
                const tileW = sz.x;
                const tileH = sz.y;

                const canvas = document.createElement('canvas');
                canvas.width = tileW;
                canvas.height = tileH;
                // Must NOT intercept mouse events – hover/click must reach Leaflet.
                canvas.style.pointerEvents = 'none';

                // ── Transition/Zoom guard ─────────────────────────────────────
                // While D3 transitions or zoom interactions are in progress,
                // return a blank canvas immediately to prevent main-thread blockage.
                if (isTransitioningRef?.current || isZoomingRef?.current) {
                    return canvas; // blank tile, 0ms cost
                }

                const topLeft = map.unproject(L.point(coords.x * tileW, coords.y * tileH), coords.z);
                const bottomRight = map.unproject(L.point((coords.x + 1) * tileW, (coords.y + 1) * tileH), coords.z);
                const minLat = bottomRight.lat;
                const maxLat = topLeft.lat;
                const minLng = topLeft.lng;
                const maxLng = bottomRight.lng;

                if (maxLng - minLng <= 0 || maxLat - minLat <= 0) return canvas;

                const cells = index.query(minLat, maxLat, minLng, maxLng);
                renderTileCanvas(canvas, cells, minLat, maxLat, minLng, maxLng,
                    opacityRef.current, colorMapRef.current);

                return canvas;
            },

            _pruneTiles(this: any) {
                // Do not prune old tiles if we are transitioning or zooming.
                if (isTransitioningRef?.current || isZoomingRef?.current) {
                    return;
                }
                (L.GridLayer.prototype as any)._pruneTiles.call(this);
            }
        });

        const layer = new (EqGridLayer as unknown as new (opts: L.GridLayerOptions) => L.GridLayer)({
            opacity: layerOpacity,
            zIndex: 400,
            // For wheel zoom (no D3 tween): CSS-scale existing tiles during
            // animation, create new sharp tiles only after zoomend.
            updateWhenZooming: false,
            keepBuffer: 2,
            noWrap: true,
        });

        layer.addTo(map);
        layerRef.current = layer;

        // Expose redraw so the parent can call it from onTransitionEnd.
        if (redrawRef) {
            redrawRef.current = () => layer.redraw();
        }

        return () => {
            if (redrawRef) redrawRef.current = () => { };
            if (layerRef.current && map.hasLayer(layerRef.current)) {
                map.removeLayer(layerRef.current);
            }
            layerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, L, spatialIndex]);

    // ── Opacity ───────────────────────────────────────────────────────────────
    useEffect(() => {
        layerRef.current?.setOpacity(layerOpacity);
    }, [layerOpacity]);

    // ── ColorMap ──────────────────────────────────────────────────────────────
    const prevColorMapRef = useRef(colorMap);
    useEffect(() => {
        if (prevColorMapRef.current !== colorMap) {
            prevColorMapRef.current = colorMap;
            layerRef.current?.redraw();
        }
    }, [colorMap]);

    // ── Remove/Add GridLayer during D3 transition ─────────────────────────────
    useEffect(() => {
        if (!map || !layerRef.current) return;
        if (isTransitioning) {
            if (map.hasLayer(layerRef.current)) {
                map.removeLayer(layerRef.current);
            }
        } else {
            if (!map.hasLayer(layerRef.current)) {
                map.addLayer(layerRef.current);
                layerRef.current.redraw();
            }
        }
    }, [isTransitioning, map]);
}

