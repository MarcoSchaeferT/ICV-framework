import { Locale } from "next-intl";
import { BarChart3, Leaf, ArrowLeftRight, Cloud, ChartSpline } from "lucide-react"
import { MosquitoIcon, VirusIcon } from "../messages/reactIcons"
import { GreekTemple, AntibodyIcon, LocationIcon } from "../messages/reactIcons";

interface ShowcaseItem {
  title: string
  description: string
  backgroundImage: string
  icon: React.ReactNode
  link: string
}

export const showCasesList: Record<Locale, ShowcaseItem[]> = {
  en: [
    {
      title: "Historical COVID-Data Germany",
      description: "Discover the historical trends during the COVID-19 pandemic in Germany",
      backgroundImage: "/showCases/historical_data_covid.png",
      icon: <GreekTemple  />,
      link: "/home/showCases/Historical_Data_COVID",
    },
    {
      title: "Suitable Mosquito Habitats",
      description: "Investigate mosquito habitat suitability predictions for different years and species",
      backgroundImage: "/showCases/suitable_mosquito_habitats.png",
      icon: <Leaf  />,
      link: "/home/showCases/Suitable_Mosquito_Habitats",
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
      description: "Inspect climate data, land usage and further factors in context",
      backgroundImage: "/showCases/climate_and_habitats.png",
      icon: <Cloud className="w-6 h-6" />,
      link: "/home/showCases/Climate_and_Habitats",
    },
    {
      title: "Dengue Serotype Counts",
      description: "Explore Dengue serotype counts of Central America for different years and types",
      backgroundImage: "/showCases/dengue_serotype_counts.png",
      icon: <AntibodyIcon  />,
      link: "/home/showCases/Dengue_Serotype_Counts",
    },
    {
      title: "Uncertainty Quantification",
      description: "Explore the uncertainty quantification for a specific prediction model",
      backgroundImage: "/showCases/uncertainty_quantification.png",
      icon: <ChartSpline  />,
      link: "/home/showCases/Uncertainty_Vis",
    }
  ],
  de: [
    {
      title: "Historische COVID-Daten Deutschland",
      description: "Entdecken Sie die historischen Entwicklungen während der COVID-19-Pandemie in Deutschland",
      backgroundImage: "/showCases/historical_data_covid.png",
      icon: <GreekTemple />,
      link: "/home/showCases/Historical_Data_COVID",
    },
    {
      title: "Geeignete Mückenlebensräume",
      description: "Untersuchen Sie Vorhersagen zur Eignung von Mückenlebensräumen für verschiedene Jahre und Arten",
      backgroundImage: "/showCases/suitable_mosquito_habitats.png",
      icon: <Leaf />,
      link: "/home/showCases/Suitable_Mosquito_Habitats",
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
      description: "Betrachten Sie Klimadaten, Landnutzung und weitere Faktoren im Kontext",
      backgroundImage: "/showCases/climate_and_habitats.png",
      icon: <Cloud className="w-6 h-6" />,
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
      title: "Unsicherheitsquantifizierung",
      description: "Untersuchen Sie die Unsicherheitsquantifizierung für ein spezifisches Vorhersagemodell",
      backgroundImage: "/showCases/uncertainty_quantification.png",
      icon: <ChartSpline  />,
      link: "/home/showCases/Uncertainty_Vis",
    }
  ]
};