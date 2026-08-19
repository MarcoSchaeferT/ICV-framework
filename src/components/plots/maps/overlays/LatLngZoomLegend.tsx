"use client";
import React from 'react';
import { useLocale } from "next-intl";

/**
 * Properties for the {@link LatLngZoomLegend} component.
 *
 * @example
 * ```ts
 * const viewportLegend: LatLngZoomLegendProps = {
 *   latitude: 52.52,
 *   longitude: 13.405,
 *   zoom: 6,
 *   scaleLegDims: { posX: 5, posY: 15, width: 100, height: 24 },
 * };
 * ```
 */
export interface LatLngZoomLegendProps {
    /** Viewport center latitude in degrees */
    latitude: number;
    /** Viewport center longitude in degrees */
    longitude: number;
    /** Current map zoom level */
    zoom: number;
    /** Bounding dimensions and pixel offset of the companion distance scale bar */
    scaleLegDims: {
        posY: number;
        width: number;
        posX: number;
        height: number;
    };
}

/**
 * HUD overlay component displaying live viewport numerical coordinates (Latitude, Longitude, Zoom).
 *
 * Positioned in the lower-left map corner relative to the distance scale bar (`scaleLegDims`), displaying
 * localized numeric values formatted via `next-intl` (`useLocale`).
 *
 * @param props - Configuration properties defined in {@link LatLngZoomLegendProps}.
 *
 * @remarks
 * `pointerEvents: "none"` is applied to the root container element to ensure that live HUD readout overlays
 * do not intercept Leaflet map panning or zoom mouse gestures.
 *
 * @example
 * ```tsx
 * <LatLngZoomLegend
 *   latitude={52.52}
 *   longitude={13.405}
 *   zoom={6.0}
 *   scaleLegDims={{ posX: 5, posY: 5, width: 118, height: 35 }}
 * />
 * ```
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

/** Default export for the current Leaflet viewport coordinate legend. */
export default LatLngZoomLegend;

