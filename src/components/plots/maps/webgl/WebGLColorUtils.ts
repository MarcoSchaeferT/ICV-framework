import * as d3 from 'd3';
import type { ColorVector } from './WebGLRendererTypes';

/**
 * Converts any CSS color understood by D3 into normalized RGBA components.
 * Invalid input falls back to opaque black so callers always receive a valid
 * WebGL uniform value.
 */
export function parseColor(cssColor: string): ColorVector {
    const parsed = d3.color(cssColor);
    if (!parsed) return [0, 0, 0, 1];
    const rgb = parsed.rgb();
    return [rgb.r / 255, rgb.g / 255, rgb.b / 255, rgb.opacity];
}

/**
 * Samples a continuous D3 color function into the grid shader's 256x1 lookup
 * texture.
 *
 * @param colorMap - Feature-value-to-CSS-color function.
 * @param minValue - Value represented by texture coordinate `0`.
 * @param maxValue - Value represented by texture coordinate `1`.
 * @returns RGBA8 texels ordered from minimum to maximum value.
 *
 * @remarks Linear texture filtering interpolates between samples on the GPU,
 * avoiding per-fragment color-scale calculations in GLSL.
 */
export function createColorMapTexture(
    colorMap: (value: number) => string,
    minValue: number,
    maxValue: number,
): Uint8Array {
    const textureData = new Uint8Array(256 * 4);
    const span = maxValue - minValue;

    for (let index = 0; index < 256; index++) {
        const value = minValue + (index / 255) * span;
        const parsed = d3.color(colorMap(value));
        const offset = index * 4;
        if (!parsed) continue;

        const rgb = parsed.rgb();
        textureData[offset] = Math.round(rgb.r);
        textureData[offset + 1] = Math.round(rgb.g);
        textureData[offset + 2] = Math.round(rgb.b);
        textureData[offset + 3] = Math.round(rgb.opacity * 255);
    }

    return textureData;
}
