"use client";

import { useRef, useEffect, useState } from 'react'
import { apiRoutes } from "@/app/api_routes";
import React from 'react';
import { InterfaceContextProvider, useInterfaceContext } from '@/components/contexts/InterfaceContext';
import SGridPlotCard from '@/components/layout/SwapyGridPlotCard';
import { CardPropsClass } from '@/components/layout/CardWrapper';
import LeafD3MapLayerComponent, { LeafD3MapLayerProps } from '@/components/plots/maps/LeafD3Map';
import MiniMapOverlay from '@/components/plots/maps/overlays/MiniMapOverlay';
import { createSwapy, Swapy } from 'swapy';
import { MDXContentProvider } from '@messages/markdown/MDXContentProvider';
import { ViewMainInfoComponent } from '@/components/ViewPageMainInfo';
import { Locale, useLocale, useTranslations } from "next-intl";
import { t_richConfig } from "@/app/const_store";
import { useUIContext } from '@/components/contexts/UIContext';
import { availableColorMapsNames } from '@/components/plots/maps/constants';
import { useLoadingTask, LoadingSpinnerAnimation } from '@/components/plots/maps/utils/loadingSpinner';

const isSWAPY = true;

/**
 * Returns the cell-linked ENSO Suitability visualization showcase.
 *
 * @remarks
 * Displays backend-rendered static climate forecast charts (4 climate factors & mean deltas)
 * alongside side-by-side Forecast (Prediction) and Reference maps.
 */
export default function Home() {
  const t = useTranslations("page_home.ShowCases.page_ENSO_Suitability");
  const locale = useLocale() as Locale;
  let MDX = MDXContentProvider[locale];

  const UI_contextT = useUIContext();
  const layoutSizes = UI_contextT.layoutDims;

  // ── 1. Forecast Map Props (Left Map) ──
  let forecastMapProps = LeafD3MapLayerProps();
  forecastMapProps.chartName = 'map_Forecast';
  forecastMapProps.mapDataURL = apiRoutes.FETCH_MAP_DATA.WORLD_MAP;
  forecastMapProps.center = [14, 15.6];
  forecastMapProps.zoom = 2.2;
  forecastMapProps.isSetIntialContextDataFromComponent = true;
  forecastMapProps.mapUIsettings.isLongitudeSlider = false;
  forecastMapProps.mapUIsettings.isLatitudeSlider = false;
  forecastMapProps.mapUIsettings.isZoomSlider = false;
  forecastMapProps.mapUIsettings.isLatLngZoomOverlay = true;
  forecastMapProps.mapUIsettings.isColorMapSelectionDropdown = true;
  forecastMapProps.mapUIsettings.isFeatureSelectionDropdown = true;
  forecastMapProps.mapUIsettings.isDatasetSelectionDropdown = true;
  forecastMapProps.mapUIsettings.isDistanceLegend = true;
  forecastMapProps.mapUIsettings.isColorMapLegend = true;
  forecastMapProps.mapUIsettings.isCountrySelectionDropdown = false;
  forecastMapProps.mapUIsettings.isDatePicker = false;
  forecastMapProps.mapUIsettings.isAutoHideSettingsToggle = false;
  forecastMapProps.mapUIsettings.isSettingsBlendAnimation = true;
  forecastMapProps.mapUIsettings.defaultDonutSize = 25;
  forecastMapProps.isStaticAutoFitFullSize = false;
  forecastMapProps.isApplyContextData = false;
  forecastMapProps.isApplyTransitions = true;
  forecastMapProps.isProjection_equirectangular = true;
  forecastMapProps.mapUIsettings.filterStringForAvailableDatasetInclude = "_sim";
  forecastMapProps.mapUIsettings.defaultDatasetName = "t_2024_monthly_mean_4_ocsvm_aegypti_predictions_2023_mod_sim";
  forecastMapProps.mapUIsettings.defaultFeatureName = "prob_1";
  forecastMapProps.mapUIsettings.defaultFeatureColorMap = availableColorMapsNames.interpolateInferno;
  forecastMapProps.mapUIsettings.areSettingsOpen = true;
  forecastMapProps.mapDataSets.isCityNames = false;
  forecastMapProps.mapUIsettings.defaultLayerOpacity = 0.8;
  forecastMapProps.mapUIsettings.isPresenceData = false;
  forecastMapProps.isSyncMapCoordsOnTheFly_SETTER = true;
  forecastMapProps.isSyncMapCoordsOnTheFly_RECIEVER = false;
  forecastMapProps.mapStyles.backgroundColor = "rgb(215, 234, 245)";
  forecastMapProps.mapInteractions = { disableMouse: false, disableScroll: false };

  // ── 2. Reference Map Props (Right Map) ──
  let referenceMapProps = LeafD3MapLayerProps();
  referenceMapProps.chartName = 'map_Reference';
  referenceMapProps.mapDataURL = apiRoutes.FETCH_MAP_DATA.WORLD_MAP;
  referenceMapProps.center = [14, 15.6];
  referenceMapProps.zoom = 2.2;
  referenceMapProps.isSetIntialContextDataFromComponent = false;
  referenceMapProps.mapUIsettings.isLongitudeSlider = false;
  referenceMapProps.mapUIsettings.isLatitudeSlider = false;
  referenceMapProps.mapUIsettings.isZoomSlider = false;
  referenceMapProps.mapUIsettings.isLatLngZoomOverlay = true;
  referenceMapProps.mapUIsettings.isColorMapSelectionDropdown = true;
  referenceMapProps.mapUIsettings.isFeatureSelectionDropdown = true;
  referenceMapProps.mapUIsettings.isDatasetSelectionDropdown = true;
  referenceMapProps.mapUIsettings.isDistanceLegend = true;
  referenceMapProps.mapUIsettings.isColorMapLegend = true;
  referenceMapProps.mapUIsettings.isCountrySelectionDropdown = false;
  referenceMapProps.mapUIsettings.isDatePicker = false;
  referenceMapProps.mapUIsettings.isAutoHideSettingsToggle = false;
  referenceMapProps.mapUIsettings.isSettingsBlendAnimation = true;
  referenceMapProps.mapUIsettings.defaultDonutSize = 25;
  referenceMapProps.isStaticAutoFitFullSize = false;
  referenceMapProps.isApplyContextData = true;
  referenceMapProps.isApplyTransitions = true;
  referenceMapProps.isProjection_equirectangular = true;
  referenceMapProps.mapUIsettings.filterStringForAvailableDatasetInclude = "_sim";
  referenceMapProps.mapUIsettings.defaultDatasetName = "t_2024_monthly_mean_4_ocsvm_aegypti_predictions_2023_mod_sim";
  referenceMapProps.mapUIsettings.defaultFeatureName = "prob_1";
  referenceMapProps.mapUIsettings.defaultFeatureColorMap = availableColorMapsNames.interpolateInferno;
  referenceMapProps.mapUIsettings.areSettingsOpen = false;
  referenceMapProps.mapDataSets.isCityNames = false;
  referenceMapProps.mapUIsettings.defaultLayerOpacity = 0.8;
  referenceMapProps.mapUIsettings.isPresenceData = false;
  referenceMapProps.isSyncMapCoordsOnTheFly_SETTER = false;
  referenceMapProps.isSyncMapCoordsOnTheFly_RECIEVER = true;
  referenceMapProps.mapStyles.backgroundColor = "rgb(215, 234, 245)";
  referenceMapProps.mapInteractions = { disableMouse: false, disableScroll: false };

  const getTranslation = (key: string, fallback: string) => {
    try {
      if (t.has(key as any)) {
        return t.rich(key as any, { ...t_richConfig })?.toString() || fallback;
      }
    } catch {
      // Fallback if key is not yet loaded in next-intl dev cache
    }
    return fallback;
  };

  // ── Card Titles & Props ──
  let climateFactorsCardProps = CardPropsClass(
    getTranslation('climateFactorsPlot', 'Climatic Factors & Forecast Sanity Check'),
    getTranslation('climateFactorsPlot', 'Climatic Factors & Forecast Sanity Check'),
    "", ""
  );
  climateFactorsCardProps.infoCard = { content: MDX.DummyContent, footer: undefined };

  let forecastMapCardProps = CardPropsClass(
    getTranslation('forecastMapTitle', 'Habitat Suitability Forecast'),
    getTranslation('forecastMapTitle', 'Habitat Suitability Forecast'),
    "", ""
  );
  forecastMapCardProps.infoCard = { content: MDX.DummyContent, footer: undefined };

  let referenceMapCardProps = CardPropsClass(
    getTranslation('referenceMapTitle', 'Historical Baseline / Reference View'),
    getTranslation('referenceMapTitle', 'Historical Baseline / Reference View'),
    "", ""
  );
  referenceMapCardProps.infoCard = { content: MDX.DummyContent, footer: undefined };

  let mainInfoHeading = getTranslation('mainInfo.heading', 'ENSO Suitability');

  useInterfaceContext();

  // set up swapy (client side only)
  const swapyRef = useRef<Swapy | null>(null);
  const swapContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = swapContainerRef.current;
    if (isSWAPY && container) {
      swapyRef.current = createSwapy(container, {
        animation: 'dynamic',
        manualSwap: false,
        swapMode: 'hover',
        autoScrollOnDrag: true,
      });
      swapyRef.current?.enable(isSWAPY);

      return () => {
        swapyRef.current?.destroy();
      };
    }
  }, []);

  return (
    <>
      <main className="flex max-h-fit flex-col items-center justify-between" style={{ paddingTop: layoutSizes.gapSize }}>
        <InterfaceContextProvider>
          <ViewMainInfoComponent heading={mainInfoHeading} mdxContent={MDX.pages.ShowCases.ENSO_Suitability} />

          {/*** START: grid layout ***/}
          <div ref={swapContainerRef} className={`grid grid-cols-6 w-full`} style={{
            gridTemplateRows: `repeat(auto-fill, minmax(${layoutSizes.rowSpanSize}vh, ${layoutSizes.rowSpanSize}vh))`,
            gap: `${layoutSizes.gapSize}px`,
            height: `calc(130vh - ${layoutSizes.topNavbarHeight}px - ${layoutSizes.gapSize}px)`,
            paddingRight: `${layoutSizes.gapSize}px`,
            paddingLeft: `${layoutSizes.gapSize}px`,
          }}>

            {/*** Top Card: 4 Climatic Factors & Forecast Sanity Check (Static Backend Image) ***/}
            <SGridPlotCard rowColSpan={[4, 6]} cardProps={climateFactorsCardProps}>
              <ClimateForecastStaticChartComponent fileName="climate_forecast_cell.svg" />
            </SGridPlotCard>

            {/*** Bottom Left Card: Forecast Map (Prediction) with Overview Minimap ***/}
            <SGridPlotCard rowColSpan={[5, 3]} cardProps={forecastMapCardProps}>
              <LeafD3MapLayerComponent props={forecastMapProps} />
              <MiniMapOverlay
                mapProps={forecastMapProps}
                height={115}
                zoom={-0.95}
                bottom={50}
                left={4}
                label="Overview"
              />
            </SGridPlotCard>

            {/*** Bottom Right Card: Reference Map ***/}
            <SGridPlotCard rowColSpan={[5, 3]} cardProps={referenceMapCardProps}>
              <LeafD3MapLayerComponent props={referenceMapProps} />
            </SGridPlotCard>

          </div>
        </InterfaceContextProvider>
      </main>
    </>
  );
}

/**
 * Renders backend-generated static SVG/PNG charts for climate factors & forecasts for selected cell.
 */
function ClimateForecastStaticChartComponent({ fileName }: { fileName: string }) {
  const contexT = useInterfaceContext();
  const rowID = contexT.dbRowID_of_selectedGridcellID;

  const [isLoading, setIsLoading] = useState(false);
  const L_svgLoader = useLoadingTask('Climate Forecast Chart');

  useEffect(() => {
    if (isLoading) {
      L_svgLoader.start();
    } else {
      L_svgLoader.stop();
    }
  }, [isLoading, L_svgLoader]);

  const initialSrc = rowID !== -1 ? apiRoutes.getUncertaintySvg({ filename: fileName, cellID: rowID }) : "";
  const [displayedSrc, setDisplayedSrc] = useState(initialSrc);
  const prevRowID = useRef(rowID);
  const loadKey = useRef(0);

  useEffect(() => {
    if (rowID !== prevRowID.current && rowID !== -1) {
      prevRowID.current = rowID;
      loadKey.current += 1;
      setIsLoading(true);
    }
  }, [rowID]);

  const pendingSrc = (isLoading && rowID !== -1)
    ? apiRoutes.getUncertaintySvg({ filename: fileName, cellID: rowID })
    : "";

  const currentKey = loadKey.current;

  return (
    <div className="relative w-full h-full">
      {displayedSrc ? (
        <img
          src={displayedSrc}
          alt={fileName}
          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '8px' }}
          className={isLoading ? "opacity-40 transition-opacity duration-300" : "transition-opacity duration-300"}
        />
      ) : (
        <div className="flex items-center justify-center h-full text-slate-400 text-sm italic">
          Select a grid cell on the map to load static climate factor & forecast plots
        </div>
      )}

      {isLoading && pendingSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={currentKey}
          src={pendingSrc}
          alt=""
          className="hidden"
          onLoad={() => {
            if (loadKey.current === currentKey) {
              setDisplayedSrc(pendingSrc);
              setIsLoading(false);
            }
          }}
          onError={() => {
            if (loadKey.current === currentKey) {
              setIsLoading(false);
            }
          }}
        />
      )}

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/30 backdrop-blur-[1px] z-10">
          <LoadingSpinnerAnimation />
        </div>
      )}
    </div>
  );
}
