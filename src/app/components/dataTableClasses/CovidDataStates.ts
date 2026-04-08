import { apiRoutes } from "../../api_routes";
import stateMappersGermany, { stateMappersGermanyT } from '../../helpers';



class CovidDataStates {
    idbundesland: string;
    datenstand: string;
    meldedatum: string;
    bundesland: string;
    accucases: number;
    newcases: number;
    accucasesperweek: number;
    newcasesperweek: number;
    accudeaths: number;
    newdeaths: number;
    accudeathsperweek: number;
    newdeathsperweek: number;
    accurecovered: number;
    newrecovered: number;
    population: number;

    /*
    private readonly _api_url: string = apiRoutes.FETCH_COMPRESSED_JSON;
    private readonly _data_url: string = "https://github.com/Rubber1Duck/RD_RKI_COVID19_DATA/raw/master/dataStore/cases/states.json.xz";
    private readonly _url: string = this._api_url + "?url=" + this._data_url;
    private readonly _dataName: string = "CovidDataStates";
    */


    private readonly _url: string = apiRoutes.fetchDbData({ relationName: "covid_states_dat", feature: "ALL" });
    private readonly _dataName: string = "CovidDataStates";


    constructor() {
        this.idbundesland = "";
        this.datenstand = "";
        this.meldedatum = "";
        this.bundesland = "";
        this.accucases = 0;
        this.newcases = 0;
        this.accucasesperweek = 0;
        this.newcasesperweek = 0;
        this.accudeaths = 0;
        this.newdeaths = 0;
        this.accudeathsperweek = 0;
        this.newdeathsperweek = 0;
        this.accurecovered = 0;
        this.newrecovered = 0;
        this.population = 0;
    }

    getURL(): string {
        return this._url;
    }

    getTableName(): string {
        return this._dataName;
    }

    getStateID(rowJSON: any): number {
        let row = JSON.parse(JSON.stringify(rowJSON));
        return row.original.idbundesland;
    }

    public static getStateBundesland(rowJSON: any): string {
        let row = JSON.parse(JSON.stringify(rowJSON));
        return row.original.bundesland;
    }

    public static mapperFunctions = stateMappersGermany;


};






export default CovidDataStates;