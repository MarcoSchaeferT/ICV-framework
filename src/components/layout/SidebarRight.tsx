"use client";

import React, { useState } from "react";
import { PanelRight, X, Hand, Plus, Trash2, TrendingUp, BarChart3, PieChart as PieChartIcon, Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUIContext } from "../contexts/UIContext";
import CardWrapper, { CardPropsClass } from "./CardWrapper";
import { LoadingSpinnerProvider } from "../plots/maps/utils/loadingSpinner";
import LinechartComponent, { LinechartProps } from "@/components/plots/linechart/linechart";
import BarchartComponent, { BarchartProps } from "@/components/plots/barchart/barchart";
import PieChartComponent, { PieChartProps } from "@/components/plots/piechart/piechart";
import LeafD3MapLayerComponent, { LeafD3MapLayerProps } from "@/components/plots/maps/LeafD3Map";
import { useChartDataset } from "../contexts/ChartDatasetContext";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Swapy } from "swapy";

/** Supported chart types that can be dynamically spawned into the sidebar. */
export type ChartType = "line" | "bar" | "pie" | "map";

/** Definition of one dynamically spawned chart instance in the right sidebar. */
interface CustomChartItem {
  /** Unique identifier for the chart instance. */
  id: string;
  /** Type of chart visualization. */
  type: ChartType;
  /** Sequential instance number for display in the card title. */
  instanceNumber: number;
}

/** Width of the expanded right sidebar in CSS rem units. @default "20rem" */
const SIDEBAR_WIDTH_OPEN = "20rem";

/**
 * Creates a map configured for the layout-template registry.
 * Dataset selection remains in the sidebar; only feature and color-map
 * controls are rendered on the map itself.
 */
function createRegistryMapProps(chartName: string, datasetName: string) {
  return LeafD3MapLayerProps(
    chartName,
    undefined,
    undefined,
    {
      areSettingsOpen: true,
      isSettingsBlendAnimation: false,
      isAutoHideSettingsToggle: false,
      isLongitudeSlider: false,
      isLatitudeSlider: false,
      isZoomSlider: false,
      isLatLngZoomOverlay: true,
      isColorMapSelectionDropdown: true,
      isFeatureSelectionDropdown: true,
      isCountrySelectionDropdown: false,
      isCountrySelectionDropdownMapBased: false,
      isDatePicker: false,
      isDatasetSelectionDropdown: false,
      isDistanceLegend: false,
      isColorMapLegend: true,
      isPresenceData: false,
      isSequenceMetaData: false,
      dataFilteringCheckboxes: false,
      defaultDatasetName: datasetName,
    },
    {},
    {
      isGridData: true,
      isPresenceData: false,
      isSequenceMetaData: false,
      isCityNames: false,
    },
    undefined,
    undefined,
    {},
    false,
    false,
    false,
    true,
  );
}

/** Props accepted by {@link SidebarRight}. */
interface SidebarRightProps {
  /** Page-level prefix to namespace Swapy slot and item IDs. */
  pageId: string;
  /** Reference to the shared Swapy instance for dynamic slot updates. */
  swapyRef?: React.RefObject<Swapy | null>;
  /** Additional CSS classes applied to the outer wrapper. */
  className?: string;
}

/**
 * Collapsible right sidebar containing a registry of draggable chart preview cards with dynamic instance spawning.
 *
 * @param props - Page identifier and optional styling overrides.
 * @returns A slide-out sidebar panel with Swapy-compatible chart slots and dynamic spawn controls.
 *
 * @remarks
 * Allows users to dynamically spawn new instances of line, bar, pie, and map charts into the right sidebar.
 * Each spawned chart gets a unique Swapy slot and item ID within the shared page container.
 *
 * @example
 * ```tsx
 * <SidebarRight pageId="3col" />
 * ```
 */
export default function SidebarRight({ pageId, swapyRef, className }: SidebarRightProps) {
  const UI_contextT = useUIContext();
  const {
    selectedDataset,
    setSelectedDataset,
    datasets,
    isLoading,
    error,
    rowLimit,
    setRowLimit,
  } = useChartDataset();
  const [isOpen, setIsOpen] = useState(false);

  // Counter tracking total spawned instances per chart type
  const [typeCounters, setTypeCounters] = useState<Record<ChartType, number>>({
    line: 1,
    bar: 1,
    pie: 1,
    map: 1,
  });

  // Dynamic list of chart instances in the sidebar
  const [chartItems, setChartItems] = useState<CustomChartItem[]>([
    { id: `${pageId}-sb-line-1`, type: "line", instanceNumber: 1 },
    { id: `${pageId}-sb-bar-1`, type: "bar", instanceNumber: 1 },
    { id: `${pageId}-sb-pie-1`, type: "pie", instanceNumber: 1 },
    { id: `${pageId}-sb-map-1`, type: "map", instanceNumber: 1 },
  ]);

  // Whenever chartItems change, update Swapy so it scans new DOM slots
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (swapyRef?.current) {
        swapyRef.current.update();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [chartItems, swapyRef]);

  /** Spawns a new instance of the specified chart type into the sidebar. */
  const spawnChartInstance = (type: ChartType) => {
    const nextNumber = (typeCounters[type] || 0) + 1;
    setTypeCounters((prev) => ({ ...prev, [type]: nextNumber }));

    const newItem: CustomChartItem = {
      id: `${pageId}-sb-${type}-${nextNumber}`,
      type,
      instanceNumber: nextNumber,
    };

    setChartItems((prev) => [...prev, newItem]);
  };

  /** Removes a chart instance from the sidebar registry. */
  const removeChartInstance = (id: string) => {
    setChartItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <>
      {/* Toggle button — visible when sidebar is closed */}
      {!isOpen && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setIsOpen(true);
            UI_contextT.setIsSwapy(true);
          }}
          className="fixed top-4 right-0 z-[1200] h-6 w-12 rounded-l-xl shadow-md bg-[#279BBA] border-sidebar-border"
        >
          <PanelRight className="h-4 w-4 text-white" />
        </Button>
      )}

      {/* Sidebar panel */}
      <div
        className={cn(
          "h-full flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden",
          className
        )}
        style={{
          width: isOpen ? SIDEBAR_WIDTH_OPEN : "0px",
          minWidth: isOpen ? SIDEBAR_WIDTH_OPEN : "0px",
        }}
      >
        <div
          className={cn(
            "h-full flex flex-col bg-sidebar border-l border-sidebar-border transition-opacity duration-200",
            isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          style={{ width: SIDEBAR_WIDTH_OPEN }}
        >
          {/* Sidebar header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-600">
            <span className="text-white text-sm font-semibold">Chart Registry</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsOpen(false);
                UI_contextT.setIsSwapy(false);
              }}
              className="text-sidebar-foreground hover:bg-sidebar-accent bg-gray-700/40 rounded-full p-1.5"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Spawn Chart Instance controls */}
          <div className="p-3 border-b border-gray-600/60 bg-gray-900/40">
            <div className="mb-3">
              <div className="text-xs text-gray-300 font-medium mb-1">Dataset for all charts:</div>
              <Select
                value={selectedDataset}
                onValueChange={setSelectedDataset}
                disabled={isLoading || datasets.length === 0}
              >
                <SelectTrigger className="h-8 w-full bg-white text-xs text-slate-900">
                  <SelectValue placeholder={isLoading ? "Loading datasets..." : "Select dataset"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Dataset</SelectLabel>
                    {datasets.map((dataset) => (
                      <SelectItem key={dataset} value={dataset}>{dataset}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {error && <p className="mt-1 text-[11px] text-red-300">{error}</p>}
            </div>
            <div className="mb-3">
              <div className="text-xs text-gray-300 font-medium mb-1">Maximum rows per chart:</div>
              <Select
                value={rowLimit === null ? "unlimited" : String(rowLimit)}
                onValueChange={(value) => setRowLimit(value === "unlimited" ? null : Number(value))}
              >
                <SelectTrigger className="h-8 w-full bg-white text-xs text-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Row limit</SelectLabel>
                    {[10, 100, 1000, 5000].map((limit) => (
                      <SelectItem key={limit} value={String(limit)}>{limit.toLocaleString()}</SelectItem>
                    ))}
                    <SelectItem value="unlimited">Unlimited (risky)</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              {rowLimit === null && (
                <p className="mt-1 text-[11px] text-amber-300">
                  Unlimited mode may freeze the browser for large datasets.
                </p>
              )}
            </div>
            <div className="text-xs text-gray-300 font-medium mb-2">Spawn Chart Instance:</div>
            <div className="flex gap-1.5 flex-wrap">
              <Button
                variant="secondary"
                size="sm"
                className="text-xs h-7 px-2.5 bg-indigo-600/80 hover:bg-indigo-600 text-white flex items-center gap-1 rounded-md"
                onClick={() => spawnChartInstance("line")}
              >
                <Plus className="w-3 h-3" /> <TrendingUp className="w-3 h-3" /> Line
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="text-xs h-7 px-2.5 bg-emerald-600/80 hover:bg-emerald-600 text-white flex items-center gap-1 rounded-md"
                onClick={() => spawnChartInstance("bar")}
              >
                <Plus className="w-3 h-3" /> <BarChart3 className="w-3 h-3" /> Bar
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="text-xs h-7 px-2.5 bg-amber-600/80 hover:bg-amber-600 text-white flex items-center gap-1 rounded-md"
                onClick={() => spawnChartInstance("pie")}
              >
                <Plus className="w-3 h-3" /> <PieChartIcon className="w-3 h-3" /> Pie
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="text-xs h-7 px-2.5 bg-sky-600/80 hover:bg-sky-600 text-white flex items-center gap-1 rounded-md"
                onClick={() => spawnChartInstance("map")}
              >
                <Plus className="w-3 h-3" /> <MapIcon className="w-3 h-3" /> Map
              </Button>
            </div>
          </div>

          {/* Chart preview cards — vertically scrollable */}
          <div className="flex-1 overflow-y-auto p-3 space-y-5">
            {chartItems.map((item) => {
              const slotId = `${item.id}-slot`;
              const itemId = `${item.id}-item`;

              let chartComponent: React.ReactNode = null;
              let title = "Chart";

              if (item.type === "line") {
                const lineProps = LinechartProps(item.id);
                lineProps.dataMode = "generic";
                chartComponent = <LinechartComponent chartProps={lineProps} />;
                title = `Line Chart ${item.instanceNumber}`;
              } else if (item.type === "bar") {
                const barProps = BarchartProps(item.id);
                barProps.dataMode = "generic";
                chartComponent = <BarchartComponent chartProps={barProps} />;
                title = `Bar Chart ${item.instanceNumber}`;
              } else if (item.type === "pie") {
                const pieProps = PieChartProps(item.id);
                pieProps.dataMode = "generic";
                chartComponent = <PieChartComponent ChartProps={pieProps} />;
                title = `Pie Chart ${item.instanceNumber}`;
              } else if (item.type === "map") {
                title = `Map ${item.instanceNumber}`;
                if (selectedDataset) {
                  const mapProps = createRegistryMapProps(item.id, selectedDataset);
                  chartComponent = (
                    <LeafD3MapLayerComponent
                      key={`${item.id}-${selectedDataset}`}
                      props={mapProps}
                    />
                  );
                } else {
                  chartComponent = (
                    <div className="flex size-full flex-col items-center justify-center gap-2 px-4 text-center text-xs text-slate-500">
                      <MapIcon className="h-8 w-8" />
                      <span>{isLoading ? "Loading datasets..." : "Select a dataset to load the map"}</span>
                    </div>
                  );
                }
              }

              const cardProps = CardPropsClass(item.id, title, "", "");

              return (
                <div
                  key={slotId}
                  data-swapy-slot={slotId}
                  className="group/sidebar-slot relative rounded-lg border border-gray-600/50 bg-gray-800/30 flex flex-col h-[180px] min-h-[180px]"
                >
                  <div
                    data-swapy-item={itemId}
                    className="size-full text-left flex flex-col min-h-0 relative"
                  >
                    {/* Delete button on sidebar card */}
                    <button
                      type="button"
                      title="Remove from sidebar"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeChartInstance(item.id);
                      }}
                      className="absolute top-1 left-1 z-40 hidden group-hover/sidebar-slot:flex items-center justify-center w-5 h-5 rounded-full bg-red-600/80 hover:bg-red-600 text-white transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>

                    {/* Drag Handle — identical to SGridPlotCard handle */}
                    <div
                      className={`handle ${UI_contextT.isSwapy ? "z-50" : "hidden"} hover:bg-amber-400 border-3 hover:text-2xl border-blue-500 hover:text-amber-50 bg-slate-300 w-10 h-10 rounded-full flex items-center justify-center`}
                      data-swapy-handle
                      style={{
                        position: "absolute",
                        top: -12,
                        right: -12,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.nativeEvent.stopImmediatePropagation();
                      }}
                      onMouseMove={(e) => {
                        e.stopPropagation();
                        e.nativeEvent.stopImmediatePropagation();
                      }}
                    >
                      <Hand className="w-7 h-7" />
                    </div>

                    {/* Card content */}
                    <LoadingSpinnerProvider>
                      <CardWrapper cardProps={cardProps}>
                        {chartComponent}
                      </CardWrapper>
                    </LoadingSpinnerProvider>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer hint */}
          <div className="p-3 border-t border-gray-600 text-center">
            <p className="text-[11px] text-gray-500">
              {UI_contextT.isSwapy
                ? "Drag charts into the grid to swap"
                : "Enable Swapy mode to drag charts"}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
