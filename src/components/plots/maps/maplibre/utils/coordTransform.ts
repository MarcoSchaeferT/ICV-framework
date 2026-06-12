/**
 * coordTransform – Coordinate reprojection utilities for equirectangular mode.
 *
 * When isProjection_equirectangular = true, these functions transform
 * GeoJSON coordinates through D3's geoEquirectangular projection and
 * then inverse-project through MapLibre's Mercator to produce "fake"
 * coordinates that render with equirectangular visual appearance on the GPU.
 *
 * Pipeline: Real [lng,lat] → D3 equirectangular → [px,py] → MapLibre unproject → [fake_lng,fake_lat]
 */
import * as d3 from 'd3';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { MapDimensions } from '../../types';

/**
 * Creates and configures a D3 equirectangular projection synced to
 * the current MapLibre viewport parameters.
 */
export function configureEquirectangularProjection(
    map: MapLibreMap,
    dims: MapDimensions,
): d3.GeoProjection {
    const center = map.getCenter();
    const zoom = map.getZoom();

    return d3.geoEquirectangular()
        .center([center.lng, center.lat])
        .scale((dims.width / (2 * Math.PI)) * Math.pow(2, zoom))
        .translate([dims.width / 2, dims.height / 2]);
}

/**
 * Recursively walks a GeoJSON geometry and transforms each [lng, lat] coordinate
 * using the provided transform function.
 */
export function transformCoords<G extends GeoJSON.Geometry>(
    geometry: G,
    transformFn: (coord: [number, number]) => [number, number],
): G {
    if (!geometry) return geometry;

    switch (geometry.type) {
        case 'Point':
            return {
                ...geometry,
                coordinates: transformFn(geometry.coordinates as [number, number]),
            };
        case 'MultiPoint':
        case 'LineString':
            return {
                ...geometry,
                coordinates: (geometry.coordinates as [number, number][]).map(transformFn),
            };
        case 'MultiLineString':
        case 'Polygon':
            return {
                ...geometry,
                coordinates: (geometry.coordinates as [number, number][][]).map(
                    ring => ring.map(transformFn)
                ),
            };
        case 'MultiPolygon':
            return {
                ...geometry,
                coordinates: (geometry.coordinates as [number, number][][][]).map(
                    polygon => polygon.map(ring => ring.map(transformFn))
                ),
            };
        case 'GeometryCollection':
            return {
                ...geometry,
                geometries: (geometry as GeoJSON.GeometryCollection).geometries.map(
                    g => transformCoords(g, transformFn)
                ),
            } as G;
        default:
            return geometry;
    }
}

/**
 * Reprojects a GeoJSON FeatureCollection for equirectangular display on MapLibre.
 *
 * For each coordinate:
 * 1. D3 geoEquirectangular projects [lng, lat] → [px, py] screen coords
 * 2. MapLibre unproject([px, py]) → [fake_lng, fake_lat]
 * 3. When MapLibre renders [fake_lng, fake_lat] through Mercator,
 *    the visual result is equirectangular
 *
 * @param geojson - Original GeoJSON with real geographic coordinates
 * @param map - MapLibre map instance (for unproject)
 * @param projection - Configured D3 equirectangular projection
 * @returns GeoJSON with reprojected coordinates for MapLibre rendering
 */
export function reprojectToEquirectangular(
    geojson: GeoJSON.FeatureCollection,
    map: MapLibreMap,
    projection: d3.GeoProjection,
): GeoJSON.FeatureCollection {
    return {
        ...geojson,
        features: geojson.features.map(f => ({
            ...f,
            geometry: transformCoords(f.geometry, ([lng, lat]) => {
                const projected = projection([lng, lat]);
                if (!projected) return [lng, lat]; // Fallback for out-of-range coords
                const fakeCoord = map.unproject(projected as [number, number]);
                return [fakeCoord.lng, fakeCoord.lat];
            }),
        })),
    };
}

/**
 * Reprojects a single [lng, lat] coordinate for equirectangular display.
 * Useful for point data (presence dots, markers) without full GeoJSON wrapping.
 */
export function reprojectPointToEquirectangular(
    lngLat: [number, number],
    map: MapLibreMap,
    projection: d3.GeoProjection,
): [number, number] {
    const projected = projection(lngLat);
    if (!projected) return lngLat;
    const fakeCoord = map.unproject(projected as [number, number]);
    return [fakeCoord.lng, fakeCoord.lat];
}
