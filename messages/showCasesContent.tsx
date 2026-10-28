import { Locale } from "next-intl";
import { ArrowLeftRight, CloudSunRain, ChartArea, ChartSpline } from "lucide-react"
import { CubesIcon, InfoIcon, GreekTemple, AntibodyIcon, LocationIcon } from "./reactIcons";
import { ReportColumns } from "iconoir-react";

/**
 * Localized preview card for one public-health visualization showcase.
 *
 * @example
 * ```tsx
 * const ensoPreview: ShowcaseItem = {
 *   title: "ENSO Suitability",
 *   description: "Inspect mosquito habitat forecasts six months ahead",
 *   backgroundImage: "/showCases/enso_suitability.png",
 *   icon: <ChartSpline />,
 *   link: "/home/showCases/ENSO_Suitability",
 * };
 * ```
 */
interface ShowcaseItem {
  /** Localized card title. */
  title: string
  /** Localized summary shown under the title. */
  description: string
  /** Public asset path for the card image. */
  backgroundImage: string
  /** React icon node rendered on the card. */
  icon: React.ReactNode
  /** Application route opened by the card. */
  link: string
}

/**
 * Localized showcase-card registry consumed by the home page.
 *
 * @remarks Each locale supplies the same destinations in the same order so
 * switching languages preserves the meaning of the selected showcase.
 *
 * @example
 * ```ts
 * import { showCasesList } from "@messages/showCasesContent";
 * const germanEnsoCard = showCasesList.de.find((item) => item.link.endsWith("ENSO_Suitability"));
 * ```
 */
export const showCasesList: Record<Locale, ShowcaseItem[]> = {
  en: [
    {
      title: "ENSO Suitability",
      description: "Inspect mosquito habitat suitability predictions up to 6 months into the future",
      backgroundImage: "/showCases/enso_suitability.png",
      icon: <ChartSpline />,
      link: "/home/showCases/ENSO_Suitability",
    },
    {
      title: "Uncertainty Quantification",
      description: "Explore the uncertainty quantification for a specific prediction model",
      backgroundImage: "/showCases/uncertainty_quantification.png",
      icon: <ChartArea />,
      link: "/home/showCases/Uncertainty_Vis",
    },
    {
      title: "Suitable Mosquito Habitats",
      description: "Investigate mosquito habitat suitability predictions for different years and species",
      backgroundImage: "/showCases/suitable_mosquito_habitats.png",
      icon: <InfoIcon />,
      link: "/PredictionView",
    },
    {
      title: "Training Data View",
      description: "Explore climate, land-use, and population data used to train the mosquito habitat suitability model",
      backgroundImage: "/showCases/training_data_view.png",
      icon: <CubesIcon />,
      link: "/TrainingDataView",
    },
    {
      title: "USA Habitats/Sightings",
      description: "Analyze how presence data aligns with habitat suitability predictions for the USA",
      backgroundImage: "/showCases/usa_habitats_sightings.png",
      icon: <LocationIcon />,
      link: "/home/showCases/USA_Habitats_Sightings",
    },
    {
      title: "Compare Country Habitats",
      description: "Compare side-by-side habitat suitability & sightings between two countries",
      backgroundImage: "/showCases/habitats_colombia_vs_germany.png",
      icon: <ArrowLeftRight className="w-6 h-6" />,
      link: "/home/showCases/Habitats_Colombia_vs_Germany",
    },
    {
      title: "Climate and Habitats",
      description: "Inspect habitat suitability in context of climate factors",
      backgroundImage: "/showCases/climate_and_habitats.png",
      icon: <CloudSunRain className="w-6 h-6" />,
      link: "/home/showCases/Climate_and_Habitats",
    },
    {
      title: "Dengue Serotype Counts",
      description: "Explore Dengue serotype counts of Central America for different years and types",
      backgroundImage: "/showCases/dengue_serotype_counts.png",
      icon: <AntibodyIcon />,
      link: "/home/showCases/Dengue_Serotype_Counts",
    },
    {
      title: "Historical COVID-Data Germany Dashboard",
      description: "Discover historical data of the COVID-19 pandemic in Germany",
      backgroundImage: "/showCases/historical_data_covid.png",
      icon: <ReportColumns />,
      link: "/covidDashboard",
    },
    {
      title: "Historical COVID-Data Worldwide",
      description: "Investigate the historical trends during the COVID-19 pandemic worldwide",
      backgroundImage: "/showCases/historical_data_covid_worldwide.png",
      icon: <GreekTemple />,
      link: "/worldViewCovid",
    }
  ],
  de: [
    {
      title: "ENSO-Eignung",
      description: "Untersuchen Sie Vorhersagen zur Mückenlebensraumeignung bis zu 6 Monate in die Zukunft",
      backgroundImage: "/showCases/enso_suitability.png",
      icon: <ChartSpline />,
      link: "/home/showCases/ENSO_Suitability",
    },
    {
      title: "Unsicherheitsquantifizierung",
      description: "Untersuchen Sie die Unsicherheitsquantifizierung für ein spezifisches Vorhersagemodell",
      backgroundImage: "/showCases/uncertainty_quantification.png",
      icon: <ChartArea />,
      link: "/home/showCases/Uncertainty_Vis",
    },
    {
      title: "Geeignete Mückenlebensräume",
      description: "Untersuchen Sie Vorhersagen zur Eignung von Mückenlebensräumen für verschiedene Jahre und Arten",
      backgroundImage: "/showCases/suitable_mosquito_habitats.png",
      icon: <InfoIcon />,
      link: "/PredictionView",
    },
    {
      title: "Trainingsdaten-Ansicht",
      description: "Erkunden Sie Klima-, Landnutzungs- und Bevölkerungsdaten, mit denen Modelle zur Eignung von Mückenlebensräumen trainiert werden",
      backgroundImage: "/showCases/training_data_view.png",
      icon: <CubesIcon />,
      link: "/TrainingDataView",
    },
    {
      title: "USA Lebensräume/Sichtungen",
      description: "Analysieren Sie, wie Präsenzdaten mit Vorhersagen zur Lebensraumeignung in den USA übereinstimmen",
      backgroundImage: "/showCases/usa_habitats_sightings.png",
      icon: <LocationIcon />,
      link: "/home/showCases/USA_Habitats_Sightings",
    },
    {
      title: "Vergleich von Lebensräumen",
      description: "Vergleichen Sie Lebensraumeignung und Sichtungen zwischen zwei verschiedenen Ländern",
      backgroundImage: "/showCases/habitats_colombia_vs_germany.png",
      icon: <ArrowLeftRight className="w-6 h-6" />,
      link: "/home/showCases/Habitats_Colombia_vs_Germany",
    },
    {
      title: "Klima und Lebensräume",
      description: "Untersuchen Sie die Lebensraumeignung im Kontext von Klimafaktoren",
      backgroundImage: "/showCases/climate_and_habitats.png",
      icon: <CloudSunRain className="w-6 h-6" />,
      link: "/home/showCases/Climate_and_Habitats",
    },
    {
      title: "Dengue-Serotypen-Anzahlen",
      description: "Erforschen Sie Dengue-Serotypen-Anzahlen in Mittelamerika für verschiedene Jahre und Typen",
      backgroundImage: "/showCases/dengue_serotype_counts.png",
      icon: <AntibodyIcon />,
      link: "/home/showCases/Dengue_Serotype_Counts",
    },
    {
      title: "Historische COVID-Daten Deutschland Dasboard",
      description: "Betrachten Sie die historischen Daten der COVID-19-Pandemie in Deutschland",
      backgroundImage: "/showCases/historical_data_covid.png",
      icon: <ReportColumns />,
      link: "/covidDashboard",
    },
    {
      title: "Historische COVID-Daten Weltweit",
      description: "Untersuchen Sie die historischen Entwicklungen während der COVID-19-Pandemie Weltweit",
      backgroundImage: "/showCases/historical_data_covid_worldwide.png",
      icon: <GreekTemple />,
      link: "/worldViewCovid",
    },
  ]
};
