
import { Droplets, Wind, Bug, X, ArrowDown, Bookmark, LucideProps} from "lucide-react"
import { Locale } from "next-intl";
import {Group} from './navbarContent'

/**
 * Disease entry shown under a transmission path in the localized sidebar.
 *
 * @example
 * ```ts
 * import { Group } from "@messages/navbarContent";
 * import type { DiseaseItemT } from "@messages/sidebarContent";
 * const dengueHabitatItem: DiseaseItemT = {
 *   name: "Habitat Suitability (Ae. aegypti, Ae. albopictus)",
 *   enabled: true,
 *   group: Group.dengue,
 * };
 * ```
 */
export interface DiseaseItemT {
  /** Localized label displayed in the disease list. */
  name: string;
  /** Whether the destination can be selected. */
  enabled: boolean;
  /** Optional disease-group identifier shared with navigation. */
  group?: string;
}

/**
 * Locale-specific sidebar sections keyed by transmission category.
 *
 * @example
 * ```ts
 * import { Bug } from "lucide-react";
 * import type { TransmissionDataT } from "@messages/sidebarContent";
 * const mosquitoVectors: TransmissionDataT = {
 *   vector: {
 *     transmissionPath: "Vector",
 *     icon: Bug,
 *     diseases: [{ name: "Habitat Suitability", enabled: true, group: "dengue" }],
 *   },
 * };
 * ```
 */
export interface TransmissionDataT {
  /** Section key such as `air` or `vector`. */
  [key: string]: {
    /** Localized transmission-path heading. */
    transmissionPath: string;
    /** React icon component for the sidebar section. */
    icon: React.ElementType;
    /** Disease destinations offered in this section. */
    diseases: DiseaseItemT[];
  };
}

/**
 * German and English transmission-path navigation data.
 *
 * @remarks The sidebar uses disease groups to coordinate its selection with
 * the primary navigation. Disabled entries remain visible as placeholders.
 *
 * @example
 * ```ts
 * import { transmissionData } from "@messages/sidebarContent";
 * const englishVectorDiseases = transmissionData.en.vector.diseases;
 * ```
 */
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
