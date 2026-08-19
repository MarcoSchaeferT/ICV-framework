
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