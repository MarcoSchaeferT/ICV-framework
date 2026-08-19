import { useEffect, useRef } from 'react';
import type { VisDataT, MapDimensions } from '../types';
import { useLoadingTask } from '@/components/plots/maps/utils/loadingSpinner';

/** Parameters for the non-tiled canvas grid renderer. */
export interface UseCanvasGridLayerParams {
    map: L.Map | null;
    L: typeof import('leaflet') | null;
    isUpdate: boolean;
    isLoading: boolean;
    hasError: boolean;
    gridData: Map<number, VisDataT>;
    cellSize: { lat: number; lng: number };
    dimensions: MapDimensions;
    colorMap: (value: number) => string;
    layerOpacity: number;
    transitionDuration?: number;
    debug?: boolean;
}

/**
 * Renders a projection-aware grid into one canvas-backed Leaflet ImageOverlay.
 *
 * This deliberately remains non-tiled. It keeps the established overlay
 * interaction model while reducing work through viewport clipping, compact
 * cell anchors, two-corner projection, color reuse, and Blob URLs.
 */
export function useCanvasGridLayer({
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
    transitionDuration = 0,
    debug = false,
}: UseCanvasGridLayerParams): void {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const overlayRef = useRef<L.ImageOverlay | null>(null);
    const overlayUrlRef = useRef<string | null>(null);
    const renderGenerationRef = useRef(0);
    const L_gridRender = useLoadingTask('Grid Layer');

    useEffect(() => {
        if (!map || !L || isLoading || hasError || gridData.size < 3) return;
        L_gridRender.start();
        const renderGeneration = renderGenerationRef.current;

        let bounds: L.LatLngBounds;
        try {
            bounds = map.getBounds();
        } catch {
            L_gridRender.stop();
            return;
        }

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
        if (!context) {
            L_gridRender.stop();
            return;
        }

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.globalAlpha = 1;

        const viewNorth = bounds.getNorth();
        const viewSouth = bounds.getSouth();
        const viewWest = bounds.getWest();
        const viewEast = bounds.getEast();
        const colorCache = new Map<number, string>();

        for (const [key, data] of gridData) {
            let north: number;
            let south: number;
            let west: number;
            let east: number;
            let sourceCorners: readonly number[];

            if (data.corners) {
                sourceCorners = data.corners;
                north = Math.max(sourceCorners[0], sourceCorners[2], sourceCorners[4], sourceCorners[6]);
                south = Math.min(sourceCorners[0], sourceCorners[2], sourceCorners[4], sourceCorners[6]);
                west = Math.min(sourceCorners[1], sourceCorners[3], sourceCorners[5], sourceCorners[7]);
                east = Math.max(sourceCorners[1], sourceCorners[3], sourceCorners[5], sourceCorners[7]);
            } else if (data.bounds) {
                [north, south, west, east] = data.bounds;
                sourceCorners = [north, west, north, east, south, east, south, west];
            } else if (data.topLeft && cellSize.lat > 0 && cellSize.lng > 0) {
                [north, west] = data.topLeft;
                south = north - cellSize.lat;
                east = west + cellSize.lng;
                sourceCorners = [north, west, north, east, south, east, south, west];
            } else if (data.geometry && data.geometry.length > 3) {
                north = -Infinity;
                south = Infinity;
                west = Infinity;
                east = -Infinity;
                for (const [lat, lng] of data.geometry) {
                    north = Math.max(north, lat);
                    south = Math.min(south, lat);
                    west = Math.min(west, lng);
                    east = Math.max(east, lng);
                }
                sourceCorners = [
                    data.geometry[0][0], data.geometry[0][1],
                    data.geometry[1][0], data.geometry[1][1],
                    data.geometry[2][0], data.geometry[2][1],
                    data.geometry[3][0], data.geometry[3][1],
                ];
            } else {
                continue;
            }

            if (south > viewNorth || north < viewSouth || east < viewWest || west > viewEast) {
                continue;
            }

            // Project every source corner through the map instance's CRS.
            // The same parsed grid therefore works with both EPSG:4326 and
            // EPSG:3857 maps without baking a projection into the dataset.
            const p0 = map.latLngToContainerPoint(L.latLng(sourceCorners[0], sourceCorners[1]));
            const p1 = map.latLngToContainerPoint(L.latLng(sourceCorners[2], sourceCorners[3]));
            const p2 = map.latLngToContainerPoint(L.latLng(sourceCorners[4], sourceCorners[5]));
            const p3 = map.latLngToContainerPoint(L.latLng(sourceCorners[6], sourceCorners[7]));
            const x1 = Math.min(p0.x, p1.x, p2.x, p3.x);
            const y1 = Math.min(p0.y, p1.y, p2.y, p3.y);
            const x2 = Math.max(p0.x, p1.x, p2.x, p3.x);
            const y2 = Math.max(p0.y, p1.y, p2.y, p3.y);

            const feature = Number(data.feature);
            let color = colorCache.get(feature);
            if (color === undefined) {
                color = colorMap(feature) || 'rgba(0, 0, 0, 0)';
                colorCache.set(feature, color);
            }
            context.fillStyle = color;
            context.beginPath();
            context.moveTo(p0.x, p0.y);
            context.lineTo(p1.x, p1.y);
            context.lineTo(p2.x, p2.y);
            context.lineTo(p3.x, p3.y);
            context.closePath();
            context.fill();
            // Adjacent projected polygons can meet on fractional pixels. A
            // same-color hairline prevents transparent anti-alias seams.
            context.strokeStyle = color;
            context.lineWidth = 0.75;
            context.lineJoin = 'round';
            context.stroke();

            if (debug) {
                context.fillStyle = 'black';
                context.font = '14px Arial';
                context.textAlign = 'right';
                context.textBaseline = 'top';
                context.fillText(`${north}, ${west}`, x2 - 5, y1 + 40);
                context.fillText(key.toString(), x2 - 5, y1 + 23);
                context.fillText(data.feature.toString(), x2 - 5, y1 + 5);
            }
        }

        let cancelled = false;
        canvas.toBlob((blob) => {
            if (cancelled || renderGeneration !== renderGenerationRef.current || !blob) {
                L_gridRender.stop();
                return;
            }
            const imageUrl = URL.createObjectURL(blob);

            if (overlayRef.current) {
                const previousOverlay = overlayRef.current;
                const previousUrl = overlayUrlRef.current;
                const previousElement = previousOverlay.getElement();
                if (previousElement && transitionDuration > 0) {
                    previousElement.style.transition = `opacity ${transitionDuration}ms ease-out`;
                    previousElement.style.opacity = '0';
                }
                setTimeout(() => {
                    if (map.hasLayer(previousOverlay)) map.removeLayer(previousOverlay);
                    if (previousUrl) URL.revokeObjectURL(previousUrl);
                }, transitionDuration > 0 ? transitionDuration : 1);
            }

            const nextOverlay = L.imageOverlay(imageUrl, bounds);
            overlayRef.current = nextOverlay;
            overlayUrlRef.current = imageUrl;
            nextOverlay.addTo(map);

            const element = nextOverlay.getElement();
            if (element && transitionDuration > 0) {
                element.style.opacity = '0';
                element.style.transition = `opacity ${transitionDuration}ms ease-in`;
            }
            setTimeout(() => {
                if (element) element.style.opacity = layerOpacity.toString();
                L_gridRender.stop();
            }, transitionDuration > 0 ? transitionDuration : 0);
        }, 'image/png');

        return () => {
            cancelled = true;
        };
        // Rendering is intentionally coordinated by the existing debounced
        // isUpdate signal to preserve layer ordering and transition behavior.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isUpdate]);

    useEffect(() => {
        if (!map) return;

        // Canvas encoding is asynchronous. Invalidate an encoded frame as soon
        // as another interaction starts so it cannot replace the moving map
        // with an overlay based on the previous viewport.
        const invalidatePendingRender = () => {
            renderGenerationRef.current += 1;
        };
        const container = map.getContainer();

        container.addEventListener('pointerdown', invalidatePendingRender, { passive: true });
        map.on('movestart', invalidatePendingRender);
        map.on('dragstart', invalidatePendingRender);
        map.on('zoomstart', invalidatePendingRender);

        return () => {
            container.removeEventListener('pointerdown', invalidatePendingRender);
            map.off('movestart', invalidatePendingRender);
            map.off('dragstart', invalidatePendingRender);
            map.off('zoomstart', invalidatePendingRender);
        };
    }, [map]);

    useEffect(() => () => {
        if (overlayRef.current && map?.hasLayer(overlayRef.current)) {
            map.removeLayer(overlayRef.current);
        }
        if (overlayUrlRef.current) URL.revokeObjectURL(overlayUrlRef.current);
        overlayRef.current = null;
        overlayUrlRef.current = null;
    }, [map]);
}
