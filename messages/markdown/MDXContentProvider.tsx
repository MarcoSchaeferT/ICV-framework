
/*******************************
 ******** DummyContent *********
 *******************************/
import DummyContent_de from './dummyContent_de.mdx';
import DummyContent_en from './dummyContent_en.mdx';
import DummyFooter_de from './dummyFooter_de.mdx';
import DummyFooter_en from './dummyFooter_en.mdx';

/************************
 **** PredictionView ****
 ************************/
import PredictionView_mainInfo_en from './pages/PredictionView/mainInfo_en.mdx';
import PredictionView_mainInfo_de from './pages/PredictionView/mainInfo_de.mdx';
// overview
import PredictionView_mapInfo_de from './pages/PredictionView/mapInfo_de.mdx';
import PredictionView_mapInfo_en from './pages/PredictionView/mapInfo_en.mdx';
import PredictionView_mapInteraction_de from './pages/PredictionView/mapInteraction_de.mdx';
import PredictionView_mapInteraction_en from './pages/PredictionView/mapInteraction_en.mdx';
// detail view
import PredictionView_detail_mapInfo_de from './pages/PredictionView/mapInfo_detail_de.mdx';
import PredictionView_detail_mapInfo_en from './pages/PredictionView/mapInfo_detail_en.mdx';
import PredictionView_detail_mapInteraction_de from './pages/PredictionView/mapInteraction_detail_de.mdx';
import PredictionView_detail_mapInteraction_en from './pages/PredictionView/mapInteraction_detail_en.mdx';

/************************
 ******** About *********
 ************************/
import  About_projectInfo_de from './pages/About/projectInfo_de.mdx';
import  About_projectInfo_en from './pages/About/projectInfo_en.mdx';

/************************
 ******** Upload ********
 ************************/
import  Upload_requirements_en from './pages/Upload/requirements_en.mdx';
import  Upload_requirements_de from './pages/Upload/requirements_de.mdx';

/***********************
 ***** RawDataView *****
 ***********************/
import RawDataView_mainInfo_en from './pages/RawDataView/mainInfo_en.mdx';
import RawDataView_mainInfo_de from './pages/RawDataView/mainInfo_de.mdx';

/**************************
 ***** CovidWorldView *****
 **************************/
import CovidWorldView_mainInfo_en from './pages/CovidWorldView/mainInfo_en.mdx';
import CovidWorldView_mainInfo_de from './pages/CovidWorldView/mainInfo_de.mdx';


/************************
 ********* Map UI *******
 ************************/
import DengueSerotypeCounts_de from './MapUI/dengueSerotypeCounts_de.mdx';
import DengueSerotypeCounts_en from './MapUI/dengueSerotypeCounts_en.mdx';
import MosquitoPresenceData_de from './MapUI/mosquitoPresenceData_de.mdx';
import MosquitoPresenceData_en from './MapUI/mosquitoPresenceData_en.mdx';
import ColorMap_de from './MapUI/colorMap_de.mdx';
import ColorMap_en from './MapUI/colorMap_en.mdx';
import DataFeature_de from './MapUI/dataFeature_de.mdx';
import DataFeature_en from './MapUI/dataFeature_en.mdx';
import DataSet_de from './MapUI/dataSet_de.mdx';
import DataSet_en from './MapUI/dataSet_en.mdx';

/**************************
 ********* Docs All *******
 **************************/
import FullDocu_en from './pages/FullDocu/fullDocu_en.mdx';
import FullDocu_de from './pages/FullDocu/fullDocu_de.mdx';

/************************************
 ********* ShowCases MainInfo *******
 ************************************/
// HistoricalDataCOVID
import SC_HistoricalDataCOVID_en from './pages/ShowCases/HistoricalDataCOVID/mainInfo_en.mdx';
import SC_HistoricalDataCOVID_de from './pages/ShowCases/HistoricalDataCOVID/mainInfo_de.mdx';
// SuitableMosquitoHabitats
import SC_SuitableMosquitoHabitats_en from './pages/ShowCases/SuitableMosquitoHabitats/mainInfo_en.mdx';
import SC_SuitableMosquitoHabitats_de from './pages/ShowCases/SuitableMosquitoHabitats/mainInfo_de.mdx';
// USAHabitatsSightings
import SC_USAHabitatsSightings_en from './pages/ShowCases/USAHabitatsSightings/mainInfo_en.mdx';
import SC_USAHabitatsSightings_de from './pages/ShowCases/USAHabitatsSightings/mainInfo_de.mdx';
// HabitatsComparison
import SC_HabitatsComparison_en from './pages/ShowCases/HabitatsComparison/mainInfo_en.mdx';
import SC_HabitatsComparison_de from './pages/ShowCases/HabitatsComparison/mainInfo_de.mdx';
// ClimateAndHabitats
import SC_ClimateAndHabitats_en from './pages/ShowCases/ClimateAndHabitats/mainInfo_en.mdx';
import SC_ClimateAndHabitats_de from './pages/ShowCases/ClimateAndHabitats/mainInfo_de.mdx';
// DengueSerotypeCounts
import SC_DengueSerotypeCounts_en from './pages/ShowCases/DengueSerotypeCounts/mainInfo_en.mdx';
import SC_DengueSerotypeCounts_de from './pages/ShowCases/DengueSerotypeCounts/mainInfo_de.mdx';
// Uncertainty_Vis
import SC_Uncertainty_Vis_en from './pages/ShowCases/Uncertainty_Vis/mainInfo_en.mdx';
import SC_Uncertainty_Vis_de from './pages/ShowCases/Uncertainty_Vis/mainInfo_de.mdx';

interface HoverCardsContent {
    Info: React.FC; // general info + how to (+ data set details)
    Interaction: React.FC; // interaction + UI elements
}

interface MDXContentProvider {
    
    DummyContent: React.FC;
    FooterContent: React.FC;
    pages: {
        About: {
            projectInfo: React.FC;
        };
        Upload: {
            requirements: React.FC;
        };
        PredictionView: {
            mainInfo: React.FC;
            overview: HoverCardsContent;
            detailView: HoverCardsContent;
        };
        RawDataView: {
            mainInfo: React.FC;
        };
        CovidWorldView: {
            mainInfo: React.FC;
        };
        ShowCases: {
            HistoricalDataCOVID: React.FC;
            SuitableMosquitoHabitats: React.FC;
            USAHabitatsSightings: React.FC;
            HabitatsComparison: React.FC;
            ClimateAndHabitats: React.FC;
            DengueSerotypeCounts: React.FC;
            Uncertainty_Vis: React.FC;
        }
    }
    MapUI: {
        DengueSerotypeCounts: React.FC;
        MosquitoPresenceData: React.FC;
        ColorMap: React.FC;
        DataFeature: React.FC;
        DataSet: React.FC;
    }
    FullDocu:{
        fullDocu: React.FC;
    }
   
    
}

export const MDXContentProvider: Record<string, MDXContentProvider> = {
    "en": {
       
        DummyContent: DummyContent_en,
        FooterContent: DummyFooter_en,
        pages: {
            About: {
                projectInfo: About_projectInfo_en,
            },
            Upload: {
                requirements: Upload_requirements_en,
            },
            PredictionView: {
                mainInfo: PredictionView_mainInfo_en,
                overview: {
                    Info: PredictionView_mapInfo_en,
                    Interaction: PredictionView_mapInteraction_en
                },
                detailView: {
                    Info: PredictionView_detail_mapInfo_en,
                    Interaction: PredictionView_detail_mapInteraction_en
                }
            },
            RawDataView: {
                mainInfo: RawDataView_mainInfo_en,
            },
            CovidWorldView: {
                mainInfo: CovidWorldView_mainInfo_en,
            },
            ShowCases: {
                HistoricalDataCOVID: SC_HistoricalDataCOVID_en,
                SuitableMosquitoHabitats: SC_SuitableMosquitoHabitats_en,
                USAHabitatsSightings: SC_USAHabitatsSightings_en,
                HabitatsComparison: SC_HabitatsComparison_en,
                ClimateAndHabitats: SC_ClimateAndHabitats_en,
                DengueSerotypeCounts: SC_DengueSerotypeCounts_en,
                Uncertainty_Vis: SC_Uncertainty_Vis_en,
        }
        },
        MapUI: {
            DengueSerotypeCounts: DengueSerotypeCounts_en,
            MosquitoPresenceData: MosquitoPresenceData_en,
            ColorMap: ColorMap_en,
            DataFeature: DataFeature_en,
            DataSet: DataSet_en,
        },
        FullDocu:{
            fullDocu: FullDocu_en,
        },
        
    },
    "de": {
        DummyContent: DummyContent_de,
        FooterContent: DummyFooter_de,
        pages: {
            About: {
                projectInfo: About_projectInfo_de,
            },
            Upload: {
                requirements: Upload_requirements_de,
            },
            PredictionView: {
                mainInfo: PredictionView_mainInfo_de,
                overview: {
                    Info: PredictionView_mapInfo_de,
                    Interaction: PredictionView_mapInteraction_de
            },
            detailView: {
                Info: PredictionView_detail_mapInfo_de,
                Interaction: PredictionView_detail_mapInteraction_de
            },
            },
            RawDataView: {
                mainInfo: RawDataView_mainInfo_de,
            },
            CovidWorldView: {
                mainInfo: CovidWorldView_mainInfo_de,
            },
            ShowCases: {
                HistoricalDataCOVID: SC_HistoricalDataCOVID_de,
                SuitableMosquitoHabitats: SC_SuitableMosquitoHabitats_de,
                USAHabitatsSightings: SC_USAHabitatsSightings_de,
                HabitatsComparison: SC_HabitatsComparison_de,
                ClimateAndHabitats: SC_ClimateAndHabitats_de,
                DengueSerotypeCounts: SC_DengueSerotypeCounts_de,
                Uncertainty_Vis: SC_Uncertainty_Vis_de,
            }
        },
        MapUI: {
            DengueSerotypeCounts: DengueSerotypeCounts_de,
            MosquitoPresenceData: MosquitoPresenceData_de,
            ColorMap: ColorMap_de,
            DataFeature: DataFeature_de,
            DataSet: DataSet_de,
        },
        FullDocu:{
            fullDocu: FullDocu_de,
        },
       
    },
};