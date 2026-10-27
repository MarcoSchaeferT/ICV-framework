#version 300 es
precision highp float;
precision highp int;

// Pixel-space position within the conservative quad emitted by the vertex
// shader. v_params stores [segment length, half stroke width].
in vec2 v_localPos;
flat in vec2 v_params;
flat in int v_countryId;

uniform vec4 u_strokeColor;
uniform vec4 u_hoverStrokeColor;
uniform vec4 u_activeStrokeColor;
uniform int u_hoveredCountryId;
uniform int u_selectedCountryId;
// 0 draws all base strokes; 1 draws selected/hovered strokes only.
uniform int u_drawOnlyHighlights;

out vec4 fragColor;

void main() {
    float lengthInPixels = v_params.x;
    float halfWidth = v_params.y;
    if (halfWidth <= 0.0) discard;

    float distanceAlongSegment = v_localPos.x;
    float distanceFromAxis = v_localPos.y;
    // Inside the endpoint interval, distancePastEnd is zero and the distance
    // is simply perpendicular to the line. Outside it, Euclidean distance to
    // the nearest endpoint produces circular rather than square caps.
    float distancePastEnd = max(
        0.0,
        max(-distanceAlongSegment, distanceAlongSegment - lengthInPixels)
    );
    float distanceFromSegment = length(vec2(distancePastEnd, distanceFromAxis));

    // fwidth adapts the transition to the fragment footprint, giving stable
    // subpixel antialiasing for both the long edges and the round caps.
    float feather = max(fwidth(distanceFromSegment), 0.75);
    float alpha = 1.0 - smoothstep(
        halfWidth - feather * 0.5,
        halfWidth + feather * 0.5,
        distanceFromSegment
    );
    if (alpha <= 0.005) discard;

    vec4 color;
    if (u_drawOnlyHighlights == 1) {
        // Match the vertex-stage width choice; selection wins over hover.
        if (v_countryId == u_selectedCountryId && u_selectedCountryId > 0) {
            color = u_activeStrokeColor;
        } else if (v_countryId == u_hoveredCountryId && u_hoveredCountryId > 0) {
            color = u_hoverStrokeColor;
        } else {
            discard;
        }
    } else {
        color = u_strokeColor;
    }

    float finalAlpha = color.a * alpha;
    // Output premultiplied RGBA for blendFunc(ONE, ONE_MINUS_SRC_ALPHA).
    fragColor = vec4(color.rgb * finalAlpha, finalAlpha);
}
