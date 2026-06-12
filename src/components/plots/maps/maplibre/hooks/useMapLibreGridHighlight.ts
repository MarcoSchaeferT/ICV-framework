/**
 * useMapLibreGridHighlight – Renders grid cell highlights (hover and selected)
 * as D3 SVG elements overlaying the MapLibre GL JS container, handling normal
 * and equirectangular projection modes.
 */
import { useEffect, useRef } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import * as d3 from 'd3';
import { configureEquirectangularProjection, reprojectPointToEquirectangular } from '../utils/coordTransform';
import { MapDimensions } from '../../types';

interface UseMapLibreGridHighlightParams {
    map: MapLibreMap | null;
    mapReady: boolean;
    gridData: Map<number, any>;
    hoveredGridcellID: number;
    selectedGridcellID: number;
    gridcellSizeLatLng: { lat: number; lng: number };
    chartName: string;
    isProjection_equirectangular?: boolean;
    dimensions?: MapDimensions;
}

export function useMapLibreGridHighlight({
    map,
    mapReady,
    gridData,
    hoveredGridcellID,
    selectedGridcellID,
    gridcellSizeLatLng,
    chartName,
    isProjection_equirectangular = false,
    dimensions,
}: UseMapLibreGridHighlightParams): void {
    const svgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);

    useEffect(() => {
        if (!map || !mapReady) {
            cleanup();
            return;
        }

        const container = map.getContainer();
        if (!container) return;

        // Initialize or select the highlight SVG overlay
        let svg = d3.select(container).select<SVGSVGElement>(`svg.grid-highlight-${chartName}`);
        if (svg.empty()) {
            svg = d3.select(container)
                .append('svg')
                .attr('class', `grid-highlight-${chartName}`)
                .style('position', 'absolute')
                .style('top', '0')
                .style('left', '0')
                .style('width', '100%')
                .style('height', '100%')
                .style('pointer-events', 'none')
                .style('z-index', '5');
        }
        svgRef.current = svg;

        // Redraw highlights
        drawHighlights();

        // Sync with map movements
        map.on('move', drawHighlights);

        function drawHighlights() {
            if (!map || !svgRef.current) return;

            const currentSvg = svgRef.current;
            currentSvg.selectAll('*').remove();

            const dims = dimensions || { width: container.clientWidth, height: container.clientHeight };
            const projection = isProjection_equirectangular ? configureEquirectangularProjection(map, dims) : null;

            // 1) Draw Hovered Grid Cell (Red semi-transparent overlay)
            if (hoveredGridcellID !== -1) {
                const hoverCell = gridData.get(hoveredGridcellID);
                if (hoverCell && hoverCell.geometry && hoverCell.geometry.length > 0) {
                    const lat = hoverCell.geometry[0][0];
                    const lng = hoverCell.geometry[0][1];
                    drawCellRect(lat, lng, 'hover-grid-cell', 'red', 0.5, 'black', 1);
                }
            }

            // 2) Draw Selected Grid Cell (Yellow outline)
            if (selectedGridcellID !== -1) {
                const selectCell = gridData.get(selectedGridcellID);
                if (selectCell && selectCell.geometry && selectCell.geometry.length > 0) {
                    const lat = selectCell.geometry[0][0];
                    const lng = selectCell.geometry[0][1];
                    drawCellRect(lat, lng, 'selected-grid-cell', 'none', 1.0, 'yellow', 3);
                }
            }

            function drawCellRect(
                cellLat: number,
                cellLng: number,
                className: string,
                fill: string,
                opacity: number,
                stroke: string,
                strokeWidth: number
            ) {
                if (!map) return;

                const latBottom = cellLat + gridcellSizeLatLng.lat;
                const lngRight = cellLng + gridcellSizeLatLng.lng;

                let tlLng = cellLng;
                let tlLat = cellLat;
                let brLng = lngRight;
                let brLat = latBottom;

                if (isProjection_equirectangular && projection) {
                    const [fakeTlLng, fakeTlLat] = reprojectPointToEquirectangular([cellLng, cellLat], map, projection);
                    const [fakeBrLng, fakeBrLat] = reprojectPointToEquirectangular([lngRight, latBottom], map, projection);
                    tlLng = fakeTlLng;
                    tlLat = fakeTlLat;
                    brLng = fakeBrLng;
                    brLat = fakeBrLat;
                }

                const topLeft = map.project([tlLng, tlLat]);
                const bottomRight = map.project([brLng, brLat]);

                const width = Math.abs(bottomRight.x - topLeft.x);
                const height = Math.abs(bottomRight.y - topLeft.y);

                currentSvg.append('rect')
                    .attr('class', className)
                    .attr('x', Math.min(topLeft.x, bottomRight.x))
                    .attr('y', Math.min(topLeft.y, bottomRight.y))
                    .attr('width', width)
                    .attr('height', height)
                    .attr('fill', fill)
                    .attr('opacity', opacity)
                    .attr('stroke', stroke)
                    .attr('stroke-width', strokeWidth);
            }
        }

        function cleanup() {
            if (map) {
                map.off('move', drawHighlights);
            }
            const container = map?.getContainer();
            if (container) {
                const s = d3.select(container).select(`svg.grid-highlight-${chartName}`);
                if (!s.empty()) {
                    s.remove();
                }
            }
            svgRef.current = null;
        }

        return cleanup;
    }, [map, mapReady, gridData, hoveredGridcellID, selectedGridcellID, gridcellSizeLatLng, chartName, isProjection_equirectangular, dimensions]);
}
