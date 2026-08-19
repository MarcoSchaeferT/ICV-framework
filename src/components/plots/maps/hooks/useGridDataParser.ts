import { useEffect, useMemo } from 'react';
import {
    polygonParser,
    getGridCellDims,
    getGeometryCenter,
    getGridCellIndex,
} from '../helpers';
import type { VisDataT, GridCellSize, MapGridResponseV1 } from '../types';

/**
 * Parameters for the {@link useGridDataParser} hook.
 *
 * @example
 * ```ts
 * const cellSize = { current: { lat: 0.25, lng: 0.25 } };
 * const params: UseGridDataParserParams = {
 *   isLoading: false,
 *   rawData: {
 *     response: [{ geometry: "POLYGON ((13 52, 13.25 52, 13.25 51.75, 13 51.75, 13 52))", feature: "0.73", id: 42 }],
 *   },
 *   gridcellSizeRef: cellSize,
 * };
 * ```
 */
export interface UseGridDataParserParams {
    /** Whether the raw dataset query is still loading */
    isLoading: boolean;
    /** The raw database payload containing polygon strings and numerical features */
    rawData: {
        response?: Array<{ geometry: string; feature: string; id?: number }> | MapGridResponseV1;
        error?: unknown;
    };
    /** Mutable ref storing the parsed cell width and height in latitude/longitude degrees */
    gridcellSizeRef: React.MutableRefObject<GridCellSize>;
}

/**
 * Parsed output structure returned by {@link useGridDataParser}.
 *
 * @example
 * ```ts
 * const result: UseGridDataParserResult = {
 *   gridData: new Map([[42, { geometry: [[52, 13], [52, 13.25], [51.75, 13.25], [51.75, 13], [52, 13]], feature: 0.73 }]]),
 *   parseErrors: [],
 * };
 * ```
 */
export interface UseGridDataParserResult {
    /** Map mapping unique spatial grid cell index keys to parsed visual cell data */
    gridData: Map<number, VisDataT>;
    /** List of string parsing error messages encountered during data ingestion */
    parseErrors: string[];
    /** Minimum and maximum numerical feature values. */
    featureRange: [number, number];
    /** Uniform grid-cell dimensions derived from response metadata. */
    cellSize: GridCellSize;
}

interface ParsedGridResource extends UseGridDataParserResult {
    cellSize: GridCellSize;
}

// `useGetJSONData` shares the same parsed response object between cards. A
// WeakMap lets those cards also share the expensive grid parsing result while
// allowing normal garbage collection after the raw response expires.
const parsedGridCache = new WeakMap<object, ParsedGridResource>();

const EMPTY_PARSED_GRID: ParsedGridResource = {
    gridData: new Map<number, VisDataT>(),
    parseErrors: [],
    featureRange: [0, 0],
    cellSize: { lat: 0, lng: 0 },
};

function isCompactGridResponse(value: unknown): value is MapGridResponseV1 {
    return Boolean(
        value &&
        typeof value === 'object' &&
        (value as MapGridResponseV1).format === 'map-grid-v1'
    );
}

/**
 * Ingests raw SQL geometry payloads into an indexed `Map<gridCellIndex, VisDataT>` for fast spatial lookup.
 *
 * Computes grid cell dimensions ($\Delta\text{lat}, \Delta\text{lng}$) from the first polygon boundary rectangle,
 * derives 2D grid cell indices from polygon centroids, and returns a memoized Map.
 *
 * @param params - Input configuration containing raw dataset response and target cell size ref.
 * @returns Object containing the parsed spatial `gridData` Map and any encountered `parseErrors`.
 *
 * @remarks
 * Ingesting high-density environmental grid data (e.g. 50,000 spatial cells) requires efficient parsing.
 * Memoizing the result via `useMemo` ensures that polygon string parsing occurs only when `rawData.response` changes.
 *
 * @example
 * ```tsx
 * const cellSizeRef = useRef<GridCellSize>({ lat: 0.25, lng: 0.25 });
 * const { gridData, parseErrors } = useGridDataParser({
 *   isLoading: false,
 *   rawData: dbResponse,
 *   gridcellSizeRef: cellSizeRef,
 * });
 * ```
 */
export function useGridDataParser({
    isLoading,
    rawData,
    gridcellSizeRef,
}: UseGridDataParserParams): UseGridDataParserResult {
    const parsed = useMemo<ParsedGridResource>(() => {
        const visDat = new Map<number, VisDataT>();
        const parseErrors: string[] = [];

        if (isLoading || !rawData?.response) return EMPTY_PARSED_GRID;

        const response = rawData.response;
        const cached = parsedGridCache.get(response as object);
        if (cached) return cached;

        let firstRect: [number, number][] = [];
        let cellSize: GridCellSize = { lat: 0, lng: 0 };
        let minFeature = Infinity;
        let maxFeature = -Infinity;

        try {
            if (isCompactGridResponse(response)) {
                cellSize = {
                    lat: Number(response.cellSize[0]),
                    lng: Number(response.cellSize[1]),
                };
                if (
                    !Number.isFinite(cellSize.lat) || cellSize.lat <= 0 ||
                    !Number.isFinite(cellSize.lng) || cellSize.lng <= 0
                ) {
                    throw new Error('Grid cell dimensions must be finite and greater than zero.');
                }
                const cornerColumns = [
                    response.lat0, response.lng0,
                    response.lat1, response.lng1,
                    response.lat2, response.lng2,
                    response.lat3, response.lng3,
                ];
                const hasExactCorners = cornerColumns.every((column) => Array.isArray(column));
                const northValues = response.north;
                const southValues = response.south;
                const westValues = response.west;
                const eastValues = response.east;
                const hasExactBounds = Boolean(
                    northValues && southValues && westValues && eastValues
                );

                if (hasExactCorners) {
                    const cornerValues = cornerColumns as number[][];
                    const count = Math.min(
                        response.id.length,
                        response.feature.length,
                        ...cornerValues.map((column) => column.length),
                    );

                    for (let index = 0; index < count; index++) {
                        const corners = cornerValues.map((column) => Number(column[index])) as VisDataT['corners'];
                        const feature = Number(response.feature[index]);
                        if (!corners || ![...corners, feature, cellSize.lat, cellSize.lng].every(Number.isFinite)) continue;

                        const north = Math.max(corners[0], corners[2], corners[4], corners[6]);
                        const south = Math.min(corners[0], corners[2], corners[4], corners[6]);
                        const west = Math.min(corners[1], corners[3], corners[5], corners[7]);
                        const east = Math.max(corners[1], corners[3], corners[5], corners[7]);
                        const gridCellIndex = getGridCellIndex(
                            { lat: (north + south) / 2, lng: (west + east) / 2 },
                            cellSize,
                        );
                        visDat.set(gridCellIndex, {
                            corners,
                            feature,
                            visDatIdx: index,
                            rowID: response.id[index],
                        });
                        minFeature = Math.min(minFeature, feature);
                        maxFeature = Math.max(maxFeature, feature);
                    }
                } else if (hasExactBounds && northValues && southValues && westValues && eastValues) {
                    const count = Math.min(
                        response.id.length,
                        northValues.length,
                        southValues.length,
                        westValues.length,
                        eastValues.length,
                        response.feature.length,
                    );

                    for (let index = 0; index < count; index++) {
                        const north = Number(northValues[index]);
                        const south = Number(southValues[index]);
                        const west = Number(westValues[index]);
                        const east = Number(eastValues[index]);
                        const feature = Number(response.feature[index]);
                        if (![north, south, west, east, feature, cellSize.lat, cellSize.lng].every(Number.isFinite)) continue;

                        const gridCellIndex = getGridCellIndex(
                            { lat: (north + south) / 2, lng: (west + east) / 2 },
                            cellSize,
                        );
                        visDat.set(gridCellIndex, {
                            bounds: [north, south, west, east],
                            feature,
                            visDatIdx: index,
                            rowID: response.id[index],
                        });
                        minFeature = Math.min(minFeature, feature);
                        maxFeature = Math.max(maxFeature, feature);
                    }
                } else if (response.latitude && response.longitude) {
                    const latOffset = Number(response.anchorOffset[0]);
                    const lngOffset = Number(response.anchorOffset[1]);
                    const count = Math.min(
                        response.id.length,
                        response.latitude.length,
                        response.longitude.length,
                        response.feature.length,
                    );

                    for (let index = 0; index < count; index++) {
                        const north = Number(response.latitude[index]) + latOffset;
                        const west = Number(response.longitude[index]) + lngOffset;
                        const feature = Number(response.feature[index]);
                        if (![north, west, feature, cellSize.lat, cellSize.lng].every(Number.isFinite)) continue;

                        const gridCellIndex = getGridCellIndex(
                            {
                                lat: north - cellSize.lat / 2,
                                lng: west + cellSize.lng / 2,
                            },
                            cellSize,
                        );
                        visDat.set(gridCellIndex, {
                            topLeft: [north, west],
                            feature,
                            visDatIdx: index,
                            rowID: response.id[index],
                        });
                        minFeature = Math.min(minFeature, feature);
                        maxFeature = Math.max(maxFeature, feature);
                    }
                }
            } else {
                response.forEach((d, index) => {
                    if (!d.geometry) return;

                    const coords = polygonParser(d.geometry);

                    // Use the first valid rectangle to determine grid cell dimensions
                    if (firstRect.length === 0) {
                        firstRect = coords;
                        const dims = getGridCellDims(firstRect);
                        cellSize = { lng: dims.gridDimLng, lat: dims.gridDimLat };
                    }

                    const centerPoint = getGeometryCenter(coords);
                    const gridCellIndex = getGridCellIndex(
                        { lat: centerPoint[0], lng: centerPoint[1] },
                        cellSize,
                    );

                    if (coords.length === 5) {
                        const feature = Number(d.feature);
                        const latitudes = coords.map(([lat]) => lat);
                        const longitudes = coords.map(([, lng]) => lng);
                        visDat.set(gridCellIndex, {
                            geometry: coords,
                            topLeft: [Math.max(...latitudes), Math.min(...longitudes)],
                            feature,
                            visDatIdx: index,
                            rowID: d.id,
                        });
                        if (Number.isFinite(feature)) {
                            minFeature = Math.min(minFeature, feature);
                            maxFeature = Math.max(maxFeature, feature);
                        }
                    }
                });
            }
        } catch (e) {
            const msg = `ERROR: while parsing the data set. csv format is required. ${e}`;
            console.error(msg);
            parseErrors.push(msg);
        }

        const backendRange = isCompactGridResponse(response) ? response.featureRange : null;
        const featureRange: [number, number] = backendRange && backendRange.every(Number.isFinite)
            ? [Number(backendRange[0]), Number(backendRange[1])]
            : (Number.isFinite(minFeature) && Number.isFinite(maxFeature)
                ? [minFeature, maxFeature]
                : [0, 0]);
        const resource: ParsedGridResource = { gridData: visDat, parseErrors, featureRange, cellSize };
        parsedGridCache.set(response as object, resource);
        return resource;
    }, [isLoading, rawData]);

    useEffect(() => {
        gridcellSizeRef.current.lat = parsed.cellSize.lat;
        gridcellSizeRef.current.lng = parsed.cellSize.lng;
    }, [gridcellSizeRef, parsed.cellSize.lat, parsed.cellSize.lng]);

    return {
        gridData: parsed.gridData,
        parseErrors: parsed.parseErrors,
        featureRange: parsed.featureRange,
        cellSize: parsed.cellSize,
    };
}

