/**
 * Shared TypeScript types for map components.
 */

/** Parsed grid-cell visualization data */
export interface VisDataT {
    geometry: [number, number][];
    feature: number;
    visDatIdx?: number;
    rowID?: number;
}

/** Latitude/longitude/zoom triplet */
export interface MapCoordinates {
    latitude: number;
    longitude: number;
    zoom: number;
}

/** Container dimensions */
export interface MapDimensions {
    width: number;
    height: number;
}

/** Grid cell size in lat/lng degrees */
export interface GridCellSize {
    lat: number;
    lng: number;
}

