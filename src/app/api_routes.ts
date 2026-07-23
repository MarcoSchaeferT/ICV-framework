import { dataSourceURLs } from './const_store';

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
export type MapName = "germany_map_states" | "germany_map_districts" | "world_map" | "usa_map" | "capitals";

class apiRoutes {

    // API base
    public static readonly API_BASE = 'api';
    public static readonly API_URL = `/${apiRoutes.API_BASE}`;

    // ── Simple endpoints (no query parameters) ───────────────────────────

    public static readonly FETCH_COMPRESSED_JSON: string = `${apiRoutes.API_URL}/get_compressed_json`;
    public static readonly CREATE_TABLE_FROM_FILE: string = `${apiRoutes.API_URL}/setFilesToDB`;
    public static readonly SET_ENTRY_TO_TABLE: string = `${apiRoutes.API_URL}/setEntryToTable`;

    // load via database
    public static readonly GET_LIST_OF_DATASETS: string = `${apiRoutes.API_URL}/getListOfRelationsDB`;

    // Column metadata (per-relation, per-language)
    public static readonly COLUMN_METADATA: string = `${apiRoutes.API_URL}/columnMetadata`;

    // Manage DB relations (list & delete)
    public static readonly MANAGE_DB: string = `${apiRoutes.API_URL}/manageDB`;

    // assign countries to dataset
    public static readonly ASSIGN_COUNTRIES_TO_DATASET: string = `${apiRoutes.API_URL}/processData/assignCountries`;

    // ── Parameterised endpoints (typed function signatures) ───────────────

    /** Poll combined upload status (progress + error) for one upload. */
    static uploadStatus(params: {
        id: string;
    }): string {
        return buildUrl(`${apiRoutes.API_URL}/uploadStatus`, params);
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
     *     feature: "mean" | "ALL",
     *     filterBy: "iso_a3",
     *     filterValue: "DEU",
     *   })
     */
    static fetchDbData(params: {
        relationName: string;
        feature: string; // ALL
        filterBy?: string;
        filterValue?: string;
        task?: string;
        startDate?: string;
        endDate?: string;
        aggregation_level?: number;
    }): string {
        return buildUrl(`${apiRoutes.API_URL}/getDataFromDB`, params);
    }

    static fetchMapData(params: {
        mapName: MapName;
    }): string {
        return buildUrl(`${apiRoutes.API_URL}/getMapData`, params);
    }

    public static readonly FETCH_MAP_DATA = {
        GERMANY_MAP_STATES: apiRoutes.fetchMapData({ mapName: "germany_map_states" }),
        GERMANY_MAP_DISTRICTS: apiRoutes.fetchMapData({ mapName: "germany_map_districts" }),
        WORLD_MAP: apiRoutes.fetchMapData({ mapName: "world_map" }),
        USA_MAP: apiRoutes.fetchMapData({ mapName: "usa_map" }),
        CAPITALS: apiRoutes.fetchMapData({ mapName: "capitals" }),
    } as const;

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