import {
  MultiplePages,
  PageSearch,
  ColorWheel,
  TestTube,
  Database,
  TableRows,
  ConstrainedSurface,
  Drone,
  HomeSimpleDoor,
  InfoCircle,
  MediaImage,
  MediaImagePlus,
  Arc3d,
  Gym,
  UploadSquare,
  ReportColumns,
  StatsReport,
  DocStar,
  Iconoir,
  GoogleDocs,
  DesignNibSolid,
  OpenBook,

} from "iconoir-react";

import  {VirusIcon,
    LineDataThresholdingIconn,
    MosquitoIcon,
    CubesIcon,
    InfoIcon,
    GreekTemple,
    DocumentTestIcon,
    DocumentIcon
} from  "./reactIcons"


/**
 * Disease-group identifiers used to filter localized navigation links.
 *
 * @example
 * ```ts
 * import { Group } from "@messages/navbarContent";
 * const habitatNavigationGroup = Group.dengue;
 * ```
 */
export const Group = {
  dengue: "dengue",
  covid: "covid",
  all: "all"
}

/**
 * One localized navigation destination.
 *
 * @remarks The `group` value controls disease-specific visibility; `all`
 * denotes a destination shared across disease groups.
 *
 * @example
 * ```ts
 * import { Group, type LINK } from "@messages/navbarContent";
 * const predictionLink: LINK = {
 *   icon: null,
 *   title: "Prediction View",
 *   href: "/worldView",
 *   group: Group.dengue,
 * };
 * ```
 */
export type LINK = {
  /** React icon component, or `null` for a text-only entry. */
  icon: React.ElementType | null;
  /** Label shown in the selected locale. */
  title: string;
  /** Internal route or absolute external destination. */
  href: string;
  /** Optional disease-group visibility filter. */
  group?: string;
  /** Optional top-navigation menu shown instead of a direct link. */
  menu?: "help";
};

/**
 * Navigation entries grouped by locale identifier.
 *
 * @example
 * ```ts
 * import { nav_LINKS_top, type LINKS } from "@messages/navbarContent";
 * const localizedNavigation: LINKS = nav_LINKS_top;
 * const englishLinks = localizedNavigation.en;
 * ```
 */
export type LINKS = {
  /** Locale key such as `en` or `de`. */
  [key: string]: LINK[];
};

/** Localized primary navigation, including disease-filtered application routes. */
const nav_LINKS_top: LINKS = { 
    "en": [
        /* {
            icon: null,
            title: "Home",
            href: "/home",
        },
        /*{
            icon: TestTube,
            title: "Test",
            href: "/testPage",
        },*/
        {
            icon: ReportColumns,
            title: "Dashboard Germany",
            href: "/covidDashboard",
            group: Group.covid
        },
        {
            icon: GreekTemple,
            title: "Historical World View",
            href: "/worldViewCovid",
            group: Group.covid
        },
        {
            icon: InfoIcon,
            title: "Prediction View",
            href: "/worldView",
            group: Group.dengue
        },
        {
            icon: CubesIcon,
            title: "Training Data View",
            href: "/rawDataView",
            group: Group.dengue
        },
       /* {
            icon: StatsReport,
            title: "Trend Board",
            href: "/trendBoard",
        },*/
        {
            icon: UploadSquare,
            title: "Upload",
            href: "/upload",
            group: Group.all
        },
        {
            icon: DocumentIcon,
            title: "Vector Information",
            href: "/domainInfo",
            group: Group.dengue
        },
        {
            icon: DocumentTestIcon,
            title: "Publications",
            href: "/publications",
            group: Group.all
        },
        {
            icon: GoogleDocs,
            title: "Help",
            href: "/docs",
            group: Group.all,
            menu: "help"
        },
        {
            icon: InfoCircle,
            title: "About",
            href: "/about",
            group: Group.all
        },
        ],
        "de": [
        /* {
            icon: null,
            title: "Start",
            href: "/home",
        },
        /*{
            icon: TestTube,
            title: "Test",
            href: "/testPage",
        },*/
       {
            icon: ReportColumns,
            title: "Dashboard Deutschland",
            href: "/covidDashboard",
            group: Group.covid
        },
        {
            icon: GreekTemple,
            title: "Historische Weltansicht",
            href: "/worldViewCovid",
            group: Group.covid
        },
        {
            icon: InfoIcon,
            title: "Vorhersage Ansicht",
            href: "/worldView",
            group: Group.dengue
        },
        {
            icon: CubesIcon,
            title: "Trainingsdaten Ansicht",
            href: "/rawDataView",
            group: Group.dengue
        },
       /* {
            icon: StatsReport,
            title: "Trend Board",
            href: "/trendBoard",
        },*/
        {
            icon: UploadSquare,
            title: "Upload",
            href: "/upload",
            group: Group.all
        },
        {
            icon: DocumentIcon,
            title: "Vektor Informationen",
            href: "/domainInfo",
            group: Group.dengue
        },
         {
            icon: DocumentTestIcon,
            title: "Publikationen",
            href: "/publications",
            group: Group.all
        },
        {
            icon: GoogleDocs,
            title: "Hilfe",
            href: "/docs",
            group: Group.all,
            menu: "help"
        },
         {
            icon: InfoCircle,
            title: "Über",
            href: "/about",
            group: Group.all
        },
    ],
};


/**
 * Localized developer and utility navigation entries.
 *
 * @remarks This registry contains links to development tools and documentation.
 */
const nav_LINKS_left: LINKS = { 
    "en": [
       /* {
            icon: PageSearch,
            title: "shdcn/ui-Docs",
            href: "https://ui.shadcn.com/docs/components/accordion",
        },*/
        {
            icon: ColorWheel,
            title: "Theme Colors",
            href: "/themeColors",
            group: Group.all
        },
        {
            icon: TestTube,
            title: "Test Page",
            href: "/testPage",
            group: Group.all
        },
        {
            icon: DocStar,
            title: "REST API Docs",
            href: "/apiDocs",
            group: Group.all
        },
        {
            icon: Iconoir,
            title: "iconoir Icons ",
            href: "https://iconoir.com/",
            group: Group.all
        },
        {
            icon: Iconoir,
            title: "lucide Icons",
            href: "https://lucide.dev/icons/",
            group: Group.all
        },
        {
            icon: DesignNibSolid,
            title: "MDX Tester",
            href: "/MDXTester",
            group: Group.all
        },
        {
            icon: OpenBook,
            title: "MDX narrative Tester",
            href: "/MDXpageTemplate",
            group: Group.all
        },
        {
            icon: TestTube,
            title: "Feedback",
            href: "/feedbackView",
            group: Group.all
        },
        {
            icon: StatsReport,
            title: "General Vis View",
            href: "/generalVisView",
            group: Group.all
        },
        {
            icon: Arc3d,
            title: "Assign Countries to Dataset",
            href: "/assignCountriesToDataset",
            group: Group.all
        },
        {
            icon: Database,
            title: "Manage Database Tables",
            href: "/manageDB",
            group: Group.all
        }

    ],
    "de": [
        /*{
            icon: PageSearch,
            title: "shdcn/ui-Docs",
            href: "https://ui.shadcn.com/docs/components/accordion",
        },*/
        {
            icon: ColorWheel,
            title: "Theme Colors",
            href: "/themeColors",
            group: Group.all
        },
        {
            icon: TestTube,
            title: "Test Page",
            href: "/testPage",
            group: Group.all
        },
        {
            icon: DocStar,
            title: "REST API Docs",
            href: "/apiDocs",
            group: Group.all
        },
        {
            icon: Iconoir,
            title: "Icons iconoir",
            href: "https://iconoir.com/",
            group: Group.all
        },
        {
            icon: Iconoir,
            title: "lucide Icons",
            href: "https://lucide.dev/icons/",
            group: Group.all
        },
        {
            icon: DesignNibSolid,
            title: "MDX Tester",
            href: "/MDXTester",
            group: Group.all
        },
        {
            icon: TestTube,
            title: "Feedback",
            href: "/feedbackView",
            group: Group.all
        },
        {
            icon: StatsReport,
            title: "General Vis View",
            href: "/generalVisView",
            group: Group.all
        },
        {
            icon: Arc3d,
            title: "Assign Countries to Dataset",
            href: "/assignCountriesToDataset",
            group: Group.all
        },
        {
            icon: Database,
            title: "Manage Database Tables",
            href: "/manageDB",
            group: Group.all
        }

    ],
};


export { nav_LINKS_left, nav_LINKS_top };
