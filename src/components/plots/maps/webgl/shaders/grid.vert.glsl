#version 300 es
precision highp float;
precision highp int;

// Each grid vertex is interleaved as [latitude, longitude, value]. All four
// vertices of a cell carry the same value.
in vec2 a_latlng;
in float a_val;

// Projection uniforms map geographic degrees to WebGL clip space.
uniform vec2 u_scale;
uniform vec2 u_offset;
uniform int u_isEquirectangular;
// Minimum and maximum data values represented by the colormap texture.
uniform vec2 u_valRange;

// `flat` prevents interpolation across a cell and, more importantly, across
// triangle edges shared by adjacent cells with different values.
flat out float v_normVal;

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
    gl_Position = vec4(projectPoint(a_latlng), 0.0, 1.0);
    // Convert the raw feature value to the colormap's [0, 1] texture range.
    // A collapsed range uses its midpoint rather than dividing by zero.
    float rangeSpan = u_valRange.y - u_valRange.x;
    v_normVal = rangeSpan > 0.000001
        ? clamp((a_val - u_valRange.x) / rangeSpan, 0.0, 1.0)
        : 0.5;
}
