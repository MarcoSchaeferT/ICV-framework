/**
 * useCanvasGridLayer – Renders grid-cell data onto an HTML Canvas, then
 * projects it as a Leaflet ImageOverlay.
 */
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { VisDataT, MapDimensions } from '../types';

interface UseCanvasGridLayerParams {
    map: L.Map | null;
    L: typeof import('leaflet') | null;
    /** Toggle to trigger re-render (typically toggled by the debounce hook) */
    isUpdate: boolean;
    /** Whether the source data is still loading */
    isLoading: boolean;
    /** Whether there was an error loading data */
    hasError: boolean;
    /** Parsed grid data */
    gridData: Map<number, VisDataT>;
    /** Container dimensions */
    dimensions: MapDimensions;
    /** Color mapping function: feature value → CSS color string */
    colorMap: (value: number) => string;
    /** Current layer opacity (0–1) */
    layerOpacity: number;
    /** Transition duration in ms for overlay fade (0 = instant) */
    transitionDuration?: number;
    /** Enable debug text labels on each grid cell */
    debug?: boolean;
}

export function useCanvasGridLayer({
    map,
    L,
    isUpdate,
    isLoading,
    hasError,
    gridData,
    dimensions,
    colorMap,
    layerOpacity,
    transitionDuration = 0,
    debug = false,
}: UseCanvasGridLayerParams): void {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const overlayRef = useRef<L.ImageOverlay | null>(null);

    useEffect(() => {
        if (!map || !L) return;
        if (isLoading || hasError || gridData.size === 0) return;

        // Reuse existing canvas if available
        let canvas = canvasRef.current;
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvasRef.current = canvas;
        }

        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
        canvas.style.width = `${dimensions.width}px`;
        canvas.style.height = `${dimensions.height}px`;

        const context = canvas.getContext('2d');
        if (!context) return;

        context.clearRect(0, 0, canvas.width, canvas.height);

        // Draw each grid cell as a filled rectangle
        for (const [key, d] of gridData) {
            if (!d.geometry) continue;

            const coords = d.geometry.map((coord) =>
                map.latLngToContainerPoint(L.latLng(coord[0], coord[1]))
            );

            if (coords.length > 3) {
                const x1 = coords[0].x;
                const y1 = coords[0].y;
                const x2 = coords[1].x;
                const y2 = coords[3].y;

                context.fillStyle =
                    d3.color(colorMap(Number(d.feature)))?.copy({ opacity: layerOpacity })?.toString() ||
                    'rgba(0, 0, 0, 0)';
                context.fillRect(x1, y1, Math.abs(x2 - x1), Math.abs(y2 - y1));

                if (debug) {
                    context.fillStyle = 'black';
                    context.font = '14px Arial';
                    context.textAlign = 'right';
                    context.textBaseline = 'top';
                    const point = map.containerPointToLatLng(L.point(x1, y1));
                    context.fillText(
                        `${Math.round(point.lat * 100) / 100}, ${Math.round(point.lng * 100) / 100}`,
                        x2 - 5,
                        y1 + 40
                    );
                    context.fillText(key.toString(), x2 - 5, y1 + 23);
                    context.fillText(d.feature.toString(), x2 - 5, y1 + 5);
                }
            }
        }

        const imageUrl = canvas.toDataURL();
        // map.getBounds() THROWS inside Leaflet when the container has zero size.
        // Use try-catch — the || fallback is unreachable when an exception is thrown.
        let bounds: L.LatLngBounds | null = null;
        try {
            bounds = map.getBounds();
        } catch {
            return; // map not yet sized — skip this render cycle
        }
        if (!bounds) return;

        // Remove previous overlay
        if (overlayRef.current) {
            const prevOverlay = overlayRef.current;
            const prevElement = prevOverlay.getElement();
            if (prevElement && transitionDuration > 0) {
                prevElement.style.transition = `opacity ${transitionDuration}ms ease-out`;
                prevElement.style.opacity = '0';
            }
            setTimeout(() => {
                if (map.hasLayer(prevOverlay)) {
                    map.removeLayer(prevOverlay);
                }
            }, transitionDuration > 0 ? transitionDuration : 1);
        }

        // Create new overlay
        const newOverlay = L.imageOverlay(imageUrl, bounds);
        overlayRef.current = newOverlay;
        newOverlay.addTo(map);

        const overlayElement = newOverlay.getElement();
        if (overlayElement) {
            if (transitionDuration > 0) {
                overlayElement.style.opacity = '0';
                overlayElement.style.transition = `opacity ${transitionDuration}ms ease-in`;
            }
            setTimeout(() => {
                overlayElement.style.opacity = layerOpacity.toString();
            }, transitionDuration > 0 ? transitionDuration : 0);
        }
    }, [isUpdate]);
}
