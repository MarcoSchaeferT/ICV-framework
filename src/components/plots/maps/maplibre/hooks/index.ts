/**
 * MapLibre hooks barrel export.
 *
 * Replaces the Leaflet hooks/index.ts with MapLibre-native equivalents.
 */

// ─── MapLibre-native hooks (replace Leaflet equivalents) ───
export { useMapLibreInit } from './useMapLibreInit';
export { useMapLibrePosition } from './useMapLibrePosition';
export { useMapLibreResize } from './useMapLibreResize';
export { useMapLibreTransition } from './useMapLibreTransition';
export { useMapLibreDistance } from './useMapLibreDistance';
export { useMapLibreGridLayer } from './useMapLibreGridLayer';
export { useMapLibreTooltip } from './useMapLibreTooltip';
export { useMapLibreCountryPolygons } from './useMapLibreCountryPolygons';
export { useMapLibrePresenceLayer } from './useMapLibrePresenceLayer';
export { useMapLibreCapitals } from './useMapLibreCapitals';

// ─── Reused hooks (unchanged from Leaflet version) ───
export { useGridDataParser } from './useGridDataParser';
export { useLayerUpdateDebounce } from './useLayerUpdateDebounce';

// ─── SVG overlays & D3 hooks ───
export { useMapLibrePieCharts } from './useMapLibrePieCharts';
export { useMapLibreGridHighlight } from './useMapLibreGridHighlight';
