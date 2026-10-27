/**
 * Shared data contracts for the Leaflet WebGL2 renderer.
 *
 * @remarks
 * Geographic coordinates use `[latitude, longitude]` order after GeoJSON has
 * been parsed. GPU colors are normalized, premultiplied at fragment-output
 * time, and blended with `ONE, ONE_MINUS_SRC_ALPHA`.
 */
import type * as GEOjson from 'geojson';

/** Normalized `[red, green, blue, alpha]` components in the range `[0, 1]`. */
export type ColorVector = [number, number, number, number];
/** Geographic `[latitude, longitude]` pair in degrees. */
export type LatLngPoint = [number, number];

/** Construction options for {@link WebGLGridRenderer}. */
export interface WebGLGridRendererOptions {
    /** Canvas owned by the React/Leaflet bridge and used as the WebGL surface. */
    canvas: HTMLCanvasElement;
    /** Enables lifecycle and geometry-upload diagnostics. */
    debug?: boolean;
    /** Re-uploads application state after WebGL recreates resources. */
    onContextRestored?: () => void;
}

/** One polygon shell and its optional interior holes, retained for CPU picking. */
export interface CountryPolygon {
    /** Exterior ring. */
    outer: LatLngPoint[];
    /** Interior rings that must not count as part of the country. */
    holes: LatLngPoint[][];
}

/** CPU-side country metadata used for hit testing and selection lookup. */
export interface CountryRecord {
    /** Positive integer shared with border instances; `-1` means no selection. */
    id: number;
    /** Original feature forwarded to interaction callbacks. */
    feature: GEOjson.Feature;
    /** Preferred ISO code, falling back to the feature name or numeric id. */
    code: string;
    /** Preferred display-independent feature name. */
    name: string;
    /** `[minLat, maxLat, minLng, maxLng]` */
    bbox: [number, number, number, number];
    /** Polygon rings in `[lat, lng]` order for point-in-polygon tests. */
    polygons: CountryPolygon[];
}

/** Optional visual styles shared by the polygon and border passes. */
export interface PolygonStyleOptions {
    /** Ocean/background color rendered behind or around land. */
    backgroundColor?: string;
    /** Base country-fill color. */
    baseFillColor?: string;
    /** Additional multiplier applied to the fill color's alpha channel. */
    baseFillOpacity?: number;
    /** Default country-border color. */
    baseStrokeColor?: string;
    /** Border color for the country under the pointer. */
    hoverStrokeColor?: string;
    /** Border color for the selected country. */
    activeStrokeColor?: string;
    /** Default border width in CSS pixels. */
    strokeWidth?: number;
    /** Hover border width in CSS pixels. */
    hoverStrokeWidth?: number;
    /** Selected border width in CSS pixels. */
    activeStrokeWidth?: number;
}

/**
 * GPU-ready country geometry plus CPU records.
 *
 * @remarks
 * `polygonVertices` is tightly packed as `[lat, lng]`. `polygonIndices`
 * contains Earcut triangle indices. `borderSegments` uses one five-float
 * instance record per edge: `[latA, lngA, latB, lngB, countryId]`.
 */
export interface CountryGeometry {
    countries: CountryRecord[];
    polygonVertices: Float32Array;
    polygonIndices: Uint32Array;
    borderSegments: Float32Array;
}

/**
 * Indexed grid-cell geometry.
 *
 * @remarks
 * Every accepted cell contributes four interleaved vertices in
 * `[lat, lng, featureValue]` layout and six indices forming two triangles.
 */
export interface GridGeometry {
    vertices: Float32Array;
    indices: Uint32Array;
    cellCount: number;
    minValue: number;
    maxValue: number;
}

/**
 * Affine geographic-to-clip-space transform consumed by the vertex shaders.
 *
 * @remarks
 * Longitude is always transformed as `lng * scaleX + offsetX`. Latitude uses
 * the same form directly for equirectangular maps, or after conversion to a
 * Web Mercator Y value. The result is WebGL normalized device coordinates.
 */
export interface ProjectionState {
    scaleX: number;
    scaleY: number;
    offsetX: number;
    offsetY: number;
    isEquirectangular: boolean;
}
