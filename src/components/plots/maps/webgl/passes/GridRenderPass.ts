/** Raster-grid geometry, colormap texture, and shader draw pass. */
import type { VisDataT } from '../../types';
import { createColorMapTexture } from '../WebGLColorUtils';
import { buildGridGeometry } from '../WebGLGeometry';
import {
    applyProjectionUniforms,
    createProgram,
    getCommonUniformLocations,
    type CommonUniformLocations,
} from '../WebGLProgramUtils';
import type { ProjectionState } from '../WebGLRendererTypes';
import GRID_FRAGMENT_SHADER from '../shaders/grid.frag.glsl';
import GRID_VERTEX_SHADER from '../shaders/grid.vert.glsl';

/** Uniform handles owned by the grid shader program. */
interface GridUniformLocations extends CommonUniformLocations {
    u_valRange: WebGLUniformLocation | null;
    u_opacity: WebGLUniformLocation | null;
    u_colormap: WebGLUniformLocation | null;
}

/**
 * Owns the climate-grid shader, buffers, colormap texture, and draw call.
 *
 * @remarks
 * The vertex buffer is interleaved as `[lat, lng, featureValue]`. Feature
 * values are normalized in the vertex shader and declared `flat`, so every
 * fragment in a cell samples exactly one position in the 256x1 colormap
 * texture. Geometry and texture data change independently: selecting a new
 * palette updates only the texture.
 */
export class GridRenderPass {
    private readonly program: WebGLProgram | null;
    private readonly vertexArray: WebGLVertexArrayObject | null;
    private readonly vertexBuffer: WebGLBuffer | null;
    private readonly indexBuffer: WebGLBuffer | null;
    private readonly colorMapTexture: WebGLTexture | null;
    private readonly uniforms: GridUniformLocations | null;
    private cellCount = 0;
    private minValue = 0;
    private maxValue = 1;
    private opacity = 1;

    /** Creates the shader program, indexed-quad buffers, VAO, and lookup texture. */
    constructor(private readonly gl: WebGL2RenderingContext) {
        this.program = createProgram(gl, 'GridRenderPass', GRID_VERTEX_SHADER, GRID_FRAGMENT_SHADER);
        this.vertexArray = gl.createVertexArray();
        this.vertexBuffer = gl.createBuffer();
        this.indexBuffer = gl.createBuffer();
        this.colorMapTexture = gl.createTexture();

        if (!this.program) {
            this.uniforms = null;
            return;
        }

        gl.bindVertexArray(this.vertexArray);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

        const stride = 3 * Float32Array.BYTES_PER_ELEMENT;
        const latLngLocation = gl.getAttribLocation(this.program, 'a_latlng');
        const valueLocation = gl.getAttribLocation(this.program, 'a_val');
        if (latLngLocation >= 0) {
            gl.enableVertexAttribArray(latLngLocation);
            gl.vertexAttribPointer(latLngLocation, 2, gl.FLOAT, false, stride, 0);
        }
        if (valueLocation >= 0) {
            gl.enableVertexAttribArray(valueLocation);
            gl.vertexAttribPointer(
                valueLocation,
                1,
                gl.FLOAT,
                false,
                stride,
                2 * Float32Array.BYTES_PER_ELEMENT,
            );
        }
        gl.bindVertexArray(null);

        this.uniforms = {
            ...getCommonUniformLocations(gl, this.program),
            u_valRange: gl.getUniformLocation(this.program, 'u_valRange'),
            u_opacity: gl.getUniformLocation(this.program, 'u_opacity'),
            u_colormap: gl.getUniformLocation(this.program, 'u_colormap'),
        };
        this.initializeColorMap();
    }

    /** Allocates a valid fallback palette before application data is available. */
    private initializeColorMap(): void {
        const { gl } = this;
        if (!this.colorMapTexture) return;

        const grayscale = new Uint8Array(256 * 4);
        for (let index = 0; index < 256; index++) {
            grayscale.set([index, index, index, 255], index * 4);
        }

        gl.bindTexture(gl.TEXTURE_2D, this.colorMapTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            256,
            1,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            grayscale,
        );
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    /** Converts application grid records and uploads static indexed quads. */
    public setData(
        gridData: Map<number, VisDataT>,
        cellSize: { lat: number; lng: number },
    ): void {
        const geometry = buildGridGeometry(gridData, cellSize);
        this.cellCount = geometry.cellCount;
        this.minValue = geometry.minValue;
        this.maxValue = geometry.maxValue;

        const { gl } = this;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);
    }

    /**
     * Resamples the active color scale and replaces the existing texture data.
     * Optional bounds also replace the value-normalization range.
     */
    public setColorMap(
        colorMap: (value: number) => string,
        minFeature?: number,
        maxFeature?: number,
    ): void {
        this.minValue = minFeature ?? this.minValue;
        this.maxValue = maxFeature ?? this.maxValue;
        if (!this.colorMapTexture) return;

        const textureData = createColorMapTexture(colorMap, this.minValue, this.maxValue);
        const { gl } = this;
        gl.bindTexture(gl.TEXTURE_2D, this.colorMapTexture);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            0,
            0,
            256,
            1,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            textureData,
        );
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    /** Sets the global grid alpha multiplier, clamped to `[0, 1]`. */
    public setOpacity(opacity: number): void {
        this.opacity = Math.max(0, Math.min(1, opacity));
    }

    /**
     * Draws all cells in one indexed call. With `maskToLand`, fragments pass
     * only where the polygon pass wrote stencil value `1`.
     */
    public draw(projection: ProjectionState, maskToLand: boolean): void {
        if (this.cellCount === 0 || !this.program || !this.uniforms) return;
        const { gl } = this;

        if (maskToLand) {
            gl.enable(gl.STENCIL_TEST);
            gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
            gl.stencilFunc(gl.EQUAL, 1, 0xff);
            gl.stencilMask(0x00);
        } else {
            gl.disable(gl.STENCIL_TEST);
        }

        gl.useProgram(this.program);
        applyProjectionUniforms(gl, this.uniforms, projection);
        gl.uniform2f(this.uniforms.u_valRange, this.minValue, this.maxValue);
        gl.uniform1f(this.uniforms.u_opacity, this.opacity);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.colorMapTexture);
        gl.uniform1i(this.uniforms.u_colormap, 0);
        gl.bindVertexArray(this.vertexArray);
        gl.drawElements(gl.TRIANGLES, this.cellCount * 6, gl.UNSIGNED_INT, 0);
        gl.bindVertexArray(null);
    }

    /** Releases programs, buffers, texture, and vertex-array state. */
    public dispose(): void {
        const { gl } = this;
        if (this.vertexBuffer) gl.deleteBuffer(this.vertexBuffer);
        if (this.indexBuffer) gl.deleteBuffer(this.indexBuffer);
        if (this.vertexArray) gl.deleteVertexArray(this.vertexArray);
        if (this.colorMapTexture) gl.deleteTexture(this.colorMapTexture);
        if (this.program) gl.deleteProgram(this.program);
        this.cellCount = 0;
    }
}
