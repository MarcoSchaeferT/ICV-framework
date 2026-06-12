/**
 * useGridLayer – Renders grid-cell data as a native Leaflet L.GridLayer.
 *
 * Architecture:
 *  - Each 256×256 tile gets its own <canvas>; projection: equirectangular.
 *  - Spatial index built once on data load; per-tile query is O(k).
 *  - canvas.style.pointerEvents = 'none' so Leaflet mouse events pass through.
 *
 * D3-tween transition guard:
 *  zoomAnimation={false} in BaseMap means Leaflet fires zoomend on every
 *  map.setView() call from the D3 tween (~60/s). updateWhenZooming:false
 *  responds to zoomend → createTile() 60×/s → main-thread block.
 *
 *  Fix: the parent passes `isTransitioningRef` (set true by onTransitionStart,
 *  false by onTransitionEnd). During transition, createTile() returns a blank
 *  canvas immediately. The parent calls the function stored in `redrawRef`
 *  once after onTransitionEnd to trigger a single full redraw.
 */
import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import type { VisDataT } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GridCell {
    lat: number;   // north (top) edge latitude
    lng: number;   // west  (left) edge longitude
    dLat: number;  // cell height in degrees (positive)
    dLng: number;  // cell width  in degrees (positive)
    value: number;
}

interface SpatialIndex {
    query(minLat: number, maxLat: number, minLng: number, maxLng: number): GridCell[];
    size: number;
}

export interface UseGridLayerParams {
    map: L.Map | null;
    L: typeof import('leaflet') | null;
    gridData: Map<number, VisDataT>;
    cellSize: { lat: number; lng: number };
    colorMap: (value: number) => string;
    layerOpacity: number;
    isLoading: boolean;
    hasError: boolean;
    /**
     * Set to true by useMapTransition's onTransitionStart,
     * false by onTransitionEnd. Prevents tile creation during D3 tweens.
     */
    isTransitioningRef?: React.MutableRefObject<boolean>;
    /**
     * Set to true during active map zoom interactions.
     * Prevents pruning old tiles and stops expensive tile redraws.
     */
    isZoomingRef?: React.MutableRefObject<boolean>;
    /**
     * Whether a D3 map transition is currently active.
     * When true, the grid layer is removed from the map to avoid 60fps layout recalculation.
     */
    isTransitioning?: boolean;
    /**
     * The hook writes its redraw() function here.
     * The parent calls it in onTransitionEnd to trigger one clean redraw.
     */
    redrawRef?: React.MutableRefObject<() => void>;
}

// ─── Spatial Index ────────────────────────────────────────────────────────────

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
