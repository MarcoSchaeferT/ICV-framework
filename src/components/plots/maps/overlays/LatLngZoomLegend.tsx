"use client";
import React from 'react';
import { useLocale } from "next-intl";

/**
 * Props for the LatLngZoomOverlay component.
 */
export interface LatLngZoomLegendProps {
    latitude: number;
    longitude: number;
    zoom: number;
    scaleLegDims: {
        posY: number;
        width: number;
        posX: number;
        height: number;
    };
}

/**
 * Small overlay displaying current Lat / Lng / Zoom values
 * on the map. Positioned relative to the scale legend dimensions.
 */
const LatLngZoomLegend: React.FC<LatLngZoomLegendProps> = ({
    latitude,
    longitude,
    zoom,
    scaleLegDims,
}) => {
    const locale = useLocale();

    return (
        <div
            style={{
                position: "absolute",
                bottom: scaleLegDims.posY - 1,
                left: scaleLegDims.width + scaleLegDims.posX + 4,
                height: scaleLegDims.height + 1,
                background: "rgba(255, 255, 255, 0.7)",
                color: "black",
                fontSize: "10px",
                padding: "2px 6px",
                borderRadius: "6px",
                zIndex: 50,
                pointerEvents: "none",
                textAlign: "center",
                border: "1px solid #454444af",
                boxSizing: "border-box",
            }}
        >
            <div className="grid grid-cols-3 gap-0 w-full text-center overflow-hidden">
                <div className="font-bold">Lat</div>
                <div className="font-bold">Lng</div>
                <div className="font-bold">Zoom</div>
                <div>{latitude.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</div>
                <div>{longitude.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</div>
                <div>{zoom.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</div>
            </div>
        </div>
    );
};

export default LatLngZoomLegend;
