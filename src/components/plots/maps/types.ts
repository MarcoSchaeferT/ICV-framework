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
 * @see {@link useWebGLGridLayer} for GPU rendering consuming `VisDataT`.
 *
 * @example
 * ```ts
 * import type { VisDataT } from "@/framework";
 *
 * const habitatCell: VisDataT = {
 *   geometry: [[52, 13], [52, 13.25], [51.75, 13.25], [51.75, 13], [52, 13]],
 *   feature: 0.73,
 *   rowID: 200509,
 * };
 * ```
 */
export interface VisDataT {
    /** Optional polygon boundary as `[latitude, longitude]` pairs. */
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

/**
 * Compact column-oriented grid response returned by `responseFormat=map-grid-v1`.
 *
 * @remarks
 * Arrays are parallel: index `i` in `id`, `feature`, and each present geometry column
 * describes the same cell. The backend emits four source polygon corners (`lat0..lng3`);
 * consumers such as {@link useGridDataParser} also accept axis-aligned bounds
 * (`north`, `south`, `west`, `east`) or legacy anchor arrays (`latitude`, `longitude`).
 * Consumers must check optional geometry columns before indexing them and narrow
 * `feature[i]` before using it as a number.
 *
 * @see {@link useGridDataParser} for conversion into {@link VisDataT} records.
 *
 * @example
 * ```ts
 * import type { MapGridResponseV1 } from "@/framework";
 *
 * const berlinHabitatGrid: MapGridResponseV1 = {
 *   format: "map-grid-v1",
 *   featureName: "mean",
 *   id: [200509],
 *   lat0: [52.5],
 *   lng0: [13.25],
 *   lat1: [52.5],
 *   lng1: [13.5],
 *   lat2: [52.25],
 *   lng2: [13.5],
 *   lat3: [52.25],
 *   lng3: [13.25],
 *   feature: [0.73],
 *   cellSize: [0.25, 0.25],
 *   anchorOffset: [0, 0],
 *   featureRange: [0.12, 0.94],
 *   rowCount: 1,
 * };
 * ```
 */
export interface MapGridResponseV1 {
    /** Discriminator for the compact grid transport format. */
    format: 'map-grid-v1';
    /** Database column represented by the compact `feature` values. */
    featureName?: string;
    /** Database row identifiers in column order. */
    id: number[];
    /** Exact per-cell bounds retain variable dimensions after reprojection. */
    north?: number[];
    /** Southern latitude of each cell's exact bound. */
    south?: number[];
    /** Western longitude of each cell's exact bound. */
    west?: number[];
    /** Eastern longitude of each cell's exact bound. */
    east?: number[];
    /** Original polygon corners, projected independently by each map CRS. */
    lat0?: number[];
    /** Longitude of the first source polygon corner. */
    lng0?: number[];
    /** Latitude of the second source polygon corner. */
    lat1?: number[];
    /** Longitude of the second source polygon corner. */
    lng1?: number[];
    /** Latitude of the third source polygon corner. */
    lat2?: number[];
    /** Longitude of the third source polygon corner. */
    lng2?: number[];
    /** Latitude of the fourth source polygon corner. */
    lat3?: number[];
    /** Longitude of the fourth source polygon corner. */
    lng3?: number[];
    /** Compatibility fields used by the first compact response revision. */
    latitude?: number[];
    /** Legacy per-cell longitude anchor values. */
    longitude?: number[];
    /** Raw feature values; null or string values require narrowing by consumers. */
    feature: Array<number | string | null>;
    /** `[latitude height, longitude width]` in degrees. */
    cellSize: [number, number];
    /** Offset from the stored latitude/longitude anchor to north-west. */
    anchorOffset: [number, number];
    /** Minimum and maximum numeric feature values reported by the backend. */
    featureRange: [number, number];
    /** Number of grid cells represented by the parallel columns. */
    rowCount: number;
}

/**
 * Synchronized Leaflet spatial camera viewport coordinates.
 *
 * @see {@link useMapPosition} for viewport synchronizer hook.
 * @see {@link InterfaceContextProvider} for global state storing `mapCoords`.
 *
 * @example
 * ```ts
 * import type { MapCoordinates } from "@/framework";
 *
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
 * import type { MapDimensions } from "@/framework";
 *
 * const visInterfaceCard: MapDimensions = { width: 960, height: 640 };
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
 * import type { GridCellSize } from "@/framework";
 *
 * const quarterDegreeCell: GridCellSize = { lat: 0.25, lng: 0.25 };
 * ```
 */
export interface GridCellSize {
    /** Cell height in latitude degrees (e.g. 0.25) */
    lat: number;
    /** Cell width in longitude degrees (e.g. 0.25) */
    lng: number;
}


