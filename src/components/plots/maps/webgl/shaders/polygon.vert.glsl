#version 300 es
precision highp float;
precision highp int;

// Geographic position in degrees, stored as [latitude, longitude].
in vec2 a_latlng;

// Affine transform from longitude/projected latitude to WebGL clip space.
// The CPU updates these uniforms whenever the map viewport changes.
uniform vec2 u_scale;
uniform vec2 u_offset;
uniform int u_isEquirectangular;

const float PI = 3.14159265358979323846;

vec2 projectPoint(vec2 latlng) {
    float lat = latlng.x;
    float lng = latlng.y;
    float ndcX = lng * u_scale.x + u_offset.x;
    float ndcY = 0.0;

    if (u_isEquirectangular == 1) {
        ndcY = lat * u_scale.y + u_offset.y;
    } else {
        // Web Mercator is undefined at the poles. Its conventional latitude
        // limit keeps tan/log finite and matches the CPU viewport projection.
        float clampedLat = clamp(lat, -85.051128, 85.051128);
        float latRad = radians(clampedLat);
        float yMerc = log(tan(PI * 0.25 + latRad * 0.5));
        ndcY = yMerc * u_scale.y + u_offset.y;
    }
    return vec2(ndcX, ndcY);
}

void main() {
    // Country vertices are already triangulated on the CPU; this stage only
    // projects their geographic coordinates to normalized device coordinates.
    gl_Position = vec4(projectPoint(a_latlng), 0.0, 1.0);
}
