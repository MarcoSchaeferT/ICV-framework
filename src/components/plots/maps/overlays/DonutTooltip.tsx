"use client";
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import * as GEOjson from 'geojson';
import { t_richConfig } from '@/app/const_store';

/**
 * Properties for the {@link PolylineTooltip} connector component.
 *
 * @example
 * ```ts
 * const connector: PolylineTooltipProps = {
 *   points: [[420, 180], [448, 160], [490, 160]],
 * };
 * ```
 */
export type PolylineTooltipProps = {
    /** Array of three `[x, y]` SVG pixel coordinate pairs defining the leader line elbow */
    points: [number, number][];
};

/**
 * Renders an SVG polyline leader line connecting a donut slice centroid to its floating tooltip card.
 *
 * @param props - Configuration containing three local coordinate points.
 *
 * @remarks
 * `pointerEvents: "none"` is set on the container `div` and SVG `<polyline>` to prevent leader lines
 * from blocking map hover or click interactions.
 */
export const PolylineTooltip: React.FC<PolylineTooltipProps> = ({
    points = [[0, 0], [0, 0], [0, 0]],
}) => {
    const polyLineSVG = useRef<SVGSVGElement | null>(null);

    // Add extra space for stroke width
    const strokeWidth = 4;
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    const minX = Math.min(...xs) - strokeWidth;
    const minY = Math.min(...ys) - strokeWidth;
    const maxX = Math.max(...xs) + strokeWidth;
    const maxY = Math.max(...ys) + strokeWidth;
    const width = maxX - minX;
    const height = maxY - minY;

    useEffect(() => {
        // Adjust points to local SVG coordinates
        const polyCoords = [
            [points[2][0] - minX, points[2][1] - minY],
            [points[1][0] - minX, points[1][1] - minY],
            [points[0][0] - minX, points[0][1] - minY],
        ]
            .map((p) => p.join(","))
            .join(" ");

        const existingSVG = d3.select(polyLineSVG.current).selectAll("polyline");
        existingSVG.remove();
        const d3Svg = d3.select(polyLineSVG.current)
            .attr("width", width)
            .attr("height", height);

        d3Svg.append("polyline")
            .style("pointer-events", "none")
            .attr("points", polyCoords)
            .attr("stroke", "#23235b")
            .attr("stroke-width", strokeWidth)
            .attr("fill", "none");
    }, [points, width, height, minX, minY]);

    return (
        <div
            className='absolute z-8000 bg-transparent overflow-visible '
            style={{
                left: `${minX}px`,
                top: `${minY}px`,
                width: `${width}px`,
                height: `${height}px`,
                pointerEvents: "none",
                border: "none",
                display: "block",
            }}
        >
            <svg ref={polyLineSVG}> </svg>
        </div>
    );
};


/**
 * Calculates a three-point elbow polyline (`[A, B, C]`) for pie slice leader annotations.
 *
 * @param arcData - D3 PieArcDatum defining slice start and end angles.
 * @param basePieSize - Base diameter of the donut chart in pixels.
 * @param thickness - Ring thickness of the donut chart in pixels.
 * @returns Array of three `[x, y]` relative coordinate offsets `[posA, posB, posC]`.
 */
export function getLabelPolyline(arcData: d3.PieArcDatum<number>, basePieSize: number, thickness: number) {
    const labelRadius = basePieSize / 2 + thickness / 2; // distance from pie center
    const startRadius = basePieSize / 2 - thickness / 2; // distance from pie center to start of arc
    const angle = (arcData.startAngle + arcData.endAngle) / 2;
    const posA = [Math.cos(angle - Math.PI / 2) * startRadius, Math.sin(angle - Math.PI / 2) * startRadius];
    const posB = [Math.cos(angle - Math.PI / 2) * labelRadius, Math.sin(angle - Math.PI / 2) * labelRadius];
    let posC = [posB[0], posB[1]];
    const midangle = arcData.startAngle + (arcData.endAngle - arcData.startAngle) / 2;
    posC[0] = labelRadius * 0.95 * (midangle < Math.PI ? 1 : -1); // multiply by 1 or -1 to put it on the right or on the left

    return [posA, posB, posC];
}


/**
 * Properties for the {@link DonutTooltip} component.
 *
 * @example
 * ```ts
 * const tooltip: DonutTooltipProps = {
 *   arcData: { data: 94, value: 94, index: 1, startAngle: 0, endAngle: Math.PI, padAngle: 0 },
 *   d: { lat: 52.52, lng: 13.405, id: "Germany" },
 *   countryCounts: { Germany: { count: 221 } },
 *   locale: "en",
 *   HexHighlightCol: "#4ecdc4",
 *   basePieSize: 40,
 *   thickness: 10,
 *   label: "DENV-2",
 *   isVisible: true,
 * };
 * ```
 */
export interface DonutTooltipProps {
    /** Leaflet map instance used for lat/lng to container pixel projection conversions */
    map?: any;
    
    /** World GeoJSON feature collection used to resolve localized country names */
    mapData?: any;
    
    /** D3 pie arc datum for the hovered donut slice */
    arcData: d3.PieArcDatum<number> | any;
    
    /** Geographic feature datum associated with the pie chart containing lat, lng, and country ID */
    d: any;
    
    /** Hex or CSS fill color string of the hovered pie slice */
    renderColor?: string;
    
    /** Dictionary mapping country identifiers to total sequence observation counts */
    countryCounts: Record<string | number, any>;
    
    /** BCP-47 locale string for localized formatting (e.g. "en", "de") */
    locale: string;
    
    /** Hex color string used to highlight counts text */
    HexHighlightCol: string;
    
    /** Base outer diameter of the pie chart in pixels */
    basePieSize: number;
    
    /** Donut ring thickness in pixels */
    thickness: number;
    
    /** Label string for the hovered category (e.g. Dengue serotype "DENV-1") */
    label?: string;
    
    /** `next-intl` translation function */
    t?: any;
    
    /** Current category filter state string */
    selection?: string;
    
    /** Tooltip visibility flag */
    isVisible?: boolean;
}

/**
 * Interactive callout tooltip displayed when hovering over country centroid donut chart slices.
 *
 * Displays sample counts, percentage distributions, serotype classifications, localized country names,
 * and an SVG elbow polyline connector anchored to the pie slice centroid.
 *
 * @param props - Configuration properties defined in {@link DonutTooltipProps}.
 *
 * @remarks
 * `pointerEvents: "none"` is applied to prevent tooltip cards from intercepting map mousemove events,
 * avoiding rapid flickering during slice hover interactions.
 *
 * @example
 * ```tsx
 * <DonutTooltip
 *   map={mapInstance}
 *   mapData={worldGeoJson}
 *   arcData={hoveredArc}
 *   d={{ lat: 14.0, lng: 100.0, id: "Thailand" }}
 *   renderColor="#ef1717"
 *   countryCounts={{ Thailand: { count: 1250 } }}
 *   locale="en"
 *   HexHighlightCol="#f87171"
 *   basePieSize={50}
 *   thickness={12}
 *   label="DENV-1"
 *   isVisible={true}
 * />
 * ```
 */
export function DonutTooltip({ 
    map, 
    mapData, 
    arcData, 
    d, 
    renderColor, 
    countryCounts, 
    locale, 
    HexHighlightCol, 
    basePieSize, 
    thickness, 
    label, 
    t, 
    selection, 
    isVisible 
}: DonutTooltipProps) {

    const labelWidth = 230;
    const labelHeight = 160;
    // Get the center of the current hover object (pie slice)
    // Get absolute pie center in SVG coordinates
    if (!map) return null;
    const pieCenterAbs = map.latLngToContainerPoint([d.lat, d.lng]);

    const s = map.getZoomScale(map.getZoom(), 3.0); // scale factor relative to base zoom
    const [posA, posB, posC] = getLabelPolyline(arcData, basePieSize, thickness);
    let posCLatLng = map.containerPointToLatLng([posC[0], posC[1]]);
    posCLatLng.lat += d.lat;
    posCLatLng.lng += d.lng;


    // Adjust tooltip position: offset from pie center by posC, then shift right/down for better visibility
    const posCPol = [posC[0] * s + pieCenterAbs.x, posC[1] * s + pieCenterAbs.y];
    const posBPol = [posB[0] * s + pieCenterAbs.x, posB[1] * s + pieCenterAbs.y];
    const posAPol = [posA[0] * s + pieCenterAbs.x, posA[1] * s + pieCenterAbs.y];

    const midangle = arcData.startAngle + (arcData.endAngle - arcData.startAngle) / 2;

    const tooltipX = posCPol[0] + (labelWidth * (midangle < Math.PI ? 0.1 : -1.1));
    const tooltipY = posCPol[1] - labelHeight / 2;

    const posCPolfin = [tooltipX, posCPol[1]];

    let textTotal = selection == "ALL" ? t.rich('tooltipDonut.total', { ...t_richConfig }) : label;
    let textPercentage = selection == "ALL" ? (Math.min(
        (arcData.value / (countryCounts[d.id]?.count || 1)) * 100,
        100
    )).toLocaleString(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    }) + "%" : "does not apply";

    // get translated country name
    let countryName = "";
    mapData.features.forEach((feature: GEOjson.Feature) => {
        feature.properties = feature.properties || {};
        if (feature && (feature.properties.admin == d.id)
            || feature.properties!.NAME == d.id
            || feature.properties!.iso_a3 == d.id
            || feature.properties!.iso_a2 == d.id) {
            countryName = feature.properties!["NAME_" + locale] || feature.properties!["name_" + locale] || "";
            return;
        }
    });

    // Polyline coordinates adjusted to be relative to the SVG's local coords
    const points: [number, number][] = [
        [posCPolfin[0], posCPolfin[1]],
        [posBPol[0], posBPol[1]],
        [posAPol[0], posAPol[1]]
    ];

    if (!isVisible) return null;
    return (
        <>
            <PolylineTooltip points={points} />
            <div
                className="
                    absolute
                    bg-linear-to-br from-[#23235b] via-[#23235b] to-[#1a1a2a]
                    text-slate-50
                    rounded-3xl
                    shadow-lg
                    p-[14px_22px]
                    text-[15px]
                    border border-[#3b3b6b]
                    font-[Segoe_UI,Arial,sans-serif]
                    z-9999
                "
                style={{
                    top: tooltipY,
                    left: tooltipX,
                    width: labelWidth,
                    height: "fit-content",
                    minWidth: labelWidth,
                    maxWidth: labelWidth,
                    pointerEvents: "none",
                }}
            >
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                        <span>
                            <span
                                className="text-3xl font-semibold tracking-tight"
                                style={{ color: HexHighlightCol }}
                            >
                                {arcData.value.toLocaleString(locale)}
                            </span>
                            <span className="text-sm text-indigo-200">
                                {" counts"}
                            </span>
                        </span>

                    </div>
                    <div className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-2 py-2 text-xs font-medium tracking-wide text-indigo-100">
                        <span
                            className="h-4 w-4 rounded-sm"
                            style={{ backgroundColor: renderColor }}
                        />
                        <span>{label}</span>
                    </div>
                </div>
                <div className="my-1 border-t border-white/20" role="separator"></div>
                <table className="w-full mt-2 text-sm border-collapse">
                    <tbody>
                        {selection == "ALL" && (
                            <tr>
                                <td className="font-medium text-indigo-300">Serotype:</td>
                                <td>{label}</td>
                            </tr>)}
                        {selection == "ALL" && (
                            <tr>
                                <td className="font-medium text-indigo-300">{textTotal}:</td>
                                <td>{countryCounts[d.id]?.count || "0"}</td>
                            </tr>)}
                        {selection == "ALL" && (
                            <tr>
                                <td className="font-medium text-indigo-300">{t.rich('tooltipDonut.relative', { ...t_richConfig })}:</td>
                                <td>
                                    {textPercentage}
                                </td>
                            </tr>
                        )}
                        <tr>
                            <td className="font-medium text-indigo-300"> {t.rich('tooltipDonut.country', { ...t_richConfig })}:</td>
                            <td>{countryName}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </>
    );
}

