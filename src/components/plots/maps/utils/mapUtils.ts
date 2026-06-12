import { RANGE_LAT, RANGE_LONG, MAX_ZOOM, MIN_ZOOM, CALCER } from '../constants';

/**
 * Clamps and rounds coordinate values to valid ranges, then returns the triplet.
 */
export function clampCoordinates(
    latitude: number,
    longitude: number,
    zoom: number
): [number, number, number] {
    longitude = Math.max(-RANGE_LONG, Math.min(RANGE_LONG, longitude));
    latitude = Math.max(-RANGE_LAT, Math.min(RANGE_LAT, latitude));
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));

    longitude = Math.round(longitude * CALCER) / CALCER;
    latitude = Math.round(latitude * CALCER) / CALCER;
    zoom = Math.round(zoom * 100) / 100;

    return [latitude, longitude, zoom];
}

/**
 * Safely clears a timeout ref.
 */
export function resetTimeout(
    ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
): void {
    if (ref.current) {
        clearTimeout(ref.current);
    }
}

/**
 * Fully removes the single reused tooltip from the map.
 * Uses removeLayer() instead of closeTooltip() to ensure the
 * DOM element is detached — closeTooltip only hides the popup
 * but leaves it rendered at the last position.
 */
export function removeReusedTooltip(
    map: L.Map | null,
    L: typeof import('leaflet') | null,
    toolTipRef: React.MutableRefObject<L.Tooltip | null>
): void {
    if (!map || !L) return;
    if (toolTipRef.current && map.hasLayer(toolTipRef.current)) {
        map.removeLayer(toolTipRef.current);
    }
}

/**
 * Parses URL query parameters into a key-value dictionary.
 * Used by LeafD3MapGermanyCovid to extract dataset info from the URL.
 */
export function getParamsOfURL(url: string): { [key: string]: string } {
    const urlParams = new URLSearchParams(url.split('?')[1]);
    const paramsDict: { [key: string]: string } = {};
    urlParams.forEach((value, key) => {
        paramsDict[key] = value;
    });
    return paramsDict;
}
