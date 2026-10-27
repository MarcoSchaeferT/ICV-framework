#version 300 es
precision highp float;
precision highp int;

// One static unit quad is reused for every border segment. x selects the side
// of the stroke (-1/+1); y selects segment endpoint A/B (0/1).
in vec2 a_quad;

// Per-instance attributes. Points are [latitude, longitude] in degrees and the
// positive country ID connects the segment to hover/selection state.
in vec2 a_pointA;
in vec2 a_pointB;
in float a_countryId;

// Geographic-to-clip-space transform shared with the fill and grid shaders.
uniform vec2 u_scale;
uniform vec2 u_offset;
uniform int u_isEquirectangular;
// Physical drawing-buffer dimensions, not CSS pixels. Expanding the quad in
// screen space keeps stroke widths visually constant while the map zooms.
uniform vec2 u_viewportSize;
uniform float u_lineWidth;
uniform float u_hoverLineWidth;
uniform float u_activeLineWidth;
uniform int u_hoveredCountryId;
uniform int u_selectedCountryId;
// Borders are rendered in two batches: all base strokes first, then only the
// wider highlighted strokes. This prevents base borders covering highlights.
uniform int u_drawOnlyHighlights;

// Pixel-space coordinates consumed by the fragment shader's distance test.
// x runs along the segment; y is the signed distance from its center line.
out vec2 v_localPos;
// [segment length in pixels, half stroke width in pixels].
flat out vec2 v_params;
flat out int v_countryId;

const float PI = 3.14159265358979323846;

vec2 projectPoint(vec2 latlng) {
    float lat = latlng.x;
    float lng = latlng.y;
    float ndcX = lng * u_scale.x + u_offset.x;
    float ndcY = 0.0;

    if (u_isEquirectangular == 1) {
        ndcY = lat * u_scale.y + u_offset.y;
    } else {
        // Clamp to the finite Web Mercator domain used by the CPU transform.
        float clampedLat = clamp(lat, -85.051128, 85.051128);
        float latRad = radians(clampedLat);
        float yMerc = log(tan(PI * 0.25 + latRad * 0.5));
        ndcY = yMerc * u_scale.y + u_offset.y;
    }
    return vec2(ndcX, ndcY);
}

void main() {
    v_countryId = int(a_countryId);

    // GeoJSON rings may cross from +180 to -180 degrees. Move endpoint B by a
    // full turn when needed so the segment follows the short path instead of
    // drawing a line across the entire map.
    vec2 pointB = a_pointB;
    float longitudeDelta = pointB.y - a_pointA.y;
    if (longitudeDelta > 180.0) {
        pointB.y -= 360.0;
    } else if (longitudeDelta < -180.0) {
        pointB.y += 360.0;
    }

    vec2 ndcA = projectPoint(a_pointA);
    vec2 ndcB = projectPoint(pointB);
    // Convert NDC to drawing-buffer pixels before calculating direction and
    // normals. Performing extrusion here avoids aspect-ratio distortion.
    vec2 viewport = max(u_viewportSize, vec2(1.0));
    vec2 screenA = (ndcA * 0.5 + 0.5) * viewport;
    vec2 screenB = (ndcB * 0.5 + 0.5) * viewport;

    vec2 delta = screenB - screenA;
    float lengthInPixels = length(delta);
    vec2 direction = lengthInPixels > 0.0001
        ? delta / lengthInPixels
        : vec2(1.0, 0.0);
    vec2 normal = vec2(-direction.y, direction.x);

    float width = u_lineWidth;
    if (u_drawOnlyHighlights == 1) {
        // Selection takes priority if a country is both selected and hovered.
        if (v_countryId == u_selectedCountryId && u_selectedCountryId > 0) {
            width = u_activeLineWidth;
        } else if (v_countryId == u_hoveredCountryId && u_hoveredCountryId > 0) {
            width = u_hoverLineWidth;
        }
    }

    float halfWidth = max(0.0, width * 0.5);
    // Extend the quad past both endpoints and beyond the nominal half-width.
    // The fragment shader trims this conservative box to a round-capped line;
    // the extra pixels leave room for its antialiasing fringe.
    float capExtension = halfWidth + 1.5;
    float endpoint = a_quad.y;
    float side = a_quad.x;
    vec2 segmentPosition = mix(screenA, screenB, endpoint);
    vec2 directionExtension = direction * ((endpoint * 2.0 - 1.0) * capExtension);
    vec2 normalExtension = normal * (side * capExtension);
    vec2 finalScreenPosition = segmentPosition + directionExtension + normalExtension;
    vec2 finalNdcPosition = (finalScreenPosition / viewport) * 2.0 - 1.0;

    gl_Position = vec4(finalNdcPosition, 0.0, 1.0);
    // Preserve pixel-space coordinates for the fragment-stage distance field.
    v_localPos = vec2(
        endpoint * lengthInPixels + (endpoint * 2.0 - 1.0) * capExtension,
        side * capExtension
    );
    v_params = vec2(lengthInPixels, halfWidth);
}
