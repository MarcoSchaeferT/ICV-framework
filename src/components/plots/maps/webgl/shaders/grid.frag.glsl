#version 300 es
precision highp float;
precision highp int;

// Constant normalized data value for the entire grid cell.
flat in float v_normVal;

// 256x1 RGBA lookup texture. Its horizontal axis represents [0, 1].
uniform sampler2D u_colormap;
uniform float u_opacity;

out vec4 fragColor;

void main() {
    // NaN represents unavailable data. Transparent colormap entries are also
    // omitted so they do not write color or interfere with later blending.
    if (isnan(v_normVal)) discard;
    vec4 color = texture(u_colormap, vec2(v_normVal, 0.5));
    if (color.a <= 0.001) discard;

    float alpha = color.a * u_opacity;
    // Output premultiplied RGBA for blendFunc(ONE, ONE_MINUS_SRC_ALPHA).
    fragColor = vec4(color.rgb * alpha, alpha);
}
