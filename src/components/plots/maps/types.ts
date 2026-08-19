/**
 * Shared TypeScript types for ICV spatial map visualization engines.
 *
 * Defines core contracts for parsed polygon geometries, spatial coordinate triplets, container pixel dimensions,
 * and grid cell angular delta sizes.
 */

/**
 * Parsed spatial grid cell visualization data record.
 *
 * Represents an individual 2D geographical grid cell extracted from raw SQL spatial payloads (`geometry` column string).
 *
 * @see {@link useGridDataParser} for ingesting raw SQL payloads into `VisDataT`.
 * @see {@link useGridLayer} for tile canvas rendering consuming `VisDataT`.
 *
 * @example
 * ```ts
 * const habitatCell: VisDataT = {
 *   geometry: [[52, 13], [52, 13.25], [51.75, 13.25], [51.75, 13], [52, 13]],
 *   feature: 0.73,
 *   rowID: 200509,
 * };
 * ```
 */
export interface VisDataT {
    /** Closed array of 5 `[latitude, longitude]` coordinate pairs defining polygon boundaries */
    geometry?: [number, number][];
    /** Compact north-west cell anchor used by map-grid-v1 responses. */
    topLeft?: [number, number];
    /** Exact `[north, south, west, east]` bounds for projection-aware compact grids. */
    bounds?: [number, number, number, number];
    /** Four source polygon corners as flat `[lat0,lng0,...,lat3,lng3]`. */
    corners?: [number, number, number, number, number, number, number, number];
    /** Numerical feature value (e.g. vector species density, temperature, or occurrence probability) */
    feature: number;
    /** Original zero-based data index in raw response array */
    visDatIdx?: number;
    /** Database primary key row identifier */
    rowID?: number;
}

/** Compact column-oriented response returned by `responseFormat=map-grid-v1`. */
export interface MapGridResponseV1 {
    format: 'map-grid-v1';
    /** Database column represented by the compact `feature` values. */
    featureName?: string;
    id: number[];
    /** Exact per-cell bounds retain variable dimensions after reprojection. */
    north?: number[];
    south?: number[];
    west?: number[];
    east?: number[];
    /** Original polygon corners, projected independently by each map CRS. */
    lat0?: number[];
    lng0?: number[];
    lat1?: number[];
    lng1?: number[];
    lat2?: number[];
    lng2?: number[];
    lat3?: number[];
    lng3?: number[];
    /** Compatibility fields used by the first compact response revision. */
    latitude?: number[];
    longitude?: number[];
    feature: Array<number | string | null>;
    /** `[latitude height, longitude width]` in degrees. */
    cellSize: [number, number];
    /** Offset from the stored latitude/longitude anchor to north-west. */
    anchorOffset: [number, number];
    featureRange: [number, number];
    rowCount: number;
}

/**
 * Synchronized Leaflet spatial camera viewport coordinates.
 *
 * @see {@link useMapPosition} for viewport synchronizer hook.
 * @see {@link InterfaceContext} for global state contract storing `mapCoords`.
 *
 * @example
 * ```ts
 * const berlinViewport: MapCoordinates = { latitude: 52.52, longitude: 13.405, zoom: 6 };
 * ```
 */
export interface MapCoordinates {
    /** Viewport center latitude coordinate in degrees (-90 to +90) */
    latitude: number;
    /** Viewport center longitude coordinate in degrees (-180 to +180) */
    longitude: number;
    /** Leaflet fractional zoom level (e.g. 0 to 18) */
    zoom: number;
}

/**
 * HTML container element pixel dimensions.
 *
 * @see {@link useChartResizer} for container dimension extraction.
 * @see {@link useMapResize} for debounced Leaflet size invalidation.
 *
 * @example
 * ```ts
 * const dashboardCard: MapDimensions = { width: 960, height: 640 };
 * ```
 */
export interface MapDimensions {
    /** Outer pixel width */
    width: number;
    /** Outer pixel height */
    height: number;
}

/**
 * Angular cell dimensions of geographical grid cells in latitude and longitude degrees.
 *
 * @see {@link useGridDataParser} for automated grid cell dimension extraction.
 *
 * @example
 * ```ts
 * const quarterDegreeCell: GridCellSize = { lat: 0.25, lng: 0.25 };
 * ```
 */
export interface GridCellSize {
    /** Cell height in latitude degrees (e.g. 0.25) */
    lat: number;
    /** Cell width in longitude degrees (e.g. 0.25) */
    lng: number;
}


