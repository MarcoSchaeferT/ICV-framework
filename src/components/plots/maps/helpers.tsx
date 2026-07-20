import React from 'react';
import * as d3 from 'd3';
import * as GEOjson from 'geojson';


/**
 * Computes the minimum and maximum values of a specified feature from the given data array.
 *
 * @param data - An array of objects containing the feature to be evaluated.
 * @returns A tuple containing the minimum and maximum values of the specified feature.
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

export function getGridOffset(latGeometryTopLeft: number, lngGeometryTopLeft: number, gridSizeDegreesLat: number, gridSizeDegreesLng: number) : {lat:number, lng:number} {
    // snap coordinates to grid
    const lat = latGeometryTopLeft;
    const lng = lngGeometryTopLeft;
    const gridLat = Math.floor((lat) / gridSizeDegreesLat) * gridSizeDegreesLat;
    const gridLng = Math.floor((lng) / gridSizeDegreesLng) * gridSizeDegreesLng;

    return {lat: lat - gridLat, lng: lng - gridLng};
}

export function snapToGrid(coords:{lat: number, lng: number}, gridCellDims:{lat:number, lng: number}, gridOffset?:{lat:number, lng: number}) : {topLeft: {lat: number, lng: number}} {

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

    return {topLeft};
}

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

export function roundLatLng(point: { lat: number; lng: number }, roundTo: number = 3): { lat: number; lng: number } {

    const rounder = Math.pow(10, roundTo);
    let lat = point.lat;
    let lng = point.lng;
    lat = Math.round(lat * rounder) / rounder;
    lng = Math.round(lng * rounder) / rounder;
    const rPoint = {lat: lat, lng: lng};
    return rPoint;
}

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

export function getGridCellDims(geoRect: [number, number][]): { gridDimLat: number; gridDimLng: number } {
    const lngDim =  Math.abs(Number(geoRect[1][0]) - Number(geoRect[2][0]));
    const latDim =  Math.abs(Number(geoRect[0][1]) - Number(geoRect[1][1]));
    return { gridDimLat: latDim, gridDimLng: lngDim };
}


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
 * Calculates a "good" readable range for axis scaling based on the provided minimum and maximum data values.
 * The function rounds the minimum down and the maximum up to the nearest order of magnitude,
 * making axis labels more human-friendly (e.g., 1235 -> 1000, 9876 -> 10000).
 * If the resulting range is too small, it uses the next lower order of magnitude for better readability.
 *
 * @param dataMin - The minimum value in the data set.
 * @param dataMax - The maximum value in the data set.
 * @returns A tuple containing the adjusted minimum and maximum values for axis scaling.
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