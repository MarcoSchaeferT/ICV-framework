import type { ProjectionState } from './WebGLRendererTypes';

/** Uniforms shared by every pass that projects geographic coordinates. */
export interface CommonUniformLocations {
    u_scale: WebGLUniformLocation | null;
    u_offset: WebGLUniformLocation | null;
    u_isEquirectangular: WebGLUniformLocation | null;
}

/**
 * Compiles and links a WebGL2 vertex/fragment shader pair.
 *
 * @param gl - Active WebGL2 context.
 * @param label - Human-readable pass name included in compiler diagnostics.
 * @param vertexSource - GLSL ES 3.00 vertex shader source.
 * @param fragmentSource - GLSL ES 3.00 fragment shader source.
 * @returns A linked program, or `null` after logging the driver error.
 *
 * @remarks Shader objects are deleted after linking; the linked program keeps
 * the executable shader state required by WebGL.
 */
export function createProgram(
    gl: WebGL2RenderingContext,
    label: string,
    vertexSource: string,
    fragmentSource: string,
): WebGLProgram | null {
    const vertexShader = compileShader(gl, label, gl.VERTEX_SHADER, vertexSource);
    if (!vertexShader) return null;

    const fragmentShader = compileShader(gl, label, gl.FRAGMENT_SHADER, fragmentSource);
    if (!fragmentShader) {
        gl.deleteShader(vertexShader);
        return null;
    }

    const program = gl.createProgram();
    if (!program) {
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        return null;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(`[${label}] Program link error:`, gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }

    return program;
}

/** Compile one shader stage and surface the GPU driver's diagnostic log. */
function compileShader(
    gl: WebGL2RenderingContext,
    label: string,
    type: number,
    source: string,
): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;

    const shaderType = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
    console.error(`[${label}] ${shaderType} shader error:`, gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
}

/** Resolves the uniform locations implementing the shared projection contract. */
export function getCommonUniformLocations(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
): CommonUniformLocations {
    return {
        u_scale: gl.getUniformLocation(program, 'u_scale'),
        u_offset: gl.getUniformLocation(program, 'u_offset'),
        u_isEquirectangular: gl.getUniformLocation(program, 'u_isEquirectangular'),
    };
}

/** Uploads the current Leaflet-derived geographic-to-NDC transform. */
export function applyProjectionUniforms(
    gl: WebGL2RenderingContext,
    uniforms: CommonUniformLocations,
    projection: ProjectionState,
): void {
    gl.uniform2f(uniforms.u_scale, projection.scaleX, projection.scaleY);
    gl.uniform2f(uniforms.u_offset, projection.offsetX, projection.offsetY);
    gl.uniform1i(uniforms.u_isEquirectangular, projection.isEquirectangular ? 1 : 0);
}
