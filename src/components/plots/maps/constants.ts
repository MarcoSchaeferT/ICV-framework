
import * as d3 from 'd3';


/** Maximum longitude range bound in degrees ($\pm 180^\circ$) */
export const RANGE_LONG = 180;
/** Maximum latitude range bound in degrees ($\pm 90^\circ$) */
export const RANGE_LAT = 90;
/** Maximum Leaflet zoom level limit */
export const MAX_ZOOM = 13;
/** Minimum Leaflet zoom level limit (supports negative zooms for small minimap containers) */
export const MIN_ZOOM = -1;
/** Zoom step increment value */
export const ZOOM_STEP = 0.01;
/** Precision decimal places count for coordinate comparisons */
export const NUMBERS_AFTER_COMMA = 3;
/**
 * Coordinate precision scaling factor ($10^{\text{NUMBERS\_AFTER\_COMMA}} = 1000$).
 *
 * Used by {@link useMapPosition} to eliminate floating-point coordinate feedback loops.
 */
export const CALCER = Math.pow(10, NUMBERS_AFTER_COMMA);


/** Complete dictionary of all available D3 sequential, diverging, and cyclical color map interpolators */
export const availableColorMapsAll = {
    "interpolateBlues": d3.interpolateBlues,
    "interpolateBrBG": d3.interpolateBrBG,
    "interpolateBuGn": d3.interpolateBuGn,
    "interpolateBuPu": d3.interpolateBuPu,
    "interpolateCividis": d3.interpolateCividis,
    "interpolateCool": d3.interpolateCool,
    "interpolateCubehelixDefault": d3.interpolateCubehelixDefault,
    "interpolateGnBu": d3.interpolateGnBu,
    "interpolateGreens": d3.interpolateGreens,
    "interpolateGreys": d3.interpolateGreys,
    "interpolateInferno": d3.interpolateInferno,
    "interpolateMagma": d3.interpolateMagma,
    "interpolateOrRd": d3.interpolateOrRd,
    "interpolateOranges": d3.interpolateOranges,
    "interpolatePRGn": d3.interpolatePRGn,
    "interpolatePiYG": d3.interpolatePiYG,
    "interpolatePlasma": d3.interpolatePlasma,
    "interpolatePuBu": d3.interpolatePuBu,
    "interpolatePuBuGn": d3.interpolatePuBuGn,
    "interpolatePuOr": d3.interpolatePuOr,
    "interpolatePuRd": d3.interpolatePuRd,
    "interpolatePurples": d3.interpolatePurples,
    "interpolateRainbow": d3.interpolateRainbow,
    "interpolateRdBu": d3.interpolateRdBu,
    "interpolateRdGy": d3.interpolateRdGy,
    "interpolateRdPu": d3.interpolateRdPu,
    "interpolateRdYlBu": d3.interpolateRdYlBu,
    "interpolateRdYlGn": d3.interpolateRdYlGn,
    "interpolateReds": d3.interpolateReds,
    "interpolateSinebow": d3.interpolateSinebow,
    "interpolateSpectral": d3.interpolateSpectral,
    "interpolateTurbo": d3.interpolateTurbo,
    "interpolateViridis": d3.interpolateViridis,
    "interpolateWarm": d3.interpolateWarm,
    "interpolateYlGn": d3.interpolateYlGn,
    "interpolateYlGnBu": d3.interpolateYlGnBu,
    "interpolateYlOrBr": d3.interpolateYlOrBr,
    "interpolateYlOrRd": d3.interpolateYlOrRd
};

/**
 * Curated palette dictionary of primary D3 color interpolators for ICV visualizations.
 *
 * Includes perceptually uniform (Viridis, Inferno, Cividis), sequential (Blues, Greens), and colorblind-safe diverging (RdBu) palettes.
 *
 * @see {@link ColorMapLegend} for legend rendering.
 * @see {@link useGridLayer} for tile canvas coloring.
 */
export const availableColorMaps = {
    "interpolateBlues": d3.interpolateBlues,
    "interpolateCividis": d3.interpolateCividis,
    "interpolateGreens": d3.interpolateGreens,
    "interpolateInferno": d3.interpolateInferno,
    "interpolateRdBu": d3.interpolateRdBu,
    "interpolateViridis": d3.interpolateViridis,
};

/** Key string mapping for available D3 color map names */
export const availableColorMapsNames = {
    interpolateBlues: "interpolateBlues",
    interpolateCividis: "interpolateCividis",
    interpolateGreens: "interpolateGreens",
    interpolateInferno: "interpolateInferno",
    interpolateRdBu: "interpolateRdBu",
    interpolateViridis: "interpolateViridis",
};

/**
 * Presence data dot colors tailored to each D3 colormap for maximum visual contrast.
 */
export const COLORMAP_PRESENCE_COLORS: Record<string, string> = {
    interpolateInferno: "rgb(2, 246, 250)",      // Türkis / Light Blue (high contrast against dark purple, red, orange, yellow)
    interpolateMagma: "rgb(2, 246, 250)",        // Türkis / Light Blue
    interpolatePlasma: "rgb(2, 246, 250)",       // Türkis / Light Blue
    interpolateWarm: "rgb(2, 246, 250)",         // Türkis / Light Blue
    interpolateYlOrRd: "rgb(2, 246, 250)",       // Türkis / Light Blue
    interpolateOrRd: "rgb(2, 246, 250)",         // Türkis / Light Blue
    interpolateReds: "rgb(2, 246, 250)",         // Türkis / Light Blue
    interpolateOranges: "rgb(2, 246, 250)",      // Türkis / Light Blue
    interpolateViridis: "rgb(255, 128, 0)",      // Vivid Orange (high contrast against deep purple, teal, yellow-green)
    interpolateCividis: "rgb(239, 23, 23)",      // Bright Red (high contrast against dark navy and yellow)
    interpolateBlues: "rgb(255, 128, 0)",        // Vivid Orange (complementary contrast against blue tones)
    interpolateBuPu: "rgb(255, 128, 0)",         // Vivid Orange
    interpolatePuBu: "rgb(255, 128, 0)",         // Vivid Orange
    interpolateCool: "rgb(255, 128, 0)",         // Vivid Orange
    interpolatePuBuGn: "rgb(255, 128, 0)",       // Vivid Orange
    interpolateGreens: "rgb(236, 72, 153)",      // Vivid Magenta (complementary contrast against green tones)
    interpolateBuGn: "rgb(236, 72, 153)",        // Vivid Magenta
    interpolateYlGn: "rgb(236, 72, 153)",        // Vivid Magenta
    interpolateYlGnBu: "rgb(236, 72, 153)",      // Vivid Magenta
    interpolateRdBu: "rgb(255, 191, 0)",         // Bright Gold / Amber (high contrast against both red and blue)
    interpolateSpectral: "rgb(2, 246, 250)",     // Türkis / Light Blue
    interpolateRdYlBu: "rgb(2, 246, 250)",       // Türkis / Light Blue
    interpolateRdYlGn: "rgb(2, 246, 250)",       // Türkis / Light Blue
};

/**
 * Returns a high-contrast presence data dot color based on the selected colormap.
 * If a custom presence color is provided and no specific colormap mapping applies, it falls back to customColor.
 *
 * @param colorMapType - Active colormap key (e.g. "interpolateInferno", "interpolateBlues", "interpolateViridis")
 * @param customColor  - Optional custom color override from mapUIsettings
 * @returns CSS color string (e.g. "rgb(2, 246, 250)")
 */
export function getPresenceDataColor(colorMapType?: string, customColor?: string): string {
    if (colorMapType && COLORMAP_PRESENCE_COLORS[colorMapType]) {
        return COLORMAP_PRESENCE_COLORS[colorMapType];
    }
    if (customColor && customColor.trim() !== "") {
        return customColor;
    }
    return "rgb(2, 246, 250)"; // Default Türkis / Light Blue
}