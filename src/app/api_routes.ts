// ─── Helper: build a URL string from a base path + typed params object ────────

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

class apiRoutes {

    // API base
    public static readonly API_BASE = 'api';
    public static readonly API_URL = `/${apiRoutes.API_BASE}`;

    // ── Simple endpoints (no query parameters) ───────────────────────────

    public static readonly FETCH_COMPRESSED_JSON: string = `${apiRoutes.API_URL}/get_compressed_json`;
    public static readonly FETCH_GERMANY_MAP: string = `${apiRoutes.API_URL}/get_germany_map`;
    public static readonly FETCH_WORLD_MAP: string = `${apiRoutes.API_URL}/get_world_map`;
    public static readonly FETCH_USA_MAP: string = `${apiRoutes.API_URL}/get_usa_map`;
    public static readonly FETCH_CAPITALS: string = `${apiRoutes.API_URL}/get_capitals`;

    public static readonly GET_UPLOAD_ERROR: string = `${apiRoutes.API_URL}/getUploadError`;
    public static readonly GET_UPLOAD_PROGRESS: string = `${apiRoutes.API_URL}/getUploadProgress`;
    public static readonly CREATE_TABLE_FROM_FILE: string = `${apiRoutes.API_URL}/setFilesToDB`;
    public static readonly SET_ENTRY_TO_TABLE: string = `${apiRoutes.API_URL}/setEntryToTable`;

    // load via database
    public static readonly GET_LIST_OF_DATASETS: string = `${apiRoutes.API_URL}/getListOfRelationsDB`;

    // Column metadata (per-relation, per-language)
    public static readonly COLUMN_METADATA: string = `${apiRoutes.API_URL}/columnMetadata`;

    // Manage DB relations (list & delete)
    public static readonly MANAGE_DB: string = `${apiRoutes.API_URL}/manageDB`;

    // ── Parameterised endpoints (typed function signatures) ───────────────

    /** Set upload progress value. */
    static setUploadProgress(params: {
        progressVal: number;
    }): string {
        return buildUrl(`${apiRoutes.API_URL}/setUploadProgress`, params);
    }

    /** Fetch column names of a DB relation. */
    static fetchDbColumnNames(params: {
        relationName: string;
    }): string {
        return buildUrl(`${apiRoutes.API_URL}/getColumnNamesDB`, params);
    }

    /**
     * Fetch data from a DB relation.
     *
     * @example
     *   apiRoutes.fetchDbData({
     *     relationName: "my_table",
     *     feature: "mean",
     *     filterBy: "iso_a3",
     *     filterValue: "DEU",
     *   })
     */
    static fetchDbData(params: {
        relationName: string;
        feature: string;
        filterBy?: string;
        filterValue?: string;
        task?: string;
        startDate?: string;
        endDate?: string;
        aggregation_level?: number;
    }): string {
        return buildUrl(`${apiRoutes.API_URL}/getDataFromDB`, params);
    }

    /** Fetch dataset metadata for a given language (en | de). */
    static getDatasetsMetadata(params: {
        LANGID: string; // en | de  
        relationName?: string;
    }): string {
        return buildUrl(`${apiRoutes.API_URL}/get_datasets_metaData`, params);
    }

    /** Load an image file by path. */
    static getImage(params: {
        imagePath: string;
    }): string {
        return buildUrl(`${apiRoutes.API_URL}/get_image`, params);
    }

    /** Load an uncertainty SVG visualisation. */
    static getUncertaintySvg(params: {
        filename: string;
        cellID: number;
    }): string {
        return buildUrl(`${apiRoutes.API_URL}/get_uncertainty_svg`, params);
    }

    /** Manage a specific DB relation (e.g. DELETE). */
    static manageDbRelation(params: {
        relationName: string;
    }): string {
        return buildUrl(`${apiRoutes.API_URL}/manageDB`, params);
    }

    /** Fetch column metadata for a relation in a specific language. */
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

export { apiRoutes };