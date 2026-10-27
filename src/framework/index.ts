/**
 * Curated TypeScript exports of the ICV framework.
 *
 * @remarks
 * This barrel is the only entry point consumed by TypeDoc. It catalogues documented Vis. Interface contracts; application
 * modules import their owning files directly so dependencies remain visible and do not cycle through this barrel.
 * Generated TypeDoc examples can use `@/framework` to illustrate the documented export surface.
 * The WebGL grid helper renders an overlay within the primary Leaflet map.
 *
 * @packageDocumentation
 */

/** Data access and endpoint construction. */
export {
  apiRoutes,
  type DataQueryTask,
  type MapName,
} from '@/app/api_routes';
export { aggregateRKI, type RkiAggregationCommand } from '@/app/api_commands';
export {
  clearCacheForUrl,
  clearDataCache,
  useGetJSONData,
} from '@/app/hooks/useFetchAndCache';
export type { dbDATA as DatabaseResponse } from '@/app/const_store';

/** Shared dataset selection for composable chart layouts. */
export {
  ChartDatasetProvider,
  useChartDataset,
  type ChartDatasetContextValue,
} from '@/components/contexts/ChartDatasetContext';

/** Linked-view interaction state. */
export {
  InterfaceContextProvider,
  useInterfaceContext,
  type interfaceContextI as InterfaceContextValue,
  type InterfaceContextProviderProps,
  type mapMouseEvents as MapMouseEvents,
} from '@/components/contexts/InterfaceContext';

/** Reusable Vis. Interface cards and tables. */
export {
  default as CardWrapper,
  CardPropsClass,
  type CardWrapperProps,
} from '@/components/layout/CardWrapper';
export {
  default as DataTable,
  type dataTableComponentT as DataTableProps,
} from '@/components/DataTable';
export type {
  DataTableData,
  DataTableFeatures,
  DataTableRow,
} from '@/components/dataTableFeatures';
export { dataTableFeatures } from '@/components/dataTableFeatures';

/** Cartesian and categorical chart components. */
export {
  default as GenericCartesianChart,
  DEFAULT_GENERIC_CHART_ROW_LIMIT,
  type GenericChartKind,
} from '@/components/plots/generic/GenericCartesianChart';
export {
  default as BarChart,
  BarchartProps,
} from '@/components/plots/barchart/barchart';
export {
  default as LineChart,
  LinechartProps,
} from '@/components/plots/linechart/linechart';
export {
  default as PieChart,
  PieChartProps,
} from '@/components/plots/piechart/piechart';

/** Leaflet map building blocks. */
export {
  default as LeafletMap,
  LeafletComponentProps,
  type LeafletMapProps,
} from '@/components/plots/maps/BaseMap';
export {
  default as LeafletGridLayer,
  LeafD3MapLayerProps,
} from '@/components/plots/maps/LeafD3Map';
export type {
  GridCellSize,
  MapCoordinates,
  MapDimensions,
  MapGridResponseV1,
  VisDataT,
} from '@/components/plots/maps/types';
export {
  useGridDataParser,
  type UseGridDataParserParams,
  type UseGridDataParserResult,
} from '@/components/plots/maps/hooks/useGridDataParser';
export {
  useWebGLGridLayer,
  type UseWebGLGridLayerParams,
} from '@/components/plots/maps/hooks/useWebGLGridLayer';
export type { PolygonStyleOptions } from '@/components/plots/maps/webgl/WebGLRendererTypes';
export {
  useMapPosition,
  type UseMapPositionParams,
} from '@/components/plots/maps/hooks/useMapPosition';
export {
  useMapResize,
  type UseMapResizeParams,
} from '@/components/plots/maps/hooks/useMapResize';
export {
  default as ColorMapLegend,
  type ColorMapLegendProps,
} from '@/components/plots/maps/overlays/ColorMapLegend';

/** Map filtering, geometry, and tooltip helpers intended for Vis. Interface extensions. */
export {
  getActiveStringFilters,
  getGoodReadableRange,
  getGridCellDims,
  getGridOffset,
  getMinMaxFeature,
  passesStringFilters,
  renderStandardTooltipHTML,
  snapToGrid,
  StandardTooltip,
  type MapStringFilter,
  type StandardTooltipProps,
  type StandardTooltipRow,
  type StandardTooltipSection,
} from '@/components/plots/maps/helpers';

/** Metadata normalization and responsive sizing helpers. */
export {
  alignFeature_to_Metadata,
  type metaDataT as MetadataRecord,
} from '@/components/plots/MetaDataHandler';
export {
  useSizeWatchDebounced,
  type Size,
} from '@/app/hooks/useResizeObserver';
export { default as SizeHook } from '@/app/hooks/useResizeObserver';
export { default as useChartResizer } from '@/app/hooks/useChartResizer';
