/**
 * useGridDataParser – Parses raw DB polygon data into a Map<gridCellIndex, VisDataT>.
 *
 * Parses polygon strings, computes grid
 * cell indices, and populates a Map for fast lookup during rendering.
 */
import { useMemo, useRef } from 'react';
import {
    polygonParser,
    getGridCellDims,
    getGeometryCenter,
    getGridCellIndex,
} from '../helpers';
import type { VisDataT, GridCellSize } from '../types';

interface UseGridDataParserParams {
    /** Whether the raw data is still loading */
    isLoading: boolean;
    /** The raw database response containing geometry + feature columns */
    rawData: {
        response?: Array<{ geometry: string; feature: string; id?: number }>;
        error?: unknown;
    };
    /** Mutable ref to store computed grid cell size (lat/lng) */
    gridcellSizeRef: React.MutableRefObject<GridCellSize>;
}

interface UseGridDataParserResult {
    gridData: Map<number, VisDataT>;
    parseErrors: string[];
}

export function useGridDataParser({
    isLoading,
    rawData,
    gridcellSizeRef,
}: UseGridDataParserParams): UseGridDataParserResult {
    const errorsRef = useRef<string[]>([]);

    const gridData = useMemo(() => {
        const visDat = new Map<number, VisDataT>();
        errorsRef.current = [];

        if (isLoading || !rawData?.response) return visDat;

        let firstRect: [number, number][] = [];

        try {
            rawData.response.forEach((d, index) => {
                if (!d.geometry) return;

                const coords = polygonParser(d.geometry);

                // Use the first valid rectangle to determine grid cell dimensions
                if (firstRect.length === 0) {
                    firstRect = coords;
                    const dims = getGridCellDims(firstRect);
                    gridcellSizeRef.current.lng = dims.gridDimLng;
                    gridcellSizeRef.current.lat = dims.gridDimLat;
                }

                const centerPoint = getGeometryCenter(coords);
                const gridCellIndex = getGridCellIndex(
                    { lat: centerPoint[0], lng: centerPoint[1] },
                    { lat: gridcellSizeRef.current.lat, lng: gridcellSizeRef.current.lng }
                );

                if (coords.length === 5) {
                    visDat.set(gridCellIndex, {
                        geometry: coords,
                        feature: Number(d.feature),
                        visDatIdx: index,
                        rowID: d.id,
                    });
                }
            });
        } catch (e) {
            const msg = `ERROR: while parsing the data set. csv format is required. ${e}`;
            console.error(msg);
            errorsRef.current.push(msg);
        }

        return visDat;
    }, [isLoading, rawData?.response, gridcellSizeRef]);

    return { gridData, parseErrors: errorsRef.current };
}
