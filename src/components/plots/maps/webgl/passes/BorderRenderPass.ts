/** Instanced, constant-screen-width country-border rendering. */
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
import BORDER_FRAGMENT_SHADER from '../shaders/border.frag.glsl';
import BORDER_VERTEX_SHADER from '../shaders/border.vert.glsl';

/** Uniform handles owned by the border shader program. */
interface BorderUniformLocations extends CommonUniformLocations {
    u_viewportSize: WebGLUniformLocation | null;
    u_lineWidth: WebGLUniformLocation | null;
    u_hoverLineWidth: WebGLUniformLocation | null;
    u_activeLineWidth: WebGLUniformLocation | null;
    u_strokeColor: WebGLUniformLocation | null;
    u_hoverStrokeColor: WebGLUniformLocation | null;
    u_activeStrokeColor: WebGLUniformLocation | null;
    u_hoveredCountryId: WebGLUniformLocation | null;
    u_selectedCountryId: WebGLUniformLocation | null;
    u_drawOnlyHighlights: WebGLUniformLocation | null;
}

/**
 * Draws instanced screen-space country borders and interaction highlights.
 *
 * @remarks
 * One static four-vertex strip is instanced once per geographic edge. The
 * vertex shader projects each edge endpoint, expands the strip in physical
 * screen pixels, and passes local segment coordinates to the fragment shader.
 * The fragment shader uses those coordinates as a signed-distance-style test
 * for antialiased lines with round caps.
 *
 * Borders are issued in two batches: the base stroke for every segment, then
 * only hovered/selected segments with wider interaction colors. This keeps
 * highlight logic on the GPU and avoids rebuilding geometry on pointer moves.
 */
export class BorderRenderPass {
    private readonly program: WebGLProgram | null;
    private readonly vertexArray: WebGLVertexArrayObject | null;
    private readonly quadBuffer: WebGLBuffer | null;
    private readonly segmentBuffer: WebGLBuffer | null;
    private readonly uniforms: BorderUniformLocations | null;
    private segmentCount = 0;
    private strokeColor: ColorVector = [0, 0, 0, 1];
    private hoverColor: ColorVector = [0.09, 0.96, 0.85, 1];
    private activeColor: ColorVector = [0.92, 1, 0, 1];
    private strokeWidth = 2;
    private hoverWidth = 2.5;
    private activeWidth = 3;

    /** Creates the shader, static unit quad, instanced segment buffer, and VAO. */
    constructor(private readonly gl: WebGL2RenderingContext) {
        this.program = createProgram(
            gl,
            'BorderRenderPass',
            BORDER_VERTEX_SHADER,
            BORDER_FRAGMENT_SHADER,
        );
        this.vertexArray = gl.createVertexArray();
        this.quadBuffer = gl.createBuffer();
        this.segmentBuffer = gl.createBuffer();

        if (!this.program) {
            this.uniforms = null;
            return;
        }

        gl.bindVertexArray(this.vertexArray);
        this.configureQuadAttribute();
        this.configureSegmentAttributes();
        gl.bindVertexArray(null);

        this.uniforms = {
            ...getCommonUniformLocations(gl, this.program),
            u_viewportSize: gl.getUniformLocation(this.program, 'u_viewportSize'),
            u_lineWidth: gl.getUniformLocation(this.program, 'u_lineWidth'),
            u_hoverLineWidth: gl.getUniformLocation(this.program, 'u_hoverLineWidth'),
            u_activeLineWidth: gl.getUniformLocation(this.program, 'u_activeLineWidth'),
            u_strokeColor: gl.getUniformLocation(this.program, 'u_strokeColor'),
            u_hoverStrokeColor: gl.getUniformLocation(this.program, 'u_hoverStrokeColor'),
            u_activeStrokeColor: gl.getUniformLocation(this.program, 'u_activeStrokeColor'),
            u_hoveredCountryId: gl.getUniformLocation(this.program, 'u_hoveredCountryId'),
            u_selectedCountryId: gl.getUniformLocation(this.program, 'u_selectedCountryId'),
            u_drawOnlyHighlights: gl.getUniformLocation(this.program, 'u_drawOnlyHighlights'),
        };
    }

    /** Configures the four per-vertex strip corners shared by every instance. */
    private configureQuadAttribute(): void {
        if (!this.program) return;
        const { gl } = this;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, 0, 1, 0, -1, 1, 1, 1]),
            gl.STATIC_DRAW,
        );

        const location = gl.getAttribLocation(this.program, 'a_quad');
        if (location < 0) return;
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 2 * Float32Array.BYTES_PER_ELEMENT, 0);
        gl.vertexAttribDivisor(location, 0);
    }

    /**
     * Configures `[latA, lngA, latB, lngB, countryId]` instance attributes.
     * A divisor of one advances these attributes once per border segment.
     */
    private configureSegmentAttributes(): void {
        if (!this.program) return;
        const { gl } = this;
        const stride = 5 * Float32Array.BYTES_PER_ELEMENT;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.segmentBuffer);

        const configure = (name: string, size: number, offset: number) => {
            const location = gl.getAttribLocation(this.program!, name);
            if (location < 0) return;
            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
            gl.vertexAttribDivisor(location, 1);
        };

        configure('a_pointA', 2, 0);
        configure('a_pointB', 2, 2 * Float32Array.BYTES_PER_ELEMENT);
        configure('a_countryId', 1, 4 * Float32Array.BYTES_PER_ELEMENT);
    }

    /** Uploads the packed border-segment instance records. */
    public setGeometry(geometry: CountryGeometry): void {
        this.segmentCount = geometry.borderSegments.length / 5;
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.segmentBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, geometry.borderSegments, this.gl.STATIC_DRAW);
    }

    /** Applies base, hover, and active colors and CSS-pixel widths. */
    public setStyles(styles: PolygonStyleOptions): void {
        if (styles.baseStrokeColor !== undefined) this.strokeColor = parseColor(styles.baseStrokeColor);
        if (styles.hoverStrokeColor !== undefined) this.hoverColor = parseColor(styles.hoverStrokeColor);
        if (styles.activeStrokeColor !== undefined) this.activeColor = parseColor(styles.activeStrokeColor);

        if (styles.strokeWidth !== undefined) {
            this.strokeWidth = Math.max(0, styles.strokeWidth);
            this.hoverWidth = Math.max(0, styles.hoverStrokeWidth ?? styles.strokeWidth + 1);
            this.activeWidth = Math.max(0, styles.activeStrokeWidth ?? styles.strokeWidth + 1.5);
        }
        if (styles.hoverStrokeWidth !== undefined) {
            this.hoverWidth = Math.max(0, styles.hoverStrokeWidth);
        }
        if (styles.activeStrokeWidth !== undefined) {
            this.activeWidth = Math.max(0, styles.activeStrokeWidth);
        }
    }

    /**
     * Draws constant-width borders for the current viewport and interaction
     * ids. CSS widths are multiplied by device pixel ratio before upload.
     */
    public draw(
        projection: ProjectionState,
        viewport: { width: number; height: number; devicePixelRatio: number },
        hoveredCountryId: number,
        selectedCountryId: number,
    ): void {
        if (this.segmentCount === 0 || !this.program || !this.uniforms) return;
        const { gl } = this;
        const pixelRatio = viewport.devicePixelRatio || 1;

        gl.disable(gl.STENCIL_TEST);
        gl.useProgram(this.program);
        applyProjectionUniforms(gl, this.uniforms, projection);
        gl.uniform2f(this.uniforms.u_viewportSize, viewport.width, viewport.height);
        gl.uniform1f(this.uniforms.u_lineWidth, this.strokeWidth * pixelRatio);
        gl.uniform1f(this.uniforms.u_hoverLineWidth, this.hoverWidth * pixelRatio);
        gl.uniform1f(this.uniforms.u_activeLineWidth, this.activeWidth * pixelRatio);
        gl.uniform4fv(this.uniforms.u_strokeColor, this.strokeColor);
        gl.uniform4fv(this.uniforms.u_hoverStrokeColor, this.hoverColor);
        gl.uniform4fv(this.uniforms.u_activeStrokeColor, this.activeColor);
        gl.uniform1i(this.uniforms.u_hoveredCountryId, hoveredCountryId);
        gl.uniform1i(this.uniforms.u_selectedCountryId, selectedCountryId);
        gl.bindVertexArray(this.vertexArray);

        if (this.strokeWidth > 0) {
            gl.uniform1i(this.uniforms.u_drawOnlyHighlights, 0);
            gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.segmentCount);
        }
        if (hoveredCountryId > 0 || selectedCountryId > 0) {
            gl.uniform1i(this.uniforms.u_drawOnlyHighlights, 1);
            gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.segmentCount);
        }

        gl.bindVertexArray(null);
    }

    /** Releases programs, buffers, and vertex-array state owned by this pass. */
    public dispose(): void {
        const { gl } = this;
        if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer);
        if (this.segmentBuffer) gl.deleteBuffer(this.segmentBuffer);
        if (this.vertexArray) gl.deleteVertexArray(this.vertexArray);
        if (this.program) gl.deleteProgram(this.program);
        this.segmentCount = 0;
    }
}
