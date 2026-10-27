#version 300 es
precision highp float;

// RGBA in straight-alpha form. The renderer uses premultiplied-alpha blending,
// so RGB is multiplied by alpha before it leaves the shader.
uniform vec4 u_color;

out vec4 fragColor;

void main() {
    // When stencil masking is enabled, fixed-function stencil state limits this
    // shader to ocean pixels; the shader itself does not inspect the stencil.
    fragColor = vec4(u_color.rgb * u_color.a, u_color.a);
}
