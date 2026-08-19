import { Locale } from "next-intl";
import { Columns3, LayoutGrid, LayoutTemplate } from "lucide-react";

/**
 * Interface representing a showcase card item for a grid layout template.
 *
 * @remarks
 * Defines title, localized description, visual icon, and navigation route link.
 *
 * @example
 * ```typescript
 * const item: LayoutTemplateItem = {
 *   title: "3 Columns Layout",
 *   description: "3 equal vertical columns (4-4-4 grid division)",
 *   icon: <Columns3 />,
 *   link: "/home/layoutTemplates/3_Columns",
 * };
 * ```
 */
export interface LayoutTemplateItem {
  /** Display title for the template card. */
  title: string;
  /** Short localized description of the grid structure. */
  description: string;
  /** Optional background thumbnail image URL. */
  backgroundImage?: string;
  /** React icon node displayed on the template card. */
  icon: React.ReactNode;
  /** Next.js localized route link target. */
  link: string;
}

/**
 * Dictionary mapping supported locales to their layout template card lists.
 *
 * @remarks
 * Includes definitions for `en` and `de` locales.
 */
export const layoutTemplatesList: Record<Locale, LayoutTemplateItem[]> = {
  en: [
    {
      title: "3 Columns Layout",
      description: "Dashboard layout with 3 equal vertical columns (4-4-4 grid division)",
      icon: <Columns3 className="w-6 h-6 text-indigo-400" />,
      link: "/home/layoutTemplates/3_Columns",
    },
    {
      title: "1-2-1 Columns Layout",
      description: "Header banner card, 2 split middle cards, and footer banner card",
      icon: <LayoutTemplate className="w-6 h-6 text-indigo-400" />,
      link: "/home/layoutTemplates/1_2_1_Columns",
    },
    {
      title: "2-2 Columns Layout",
      description: "Balanced 2x2 grid layout with four 6-column quarter slots",
      icon: <LayoutGrid className="w-6 h-6 text-indigo-400" />,
      link: "/home/layoutTemplates/2_2_Columns",
    },
  ],
  de: [
    {
      title: "3-Spalten-Layout",
      description: "Dashboard-Layout mit 3 gleich breiten vertikalen Spalten (4-4-4 Rasteraufteilung)",
      icon: <Columns3 className="w-6 h-6 text-indigo-400" />,
      link: "/home/layoutTemplates/3_Columns",
    },
    {
      title: "1-2-1-Spalten-Layout",
      description: "Vollbreite Kopfkarte, 2 geteilte Mittelkarten und Vollbreite Fußkarte",
      icon: <LayoutTemplate className="w-6 h-6 text-indigo-400" />,
      link: "/home/layoutTemplates/1_2_1_Columns",
    },
    {
      title: "2-2-Spalten-Layout",
      description: "Ausgewogenes 2x2-Rasterlayout mit vier 6-Spalten-Viertelkarten",
      icon: <LayoutGrid className="w-6 h-6 text-indigo-400" />,
      link: "/home/layoutTemplates/2_2_Columns",
    },
  ],
};
