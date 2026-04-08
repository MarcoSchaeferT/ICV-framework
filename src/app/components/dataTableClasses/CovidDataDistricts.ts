import { apiRoutes } from "../../api_routes";

class CovidDataDistricts {
    Bundesland: string;
    Datenstand: string;
    IdLandkreis: string;
    Landkreis: string;
    Meldedatum: string;
    accuCases: number;
    accuCasesPerWeek: number;
    accuDeaths: number;
    accuDeathsPerWeek: number;
    accuRecovered: number;
    newCases: number;
    newCasesPerWeek: number;
    newDeaths: number;
    newDeathsPerWeek: number;
    newRecovered: number;
    population: number;

    private _api_url: string = apiRoutes.FETCH_COMPRESSED_JSON;
    private _data_url: string = "https://github.com/Rubber1Duck/RD_RKI_COVID19_DATA/raw/master/dataStore/cases/districts.json.xz";
    private _url: string = this._api_url + "?url=" + this._data_url;
    private _dataName: string = "CovidDataDistricts";

    constructor() {
        this.Bundesland = "";
        this.Datenstand = "";
        this.IdLandkreis = "";
        this.Landkreis = "";
        this.Meldedatum = "";
        this.accuCases = 0;
        this.accuCasesPerWeek = 0;
        this.accuDeaths = 0;
        this.accuDeathsPerWeek = 0;
        this.accuRecovered = 0;
        this.newCases = 0;
        this.newCasesPerWeek = 0;
        this.newDeaths = 0;
        this.newDeathsPerWeek = 0;
        this.newRecovered = 0;
        this.population = 0;
    }

    getURL(): string {
        return this._url;
    }
    getTableName(): string {
        return this._dataName;
    }
};

export default CovidDataDistricts;