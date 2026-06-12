/**
 * useMapLibrePieCharts – Renders and updates pie/donut charts for sequence metadata
 * as a D3 SVG overlay aligned with MapLibre GL JS viewport.
 *
 * Replaces the D3 SVG overlay parts of MapDrawLayer_SequenceMetadata from LeafD3Map.tsx.
 */
import { useEffect, useRef } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import * as d3 from 'd3';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { DonutTooltip } from '../../overlays/DonutTooltip';
import { configureEquirectangularProjection, reprojectPointToEquirectangular } from '../utils/coordTransform';
import { MapDimensions } from '../../types';

interface UseMapLibrePieChartsParams {
    map: MapLibreMap | null;
    mapReady: boolean;
    countryCounts: { [key: string]: any };
    isSequenceMetaData: boolean;
    pieSize: number;
    isLoading: boolean;
    DonutColors: { [key: string]: string };
    sequenceMedatdata_colorMap: any;
    locale: string;
    mapData: any;
    t: any;
    cur_Sorgansim: string;
    chartName: string;
    isProjection_equirectangular?: boolean;
    dimensions?: MapDimensions;
}

export function useMapLibrePieCharts({
    map,
    mapReady,
    countryCounts,
    isSequenceMetaData,
    pieSize,
    isLoading,
    DonutColors,
    sequenceMedatdata_colorMap,
    locale,
    mapData,
    t,
    cur_Sorgansim,
    chartName,
    isProjection_equirectangular = false,
    dimensions,
}: UseMapLibrePieChartsParams): void {
    const piesMergedRef = useRef<d3.Selection<SVGGElement, any, SVGGElement, unknown> | null>(null);
    const tooltipRootRef = useRef<Root | null>(null);
    const tooltipContainerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!map || !mapReady || isLoading || !isSequenceMetaData) {
            cleanup();
            return;
        }

        const container = map.getContainer();
        if (!container) return;

        // 1) Initialize or select the tooltip container & React root
        if (!tooltipContainerRef.current) {
            const tooltipEl = document.createElement('div');
            tooltipEl.className = `donut-tooltip-container-${chartName}`;
            tooltipEl.style.cssText = 'position: absolute; pointer-events: none; z-index: 1000; top: 0; left: 0; width: 100%; height: 100%;';
            container.appendChild(tooltipEl);
            tooltipContainerRef.current = tooltipEl;
            tooltipRootRef.current = createRoot(tooltipEl);
        }

        // 2) Initialize or select the SVG overlay
        let svg = d3.select(container).select<SVGSVGElement>(`svg.pies-svg-${chartName}`);
        if (svg.empty()) {
            svg = d3.select(container)
                .append('svg')
                .attr('class', `pies-svg-${chartName}`)
                .style('position', 'absolute')
                .style('top', '0')
                .style('left', '0')
                .style('width', '100%')
                .style('height', '100%')
                .style('pointer-events', 'none')
                .style('z-index', '6');
        }

        let piesG = svg.select<SVGGElement>(`g.pies-${chartName}`);
        if (piesG.empty()) {
            piesG = svg.append('g')
                .attr('class', `pies-${chartName}`)
                .style('pointer-events', 'all')
                .style('overflow', 'visible');
        }

        // Clear previous SVG contents for a clean redraw
        piesG.selectAll('*').remove();

        const basePieSize = pieSize;
        const thickness = Math.ceil(pieSize / 3.333);
        const pieGen = d3.pie<number>();

        // Prep data array
        const dataArr = Object.entries(countryCounts)
            .map(([id, c]: [string, any]) => {
                const lat = c.center?.lat ?? 0;
                const lng = c.center?.lng ?? 0;
                const values = Array.isArray(c.counts) ? c.counts : [c.count ?? null];
                const labels = Array.isArray(c.labels) ? c.labels : [c.label ?? ''];
                if (c.count > 0) {
                    return {
                        id,
                        lat,
                        lng,
                        values,
                        labels,
                    };
                }
                return undefined;
            })
            .filter((d): d is any => d !== undefined);

        if (dataArr.length === 0) return;

        // D3 Join
        const pies = piesG.selectAll<SVGGElement, any>('g.pie')
            .data(dataArr, d => d.id);

        const piesEnter = pies.enter()
            .append('g')
            .attr('class', 'pie');

        const piesInner = piesEnter.append('g').attr('class', 'pie-scale');
        const enlargeBy = 4;

        // Render each pie
        piesInner.each(function (d) {
            const g = d3.select(this);
            const pieData = pieGen(d.values);

            const arcGenZero = d3.arc<d3.PieArcDatum<number>>()
                .innerRadius(basePieSize / 2 - thickness)
                .outerRadius(basePieSize / 2)
                .startAngle((a: any) => a.startAngle)
                .endAngle((a: any) => a.startAngle);

            g.selectAll('path')
                .data(pieData)
                .enter()
                .append('path')
                .attr('d', arcGenZero as any)
                .attr('labelID', (_, i) => i.toString())
                .attr('fill', (_, i) => DonutColors[d.labels[i]] || '#ccc')
                .attr('label', (_, i) => d.labels[i])
                .attr('stroke-opacity', 0.0)
                .attr('stroke', 'black')
                .attr('stroke-width', 0.5)
                .style('pointer-events', 'all')
                .style('cursor', 'pointer')
                .on('mouseover', function (event, arcData) {
                    event.stopPropagation();
                    const renderLabel = d3.select(this).attr('label');
                    const renderColor = d3.select(this).attr('fill');

                    if (tooltipRootRef.current) {
                        tooltipRootRef.current.render(
                            React.createElement(DonutTooltip, {
                                map,
                                mapData,
                                arcData,
                                d,
                                renderColor,
                                countryCounts,
                                locale,
                                basePieSize,
                                thickness,
                                HexHighlightCol: '#ffffff',
                                label: renderLabel,
                                t,
                                selection: cur_Sorgansim,
                                isVisible: true,
                            })
                        );
                    }

                    const select = d3.select(this);
                    select.transition()
                        .duration(200)
                        .attrTween('d', function () {
                            const outerInterp = d3.interpolate(basePieSize / 2, basePieSize / 2 + enlargeBy);
                            return function (time) {
                                const expandedArc = d3.arc<d3.PieArcDatum<number>>()
                                    .innerRadius(basePieSize / 2 - thickness)
                                    .outerRadius(outerInterp(time));
                                return expandedArc(arcData as any) || '';
                            };
                        })
                        .attr('stroke', 'black')
                        .attr('stroke-width', 0.5)
                        .attr('stroke-opacity', 1.0);
                    select.raise();
                })
                .on('mouseout', function (event, arcData) {
                    if (tooltipRootRef.current) {
                        tooltipRootRef.current.render(
                            React.createElement(DonutTooltip, {
                                arcData: 0,
                                d: { lat: 0, lng: 0 },
                                countryCounts: {},
                                locale,
                                HexHighlightCol: '',
                                basePieSize: 0,
                                thickness: 0,
                                isVisible: false,
                            })
                        );
                    }
                    const select = d3.select(this);
                    select.transition()
                        .duration(300)
                        .attrTween('d', function () {
                            const outerInterp = d3.interpolate(basePieSize / 2 + enlargeBy, basePieSize / 2);
                            return function (time) {
                                const shrinkArc = d3.arc<d3.PieArcDatum<number>>()
                                    .innerRadius(basePieSize / 2 - thickness)
                                    .outerRadius(outerInterp(time));
                                return shrinkArc(arcData as any) || '';
                            };
                        })
                        .attr('stroke', 'black')
                        .attr('stroke-width', 0.5)
                        .attr('stroke-opacity', 1.0);
                });

            // Animate transition to full arc
            const arcGen = d3.arc<d3.PieArcDatum<number>>()
                .innerRadius(basePieSize / 2 - thickness)
                .outerRadius(basePieSize / 2);

            g.selectAll('path')
                .transition()
                .duration(1000)
                .attrTween('d', function (arcData: any) {
                    const interpolate = d3.interpolate(arcData.startAngle, arcData.endAngle);
                    return function (time) {
                        arcData.endAngle = interpolate(time);
                        return arcGen(arcData) || '';
                    };
                })
                .transition()
                .duration(500)
                .attr('stroke-opacity', 1.0);

            // Add colored background and counts text above the pie chart
            const bgColor = d3.color(sequenceMedatdata_colorMap ? sequenceMedatdata_colorMap(countryCounts[d.id]?.count) : '#0d3eec');
            const rgbColor = bgColor ? bgColor.rgb() : null;
            const textColor = rgbColor && rgbColor.r * 0.299 + rgbColor.g * 0.587 + rgbColor.b * 0.114 > 186 ? d3.color('black') : d3.color('white');
            const textSize = thickness;


            g.append('text')
                .attr('x', 0)
                .attr('y', -((basePieSize / 2) + textSize))
                .attr('opacity', 0.0)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .attr('font-size', `${textSize}px`)
                .attr('fill', bgColor ? bgColor.toString() : 'white')
                .text('■■■')
                .attr('paint-order', 'stroke')
                .attr('stroke', bgColor ? bgColor.toString() : 'white')
                .attr('stroke-width', textSize - 2)
                .transition()
                .duration(2000)
                .attr('opacity', 1.0);

            g.append('text')
                .attr('x', 0)
                .attr('y', -((basePieSize / 2) + textSize - 1))
                .attr('opacity', 0.0)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .attr('font-size', '0px')
                .attr('fill', textColor ? textColor.toString() : 'white')
                .text(countryCounts[d.id]?.count || '0')
                .transition()
                .duration(2000)
                .attr('opacity', 1.0)
                .attr('font-size', `${textSize}px`);
        });

        // Store references for positioning update
        piesMergedRef.current = piesG.selectAll<SVGGElement, any>('g.pie');

        // Reposition pies initially
        repositionPies();

        // 3) Bind position update to map moves
        map.on('move', repositionPies);

        function repositionPies() {
            if (!map || !piesMergedRef.current) return;

            const scale = Math.pow(2, map.getZoom() - 3.0);
            const dims = dimensions || { width: container.clientWidth, height: container.clientHeight };
            const projection = isProjection_equirectangular ? configureEquirectangularProjection(map, dims) : null;

            piesMergedRef.current.each(function (d: any) {
                let lng = d.lng;
                let lat = d.lat;

                if (isProjection_equirectangular && projection) {
                    const [fakeLng, fakeLat] = reprojectPointToEquirectangular([d.lng, d.lat], map, projection);
                    lng = fakeLng;
                    lat = fakeLat;
                }

                const p = map.project([lng, lat]);
                const outer = d3.select(this);
                const inner = outer.select<SVGGElement>('g.pie-scale');

                outer.attr('transform', `translate(${p.x},${p.y})`);
                inner.attr('transform', `scale(${scale})`);
            });
        }

        function cleanup() {
            if (map) {
                map.off('move', repositionPies);
            }
            if (tooltipRootRef.current) {
                try {
                    tooltipRootRef.current.unmount();
                } catch { /* ignore */ }
                tooltipRootRef.current = null;
            }
            if (tooltipContainerRef.current && container.contains(tooltipContainerRef.current)) {
                container.removeChild(tooltipContainerRef.current);
            }
            tooltipContainerRef.current = null;

            const s = d3.select(container).select(`svg.pies-svg-${chartName}`);
            if (!s.empty()) {
                s.remove();
            }
            piesMergedRef.current = null;
        }

        return cleanup;
    }, [map, mapReady, countryCounts, isSequenceMetaData, pieSize, isLoading, DonutColors, sequenceMedatdata_colorMap, locale, mapData, cur_Sorgansim, chartName, isProjection_equirectangular, dimensions]);
}
