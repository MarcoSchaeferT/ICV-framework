import {
  Archive,
  MultiplePages,
  PageSearch,
  ColorWheel,
  TestTube,
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
  Globe,
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


export const Group = {
  dengue: "dengue",
  covid: "covid",
  all: "all"
}

export type LINK = {
  icon: React.ElementType | null;
  title: string;
  href: string;
  group?: string;
};

export type LINKS = {
  [key: string]: LINK[];
};

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
            group: Group.all
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
            group: Group.all
        },
         {
            icon: InfoCircle,
            title: "Über",
            href: "/about",
            group: Group.all
        },
    ],
};


const nav_LINKS_left: LINKS = { 
    "en": [
        {
            icon: Archive,
            title: "ICV-Docs",
            href: "https://marcoschaefert.github.io/davisDocu/",
            group: Group.all
        },
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
            href: "http://localhost:5222/apidocs",
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
        }

    ],
    "de": [
        {
            icon: Archive,
            title: "ICV-Docs",
            href: "https://marcoschaefert.github.io/davisDocu/",
            group: Group.all
        },
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
            href: "http://localhost:5222/apidocs",
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
        }

    ],
};


export { nav_LINKS_left, nav_LINKS_top };