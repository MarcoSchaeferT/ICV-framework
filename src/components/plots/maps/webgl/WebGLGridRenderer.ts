/**
 * Coordinates the WebGL2 render passes used by the Leaflet map.
 *
 * Geometry preparation, GPU resources, and GLSL sources live in focused modules;
 * this class owns only lifecycle, interaction state, viewport projection, and draw order.
 *
 * Render pipeline:
 * 1. Country triangles optionally write the land stencil.
 * 2. Grid cells draw through that stencil.
 * 3. A full-screen triangle paints the stencil-rejected ocean.
 * 4. Instanced borders and interaction highlights draw above all fills.
 *
 * All fragment shaders emit premultiplied colors because the context blends
 * with `ONE, ONE_MINUS_SRC_ALPHA`.
 */
import type * as GEOjson from 'geojson';
import type { VisDataT } from '../types';
import {
    buildCountryGeometry,
    findCountryByName,
    hitTestCountries,
} from './WebGLGeometry';
import { BorderRenderPass } from './passes/BorderRenderPass';
import { GridRenderPass } from './passes/GridRenderPass';
import { PolygonRenderPass } from './passes/PolygonRenderPass';
import type {
    CountryRecord,
    PolygonStyleOptions,
    ProjectionState,
    WebGLGridRendererOptions,
} from './WebGLRendererTypes';

export type {
    CountryRecord,
    PolygonStyleOptions,
    WebGLGridRendererOptions,
} from './WebGLRendererTypes';

const INITIAL_PROJECTION: ProjectionState = {
    scaleX: 0,
    scaleY: 0,
    offsetX: 0,
    offsetY: 0,
    isEquirectangular: true,
};

const MAX_MERCATOR_LATITUDE = 85.051128;

function normalizeLongitude(longitude: number): number {
    return ((longitude + 180) % 360 + 360) % 360 - 180;
}

function projectMercatorLatitude(latitude: number): number {
    const clampedLatitude = Math.min(
        MAX_MERCATOR_LATITUDE,
        Math.max(-MAX_MERCATOR_LATITUDE, latitude),
    );
    const latitudeRadians = (clampedLatitude * Math.PI) / 180;
    return Math.log(Math.tan(Math.PI * 0.25 + latitudeRadians * 0.5));
}

/**
 * Stateful WebGL2 renderer embedded in a Leaflet map container.
 *
 * @remarks
 * React owns the canvas element through `useWebGLGridLayer`; this class owns
 * the WebGL resources attached to it. Geographic data is uploaded only when
 * datasets change. Pan and zoom updates modify a small projection uniform set,
 * allowing the same buffers to be redrawn without CPU reprojection.
 */
export class WebGLGridRenderer {
    private readonly canvas: HTMLCanvasElement;
    private readonly debug: boolean;
    private readonly onContextRestored?: () => void;

    private gl: WebGL2RenderingContext | null = null;
    private gridPass: GridRenderPass | null = null;
    private polygonPass: PolygonRenderPass | null = null;
    private borderPass: BorderRenderPass | null = null;

    private countries: CountryRecord[] = [];
    private hoveredCountryId = -1;
    private selectedCountryId = -1;
    private projection: ProjectionState = { ...INITIAL_PROJECTION };
    private devicePixelRatio = 1;
    private useOceanMask = true;
    private hasStencilBuffer = false;
    private isContextLost = false;

    /** Attaches context lifecycle listeners and initializes all render passes. */
    constructor(options: WebGLGridRendererOptions) {
        this.canvas = options.canvas;
        this.debug = Boolean(options.debug);
        this.onContextRestored = options.onContextRestored;
        this.canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
        this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);
        this.initializeGL();
    }

    /**
     * Creates a WebGL2 context and pass-local resources.
     *
     * Depth testing is unnecessary because draw order defines composition.
     * Stencil is requested for land-only grids, while antialiasing and
     * premultiplied alpha keep the canvas compositable over Leaflet.
     */
    private initializeGL(): void {
        const gl = this.canvas.getContext('webgl2', {
            alpha: true,
            antialias: true,
            depth: false,
            stencil: true,
            premultipliedAlpha: true,
            preserveDrawingBuffer: false,
        });

        if (!gl) {
            console.error('[WebGLGridRenderer] WebGL2 is not supported.');
            return;
        }

        this.gl = gl;
        this.hasStencilBuffer = gl.getParameter(gl.STENCIL_BITS) > 0;
        if (!this.hasStencilBuffer && this.debug) {
            console.warn('[WebGLGridRenderer] Stencil buffer unavailable; ocean masking is disabled.');
        }

        this.gridPass = new GridRenderPass(gl);
        this.polygonPass = new PolygonRenderPass(gl);
        this.borderPass = new BorderRenderPass(gl);

        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    /** Prevents the browser's default context-loss handling until restoration. */
    private handleContextLost = (event: Event): void => {
        event.preventDefault();
        this.isContextLost = true;
        if (this.debug) console.warn('[WebGLGridRenderer] WebGL context lost.');
    };

    /** Recreates invalid GPU resources and asks the hook to re-upload state. */
    private handleContextRestored = (): void => {
        this.isContextLost = false;
        if (this.debug) {
            console.info('[WebGLGridRenderer] WebGL context restored. Reinitializing resources.');
        }

        this.dropResourceReferences();
        this.initializeGL();
        if (this.gl) this.onContextRestored?.();
    };

    /** Drops JavaScript references whose underlying objects became invalid. */
    private dropResourceReferences(): void {
        this.gl = null;
        this.gridPass = null;
        this.polygonPass = null;
        this.borderPass = null;
        this.hasStencilBuffer = false;
    }

    /** Updates polygon fill/background styles and border interaction styles. */
    public setStyles(styles: PolygonStyleOptions): void {
        this.polygonPass?.setStyles(styles);
        this.borderPass?.setStyles(styles);
    }

    /**
     * Triangulates and uploads country fills and border instances, while
     * retaining polygon rings for CPU hit testing.
     */
    public setCountriesData(mapData: GEOjson.FeatureCollection | null): void {
        if (!this.gl || this.isContextLost) return;

        const geometry = buildCountryGeometry(mapData);
        this.countries = geometry.countries;
        this.hoveredCountryId = -1;
        this.selectedCountryId = -1;
        this.polygonPass?.setGeometry(geometry);
        this.borderPass?.setGeometry(geometry);

        if (this.debug) {
            const triangleCount = geometry.polygonIndices.length / 3;
            const borderCount = geometry.borderSegments.length / 5;
            console.info(
                '[WebGLGridRenderer] Uploaded ' + geometry.countries.length +
                ' countries (' + triangleCount + ' triangles, ' +
                borderCount + ' border quads)',
            );
        }
    }

    /** Converts grid records into indexed quads and uploads them to the grid pass. */
    public setData(
        gridData: Map<number, VisDataT>,
        cellSize: { lat: number; lng: number },
    ): void {
        if (!this.gl || this.isContextLost) return;
        this.gridPass?.setData(gridData, cellSize);
    }

    /** Rebuilds the one-dimensional colormap texture without changing geometry. */
    public setColorMap(
        colorMap: (value: number) => string,
        minFeature?: number,
        maxFeature?: number,
    ): void {
        if (!this.gl || this.isContextLost) return;
        this.gridPass?.setColorMap(colorMap, minFeature, maxFeature);
    }

    /** Updates the global grid opacity. */
    public setOpacity(opacity: number): void {
        this.gridPass?.setOpacity(opacity);
    }

    /** Enables or disables stencil-based clipping of grid cells to land. */
    public setUseOceanMask(useOceanMask: boolean): void {
        this.useOceanMask = useOceanMask;
    }

    /** Performs CPU point-in-polygon picking for a Leaflet latitude/longitude. */
    public hitTest(lat: number, lng: number): CountryRecord | null {
        return hitTestCountries(this.countries, lat, lng);
    }

    /** Updates the hovered id and redraws only when interaction state changed. */
    public setHoveredCountry(id: number): void {
        if (id === this.hoveredCountryId) return;
        this.hoveredCountryId = id;
        this.render();
    }

    /** Resolves and applies hover state from a code or localized country name. */
    public setHoveredCountryByName(name: string): void {
        const country = findCountryByName(this.countries, name);
        this.setHoveredCountry(country?.id ?? -1);
    }

    /** Updates the selected id and redraws only when interaction state changed. */
    public setSelectedCountry(id: number): void {
        if (id === this.selectedCountryId) return;
        this.selectedCountryId = id;
        this.render();
    }

    /** Resolves and applies selection state from a code or localized name. */
    public setSelectedCountryByName(name: string): void {
        const country = findCountryByName(this.countries, name);
        this.setSelectedCountry(country?.id ?? -1);
    }

    /**
     * Derives the geographic-to-NDC shader transform from the current Leaflet
     * camera and resizes the backing store for device pixel ratio.
     *
     * @remarks
     * Longitude remains linear for both supported CRSs. Latitude is linear in
     * EPSG:4326 and converted to the standard clamped Web Mercator Y function
     * for EPSG:3857. A local reference point ties the floating-point shader
     * transform to Leaflet's current center and avoids drift during movement.
     */
    public updateViewport(
        map: L.Map,
        dimensions: { width: number; height: number },
        isEquirectangular = true,
    ): void {
        const gl = this.gl;
        if (
            !gl ||
            this.isContextLost ||
            dimensions.width <= 0 ||
            dimensions.height <= 0
        ) {
            return;
        }

        this.devicePixelRatio = window.devicePixelRatio || 1;
        const targetWidth = Math.max(1, Math.round(dimensions.width * this.devicePixelRatio));
        const targetHeight = Math.max(1, Math.round(dimensions.height * this.devicePixelRatio));

        if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
            this.canvas.width = targetWidth;
            this.canvas.height = targetHeight;
        }
        gl.viewport(0, 0, targetWidth, targetHeight);

        // Leaflet container points are integer-rounded. Anchor the map locally
        // but derive scale from subpixel project() coordinates to avoid drift.
        const zoom = map.getZoom();
        const reference = map.getCenter();
        const referenceLongitude = normalizeLongitude(reference.lng);
        const containerPoint = map.latLngToContainerPoint(reference);
        const projectedReference = map.project(reference, zoom);
        const projectedLongitudeUnit = map.project(
            [reference.lat, reference.lng + 1],
            zoom,
        );
        const pixelsPerLongitudeDegree = projectedLongitudeUnit.x - projectedReference.x;

        const projection: ProjectionState = {
            ...this.projection,
            isEquirectangular,
            scaleX: (pixelsPerLongitudeDegree / dimensions.width) * 2,
            offsetX: (
                (containerPoint.x - pixelsPerLongitudeDegree * referenceLongitude) /
                dimensions.width
            ) * 2 - 1,
        };

        if (isEquirectangular) {
            const projectedLatitudeUnit = map.project(
                [reference.lat + 1, reference.lng],
                zoom,
            );
            const pixelsPerLatitudeDegree = projectedLatitudeUnit.y - projectedReference.y;
            projection.scaleY = (-pixelsPerLatitudeDegree / dimensions.height) * 2;
            projection.offsetY = 1 - (
                (containerPoint.y - pixelsPerLatitudeDegree * reference.lat) /
                dimensions.height
            ) * 2;
        } else {
            // Match Leaflet's EPSG:3857 pixel projection directly. Deriving the
            // transform from clamped viewport bounds made the Mercator span
            // collapse when the viewport extended beyond either pole.
            const mercatorLatitudeUnit = projectMercatorLatitude(45);
            const projectedEquator = map.project([0, reference.lng], zoom);
            const projectedLatitudeUnit = map.project([45, reference.lng], zoom);
            const pixelsPerMercatorUnit = (
                projectedLatitudeUnit.y - projectedEquator.y
            ) / mercatorLatitudeUnit;
            const referenceMercatorY = projectMercatorLatitude(reference.lat);

            projection.scaleY = (-pixelsPerMercatorUnit / dimensions.height) * 2;
            projection.offsetY = 1 - (
                (containerPoint.y - pixelsPerMercatorUnit * referenceMercatorY) /
                dimensions.height
            ) * 2;
        }

        this.projection = projection;
    }

    /** Executes the ordered polygon, grid, ocean, and border passes. */
    public render(): void {
        const gl = this.gl;
        if (!gl || this.isContextLost) return;

        const hasLandMask = Boolean(
            this.useOceanMask &&
            this.hasStencilBuffer &&
            this.polygonPass?.hasGeometry
        );

        // Clear uses the current stencil write mask, so restore it first.
        gl.stencilMask(0xff);
        gl.clearColor(0, 0, 0, 0);
        gl.clearStencil(0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

        if (!hasLandMask) this.polygonPass?.drawBackground(false);
        this.polygonPass?.drawLand(this.projection, hasLandMask);
        this.gridPass?.draw(this.projection, hasLandMask);

        // Drawing ocean last keeps the transparent land underlay from creating
        // bright fringes around dark grid cells.
        if (hasLandMask) this.polygonPass?.drawBackground(true);

        this.borderPass?.draw(
            this.projection,
            {
                width: this.canvas.width,
                height: this.canvas.height,
                devicePixelRatio: this.devicePixelRatio,
            },
            this.hoveredCountryId,
            this.selectedCountryId,
        );
    }

    /** Removes context listeners and releases all live GPU resources. */
    public dispose(): void {
        this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
        this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);

        if (!this.isContextLost) {
            this.gridPass?.dispose();
            this.polygonPass?.dispose();
            this.borderPass?.dispose();
        }

        this.dropResourceReferences();
        this.countries = [];
        this.hoveredCountryId = -1;
        this.selectedCountryId = -1;
    }
}
