// ─── Helper: build a URL string from a base path + typed params object ────────

/**
 * Builds an encoded application API URL from a path and optional query parameters.
 *
 * @param basePath - Relative API path, normally rooted below `/api`.
 * @param params - Query parameters; `undefined` and `null` values are omitted.
 * @returns The unchanged base path when no parameters remain, otherwise the path plus an encoded query string.
 *
 * @remarks
 * Centralising query-string construction prevents dataset, feature, date, and geographic filter values from being
 * interpolated without URL encoding. Application code should use {@link apiRoutes} instead of calling this helper.
 */
function buildUrl(basePath: string, params?: Record<string, string | number | undefined>): string {
    if (!params) return basePath;

    // remove params with undefined and null values
    const entries = Object.entries(params).filter(
        ([, v]) => v !== undefined && v !== null
    );

    // if no params, return base path
    if (entries.length === 0) return basePath;

    // build query string and convert "<" to "&lt;" and ">" to "&gt;" and so on
    const qs = entries
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&");

    return `${basePath}?${qs}`;
}

// ─── Route Definitions ───────────────────────────────────────────────────────
/**
 * Supported Leaflet basemap asset identifiers accepted by `/api/getMapData`.
 *
 * @example
 * ```ts
 * import { apiRoutes, type MapName } from "@/framework";
 *
 * const publicHealthBasemap: MapName = "germany_map_districts";
 * const url = apiRoutes.fetchMapData({ mapName: publicHealthBasemap });
 * ```
 */
export type MapName = "germany_map_states" | "germany_map_districts" | "world_map" | "usa_map" | "capitals";

/**
 * Supported analytical aggregate operations accepted by `/api/getDataFromDB`.
 *
 * @remarks
 * - `getUniqueEntries`: Returns distinct feature values as `Array<{ feature: string | number }>`.
 *   When querying a `date` column, calendar years are returned instead.
 * - `getMinMax`: Computes the minimum and maximum numeric values as `{ min_val: number, max_val: number }`.
 * - `getCount`: Counts occurrences per feature value as `Array<{ feature: string | number, count: number }>`.
 * - `getGroupedCount`: Groups feature values by a secondary category column as
 *   `Array<{ feature: string | number, category: string, count: number }>`. Requires `groupBy`.
 *
 * @example
 * ```ts
 * import { apiRoutes, type DataQueryTask } from "@/framework";
 *
 * const uniqueSpeciesTask: DataQueryTask = "getUniqueEntries";
 * const url = apiRoutes.fetchDbData({
 *   relationName: "world_mosquitos_2014_2025_gdf_mosquito_amount",
 *   feature: "species",
 *   task: uniqueSpeciesTask,
 * });
 * ```
 */
export type DataQueryTask = "getUniqueEntries" | "getMinMax" | "getCount" | "getGroupedCount";

/**
 * Canonical frontend registry for Flask API endpoint URLs.
 *
 * @remarks
 * Route builders keep the Next.js-to-Flask proxy boundary decoupled from visualization components and encode every
 * supplied query value. Add new supported backend routes here so maps, charts, tables, and editors do not duplicate
 * endpoint strings. All returned paths remain relative and therefore pass through the Next.js `/api/*` rewrite.
 *
 * @example
 * ```ts
 * import { apiRoutes } from "@/framework";
 *
 * // Replace the relation name with one available in your deployment.
 * const habitatUrl = apiRoutes.fetchDbData({
 *   relationName: "t_2024_monthly_mean_7_ocsvm_albopictus_predictions_2023_mod_sim",
 *   feature: "mean",
 *   filterBy: "country",
 *   filterValue: "Germany",
 * });
 * ```
 */
class apiRoutes {

    // API base
    /** API namespace used by the Next.js proxy. @defaultValue "api" */
    public static readonly API_BASE = 'api';
    /** Root path shared by all proxied Flask endpoints. @defaultValue "/api" */
    public static readonly API_URL = `/${apiRoutes.API_BASE}`;

    // ── Simple endpoints (no query parameters) ───────────────────────────

    /** Endpoint that creates a database relation from an uploaded file. */
    public static readonly CREATE_TABLE_FROM_FILE: string = `${apiRoutes.API_URL}/setFilesToDB`;
    /** Endpoint that updates an individual database value. */
    public static readonly SET_ENTRY_TO_TABLE: string = `${apiRoutes.API_URL}/setEntryToTable`;

    // load via database
    /** Endpoint returning the relations available as visualization datasets. */
    public static readonly GET_LIST_OF_DATASETS: string = `${apiRoutes.API_URL}/getListOfRelationsDB`;

    // Column metadata (per-relation, per-language)
    /** Base endpoint for localized per-column metadata. */
    public static readonly COLUMN_METADATA: string = `${apiRoutes.API_URL}/columnMetadata`;

    // Manage DB relations (list & delete)
    /** Base endpoint for database-relation administration. */
    public static readonly MANAGE_DB: string = `${apiRoutes.API_URL}/manageDB`;

    // assign countries to dataset
    /** Processing endpoint that assigns spatial records to country polygons. */
    public static readonly ASSIGN_COUNTRIES_TO_DATASET: string = `${apiRoutes.API_URL}/processData/assignCountries`;

    /** POST endpoint that creates or refreshes RKI state aggregates. */
    public static readonly AGGREGATE_RKI: string = `${apiRoutes.API_URL}/processData/aggregateRKI`;

    // ── Parameterised endpoints (typed function signatures) ───────────────

    /**
     * Builds the polling URL for one asynchronous dataset upload.
     *
     * @param params - Upload identifier returned when ingestion starts.
     * @returns Encoded upload-status endpoint URL.
     */
    static uploadStatus(params: {
        id: string;
    }): string {
        return buildUrl(`${apiRoutes.API_URL}/uploadStatus`, params);
    }

    /**
     * Builds the URL for retrieving the columns of a database relation.
     *
     * @param params - Database relation identifier.
     * @returns Encoded column-name endpoint URL.
     */
    static fetchDbColumnNames(params: {
        relationName: string;
    }): string {
        return buildUrl(`${apiRoutes.API_URL}/getColumnNamesDB`, params);
    }

    /**
     * Fetch data from a DB relation.
     *
     * @param params - Relation, feature, task, spatial filter, and temporal filter contract.
     * @returns Encoded database-query endpoint URL.
     *
     * @remarks
     * This builder targets `/api/getDataFromDB` through the Next.js-to-Flask rewrite.
     * `relationName` is required; `feature` and the remaining filters are emitted only
     * when supplied. Generic multi-column charts pass `features` as a comma-separated
     * query value. The response shape depends on `task` and `responseFormat`; this
     * method only constructs the URL and does not validate the query or fetch data.
     * JSON consumers can pass the returned URL to `useGetJSONData`.
     *
     * @example
     * ```ts
     * import { apiRoutes } from "@/framework";
     *
     * // Replace the relation name with one available in your deployment.
     * const url = apiRoutes.fetchDbData({
     *   relationName: "world_mosquitos_2014_2025_gdf_mosquito_amount",
     *   feature: "mosquito_amount",
     *   filterBy: "species",
     *   filterValue: "albopictus",
     *   startDate: "2024-01-01",
     *   endDate: "2024-12-31",
     * });
     * ```
     */
    static fetchDbData(params: {
        relationName: string;
        feature?: string; // ALL
        /** Columns returned together for generic chart views. */
        features?: string[];
        /** Maximum rows returned by a multi-column chart request; -1 opts into unbounded debug mode. */
        limit?: number;
        filterBy?: string;
        filterValue?: string;
        /** Optional aggregate or set operation performed on a single feature. */
        task?: DataQueryTask;
        /** Optional response representation optimized for a specific consumer. */
        responseFormat?: "map-grid-v1";
        /** Secondary grouping column used by grouped aggregate tasks. */
        groupBy?: string;
        startDate?: string;
        endDate?: string;
        targetDate?: string;
        aggregation_level?: number;
    }): string {
        const { features, ...queryParams } = params;
        return buildUrl(`${apiRoutes.API_URL}/getDataFromDB`, {
            ...queryParams,
            features: features?.join(","),
        });
    }

    /**
     * Builds the URL for a supported Leaflet map asset.
     *
     * @param params - Supported map identifier.
     * @returns Encoded map-data endpoint URL.
     */
    static fetchMapData(params: {
        mapName: MapName;
    }): string {
        return buildUrl(`${apiRoutes.API_URL}/getMapData`, params);
    }

    /** Prebuilt URLs for every supported Leaflet basemap asset. */
    public static readonly FETCH_MAP_DATA = {
        GERMANY_MAP_STATES: apiRoutes.fetchMapData({ mapName: "germany_map_states" }),
        GERMANY_MAP_DISTRICTS: apiRoutes.fetchMapData({ mapName: "germany_map_districts" }),
        WORLD_MAP: apiRoutes.fetchMapData({ mapName: "world_map" }),
        USA_MAP: apiRoutes.fetchMapData({ mapName: "usa_map" }),
        CAPITALS: apiRoutes.fetchMapData({ mapName: "capitals" }),
    } as const;

    /**
     * Builds the URL for localized dataset metadata.
     *
     * @param params - UI language and optional database relation.
     * @returns Encoded metadata endpoint URL.
     */
    static getDatasetsMetadata(params: {
        LANGID: string; // en | de  
        relationName?: string;
    }): string {
        return buildUrl(`${apiRoutes.API_URL}/get_datasets_metaData`, params);
    }

    /**
     * Builds the URL for an image managed by the backend.
     *
     * @param params - Backend-relative image path.
     * @returns Encoded image endpoint URL.
     */
    static getImage(params: {
        imagePath: string;
    }): string {
        return buildUrl(`${apiRoutes.API_URL}/get_image`, params);
    }

    /**
     * Builds the URL for a cell-level UQ SVG visualization.
     *
     * @param params - SVG filename and database row ID of the selected spatial cell.
     * @returns Encoded uncertainty-visualization endpoint URL.
     *
     * @remarks
     * Use the database row ID corresponding to the selected grid cell, as stored
     * in `InterfaceContext.dbRowID_of_selectedGridcellID`. The response is an SVG
     * image; render the URL as an image source rather than parsing it as `dbDATA`.
     *
     * @example
     * ```tsx
     * import { apiRoutes } from "@/framework";
     *
     * const svgUrl = apiRoutes.getUncertaintySvg({
     *   filename: "seasonal_uncertainty_cell.svg",
     *   cellID: 200509,
     * });
     * <img src={svgUrl} alt="Seasonal uncertainty for the selected grid cell" />;
     * ```
     */
    static getUncertaintySvg(params: {
        filename: string;
        cellID: number;
        dataset?: string;  // optional: seas5_forecast_* table name
        month?: string;    // optional: highlight this forecast month (e.g. "aug")
        locale?: "en" | "de"; // optional: locale for backend-rendered labels
    }): string {
        return buildUrl(`${apiRoutes.API_URL}/get_uncertainty_svg`, params);
    }

    /**
     * Builds a JSON chart-data URL for ENSO suitability or seasonal uncertainty visualizations.
     *
     * @param params - Chart mode (`"enso"` or `"uncertainty"`), database row `cellID`, and optional dataset/locale overrides.
     * @returns Encoded cell-chart endpoint URL (`/api/get_cell_chart_data`).
     */
    static getCellChartData(params: {
        chart: "enso" | "uncertainty";
        cellID: number;
        dataset?: string;
        locale?: "en" | "de";
    }): string {
        return buildUrl(`${apiRoutes.API_URL}/get_cell_chart_data`, params);
    }
 

    /**
     * Builds the administration URL for a database relation.
     *
     * @param params - Relation to inspect or delete.
     * @returns Encoded database-management endpoint URL.
     */
    static manageDbRelation(params: {
        relationName: string;
    }): string {
        return buildUrl(`${apiRoutes.API_URL}/manageDB`, params);
    }

    /**
     * Builds the URL for relation-scoped, localized column metadata.
     *
     * @param params - Relation identifier and supported metadata language.
     * @returns Encoded column-metadata endpoint URL.
     */
    static columnMetadata(params: {
        relationName: string;
        lang: "en" | "de";
    }): string {
        return buildUrl(`${apiRoutes.API_URL}/columnMetadata`, params);
    }

    // not implemented
    /* public static readonly AUTH = `${apiRoutes.API_URL}/auth`;
     public static readonly LOGIN = `${apiRoutes.AUTH}/login`;
     public static readonly REGISTER = `${apiRoutes.AUTH}/register`;
     public static readonly LOGOUT = `${apiRoutes.AUTH}/logout`;
     public static readonly REFRESH = `${apiRoutes.AUTH}/refresh`;
     public static readonly ME = `${apiRoutes.AUTH}/me`;

     public static readonly USERS = `${apiRoutes.API_URL}/users`;
     public static readonly USER = `${apiRoutes.USERS}/:id`;
     public static readonly USER_PROFILE = `${apiRoutes.USERS}/profile`;
     public static readonly USER_CHANGE_PASSWORD = `${apiRoutes.USERS}/change-password`;
 */
}

/** Public API-route registry used by frontend data consumers. */
export { apiRoutes };
