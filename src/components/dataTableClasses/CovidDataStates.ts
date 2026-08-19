import { apiRoutes } from '@/app/api_routes';
import stateMappersGermany, { stateMappersGermanyT } from '@/app/helpers';



/**
 * Dataset adapter for aggregated state-level RKI COVID-19 records.
 *
 * @remarks
 * The adapter exposes state identifiers and mapper functions so table selections can brush the corresponding Leaflet
 * state feature through `InterfaceContext`.
 */
class CovidDataStates {


    /*
    private readonly _api_url: string = apiRoutes.FETCH_COMPRESSED_JSON;
    private readonly _data_url: string = "https://github.com/Rubber1Duck/RD_RKI_COVID19_DATA/raw/master/dataStore/cases/states.json.xz";
    private readonly _url: string = this._api_url + "?url=" + this._data_url;
    private readonly _dataName: string = "CovidDataStates";
    */


    private readonly _url: string = apiRoutes.fetchDbData({ relationName: "aktuell_deutschland_sarscov2_infektionen_aggregated", feature: "ALL" });
    private readonly _dataName: string = "CovidDataStates";



    getURL(targetDate?: string): string {
        return apiRoutes.fetchDbData({
            relationName: "aktuell_deutschland_sarscov2_infektionen_aggregated",
            feature: "ALL",
            targetDate: targetDate
        });
    }

    getTableName(): string {
        return this._dataName;
    }

    getStateID(rowJSON: any): number {
        let row = JSON.parse(JSON.stringify(rowJSON));
        return row.original.idbundesland ?? row.original.IdBundesland;
    }

    public static getStateBundesland(rowJSON: any): string {
        let row = JSON.parse(JSON.stringify(rowJSON));
        return row.original.bundesland ?? row.original.Bundesland;
    }

    public static mapperFunctions = stateMappersGermany;


};






/** Default export for the state-level COVID-19 table adapter. */
export default CovidDataStates;
