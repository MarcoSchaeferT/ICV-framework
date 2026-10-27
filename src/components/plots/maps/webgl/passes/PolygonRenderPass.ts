/** Country-fill, land-stencil, and full-screen ocean/background rendering. */
import { parseColor } from '../WebGLColorUtils';
import {
    applyProjectionUniforms,
    createProgram,
    getCommonUniformLocations,
    type CommonUniformLocations,
} from '../WebGLProgramUtils';
import type {
    ColorVector,
    CountryGeometry,
    PolygonStyleOptions,
    ProjectionState,
} from '../WebGLRendererTypes';
import BACKGROUND_FRAGMENT_SHADER from '../shaders/background.frag.glsl';
import BACKGROUND_VERTEX_SHADER from '../shaders/background.vert.glsl';
import POLYGON_FRAGMENT_SHADER from '../shaders/polygon.frag.glsl';
import POLYGON_VERTEX_SHADER from '../shaders/polygon.vert.glsl';

/** Uniform handles owned by the country-fill shader program. */
interface PolygonUniformLocations extends CommonUniformLocations {
    u_baseColor: WebGLUniformLocation | null;
}

/**
 * Draws country fills and the full-screen background/ocean pass.
 *
 * @remarks
 * When ocean masking is active, {@link drawLand} writes `1` into the stencil
 * buffer for every triangulated land fragment. The grid pass subsequently
 * accepts only stencil value `1`, while {@link drawBackground} accepts every
 * value except `1` and paints the ocean. Without stencil masking, the same
 * background shader runs first as a normal full-canvas backdrop.
 */
export class PolygonRenderPass {
    private readonly polygonProgram: WebGLProgram | null;
    private readonly polygonVertexArray: WebGLVertexArrayObject | null;
    private readonly polygonVertexBuffer: WebGLBuffer | null;
    private readonly polygonIndexBuffer: WebGLBuffer | null;
    private readonly polygonUniforms: PolygonUniformLocations | null;
    private readonly backgroundProgram: WebGLProgram | null;
    private readonly backgroundColorUniform: WebGLUniformLocation | null;
    private indexCount = 0;
    private backgroundColor: ColorVector = [0, 0, 0, 0];
    private fillColor: ColorVector = [1, 1, 1, 1];
    private fillOpacity = 1;

    /** Creates shader programs, GPU buffers, and the polygon vertex layout. */
    constructor(private readonly gl: WebGL2RenderingContext) {
        this.polygonProgram = createProgram(
            gl,
            'PolygonRenderPass',
            POLYGON_VERTEX_SHADER,
            POLYGON_FRAGMENT_SHADER,
        );
        this.polygonVertexArray = gl.createVertexArray();
        this.polygonVertexBuffer = gl.createBuffer();
        this.polygonIndexBuffer = gl.createBuffer();

        if (this.polygonProgram) {
            gl.bindVertexArray(this.polygonVertexArray);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.polygonVertexBuffer);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.polygonIndexBuffer);

            const latLngLocation = gl.getAttribLocation(this.polygonProgram, 'a_latlng');
            if (latLngLocation >= 0) {
                gl.enableVertexAttribArray(latLngLocation);
                gl.vertexAttribPointer(
                    latLngLocation,
                    2,
                    gl.FLOAT,
                    false,
                    2 * Float32Array.BYTES_PER_ELEMENT,
                    0,
                );
            }
            gl.bindVertexArray(null);

            this.polygonUniforms = {
                ...getCommonUniformLocations(gl, this.polygonProgram),
                u_baseColor: gl.getUniformLocation(this.polygonProgram, 'u_baseColor'),
            };
        } else {
            this.polygonUniforms = null;
        }

        this.backgroundProgram = createProgram(
            gl,
            'BackgroundRenderPass',
            BACKGROUND_VERTEX_SHADER,
            BACKGROUND_FRAGMENT_SHADER,
        );
        this.backgroundColorUniform = this.backgroundProgram
            ? gl.getUniformLocation(this.backgroundProgram, 'u_color')
            : null;
    }

    /** Whether the pass has a linked program and at least one fill triangle. */
    public get hasGeometry(): boolean {
        return this.indexCount > 0 && this.polygonProgram !== null;
    }

    /** Uploads static `[lat, lng]` vertices and Earcut triangle indices. */
    public setGeometry(geometry: CountryGeometry): void {
        this.indexCount = geometry.polygonIndices.length;
        const { gl } = this;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.polygonVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, geometry.polygonVertices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.polygonIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.polygonIndices, gl.STATIC_DRAW);
    }

    /** Applies CSS color options after converting them to normalized RGBA. */
    public setStyles(styles: PolygonStyleOptions): void {
        if (styles.backgroundColor !== undefined) {
            this.backgroundColor = parseColor(styles.backgroundColor);
        }
        if (styles.baseFillColor !== undefined) {
            this.fillColor = parseColor(styles.baseFillColor);
        }
        if (styles.baseFillOpacity !== undefined) {
            this.fillOpacity = Math.max(0, Math.min(1, styles.baseFillOpacity));
        }
    }

    /**
     * Draws all triangulated country fills and optionally records land in the
     * stencil buffer. Color output uses premultiplied alpha.
     */
    public drawLand(projection: ProjectionState, writeLandMask: boolean): void {
        if (!this.hasGeometry || !this.polygonProgram || !this.polygonUniforms) return;
        const { gl } = this;

        if (writeLandMask) {
            gl.enable(gl.STENCIL_TEST);
            gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
            gl.stencilFunc(gl.ALWAYS, 1, 0xff);
            gl.stencilMask(0xff);
        } else {
            gl.disable(gl.STENCIL_TEST);
        }

        gl.useProgram(this.polygonProgram);
        applyProjectionUniforms(gl, this.polygonUniforms, projection);
        gl.uniform4f(
            this.polygonUniforms.u_baseColor,
            this.fillColor[0],
            this.fillColor[1],
            this.fillColor[2],
            this.fillColor[3] * this.fillOpacity,
        );
        gl.bindVertexArray(this.polygonVertexArray);
        gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0);
        gl.bindVertexArray(null);
    }

    /**
     * Draws one oversized full-screen triangle. When `maskToOcean` is true,
     * fragments over stencil-marked land are rejected.
     */
    public drawBackground(maskToOcean: boolean): void {
        if (!this.backgroundProgram) return;
        const { gl } = this;

        if (maskToOcean) {
            gl.enable(gl.STENCIL_TEST);
            gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
            gl.stencilFunc(gl.NOTEQUAL, 1, 0xff);
            gl.stencilMask(0x00);
        } else {
            gl.disable(gl.STENCIL_TEST);
        }

        gl.useProgram(this.backgroundProgram);
        gl.uniform4fv(this.backgroundColorUniform, this.backgroundColor);
        gl.bindVertexArray(null);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    /** Releases programs, buffers, and vertex-array state owned by this pass. */
    public dispose(): void {
        const { gl } = this;
        if (this.polygonVertexBuffer) gl.deleteBuffer(this.polygonVertexBuffer);
        if (this.polygonIndexBuffer) gl.deleteBuffer(this.polygonIndexBuffer);
        if (this.polygonVertexArray) gl.deleteVertexArray(this.polygonVertexArray);
        if (this.polygonProgram) gl.deleteProgram(this.polygonProgram);
        if (this.backgroundProgram) gl.deleteProgram(this.backgroundProgram);
        this.indexCount = 0;
    }
}
