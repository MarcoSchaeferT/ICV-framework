"use client";
import React, { useMemo } from 'react';
import LeafD3MapLayerComponent, { LeafD3MapLayerProps } from '../LeafD3Map';
import { apiRoutes } from "@/app/api_routes";
import { availableColorMapsNames } from '../constants';

export interface MiniMapOverlayProps {
  /** Parent mapProps object to inherit dataset, feature, colorMap, center from */
  mapProps?: ReturnType<typeof LeafD3MapLayerProps>;
  /** Optional explicit dataset name override */
  datasetName?: string;
  /** Optional explicit feature name override */
  featureName?: string;
  /** Optional explicit color map name override */
  colorMapName?: string;
  /** Container height in pixels or CSS string. Default: 115 */
  height?: number | string;
  /** Width-to-height aspect ratio. Default: 2.0 (equirectangular 360° x 180°) */
  aspectRatio?: number;
  /** Optional explicit zoom level override. Default: -0.99 */
  zoom?: number;
  /** Optional explicit width override */
  width?: number | string;
  /** Distance from bottom edge. Default: 50 */
  bottom?: number | string;
  /** Distance from left edge. Default: 4 */
  left?: number | string;
  /** Label pill text. Default: "Overview" */
  label?: string;
  /** Z-index for overlay box. Default: 800 */
  zIndex?: number;
  /** Extra CSS classes */
  className?: string;
}

/**
 * Clean floating overview minimap overlay component.
 */
export function MiniMapOverlay({
  mapProps,
  datasetName,
  featureName,
  colorMapName,
  height = 115,
  aspectRatio = 2.0,
  zoom,
  width,
  bottom = 50,
  left = 4,
  label = 'Overview',
  zIndex = 800,
  className = '',
}: MiniMapOverlayProps) {
  const numHeight = typeof height === 'number' ? height : parseFloat(height) || 115;
  const formattedHeight = typeof height === 'number' ? `${height}px` : height;
  const formattedWidth = width !== undefined
    ? (typeof width === 'number' ? `${width}px` : width)
    : `${numHeight * aspectRatio}px`;

  const effectiveMapProps = useMemo(() => {
    const p = LeafD3MapLayerProps();
    p.chartName = mapProps?.chartName ? `${mapProps.chartName}_Mini` : 'map_Overview_Mini';
    p.mapDataURL = mapProps?.mapDataURL || apiRoutes.FETCH_MAP_DATA.WORLD_MAP;
    p.center = mapProps?.center || [8.7, 10.3];
    p.zoom = zoom ?? mapProps?.zoom ?? -0.99;

    // Disable all interactive UI elements & sliders for minimap
    p.mapUIsettings.areSettingsOpen = false;
    p.mapUIsettings.isLongitudeSlider = false;
    p.mapUIsettings.isLatitudeSlider = false;
    p.mapUIsettings.isZoomSlider = false;
    p.mapUIsettings.isLatLngZoomOverlay = false;
    p.mapUIsettings.isColorMapSelectionDropdown = false;
    p.mapUIsettings.isFeatureSelectionDropdown = false;
    p.mapUIsettings.isDatasetSelectionDropdown = false;
    p.mapUIsettings.isDistanceLegend = false;
    p.mapUIsettings.isColorMapLegend = false;
    p.mapUIsettings.isCountrySelectionDropdown = false;
    p.mapUIsettings.isDatePicker = false;
    p.mapUIsettings.isAutoHideSettingsToggle = true;

    p.isStaticAutoFitFullSize = mapProps?.isStaticAutoFitFullSize ?? false;
    p.isProjection_equirectangular = mapProps?.isProjection_equirectangular ?? true;
    p.mapUIsettings.presenceDataColor = mapProps?.mapUIsettings.presenceDataColor || "rgb(255, 128, 0)";
    p.isApplyContextData = true;
    p.isApplyTransitions = false;
    p.isSyncMapCoordsOnTheFly_RECIEVER = false;

    // Dataset & feature configuration
    p.mapUIsettings.filterStringForAvailableDatasetInclude = mapProps?.mapUIsettings.filterStringForAvailableDatasetInclude || "_sim";
    p.mapUIsettings.defaultDatasetName = datasetName || mapProps?.mapUIsettings.defaultDatasetName || "t_2024_monthly_mean_4_ocsvm_aegypti_predictions_2023_mod_sim";
    p.mapUIsettings.defaultFeatureName = featureName || mapProps?.mapUIsettings.defaultFeatureName || "prob_1";
    p.mapUIsettings.defaultFeatureColorMap = colorMapName || mapProps?.mapUIsettings.defaultFeatureColorMap || availableColorMapsNames.interpolateInferno;

    p.mapInteractions = { disableMouse: true, disableScroll: true };
    p.mapDataSets = { isGridData: true, isPresenceData: false, isSequenceMetaData: false, isCityNames: false };
    p.mapStyles.backgroundColor = mapProps?.mapStyles.backgroundColor || "rgb(215, 234, 245)";
    p.mapStyles.isTooltopVisible = false;
    p.mapStyles.isMapMarkerTooltipVisible = true;

    return p;
  }, [mapProps, datasetName, featureName, colorMapName, zoom]);

  return (
    <div
      className={`absolute overflow-hidden rounded-[10px] border-2 border-white/55 shadow-[0_4px_10px_rgba(0,0,0,0.45)] ${className}`}
      style={{
        bottom,
        left,
        width: formattedWidth,
        height: formattedHeight,
        zIndex,
        backdropFilter: 'blur(2px)',
      }}
    >
      {label && (
        <div
          className="absolute top-1.5 left-2 pointer-events-none select-none rounded-full px-2 py-0.5 text-white font-semibold tracking-widest"
          style={{
            zIndex: zIndex + 100,
            fontSize: 10,
            background: 'rgba(20,20,30,0.72)',
            backdropFilter: 'blur(4px)',
          }}
        >
          {label}
        </div>
      )}

      <div
        className="gridPlotCardContent relative pointer-events-none [&_.leaflet-control-attribution]:!hidden [&_.leaflet-control-container]:!hidden"
        style={{ width: formattedWidth, height: formattedHeight }}
      >
        <LeafD3MapLayerComponent props={effectiveMapProps} />
      </div>
    </div>
  );
}

export default MiniMapOverlay;
