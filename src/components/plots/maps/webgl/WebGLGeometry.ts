/**
 * CPU-side geometry preparation and country hit testing for the WebGL map.
 *
 * GeoJSON arrives in `[longitude, latitude]` order. This module converts all
 * render and picking data to the renderer's `[latitude, longitude]` contract,
 * triangulates polygon fills, and builds compact typed arrays for GPU upload.
 */
import earcut, { flatten } from 'earcut';
import type * as GEOjson from 'geojson';
import type { VisDataT } from '../types';
import type {
    CountryGeometry,
    CountryPolygon,
    CountryRecord,
    GridGeometry,
    LatLngPoint,
} from './WebGLRendererTypes';

type GridQuad = [LatLngPoint, LatLngPoint, LatLngPoint, LatLngPoint];

/**
 * Converts GeoJSON polygons into compact GPU buffers and CPU hit-test records.
 *
 * @param mapData - Country `Polygon`/`MultiPolygon` features, or `null`.
 * @returns Triangulated land vertices, triangle indices, border instances, and
 * CPU polygon rings.
 *
 * @remarks
 * Earcut handles concave outlines and holes for the fill geometry. Border
 * geometry is not triangulated here: each edge is stored as
 * `[latA, lngA, latB, lngB, countryId]` and expanded into a screen-space quad
 * by the instanced border vertex shader. Country ids start at one because
 * negative ids represent "none" in interaction state.
 */
export function buildCountryGeometry(mapData: GEOjson.FeatureCollection | null): CountryGeometry {
    if (!mapData?.features.length) {
        return {
            countries: [],
            polygonVertices: new Float32Array(),
            polygonIndices: new Uint32Array(),
            borderSegments: new Float32Array(),
        };
    }

    const vertices: number[] = [];
    const indices: number[] = [];
    const borderSegments: number[] = [];
    const countries: CountryRecord[] = [];
    let vertexOffset = 0;

    const addBorderSegment = (
        pointA: number[],
        pointB: number[],
        countryId: number,
    ) => {
        const [lngA, latA] = pointA;
        const [lngB, latB] = pointB;
        if (latA === latB && lngA === lngB) return;
        borderSegments.push(latA, lngA, latB, lngB, countryId);
    };

    mapData.features.forEach((feature, featureIndex) => {
        const geometry = feature.geometry;
        if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) return;

        const countryId = featureIndex + 1;
        const properties = feature.properties ?? {};
        const countryPolygons: CountryPolygon[] = [];
        let minLat = Infinity;
        let maxLat = -Infinity;
        let minLng = Infinity;
        let maxLng = -Infinity;

        const addPolygon = (coordinates: number[][][]) => {
            if (coordinates.length === 0) return;

            const hitTestRings = coordinates.map((ring) => ring.map(([lng, lat]) => {
                minLat = Math.min(minLat, lat);
                maxLat = Math.max(maxLat, lat);
                minLng = Math.min(minLng, lng);
                maxLng = Math.max(maxLng, lng);
                return [lat, lng] as LatLngPoint;
            }));

            if (hitTestRings.length > 0) {
                countryPolygons.push({
                    outer: hitTestRings[0],
                    holes: hitTestRings.slice(1),
                });
            }

            const flattened = flatten(coordinates);
            const triangleIndices = earcut(
                flattened.vertices,
                flattened.holes,
                flattened.dimensions,
            );
            const polygonVertexOffset = vertexOffset;
            const vertexCount = flattened.vertices.length / flattened.dimensions;

            for (let index = 0; index < vertexCount; index++) {
                const position = index * flattened.dimensions;
                vertices.push(flattened.vertices[position + 1], flattened.vertices[position]);
            }
            vertexOffset += vertexCount;
            triangleIndices.forEach((index) => indices.push(polygonVertexOffset + index));

            coordinates.forEach((ring) => {
                for (let index = 1; index < ring.length; index++) {
                    addBorderSegment(ring[index - 1], ring[index], countryId);
                }
                const first = ring[0];
                const last = ring.at(-1);
                if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
                    addBorderSegment(last, first, countryId);
                }
            });
        };

        if (geometry.type === 'Polygon') {
            addPolygon(geometry.coordinates as number[][][]);
        } else {
            (geometry.coordinates as number[][][][]).forEach(addPolygon);
        }

        if (countryPolygons.length === 0) return;
        countries.push({
            id: countryId,
            feature,
            code: String(properties.iso_a3 || properties.ISO_A3 || properties.name || countryId),
            name: String(properties.name || properties.NAME || properties.admin || ''),
            bbox: [minLat, maxLat, minLng, maxLng],
            polygons: countryPolygons,
        });
    });

    return {
        countries,
        polygonVertices: new Float32Array(vertices),
        polygonIndices: new Uint32Array(indices),
        borderSegments: new Float32Array(borderSegments),
    };
}

/**
 * Resolves the four display corners of a grid record in clockwise order.
 * Explicit `topLeft` plus cell size takes precedence, followed by bounds,
 * packed corners, and finally the first four geometry points.
 */
function resolveGridQuad(
    data: VisDataT,
    cellSize: { lat: number; lng: number },
): GridQuad | null {
    if (data.topLeft && cellSize.lat > 0 && cellSize.lng > 0) {
        const [north, west] = data.topLeft;
        const south = north - cellSize.lat;
        const east = west + cellSize.lng;
        return [[north, west], [north, east], [south, east], [south, west]];
    }

    if (data.bounds) {
        const [north, south, west, east] = data.bounds;
        return [[north, west], [north, east], [south, east], [south, west]];
    }

    if (data.corners) {
        return [
            [data.corners[0], data.corners[1]],
            [data.corners[2], data.corners[3]],
            [data.corners[4], data.corners[5]],
            [data.corners[6], data.corners[7]],
        ];
    }

    if (data.geometry && data.geometry.length >= 4) {
        return [data.geometry[0], data.geometry[1], data.geometry[2], data.geometry[3]];
    }

    return null;
}

/**
 * Converts spatial grid records into indexed quads ready for GPU upload.
 *
 * @remarks
 * Each valid cell produces four `[lat, lng, value]` vertices and the fixed
 * index pattern `[0, 1, 2, 0, 2, 3]`. Invalid geometry and non-finite feature
 * values are skipped. Returned arrays are sliced to the accepted cell count so
 * unused preallocated capacity is never transferred to WebGL.
 */
export function buildGridGeometry(
    gridData: Map<number, VisDataT>,
    cellSize: { lat: number; lng: number },
): GridGeometry {
    const vertices = new Float32Array(gridData.size * 12);
    const indices = new Uint32Array(gridData.size * 6);
    let cellCount = 0;
    let minValue = Infinity;
    let maxValue = -Infinity;

    for (const data of gridData.values()) {
        const quad = resolveGridQuad(data, cellSize);
        const value = Number(data.feature);
        if (!quad || !Number.isFinite(value)) continue;

        minValue = Math.min(minValue, value);
        maxValue = Math.max(maxValue, value);

        const vertexOffset = cellCount * 12;
        quad.forEach(([lat, lng], pointIndex) => {
            const offset = vertexOffset + pointIndex * 3;
            vertices[offset] = lat;
            vertices[offset + 1] = lng;
            vertices[offset + 2] = value;
        });

        const indexOffset = cellCount * 6;
        const baseVertex = cellCount * 4;
        indices[indexOffset] = baseVertex;
        indices[indexOffset + 1] = baseVertex + 1;
        indices[indexOffset + 2] = baseVertex + 2;
        indices[indexOffset + 3] = baseVertex;
        indices[indexOffset + 4] = baseVertex + 2;
        indices[indexOffset + 5] = baseVertex + 3;
        cellCount++;
    }

    return {
        vertices: vertices.subarray(0, cellCount * 12),
        indices: indices.subarray(0, cellCount * 6),
        cellCount,
        minValue: Number.isFinite(minValue) ? minValue : 0,
        maxValue: Number.isFinite(maxValue) ? maxValue : 1,
    };
}

/** Ray-casting point-in-ring test in geographic latitude/longitude space. */
function isPointInRing(lat: number, lng: number, ring: LatLngPoint[]): boolean {
    let inside = false;
    for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
        const [currentLat, currentLng] = ring[current];
        const [previousLat, previousLng] = ring[previous];
        const crossesLatitude = (currentLat > lat) !== (previousLat > lat);
        if (crossesLatitude) {
            const intersectionLng = (
                (previousLng - currentLng) * (lat - currentLat) /
                (previousLat - currentLat)
            ) + currentLng;
            if (lng < intersectionLng) inside = !inside;
        }
    }
    return inside;
}

/**
 * Finds the first country containing a geographic point.
 *
 * A bounding-box rejection avoids most polygon tests. A point counts as inside
 * only when it is inside an outer ring and outside every hole. Longitude is
 * normalized to `[-180, 180]` to match the uploaded GeoJSON coordinates.
 */
export function hitTestCountries(
    countries: CountryRecord[],
    lat: number,
    lng: number,
): CountryRecord | null {
    const normalizedLng = lng === 180 ? 180 : ((lng + 180) % 360 + 360) % 360 - 180;

    for (const country of countries) {
        const [minLat, maxLat, minLng, maxLng] = country.bbox;
        if (lat < minLat || lat > maxLat || normalizedLng < minLng || normalizedLng > maxLng) {
            continue;
        }

        const containsPoint = country.polygons.some((polygon) => (
            isPointInRing(lat, normalizedLng, polygon.outer) &&
            !polygon.holes.some((hole) => isPointInRing(lat, normalizedLng, hole))
        ));
        if (containsPoint) return country;
    }

    return null;
}

/**
 * Resolves a country from ISO codes, canonical names, localized names, or
 * common GeoJSON `admin` properties using case-insensitive exact matching.
 */
export function findCountryByName(
    countries: CountryRecord[],
    name: string,
): CountryRecord | undefined {
    if (!name) return undefined;
    const normalizedName = name.trim().toLowerCase();
    const matches = (value: unknown) => String(value ?? '').trim().toLowerCase() === normalizedName;

    return countries.find((country) => {
        const properties = country.feature.properties ?? {};
        return [
            country.code,
            country.name,
            properties.name,
            properties.NAME,
            properties.name_de,
            properties.NAME_de,
            properties.name_en,
            properties.NAME_en,
            properties.admin,
            properties.ADMIN,
            properties.iso_a3,
            properties.ISO_A3,
            properties.iso_a2,
            properties.ISO_A2,
        ].some(matches);
    });
}
