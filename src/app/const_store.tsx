import { Link } from "@/i18n/routing";
import { LINK } from '@messages/navbarContent'; // Ensure LINK is exported as a value from this module
import * as d3 from 'd3';

/** Legacy application constants retained for compatibility with existing consumers. */
export const consts: { [key: string]: string } = 
    {
        "API_ADDRES": "http://localhost:3000/api"
    };


/**
 * Pixel and grid-unit measurements shared by the responsive dashboard shell.
 *
 * @example
 * ```ts
 * const compactDashboard: LayoutSizesT = {
 *   rowSpanSize: 8.5,
 *   gapSize: 20,
 *   leftSidebarWidth: 40,
 *   leftNavbarWidth: 0,
 *   topNavbarHeight: 64,
 * };
 * ```
 */
export type LayoutSizesT = {
    /** Height represented by one dashboard grid row. */
    rowSpanSize: number;
    /** Gap between dashboard cards in pixels. */
    gapSize: number;
    /** Width reserved for the disease sidebar in pixels. */
    leftSidebarWidth: number;
    /** Width reserved for the optional icon navigation in pixels. */
    leftNavbarWidth: number;
    /** Height reserved for the top navigation in pixels. */
    topNavbarHeight: number;
};

/**
 * Standard frontend representation of a Flask database response.
 *
 * @remarks
 * The `response` member varies by backend task and is therefore currently untyped. New task-specific consumers should
 * narrow it at their component boundary rather than spreading `any` into visualization logic.
 *
 * @example
 * ```ts
 * const mosquitoResponse: dbDATA = {
 *   relationName: "world_mosquitos_2014_2025_gdf_mosquito_amount",
 *   header: ["id", "species", "mosquito_amount"],
 *   response: [{ id: 42, species: "albopictus", mosquito_amount: 18 }],
 *   error: "",
 * };
 * ```
 */
export interface dbDATA {
      /** Database relation used by the request. */
      relationName: string;
      /** Ordered set of columns included in the response. */
      header: string[];
      /** Task-dependent records or aggregate values returned by Flask. */
      response: any;
      /** Empty string on success or a human-readable backend error. */
      error: string;
}


/** Default dimensions used by the application layout and exposed through `UIContext`. */
export let layoutSizes: LayoutSizesT = {
    rowSpanSize: 8.5,
    gapSize: 20,
    leftNavbarWidth: 68,
    leftSidebarWidth: 40,
    topNavbarHeight: 48+16,
};


/** React element renderers shared by `next-intl` rich-text messages. */
export const t_richConfig = {
    b: (chunks: any) => <b>{chunks}</b>,
    p: (chunks: any) => <p>{chunks}</p>,
    a: (chunks: any) => <a>{chunks}</a>,
    i: (chunks: any) => <i>{chunks}</i>,
    em: (chunks: any) => <em>{chunks}</em>,
    ul: (chunks: any) => <ul>{chunks}</ul>,
    li: (chunks: any) => <li>{chunks}</li>,
    h1: (chunks: any) => <h1>{chunks}</h1>,
    h2: (chunks: any) => <h2>{chunks}</h2>,
    h3: (chunks: any) => <h3>{chunks}</h3>,
  };

/** Maps German state names to the feature order used by the Leaflet state GeoJSON. */
export const dictStates_mapGermany: { [key: string]: number } = 
{
    "Baden-Württemberg": 0,
    "Bayern": 1,
    "Berlin": 2,
    "Brandenburg": 3,
    "Bremen": 4,
    "Hamburg": 5,
    "Hessen": 6,
    "Mecklenburg-Vorpommern": 7,
    "Niedersachsen": 8,
    "Nordrhein-Westfalen": 9,
    "Rheinland-Pfalz": 10,
    "Saarland": 11,
    "Sachsen-Anhalt": 12,
    "Sachsen": 13,
    "Schleswig-Holstein": 14,
    "Thüringen": 15
};

/** Maps German state names to the identifiers used by the RKI state table. */
export const dictStates_TableGermany: { [key: string]: number } = 
{
    "Baden-Württemberg": 8,
    "Bayern": 9,
    "Berlin": 11,
    "Brandenburg": 12,
    "Bremen": 4,
    "Hamburg": 2,
    "Hessen": 6,
    "Mecklenburg-Vorpommern": 13,
    "Niedersachsen": 3,
    "Nordrhein-Westfalen": 5,
    "Rheinland-Pfalz": 7,
    "Saarland": 10,
    "Sachsen-Anhalt": 15,
    "Sachsen": 14,
    "Schleswig-Holstein": 1,
    "Thüringen": 16
};

/** Maps German state names to the three-letter abbreviations used in linked views. */
export const dictStates_AbbrGermany: { [key: string]: string } = 
{
    "Baden-Württemberg": "BWG",
    "Bayern": "BAY",
    "Berlin": "BER",
    "Brandenburg": "BBG",
    "Bremen": "BRE",
    "Hamburg": "HAM",
    "Hessen": "HES",
    "Mecklenburg-Vorpommern": "MVP",
    "Niedersachsen": "NDS",
    "Nordrhein-Westfalen": "NRW",
    "Rheinland-Pfalz": "RLP",
    "Saarland": "SAR",
    "Sachsen-Anhalt": "SAN",
    "Sachsen": "SAC",
    "Schleswig-Holstein": "SHL",
    "Thüringen": "THU"
};

/** Normalizes common English and spelling variants to canonical German state names. */
export const GERMAN_STATE_ALIASES: Record<string, string> = {
    bavaria: "Bayern",
    hesse: "Hessen",
    hessen: "Hessen",
    "lower saxony": "Niedersachsen",
    "north rhine-westphalia": "Nordrhein-Westfalen",
    "rhineland-palatinate": "Rheinland-Pfalz",
    saxony: "Sachsen",
    "saxony-anhalt": "Sachsen-Anhalt",
    thuringia: "Thüringen",
    "baden-wuerttemberg": "Baden-Württemberg",
    "baden-wurtemberg": "Baden-Württemberg",
    "mecklenburg-western pomerania": "Mecklenburg-Vorpommern",
};

/** English display names keyed by ISO 3166-1 alpha-3 country code. */
export const country_names: [string, string][] = [['AFG', 'Afghanistan'], ['AGO', 'Angola'], ['ALB', 'Albania'], ['ARE', 'United Arab Emirates'], ['ARG', 'Argentina'], ['ARM', 'Armenia'], ['AUS', 'Australia'], ['AUT', 'Austria'], ['AZE', 'Azerbaijan'], ['BDI', 'Burundi'], ['BEL', 'Belgium'], ['BEN', 'Benin'], ['BFA', 'Burkina Faso'], ['BGD', 'Bangladesh'], ['BGR', 'Bulgaria'], ['BHS', 'Bahamas'], ['BIH', 'Bosnia and Herzegovina'], ['BLR', 'Belarus'], ['BLZ', 'Belize'], ['BOL', 'Bolivia'], ['BRA', 'Brazil'], ['BRN', 'Brunei'], ['BTN', 'Bhutan'], ['BWA', 'Botswana'], ['CAF', 'Central African Republic'], ['CAN', 'Canada'], ['CHE', 'Switzerland'], ['CHL', 'Chile'], ['CHN', 'China'], ['CIV', 'Ivory Coast'], ['CMR', 'Cameroon'], ['COD', 'Democratic Republic of the Congo'], ['COG', 'Republic of the Congo'], ['COL', 'Colombia'], ['CRI', 'Costa Rica'], ['CUB', 'Cuba'], ['CYP', 'Cyprus'], ['CZE', 'Czech Republic'], ['DEU', 'Germany'], ['DJI', 'Djibouti'], ['DNK', 'Denmark'], ['DOM', 'Dominican Republic'], ['DZA', 'Algeria'], ['ECU', 'Ecuador'], ['EGY', 'Egypt'], ['ERI', 'Eritrea'], ['ESH', 'Western Sahara'], ['ESP', 'Spain'], ['EST', 'Estonia'], ['ETH', 'Ethiopia'], ['FIN', 'Finland'], ['FJI', 'Fiji'], ['FLK', 'Falkland Islands'], ['FRA', 'France'], ['GAB', 'Gabon'], ['GBR', 'United Kingdom'], ['GEO', 'Georgia'], ['GHA', 'Ghana'], ['GIN', 'Guinea'], ['GMB', 'Gambia'], ['GNB', 'Guinea-Bissau'], ['GNQ', 'Equatorial Guinea'], ['GRC', 'Greece'], ['GRL', 'Greenland'], ['GTM', 'Guatemala'], ['GUY', 'Guyana'], ['HND', 'Honduras'], ['HRV', 'Croatia'], ['HTI', 'Haiti'], ['HUN', 'Hungary'], ['IDN', 'Indonesia'], ['IND', 'India'], ['IRL', 'Ireland'], ['IRN', 'Iran'], ['IRQ', 'Iraq'], ['ISL', 'Iceland'], ['ISR', 'Israel'], ['ITA', 'Italy'], ['JAM', 'Jamaica'], ['JOR', 'Jordan'], ['JPN', 'Japan'], ['KAZ', 'Kazakhstan'], ['KEN', 'Kenya'], ['KGZ', 'Kyrgyzstan'], ['KHM', 'Cambodia'], ['KOR', 'South Korea'], ['KWT', 'Kuwait'], ['LAO', 'Laos'], ['LBN', 'Lebanon'], ['LBR', 'Liberia'], ['LBY', 'Libya'], ['LKA', 'Sri Lanka'], ['LSO', 'Lesotho'], ['LTU', 'Lithuania'], ['LUX', 'Luxembourg'], ['LVA', 'Latvia'], ['MAR', 'Morocco'], ['MDA', 'Moldova'], ['MDG', 'Madagascar'], ['MEX', 'Mexico'], ['MKD', 'Macedonia'], ['MLI', 'Mali'], ['MLT', 'Malta'], ['MMR', 'Myanmar'], ['MNE', 'Montenegro'], ['MNG', 'Mongolia'], ['MOZ', 'Mozambique'], ['MRT', 'Mauritania'], ['MWI', 'Malawi'], ['MYS', 'Malaysia'], ['NAM', 'Namibia'], ['NCL', 'New Caledonia'], ['NER', 'Niger'], ['NGA', 'Nigeria'], ['NIC', 'Nicaragua'], ['NLD', 'Netherlands'], ['NOR', 'Norway'], ['NPL', 'Nepal'], ['NZL', 'New Zealand'], ['OMN', 'Oman'], ['PAK', 'Pakistan'], ['PAN', 'Panama'], ['PER', 'Peru'], ['PHL', 'Philippines'], ['PNG', 'Papua New Guinea'], ['POL', 'Poland'], ['PRI', 'Puerto Rico'], ['PRK', 'North Korea'], ['PRT', 'Portugal'], ['PRY', 'Paraguay'], ['PSE', 'Palestine'], ['QAT', 'Qatar'], ['ROU', 'Romania'], ['RUS', 'Russia'], ['RWA', 'Rwanda'], ['SAU', 'Saudi Arabia'], ['SDN', 'Sudan'], ['SEN', 'Senegal'], ['SLB', 'Solomon Islands'], ['SLE', 'Sierra Leone'], ['SLV', 'El Salvador'], ['SOM', 'Somalia'], ['SRB', 'Serbia'], ['SSD', 'South Sudan'], ['SUR', 'Suriname'], ['SVK', 'Slovakia'], ['SVN', 'Slovenia'], ['SWE', 'Sweden'], ['SWZ', 'Swaziland'], ['SYR', 'Syria'], ['TCD', 'Chad'], ['TGO', 'Togo'], ['THA', 'Thailand'], ['TJK', 'Tajikistan'], ['TKM', 'Turkmenistan'], ['TLS', 'East Timor'], ['TTO', 'Trinidad and Tobago'], ['TUN', 'Tunisia'], ['TUR', 'Turkey'], ['TWN', 'Taiwan'], ['TZA', 'Tanzania'], ['UGA', 'Uganda'], ['UKR', 'Ukraine'], ['URY', 'Uruguay'], ['USA', 'United States of America'], ['UZB', 'Uzbekistan'], ['VEN', 'Venezuela'], ['VIR', 'United States Virgin Islands'], ['VNM', 'Vietnam'], ['VUT', 'Vanuatu'], ['YEM', 'Yemen'], ['ZAF', 'South Africa'], ['ZMB', 'Zambia'], ['ZWE', 'Zimbabwe']];

/** German display names keyed by ISO 3166-1 alpha-3 country code. */
export const country_names_de: [string, string][] = [
    ['AFG', 'Afghanistan'],
    ['AGO', 'Angola'],
    ['ALB', 'Albanien'],
    ['ARE', 'Vereinigte Arabische Emirate'],
    ['ARG', 'Argentinien'],
    ['ARM', 'Armenien'],
    ['AUS', 'Australien'],
    ['AUT', 'Österreich'],
    ['AZE', 'Aserbaidschan'],
    ['BDI', 'Burundi'],
    ['BEL', 'Belgien'],
    ['BEN', 'Benin'],
    ['BFA', 'Burkina Faso'],
    ['BGD', 'Bangladesch'],
    ['BGR', 'Bulgarien'],
    ['BHS', 'Bahamas'],
    ['BIH', 'Bosnien und Herzegowina'],
    ['BLR', 'Belarus'],
    ['BLZ', 'Belize'],
    ['BOL', 'Bolivien'],
    ['BRA', 'Brasilien'],
    ['BRN', 'Brunei'],
    ['BTN', 'Bhutan'],
    ['BWA', 'Botswana'],
    ['CAF', 'Zentralafrikanische Republik'],
    ['CAN', 'Kanada'],
    ['CHE', 'Schweiz'],
    ['CHL', 'Chile'],
    ['CHN', 'China'],
    ['CIV', 'Elfenbeinküste'],
    ['CMR', 'Kamerun'],
    ['COD', 'Demokratische Republik Kongo'],
    ['COG', 'Republik Kongo'],
    ['COL', 'Kolumbien'],
    ['CRI', 'Costa Rica'],
    ['CUB', 'Kuba'],
    ['CYP', 'Zypern'],
    ['CZE', 'Tschechien'],
    ['DEU', 'Deutschland'],
    ['DJI', 'Dschibuti'],
    ['DNK', 'Dänemark'],
    ['DOM', 'Dominikanische Republik'],
    ['DZA', 'Algerien'],
    ['ECU', 'Ecuador'],
    ['EGY', 'Ägypten'],
    ['ERI', 'Eritrea'],
    ['ESH', 'Westsahara'],
    ['ESP', 'Spanien'],
    ['EST', 'Estland'],
    ['ETH', 'Äthiopien'],
    ['FIN', 'Finnland'],
    ['FJI', 'Fidschi'],
    ['FLK', 'Falklandinseln'],
    ['FRA', 'Frankreich'],
    ['GAB', 'Gabun'],
    ['GBR', 'Vereinigtes Königreich'],
    ['GEO', 'Georgien'],
    ['GHA', 'Ghana'],
    ['GIN', 'Guinea'],
    ['GMB', 'Gambia'],
    ['GNB', 'Guinea-Bissau'],
    ['GNQ', 'Äquatorialguinea'],
    ['GRC', 'Griechenland'],
    ['GRL', 'Grönland'],
    ['GTM', 'Guatemala'],
    ['GUY', 'Guyana'],
    ['HND', 'Honduras'],
    ['HRV', 'Kroatien'],
    ['HTI', 'Haiti'],
    ['HUN', 'Ungarn'],
    ['IDN', 'Indonesien'],
    ['IND', 'Indien'],
    ['IRL', 'Irland'],
    ['IRN', 'Iran'],
    ['IRQ', 'Irak'],
    ['ISL', 'Island'],
    ['ISR', 'Israel'],
    ['ITA', 'Italien'],
    ['JAM', 'Jamaika'],
    ['JOR', 'Jordanien'],
    ['JPN', 'Japan'],
    ['KAZ', 'Kasachstan'],
    ['KEN', 'Kenia'],
    ['KGZ', 'Kirgisistan'],
    ['KHM', 'Kambodscha'],
    ['KOR', 'Südkorea'],
    ['KWT', 'Kuwait'],
    ['LAO', 'Laos'],
    ['LBN', 'Libanon'],
    ['LBR', 'Liberia'],
    ['LBY', 'Libyen'],
    ['LKA', 'Sri Lanka'],
    ['LSO', 'Lesotho'],
    ['LTU', 'Litauen'],
    ['LUX', 'Luxemburg'],
    ['LVA', 'Lettland'],
    ['MAR', 'Marokko'],
    ['MDA', 'Moldawien'],
    ['MDG', 'Madagaskar'],
    ['MEX', 'Mexiko'],
    ['MKD', 'Nordmazedonien'],
    ['MLI', 'Mali'],
    ['MLT', 'Malta'],
    ['MMR', 'Myanmar'],
    ['MNE', 'Montenegro'],
    ['MNG', 'Mongolei'],
    ['MOZ', 'Mosambik'],
    ['MRT', 'Mauretanien'],
    ['MWI', 'Malawi'],
    ['MYS', 'Malaysia'],
    ['NAM', 'Namibia'],
    ['NCL', 'Neukaledonien'],
    ['NER', 'Niger'],
    ['NGA', 'Nigeria'],
    ['NIC', 'Nicaragua'],
    ['NLD', 'Niederlande'],
    ['NOR', 'Norwegen'],
    ['NPL', 'Nepal'],
    ['NZL', 'Neuseeland'],
    ['OMN', 'Oman'],
    ['PAK', 'Pakistan'],
    ['PAN', 'Panama'],
    ['PER', 'Peru'],
    ['PHL', 'Philippinen'],
    ['PNG', 'Papua‑Neuguinea'],
    ['POL', 'Polen'],
    ['PRI', 'Puerto Rico'],
    ['PRK', 'Nordkorea'],
    ['PRT', 'Portugal'],
    ['PRY', 'Paraguay'],
    ['PSE', 'Palästina'],
    ['QAT', 'Katar'],
    ['ROU', 'Rumänien'],
    ['RUS', 'Russland'],
    ['RWA', 'Ruanda'],
    ['SAU', 'Saudi-Arabien'],
    ['SDN', 'Sudan'],
    ['SEN', 'Senegal'],
    ['SLB', 'Salomonen'],
    ['SLE', 'Sierra Leone'],
    ['SLV', 'El Salvador'],
    ['SOM', 'Somalia'],
    ['SRB', 'Serbien'],
    ['SSD', 'Südsudan'],
    ['SUR', 'Suriname'],
    ['SVK', 'Slowakei'],
    ['SVN', 'Slowenien'],
    ['SWE', 'Schweden'],
    ['SWZ', 'Swasiland'],
    ['SYR', 'Syrien'],
    ['TCD', 'Tschad'],
    ['TGO', 'Togo'],
    ['THA', 'Thailand'],
    ['TJK', 'Tadschikistan'],
    ['TKM', 'Turkmenistan'],
    ['TLS', 'Osttimor'],
    ['TTO', 'Trinidad und Tobago'],
    ['TUN', 'Tunesien'],
    ['TUR', 'Türkei'],
    ['TWN', 'Taiwan'],
    ['TZA', 'Tansania'],
    ['UGA', 'Uganda'],
    ['UKR', 'Ukraine'],
    ['URY', 'Uruguay'],
    ['USA', 'Vereinigte Staaten von Amerika'],
    ['UZB', 'Usbekistan'],
    ['VEN', 'Venezuela'],
    ['VIR', 'Amerikanische Jungferninseln'],
    ['VNM', 'Vietnam'],
    ['VUT', 'Vanuatu'],
    ['YEM', 'Jemen'],
    ['ZAF', 'Südafrika'],
    ['ZMB', 'Sambia'],
    ['ZWE', 'Simbabwe'],
  ];
  
/** English abbreviated month labels ordered from January through December. */
export const monthNames: string[] = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];


/** Representative latitude/longitude anchors used to place categorical lineage examples. */
export const categoryCoordsMap: Record<string, [number, number]> = {
    "African":                            [2.0, 20.0],     // Central Africa
    "African American or Afro-Caribbean": [18.0, -72.0],   // Caribbean
    "Asian":                              [30.0, 105.0],   // East / Southeast Asia
    "European":                           [50.0, 10.0],    // Central Europe
    "Hispanic or Latin American":         [-10.0, -55.0],  // South America
    "Other/Mixed":                        [39.1, -39.0],     // Neutral / Atlantic
};

// Categorical palette optimised for contrast against the Inferno colourmap
// (Inferno: black → dark purple → red-orange → bright yellow)
// → cool blues, teals, greens, and vivid pinks stand out best
/** High-contrast categorical colors selected to remain distinguishable above Inferno raster layers. */
export const categoricalColors2 = [
        // ── best 4 against Inferno ──
        "#4ecdc4", // teal-cyan     (hue 175°, sat 55%, lum 55%) – clearly blue-green, away from lime
        "#a8b8e8", // boosted lilac  (Pastel2[2] → sat 55%, lum 75%) – richer blue-violet
        "#5ac800", // lime-green     – vivid, distinct from Inferno's warm yellows
        "#e040fb", // vivid violet   – stands out from Inferno's muted dark purples
        // ── remaining ──
        "#40c4ff", // sky-blue
        "#448aff", // bright blue
        "#1de9b6", // mint / aquamarine
        "#b2ff59", // yellow-green
        "#7c4dff", // deep lavender
        "#64ffda", // light teal
        "#ff80ab", // soft pink
        "#18ffff", // electric cyan
        "#69f0ae", // spring green
        "#ea80fc", // orchid
        "#2979ff", // cobalt
        "#00e676", // emerald
    ];

    /** Extended D3 categorical palette used for discrete public-health attributes. */
    export const categoricalColors = d3.schemeCategory10.concat(d3.schemeSet3).concat(d3.schemeTableau10).concat(d3.schemePaired).concat(d3.schemePastel1).concat(d3.schemePastel2);

    /** External provenance URLs keyed by the dataset family shown in the UI. */
    export const dataSourceURLs: { [key: string]: string } = {
        "mosquito": "https://zenodo.org/records/19615975",
    };
