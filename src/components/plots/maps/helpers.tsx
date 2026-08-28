import React from 'react';
import * as d3 from 'd3';
import * as GEOjson from 'geojson';


/** A substring filter can contain one value or several alternatives. */
export type MapStringFilter = string | string[];

/** Return the non-empty substrings represented by a map filter option. */
export function getActiveStringFilters(filter?: MapStringFilter): string[] {
    const filters = Array.isArray(filter) ? filter : [filter];
    return filters.filter((value): value is string => Boolean(value));
}

/**
 * Determines whether a value passes optional include and exclude substring
 * filters. Multiple values in either filter use OR semantics.
 */
export function passesStringFilters(
    value: string,
    includeFilter?: MapStringFilter,
    excludeFilter?: MapStringFilter
): boolean {
    const includeFilters = getActiveStringFilters(includeFilter);
    const excludeFilters = getActiveStringFilters(excludeFilter);

    return !excludeFilters.some((filter) => value.includes(filter)) &&
        (includeFilters.length === 0 || includeFilters.some((filter) => value.includes(filter)));
}

/**
 * Determines whether a dataset key passes both include and exclude
 * substring filters.
 *
 * Used by the dataset-selection dropdown to reduce the visible list to
 * only those datasets relevant to the current showcase or view.
 *
 * @param key            - The dataset key (relation name) to test.
 * @param includeFilter  - A single substring **or** an array of substrings.
 *                         The key must contain **at least one** non-empty
 *                         substring to pass. An empty string, empty array,
 *                         or `undefined` disables the include filter.
 * @param excludeFilter  - A single substring **or** an array of substrings.
 *                         If the key contains at least one non-empty substring
 *                         it is excluded regardless of the include filter.
 *                         An empty string, empty array, or `undefined` disables
 *                         the exclude filter.
 * @returns `true` if the dataset should be shown in the UI.
 *
 * @example
 * ```ts
 * isDatasetIncluded("t_2024_albopictus_predictions", "albopictus", "?");  // true
 * isDatasetIncluded("t_2024_aegypti_predictions",    "albopictus", "?");  // false
 * isDatasetIncluded("t_2024_albopictus_debug?",       "albopictus", "?"); // false (excluded)
 * isDatasetIncluded("anything",                       "",           "");  // true  (no filter)
 * ```
 */
export function isDatasetIncluded(
    key: string,
    includeFilter?: MapStringFilter,
    excludeFilter?: MapStringFilter
): boolean {
    return passesStringFilters(key, includeFilter, excludeFilter);
}


/**
 * Computes the minimum and maximum feature numerical values across a dataset array.
 *
 * @param data - Array of dataset objects containing numerical `feature` properties.
 * @returns A tuple `[min, max]` representing numerical bounds.
 *
 * @see {@link ColorMapLegend} for color scale domain calculation.
 *
 * @example
 * ```ts
 * const [min, max] = getMinMaxFeature([{ feature: 0.12 }, { feature: 0.89 }]);
 * // Returns [0.12, 0.89]
 * ```
 */
export function getMinMaxFeature(data: { feature: number }[]): [number, number] {
    if (!data || !Array.isArray(data) || data.length === 0) return [0, 0];
    let min = Infinity;
    let max = -Infinity;
    data.forEach((d: any) => {
        const value = Number(d.feature);
        if (value < min) min = value;
        if (value > max) max = value;
    });
   if (min == max) 
   {
        min = 0;
        max = max;
    }
    return [min, max];
}

/**
 * Calculates spatial grid snapping offset coordinates relative to a zero-origin angular grid.
 *
 * @param latGeometryTopLeft - Latitude coordinate of top-left geometry corner in degrees.
 * @param lngGeometryTopLeft - Longitude coordinate of top-left geometry corner in degrees.
 * @param gridSizeDegreesLat - Grid cell height in latitude degrees.
 * @param gridSizeDegreesLng - Grid cell width in longitude degrees.
 * @returns Angular offset object `{ lat, lng }`.
 */
export function getGridOffset(latGeometryTopLeft: number, lngGeometryTopLeft: number, gridSizeDegreesLat: number, gridSizeDegreesLng: number) : {lat:number, lng:number} {
    // snap coordinates to grid
    const lat = latGeometryTopLeft;
    const lng = lngGeometryTopLeft;
    const gridLat = Math.floor((lat) / gridSizeDegreesLat) * gridSizeDegreesLat;
    const gridLng = Math.floor((lng) / gridSizeDegreesLng) * gridSizeDegreesLng;

    return {lat: lat - gridLat, lng: lng - gridLng};
}

/**
 * Snaps latitude and longitude coordinates to top-left corner bounds of a spatial grid cell.
 *
 * @param coords - Target coordinate pair `{ lat, lng }`.
 * @param gridCellDims - Grid cell dimensions `{ lat, lng }`.
 * @param gridOffset - Optional offset displacement `{ lat, lng }`.
 * @returns Object containing `topLeft` snapped coordinate pair.
 */
export function snapToGrid(coords:{lat: number, lng: number}, gridCellDims:{lat:number, lng: number}, gridOffset?:{lat:number, lng: number}) : {topLeft: {lat: number, lng: number}, center: {lat: number, lng: number}} {

    if(gridOffset == undefined) {
        gridOffset = {lat:0, lng:0};
    }
    // calculate corrected position (transform to a grid starting in 0,0 or -180,-90)
    coords.lat -= gridOffset.lat;
    coords.lng -= gridOffset.lng;
    // snap coordinates to grid
    const gridLat = Math.floor((coords.lat) / gridCellDims.lat) * gridCellDims.lat + gridCellDims.lat;
    const gridLng = Math.floor((coords.lng) / gridCellDims.lng) * gridCellDims.lng;

    // add the offset to get the top-left corner of the grid cell (transfrom back to original grid)
    let topLeft= {lat:gridLat+gridOffset.lat, lng:gridLng+gridOffset.lng};
    let center = {lat:topLeft.lat - gridCellDims.lat/2, lng:topLeft.lng - gridCellDims.lng/2};

    return {topLeft, center};
}

/**
 * Computes a unique 2D spatial grid cell integer index key for fast map lookup and 2.0-degree spatial bucket indexing.
 *
 * Maps continuous 2D coordinates ($\text{lat} \in [-90, +90], \text{lng} \in [-180, +180]$) into discrete integer cell keys ($a \cdot \text{rowCnt} + b$).
 *
 * @param coords - Geographical point coordinates `{ lat, lng }`.
 * @param gridCellDims - Angular cell width and height `{ lat, lng }`.
 * @returns Unique integer grid cell index key.
 *
 * @remarks
 * Used by spatial spatial bucket indexing inside {@link useGridLayer} to accelerate tile collision queries ($O(1)$ lookup).
 *
 * @see {@link useGridDataParser} for populating spatial cell maps.
 * @see {@link useGridLayer} for tile canvas rendering using cell index lookups.
 *
 * @example
 * ```ts
 * const cellIdx = getGridCellIndex({ lat: 52.52, lng: 13.405 }, { lat: 0.25, lng: 0.25 });
 * ```
 */
export function getGridCellIndex(coords:{lat: number, lng: number}, gridCellDims:{lat:number, lng: number}) {
    
    // snap coordinates to grid
    const { topLeft: { lat: gridLat, lng: gridLng } } = snapToGrid(coords, gridCellDims);

    // calculate grid cell index
    let a = Math.floor((gridLng+180) / gridCellDims.lng);
    let b = Math.floor((gridLat+90) / gridCellDims.lat);
   
    let rowCnt = Math.ceil(180 / gridCellDims.lat); // number of rows in the grid
    let gridCell = a * rowCnt + b; // key for unique grid cell identification
    return gridCell;
}

/**
 * Rounds latitude and longitude coordinates to a specified decimal precision.
 *
 * @param point - Geographical coordinate point `{ lat, lng }`.
 * @param roundTo - Decimal places precision. @default 2
 * @returns Rounded coordinate point `{ lat, lng }`.
 */
export function roundLatLng(point: { lat: number; lng: number }, roundTo: number = 2): { lat: number; lng: number } {

    const rounder = Math.pow(10, roundTo);
    let lat = point.lat;
    let lng = point.lng;
    lat = Math.round(lat * rounder) / rounder;
    lng = Math.round(lng * rounder) / rounder;
    const rPoint = {lat: lat, lng: lng};
    return rPoint;
}

/**
 * Parses WKT (Well-Known Text) `"POLYGON ((...))"` strings into arrays of latitude/longitude coordinate pairs.
 *
 * Swaps standard WGS84 (EPSG:4326) `[lng, lat]` order to Leaflet-compatible `[lat, lng]` pairs.
 *
 * @param polygonString - WKT polygon string representation from database payload.
 * @returns Array of 5 closed `[latitude, longitude]` coordinate tuples.
 *
 * @see {@link useGridDataParser} for spatial dataset parsing.
 *
 * @example
 * ```ts
 * const coords = polygonParser("POLYGON ((13.40 52.52, 13.65 52.52, 13.65 52.77, 13.40 52.77, 13.40 52.52))");
 * ```
 */
export function polygonParser(polygonString: string): [number, number][] {
    
    if(polygonString == undefined){ return [[0,0],[0,0],[0,0],[0,0],[0,0]]; }
    // Remove the "POLYGON ((" prefix and "))" suffix
    var regex = /POLYGON |\(|\)/gi; 
    const coordinatesString =  polygonString.replace(regex, ""); 

    // Split the coordinates string into individual coordinate pairs
    const coordinatePairs = coordinatesString.split(", ");

    // Map each coordinate pair to a tuple of numbers
    const coordinates: [number, number][] = coordinatePairs.map(pair => {
        // standard convention used in WGS84 (EPSG:4326) coordinate system: longitude comes first, followed by latitude
        const [lng, lat] = pair.split(" ").map(coord => Number(coord));
        const rPoint = roundLatLng({lat, lng});
        return [rPoint.lat, rPoint.lng];
    });
    return coordinates;
}

/**
 * Parses WKT `"POINT (...)"` strings into a single `[latitude, longitude]` tuple.
 *
 * @param polygonString - WKT point string.
 * @returns `[latitude, longitude]` tuple.
 */
export function pointParser(polygonString: string): [number, number] {
    
    if(polygonString == undefined){ return [0,0]; }
    // Remove the "POLYGON ((" prefix and "))" suffix
    var regex = /POINT |\(|\)/gi; 
    const coordinatesString =  polygonString.replace(regex, ""); 

    // Split the coordinates string into individual coordinate pairs
    const coordinatePairs = coordinatesString.split(", ");

    // Map each coordinate pair to a tuple of numbers
    const coordinates: [number, number][] = coordinatePairs.map(pair => {
        // standard convention used in WGS84 (EPSG:4326) coordinate system: longitude comes first, followed by latitude
        const [lng, lat] = pair.split(" ").map(coord => Number(coord));
        const rPoint = roundLatLng({lat, lng});
        return [rPoint.lat, rPoint.lng];
    });
    return coordinates[0];
}

/**
 * Computes angular cell height ($\Delta\text{lat}$) and width ($\Delta\text{lng}$) in degrees from a polygon boundary rectangle.
 *
 * @param geoRect - Closed array of boundary coordinate tuples.
 * @returns Object `{ gridDimLat, gridDimLng }` in degrees.
 *
 * @see {@link useGridDataParser}
 */
export function getGridCellDims(geoRect: [number, number][]): { gridDimLat: number; gridDimLng: number } {
    if (geoRect.length === 0) {
        return { gridDimLat: 0, gridDimLng: 0 };
    }

    const latitudes = geoRect.map(([lat]) => Number(lat));
    const longitudes = geoRect.map(([, lng]) => Number(lng));

    const gridDimLat = Math.max(...latitudes) - Math.min(...latitudes);
    const gridDimLng = Math.max(...longitudes) - Math.min(...longitudes);

    return { gridDimLat, gridDimLng };
}

/**
 * Calculates geographical centroid coordinates `[lat, lng]` of a polygon coordinate array.
 *
 * @param geometry - Array of `[lat, lng]` tuples.
 * @returns `[avgLat, avgLng]` centroid coordinate pair.
 */
export function getGeometryCenter (geometry: [number, number][]) {

    // extract all latitudes and longitudes from the geometry
    // and creates an array of latitudes and an array of longitudes
    const latitudes = geometry.map(coord => coord[0]);
    const longitudes = geometry.map(coord => coord[1]);

    // calculate the average latitude and longitude := center of the geometry
    const avgLat = latitudes.reduce((sum, lat) => sum + lat, 0) / latitudes.length;
    const avgLng = longitudes.reduce((sum, lng) => sum + lng, 0) / longitudes.length;

    return [avgLat, avgLng];
};

/**
 * Resolves center coordinates `{ lat, lng }` of an administrative country feature from a GeoJSON FeatureCollection.
 *
 * Uses property matching, fuzzy alias normalization (`normalizeCountryName`), and geometric centroid fallback calculation.
 *
 * @param mapData - World GeoJSON FeatureCollection instance.
 * @param countryName - ISO code or country name string to locate.
 * @returns Center point `{ lat, lng }`.
 */
export function getCountryCenterFromMapData(mapData: GEOjson.FeatureCollection, countryName: string ): { lat: number, lng: number } {
    let curCenter = { lat: 0, lng: 0 };
    if (!countryName) return curCenter;

    const normalizedTarget = normalizeCountryName(countryName);

    // Helper to calculate the geometric center (centroid of coordinates)
    const calculateCentroid = (feature: GEOjson.Feature): { lat: number, lng: number } => {
        let sumLat = 0;
        let sumLng = 0;
        let count = 0;

        const processCoords = (coords: any) => {
            if (Array.isArray(coords) && typeof coords[0] === 'number') {
                sumLng += coords[0];
                sumLat += coords[1];
                count++;
            } else if (Array.isArray(coords)) {
                coords.forEach(processCoords);
            }
        };

        if (feature.geometry) {
            processCoords((feature.geometry as any).coordinates);
        }

        if (count > 0) {
            return { lat: sumLat / count, lng: sumLng / count };
        }
        return { lat: 0, lng: 0 };
    };

    // Helper to get center from properties or fallback to centroid
    const getCenter = (feature: GEOjson.Feature): { lat: number, lng: number } => {
        const props = feature.properties || {};
        if (props.label_y !== undefined && props.label_x !== undefined &&
            !isNaN(Number(props.label_y)) && !isNaN(Number(props.label_x))) {
            return { lat: Number(props.label_y), lng: Number(props.label_x) };
        }
        return calculateCentroid(feature);
    };

    // 1. Try exact matches on properties
    for (const feature of mapData.features) {
        const props = feature.properties || {};
        const featName = props.name || props.NAME || '';
        if (props.admin === countryName ||
            featName === countryName ||
            props.iso_a3 === countryName ||
            props.iso_a2 === countryName) {
            return getCenter(feature);
        }
    }

    // 2. Try normalized fuzzy matching
    for (const feature of mapData.features) {
        const props = feature.properties || {};
        const featName = props.name || props.NAME || '';
        if (normalizeCountryName(props.admin) === normalizedTarget ||
            normalizeCountryName(featName) === normalizedTarget ||
            normalizeCountryName(props.iso_a3) === normalizedTarget ||
            normalizeCountryName(props.iso_a2) === normalizedTarget) {
            return getCenter(feature);
        }
    }

    // 3. Try substring/partial matching
    for (const feature of mapData.features) {
        const props = feature.properties || {};
        const featName = props.name || props.NAME || '';
        const adminNorm = normalizeCountryName(props.admin);
        const nameNorm = normalizeCountryName(featName);
        if ((adminNorm && (adminNorm.includes(normalizedTarget) || normalizedTarget.includes(adminNorm))) ||
            (nameNorm && (nameNorm.includes(normalizedTarget) || normalizedTarget.includes(nameNorm)))) {
            return getCenter(feature);
        }
    }

    if (curCenter.lat === 0 && curCenter.lng === 0) {
        console.warn("Country not found in map data:", countryName, "Function: getCountryCenterFromMapData");
    }
    return curCenter;
}

function normalizeCountryName(name: any): string {
    if (!name || typeof name !== 'string') return '';
    
    // Split diacritics/accents and normalize to lowercase alphanumeric
    let normalized = name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

    // Map common aliases to a unified representation
    const aliases: Record<string, string> = {
        'ivorycoast': 'cotedivoire',
        'cotedivoire': 'cotedivoire',
        'cotedivoir': 'cotedivoire',
        'cotedivory': 'cotedivoire',
        'cotedivorie': 'cotedivoire',
        'côtedivoire': 'cotedivoire',
        'cote d ivory': 'cotedivoire',
        'cote divoire': 'cotedivoire',
        'unitedstates': 'unitedstatesofamerica',
        'unitedstatesofamerica': 'unitedstatesofamerica',
        'usa': 'unitedstatesofamerica',
        'us': 'unitedstatesofamerica',
        'unitedkingdom': 'unitedkingdom',
        'uk': 'unitedkingdom',
        'greatbritain': 'unitedkingdom',
        'britain': 'unitedkingdom',
        'eswatini': 'swaziland',
        'swaziland': 'swaziland',
        'northmacedonia': 'macedonia',
        'macedonia': 'macedonia',
        'czechia': 'czechrepublic',
        'czechrepublic': 'czechrepublic',
        'timorleste': 'easttimor',
        'easttimor': 'easttimor',
        'capeverde': 'caboverde',
        'caboverde': 'caboverde',
        'demrepcongo': 'democraticrepublicofthecongo',
        'democraticrepublicofcongo': 'democraticrepublicofthecongo',
        'congodr': 'democraticrepublicofthecongo',
        'drc': 'democraticrepublicofthecongo',
        'congo': 'democraticrepublicofthecongo'
    };

    if (aliases[normalized]) {
        return aliases[normalized];
    }
    return normalized;
}

/**
 * Calculates high-contrast text color (black or white) for a background color to satisfy WCAG AA contrast standards.
 *
 * Uses WCAG 2.0 relative luminance formula ($\text{Luminance} = 0.2126 R + 0.7152 G + 0.0722 B$). Returns black for light backgrounds ($\text{luminance} > 0.6$) and white for dark backgrounds.
 *
 * @param bgColor - D3 RGB or HSL color object.
 * @returns High-contrast D3 RGB color object (`#000000` or `#ffffff`).
 */
export function getContrastTextColorForBgColor(bgColor: d3.RGBColor | d3.HSLColor | null): d3.RGBColor {
    let textColor: d3.RGBColor;
    textColor = d3.rgb(255, 255, 255); // default to white
    if (bgColor) {
        // Calculate luminance (perceived brightness)
        // Formula: https://www.w3.org/TR/WCAG20/#relativeluminancedef
        const rgb = bgColor.rgb();
        const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
        textColor = luminance > 0.6 ? d3.rgb(0, 0, 0) : textColor;
    }

    return textColor;
}

/**
 * Generates an ocean masking polygon FeatureCollection by subtracting landmass feature polygons from a world bounding box.
 *
 * @param mapData - Landmass GeoJSON FeatureCollection.
 * @returns Mask FeatureCollection containing inverted ocean polygons.
 */
export function getOceanMaskGeoJSON(mapData: GEOjson.FeatureCollection): GEOjson.FeatureCollection {
    // 1. Create a world bounding box polygon that covers the full extent
    const worldOuterRing = [
        [-180, 90],
        [180, 90],
        [180, -90],
        [-180, -90],
        [-180, 90]
    ];

    const holes: number[][][] = [];

    // 2. Add all outer rings of countries as holes in the world polygon
    mapData.features.forEach((feature) => {
        if (!feature.geometry) return;
        
        if (feature.geometry.type === 'Polygon') {
            if (feature.geometry.coordinates.length > 0) {
                // GeoJSON Polygon coordinates: [outer_ring, hole_ring_1, hole_ring_2, ...]
                holes.push(feature.geometry.coordinates[0]);
            }
        } else if (feature.geometry.type === 'MultiPolygon') {
            feature.geometry.coordinates.forEach((poly) => {
                if (poly.length > 0) {
                    holes.push(poly[0]);
                }
            });
        }
    });

    const oceanFeature: GEOjson.Feature = {
        type: "Feature",
        properties: {
            name: "OceanMask",
        },
        geometry: {
            type: "Polygon",
            coordinates: [worldOuterRing, ...holes]
        }
    };

    return {
        type: "FeatureCollection",
        features: [oceanFeature]
    };
}



/**
 * Calculates human-readable axis range bounds `[min, max]` by rounding to powers of 10.
 *
 * @param dataMin - Raw dataset minimum value.
 * @param dataMax - Raw dataset maximum value.
 * @returns Human-friendly axis scale range tuple `[adjustedMin, adjustedMax]`.
 *
 * @see {@link ColorMapLegend} for legend scale tick generation.
 */
export function getGoodReadableRange(dataMin: number, dataMax: number): [number, number] {
  if (dataMin !== dataMax) {
        // "Nice" rounding for axis: e.g., 1235 -> 1000, 9876 -> 10000, etc.
        const order = Math.pow(10, Math.floor(Math.log10(dataMax)));
        // Round min down, max up to nearest order of magnitude
        dataMin = Math.floor(dataMin / order) * order;
        dataMax = Math.ceil(dataMax / order) * order;
        // If range is too small, use next lower order
        if (dataMax - dataMin < order) {
          const lowerOrder = order / 10;
          dataMin = Math.floor(dataMin / lowerOrder) * lowerOrder;
          dataMax = Math.ceil(dataMax / lowerOrder) * lowerOrder;
        }
    }
    return [dataMin, dataMax];
}

/**
 * Row item structure for standardized tooltip tables.
 *
 * @example
 * ```ts
 * const speciesRow: StandardTooltipRow = { label: "Species", value: "Aedes albopictus" };
 * ```
 */
export interface StandardTooltipRow {
    /** Label string describing the attribute */
    label: string;
    /** Attribute value (numerical or string) */
    value: string | number;
}

/** Optional second metric rendered below the primary tooltip value. */
export interface StandardTooltipSection {
    /** Short heading identifying the metric or selected field. */
    label?: string;
    /** Inspected numerical or string value. */
    value: string | number;
    /** Physical dimension unit string. */
    unit?: string;
    /** Human-readable metadata description. */
    description?: string;
}

/**
 * Properties for standard HTML and React map tooltip renderers.
 *
 * @example
 * ```ts
 * const tooltip: StandardTooltipProps = {
 *   value: 0.73,
 *   unit: "probability",
 *   description: "Modeled habitat suitability",
 *   rows: [{ label: "Species", value: "Aedes albopictus" }],
 *   chartId: "albopictus-habitat-tooltip",
 * };
 * ```
 */
export interface StandardTooltipProps {
    /** Use reduced width, spacing, and typography for compact chart cards. */
    compact?: boolean;
    /** Short heading identifying the primary metric or selected field. */
    valueLabel?: string;
    /** Inspected primary numerical or string feature value */
    value: string | number;
    /** Physical dimension unit string (e.g. "°C", "mm", "%") */
    unit?: string;
    /** Variable description text */
    description?: string;
    /** Array of attribute rows matching {@link StandardTooltipRow} */
    rows: StandardTooltipRow[];
    /** Optional metric displayed below the primary value using identical styling. */
    secondarySection?: StandardTooltipSection;
    /** DOM container element ID */
    chartId?: string;
    /** Optional HTML snippet for color bar previews */
    colorBarHtml?: string;
}

/**
 * Generates standardized HTML string for map Leaflet tooltips.
 *
 * @param props - Configuration matching {@link StandardTooltipProps}.
 * @returns HTML string representation.
 */
export function renderStandardTooltipHTML({
    compact = false,
    valueLabel,
    value,
    unit = "",
    description,
    rows,
    secondarySection,
    chartId = "tooltip",
    colorBarHtml = "",
}: StandardTooltipProps): string {
    const containerClasses = compact
        ? "min-w-[170px] max-w-[230px] rounded-lg border border-gray-800 bg-linear-to-br from-indigo-600 via-indigo-700 to-slate-900 p-3 text-white shadow-lg font-sans"
        : "min-w-[220px] max-w-[280px] rounded-xl border border-gray-800 bg-linear-to-br from-indigo-600 via-indigo-700 to-slate-900 p-4 text-white shadow-xl font-sans";
    const valueClasses = compact ? "text-xl font-semibold align-baseline" : "text-3xl font-semibold align-baseline";
    const unitClasses = compact
        ? "text-sm font-medium text-indigo-200 ml-1 align-baseline"
        : "text-lg font-medium text-indigo-200 ml-1 align-baseline";
    const descriptionClasses = compact
        ? "mt-0.5 italic text-xs text-indigo-100/90"
        : "mt-1 italic text-sm text-indigo-100/90";
    const tableRowsHtml = rows
        .map(
            (row, idx) => `
        <tr class="${idx < rows.length - 1 ? "border-b border-white/20" : ""}">
            <td class="py-1.5 pr-2 text-left font-normal text-indigo-200">
                ${row.label}
            </td>
            <td class="py-1.5 pl-2 text-right font-medium" style="white-space: normal; word-break: break-word;">
                ${row.value}
            </td>
        </tr>`
        )
        .join("");

    const descHtml =
        description && description !== "N/A"
            ? `<div class="${descriptionClasses}" style="white-space: normal; word-break: break-word;">${description}</div>`
            : "";

    const secondaryDescHtml =
        secondarySection?.description && secondarySection.description !== "N/A"
            ? `<div class="${descriptionClasses}" style="white-space: normal; word-break: break-word;">${secondarySection.description}</div>`
            : "";

    const secondarySectionHtml = secondarySection
        ? `<div class="${compact ? "mb-2 border-t border-white/20 pt-2" : "mb-3 border-t border-white/20 pt-3"}">
                ${secondarySection.label ? `<div class="mb-1 text-xs font-medium uppercase tracking-wide text-indigo-200">${secondarySection.label}</div>` : ""}
                <span class="${valueClasses}">${secondarySection.value}</span>
                ${secondarySection.unit ? `<span class="${unitClasses}">${secondarySection.unit}</span>` : ""}
                ${secondaryDescHtml}
           </div>`
        : "";

    return `
        <div id="${chartId}" class="${containerClasses}">
            <div class="${compact ? "mb-2" : "mb-3"}">
                ${valueLabel ? `<div class="mb-1 text-xs font-medium uppercase tracking-wide text-indigo-200">${valueLabel}</div>` : ""}
                <span class="${valueClasses}">
                    ${value}
                </span>
                ${unit ? `<span class="${unitClasses}">${unit}</span>` : ""}
                ${descHtml}
            </div>

            ${secondarySectionHtml}

            ${colorBarHtml}

            ${rows.length > 0 ? `<table class="w-full text-sm">
                <tbody>
                    ${tableRowsHtml}
                </tbody>
            </table>` : ""}
        </div>`;
}

/**
 * Standardized React component for map tooltips.
 *
 * @param props - Configuration matching {@link StandardTooltipProps}.
 */
export function StandardTooltip({
    compact = false,
    valueLabel,
    value,
    unit = "",
    description,
    rows,
    secondarySection,
    chartId = "tooltip",
    colorBarHtml,
}: StandardTooltipProps) {
    const containerClasses = compact
        ? "min-w-[170px] max-w-[230px] rounded-lg border border-gray-800 bg-linear-to-br from-indigo-600 via-indigo-700 to-slate-900 p-3 text-white shadow-lg font-sans"
        : "min-w-[220px] max-w-[280px] rounded-xl border border-gray-800 bg-linear-to-br from-indigo-600 via-indigo-700 to-slate-900 p-4 text-white shadow-xl font-sans";
    const valueClasses = compact ? "text-xl font-semibold align-baseline" : "text-3xl font-semibold align-baseline";
    const unitClasses = compact
        ? "text-sm font-medium text-indigo-200 ml-1 align-baseline"
        : "text-lg font-medium text-indigo-200 ml-1 align-baseline";
    const descriptionClasses = compact
        ? "mt-0.5 italic text-xs text-indigo-100/90"
        : "mt-1 italic text-sm text-indigo-100/90";

    return (
        <div id={chartId} className={containerClasses}>
            <div className={compact ? "mb-2" : "mb-3"}>
                {valueLabel ? (
                    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-indigo-200">
                        {valueLabel}
                    </div>
                ) : null}
                <span className={valueClasses}>
                    {value}
                </span>
                {unit ? <span className={unitClasses}>{unit}</span> : null}
                {description && description !== "N/A" ? (
                    <div className={descriptionClasses} style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {description}
                    </div>
                ) : null}
            </div>

            {secondarySection ? (
                <div className={compact ? "mb-2 border-t border-white/20 pt-2" : "mb-3 border-t border-white/20 pt-3"}>
                    {secondarySection.label ? (
                        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-indigo-200">
                            {secondarySection.label}
                        </div>
                    ) : null}
                    <span className={valueClasses}>
                        {secondarySection.value}
                    </span>
                    {secondarySection.unit ? (
                        <span className={unitClasses}>
                            {secondarySection.unit}
                        </span>
                    ) : null}
                    {secondarySection.description && secondarySection.description !== "N/A" ? (
                        <div className={descriptionClasses} style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                            {secondarySection.description}
                        </div>
                    ) : null}
                </div>
            ) : null}

            {colorBarHtml ? (
                <div dangerouslySetInnerHTML={{ __html: colorBarHtml }} />
            ) : null}

            {rows.length > 0 ? <table className="w-full text-sm">
                <tbody>
                    {rows.map((row, idx) => (
                        <tr key={idx} className={idx < rows.length - 1 ? "border-b border-white/20" : ""}>
                            <td className="py-1.5 pr-2 text-left font-normal text-indigo-200">
                                {row.label}
                            </td>
                            <td className="py-1.5 pl-2 text-right font-medium" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                {row.value}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table> : null}
        </div>
    );
}

