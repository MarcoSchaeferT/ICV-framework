"use client";
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import * as GEOjson from 'geojson';
import { t_richConfig } from '@/app/const_store';

// ─── PolylineTooltip ────────────────────────────────────────────────────────

export type PolylineTooltipProps = {
    points: [number, number][];
};

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


// ─── getLabelPolyline ────────────────────────────────────────────────────────

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


export interface DonutTooltipProps {
    /** The Leaflet map instance used for coordinate conversions. */
    map?: any;
    
    /** The full dataset being visualized on the map. */
    mapData?: any;
    
    /** The D3 pie arc data object for the hovered slice. */
    arcData: d3.PieArcDatum<number> | any;
    
    /** The data point (geographic feature) associated with the pie chart. Contains lat, lng, and id. */
    d: any;
    
    /** The fill color of the hovered pie slice. */
    renderColor?: string;
    
    /** Dictionary mapping feature IDs to their total counts. */
    countryCounts: Record<string | number, any>;
    
    /** The locale string for number formatting. */
    locale: string;
    
    /** Highlight color for the tooltip border or background. */
    HexHighlightCol: string;
    
    /** The base outer diameter/size of the pie chart in pixels. */
    basePieSize: number;
    
    /** The thickness of the donut ring in pixels. */
    thickness: number;
    
    /** The label text for the hovered slice (e.g., the serotype name). */
    label?: string;
    
    /** The translation function from next-intl. */
    t?: any;
    
    /** The current filter selection state (e.g., "ALL"). */
    selection?: string;
    
    /** Whether the tooltip should be rendered. */
    isVisible?: boolean;
}

/**
 * Tooltip component rendered when hovering over a donut/pie slice on the map.
 * Shows counts, percentage, serotype label, and translated country name.
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
