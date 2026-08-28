"use client";
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { availableColorMaps } from '../constants';
import { metaDataT, alignFeature_to_Metadata } from '@/components/plots/MetaDataHandler';
import { getGoodReadableRange } from '../helpers';

/**
 * Properties for the {@link ColorMapLegend} component.
 *
 * @example
 * ```ts
 * const legend: ColorMapLegendProps = {
 *   chartId: "albopictus-habitat-map",
 *   colorMapType: "interpolateInferno",
 *   minVal: 0,
 *   maxVal: 1,
 *   selectedFeature: "mean",
 *   metaData: {
 *     mean: { valuename: "mean", dimension: "probability", description: "Habitat suitability", availability: "2024" },
 *   },
 *   layerOpacity: 0.85,
 *   locale: "en",
 * };
 * ```
 */
export interface ColorMapLegendProps {
    /** Unique DOM ID suffix for the SVG linearGradient definition preventing collisions across multi-map layouts */
    chartId: string;
    /** Sequential D3 color map key (e.g. "interpolateInferno", "interpolateViridis", "interpolateRdBu") */
    colorMapType: string;
    /** Raw minimum feature data value before metadata unit scaling */
    minVal: number;
    /** Raw maximum feature data value before metadata unit scaling */
    maxVal: number;
    /** Name of the active dataset column feature */
    selectedFeature: string;
    /** Metadata dictionary specifying units, scaling factors, and dimension labels */
    metaData: metaDataT;
    /** Map layer opacity (0 to 1) applied to SVG gradient stop stops */
    layerOpacity: number;
    /** BCP-47 locale identifier for localized number formatting (e.g. "en", "de") */
    locale: string;
    /** Outer SVG width in pixels. @default 5 */
    width?: number;
    /** Outer SVG height in pixels. @default 160 */
    height?: number;
    /** Width of the vertical color gradient bar in pixels. @default 10 */
    barWidth?: number;
    /** Visibility toggle flag. @default true */
    isVisible?: boolean;
    /** Target number of axis ticks along the color scale. @default 5 */
    tickCount?: number;
}

/**
 * Universal color map legend component using classical D3 SVG imperative rendering.
 *
 * Renders a vertical color scale bar with unit-aligned axis ticks, handling:
 * - Feature-to-metadata alignment (`alignFeature_to_Metadata` for unit scaling)
 * - Human-readable numeric ranges (`getGoodReadableRange`)
 * - Symmetric domain centering for `interpolateRdBu` diverging color maps
 * - Opacity-aware SVG gradient stops matching map layer alpha settings
 * - Dynamic SVG container auto-sizing based on rendered text bounding boxes
 *
 * @param props - Configuration properties defined in {@link ColorMapLegendProps}.
 *
 * @remarks
 * In multi-view map layouts, legend SVG gradient IDs must be unique to avoid SVG linearGradient collision bugs.
 * `pointer-events: none` is set on the container SVG element so hovering or clicking over legend overlays does not block map navigation.
 *
 * @example
 * ```tsx
 * <ColorMapLegend
 *   chartId="habitat-map-legend"
 *   colorMapType="interpolateInferno"
 *   minVal={0.0}
 *   maxVal={1.0}
 *   selectedFeature="prob_7"
 *   metaData={metaData}
 *   layerOpacity={0.85}
 *   locale="en"
 *   height={160}
 * />
 * ```
 */
const ColorMapLegend: React.FC<ColorMapLegendProps> = ({
    chartId,
    colorMapType,
    minVal,
    maxVal,
    selectedFeature,
    metaData,
    layerOpacity,
    locale,
    width = 5,
    height = 160,
    barWidth = 10,
    isVisible = true,
    tickCount = 5,
}) => {
    const svgRef = useRef<SVGSVGElement | null>(null);

    useEffect(() => {
        if (!isVisible || !svgRef.current) return;

        const innerMargins = { top: 7, right: 10, bottom: 7, left: 5 };
        const innerHeight = height - innerMargins.top - innerMargins.bottom;
        const gradientId = `gradient-${chartId}`;

        // --- Compute aligned min/max/unit ---
        let minGoodVal = alignFeature_to_Metadata(minVal, selectedFeature, metaData).value;
        let maxGoodVal = alignFeature_to_Metadata(maxVal, selectedFeature, metaData).value;
        let unit = alignFeature_to_Metadata(minVal, selectedFeature, metaData).unit;
        [minGoodVal, maxGoodVal] = getGoodReadableRange(minGoodVal, maxGoodVal);
        if (isNaN(minGoodVal)) minGoodVal = 0;
        if (isNaN(maxGoodVal) || maxGoodVal <= minGoodVal) maxGoodVal = minGoodVal + 1;

        // --- Build D3 color scale ---
        const colorMap = d3.scaleSequential(
            availableColorMaps[colorMapType as keyof typeof availableColorMaps]
        );
        colorMap.domain([minGoodVal, maxGoodVal]);

        // Symmetric domain for interpolateRdBu diverging color maps
        if (colorMapType === "interpolateRdBu") {
            if ((minGoodVal < 0 && maxGoodVal > 0) || unit === "K" || unit === "°C") {
                const m = Math.max(Math.abs(minGoodVal), Math.abs(maxGoodVal));
                minGoodVal = -m;
                maxGoodVal = m;
            }
            colorMap.domain([maxGoodVal, minGoodVal]);
        }

        // --- Clear previous content ---
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        svg.attr("width", width)
            .attr("height", height)
            .style("pointer-events", "none");

        // --- Background rect ---
        svg.append("rect")
            .attr("x", 0.5)
            .attr("y", 0.5)
            .attr("rx", 4)
            .attr("ry", 4)
            .attr("width", width - 1)
            .attr("height", height - 1)
            .attr("fill", "rgba(255, 255, 255, 0.7)")
            .attr("stroke", "grey")
            .attr("stroke-width", 1);

        // --- Inner group with margins ---
        const legendSvg = svg.append("g")
            .attr("transform", `translate(${innerMargins.left}, ${innerMargins.top})`);

        // --- Gradient definition ---
        const gradient = legendSvg.append("defs")
            .append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%")
            .attr("y1", "100%")
            .attr("x2", "0%")
            .attr("y2", "0%");

        gradient.selectAll("stop")
            .data(d3.range(minGoodVal, maxGoodVal, (maxGoodVal - minGoodVal) / 100))
            .enter()
            .append("stop")
            .attr("offset", d => `${((d - minGoodVal) / (maxGoodVal - minGoodVal)) * 100}%`)
            .attr("stop-color", d => d3.color(colorMap(d))?.copy({ opacity: layerOpacity })?.toString() || colorMap(d));

        // --- Gradient bar ---
        legendSvg.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", barWidth)
            .attr("height", innerHeight)
            .style("fill", `url(#${gradientId})`);

        // --- Axis ---
        const legendScale = d3.scaleLinear()
            .domain([minGoodVal, maxGoodVal])
            .range([innerHeight - 1, 0]);

        const legendAxis = d3.axisRight(legendScale)
            .tickValues([...d3.range(minGoodVal, maxGoodVal, (maxGoodVal - minGoodVal) / tickCount), maxGoodVal])
            .tickFormat(d => {
                let rawValue = d as unknown as number;
                return ` ${rawValue.toLocaleString(locale, { maximumFractionDigits: 3 })} ${unit}`;
            })
            .tickSize(6);

        const axisGroup = legendSvg.append("g")
            .attr("transform", `translate(${barWidth}, 0)`)
            .call(legendAxis);

        // --- Dynamic Width Adjustment ---
        // Measure the width of the rendered axis labels
        const axisBBox = axisGroup.node()?.getBBox();
        // Calculate needed width: left margin + gradient bar + axis width + right margin
        const calculatedWidth = innerMargins.left + barWidth + (axisBBox ? axisBBox.width : 5) + innerMargins.right;
        const finalWidth = Math.max(width, calculatedWidth);

        // Update the SVG and background rectangle to the new calculated width
        svg.attr("width", finalWidth);
        svg.select("rect").attr("width", finalWidth - 1);

    }, [chartId, colorMapType, minVal, maxVal, selectedFeature, metaData, layerOpacity, locale, width, height, barWidth, isVisible, tickCount]);

    if (!isVisible) return null;

    return <svg ref={svgRef} />;
};

/** Default export for the accessible continuous-color map legend. */
export default ColorMapLegend;

