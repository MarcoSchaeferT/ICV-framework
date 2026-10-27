#version 300 es
precision highp float;
precision highp int;

// Uniform land fill in straight-alpha form.
uniform vec4 u_baseColor;

out vec4 fragColor;

void main() {
    // Stencil writes used to build the land mask are configured by the polygon
    // render pass. Fragment shaders do not write stencil values directly.
    // Premultiplication matches blendFunc(ONE, ONE_MINUS_SRC_ALPHA).
    fragColor = vec4(u_baseColor.rgb * u_baseColor.a, u_baseColor.a);
}
