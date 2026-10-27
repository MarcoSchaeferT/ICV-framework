#version 300 es
precision highp float;

// Generate a fullscreen triangle from gl_VertexID. The triangle deliberately
// extends beyond clip space so it covers the viewport without a vertex buffer
// or the diagonal seam that two fullscreen triangles could introduce.
const vec2 POSITIONS[3] = vec2[3](
    vec2(-1.0, -1.0),
    vec2(3.0, -1.0),
    vec2(-1.0, 3.0)
);

void main() {
    gl_Position = vec4(POSITIONS[gl_VertexID], 0.0, 1.0);
}
