
import { Droplets, Wind, Bug, X, ArrowDown, Bookmark, LucideProps} from "lucide-react"
import { Locale } from "next-intl";
import {Group} from './navbarContent'

export interface DiseaseItemT {
  name: string;
  enabled: boolean;
  group?: string;
}

export interface TransmissionDataT {
  [key: string]: {
    transmissionPath: string;
    icon: React.ElementType;
    diseases: DiseaseItemT[];
  };
}

export const transmissionData: Record<Locale, TransmissionDataT> = {
  de: {
    /*
      water: {
        transmissionPath: "Wasser",
        icon: Droplets,
        diseases: [
          ["Cholera", false],
          ["Typhus", false],
          ["Hepatitis A", false],
          ["Amöbenruhr (Entamoeba histolytica)", false],
          ["Giardiasis", false],
          ["Kryptosporidiose", false]
        ]
      },
      */
      air: {
        transmissionPath: "Luft",
        icon: Wind,
        diseases: [
          // { name: "Tuberkulose (Mycobacterium tuberculosis)", enabled: false },
          // { name: "Influenza", enabled: false },
          { name: "COVID-19 (SARS-CoV-2)", enabled: true, group: Group.covid },
          { name: "Platzhalter", enabled: false }
          // { name: "Masern (Rubeola)", enabled: false },
          // { name: "Lungenentzündung (verschiedene Erreger)", enabled: false }
        ]
      },
    vector: {
      transmissionPath: "Vektor",
      icon: Bug,
      diseases: [
        // { name: "Malaria (Plasmodium spp.)", enabled: false },
        // { name: "Dengue-Fieber (Dengue-Virus)", enabled: false },
        { name: "Eignung Lebensraum (Ae. aegypti, Ae. albopictus)", enabled: true, group: Group.dengue },
        { name: "Platzhalter", enabled: false }
        // { name: "Zika-Virus-Infektion", enabled: false },
        // { name: "Gelbfieber (Gelbfieber-Virus)", enabled: false },
        // { name: "Borreliose (Borrelia burgdorferi)", enabled: false },
        // { name: "West-Nil-Virus-Infektion", enabled: false }
      ]
    }
  },
  en: {
    /*
    water: {
      transmissionPath: "Water",
      icon: Droplets,
      diseases: [
        ["Cholera", false],
        ["Typhoid Fever", false],
        ["Hepatitis A", false],
        ["Amebic Dysentery (Entamoeba histolytica)", false],
        ["Giardiasis", false],
        ["Cryptosporidiosis", false]
        ]
      },
      */
      air: {
        transmissionPath: "Air",
        icon: Wind,
        diseases: [
         // { name: "Tuberculosis (Mycobacterium tuberculosis)", enabled: false },
         // { name: "Influenza", enabled: false },
          { name: "COVID-19 (SARS-CoV-2)", enabled: true, group: Group.covid },
          { name: "placeholder", enabled: false }
         // { name: "Measles (Rubeola)", enabled: false },
         // { name: "Pneumonia (various pathogens)", enabled: false }
        ]
      },
      vector: {
        transmissionPath: "Vector",
        icon: Bug,
        diseases: [
          // { name: "Malaria (Plasmodium spp.)", enabled: false },
          // { name: "Dengue Fever (Dengue Virus)", enabled: false },
          { name: "Habitat Suitability (Ae. aegypti, Ae. albopictus)", enabled: true, group: Group.dengue },
          { name: "placeholder", enabled: false }
          // { name: "Zika Virus Infection", enabled: false },
          // { name: "Yellow Fever (Yellow Fever Virus)", enabled: false },
          // { name: "Lyme Disease (Borrelia Burgdorferi)", enabled: false },
          // { name: "West Nile Virus Infection", enabled: false }
        ]
      }
  }
};