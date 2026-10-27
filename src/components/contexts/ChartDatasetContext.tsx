"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import { apiRoutes } from "@/app/api_routes";
import { useGetJSONData } from "@/app/hooks/useFetchAndCache";

/**
 * Dataset selection shared by the generic charts in one layout-template page.
 *
 * @remarks
 * The dataset and row limit are shared; each chart keeps its own axis and feature selection.
 * `selectedDataset` is empty until the requested relation appears in the fetched list.
 *
 * @example
 * ```tsx
 * import { useChartDataset, type ChartDatasetContextValue } from "@/framework";
 *
 * function MosquitoDatasetSelection() {
 *   const selection: ChartDatasetContextValue = useChartDataset();
 *   return (
 *     <button onClick={() => selection.setSelectedDataset("world_mosquitos_2014_2025_gdf_mosquito_amount")}>
 *       {selection.selectedDataset || "Select mosquito observations"}
 *     </button>
 *   );
 * }
 * ```
 */
export interface ChartDatasetContextValue {
  /** Selected relation name, or an empty string until a valid selection exists. */
  selectedDataset: string;
  /** Requests a relation from the currently available dataset list. */
  setSelectedDataset: (dataset: string) => void;
  /** Sorted dataset relation names returned by the backend. */
  datasets: string[];
  /** Whether the relation-list request is pending. */
  isLoading: boolean;
  /** Backend or network error reported by the relation-list request. */
  error?: string;
  /** Maximum rows fetched by generic charts; `null` leaves the choice to the consumer. */
  rowLimit: number | null;
  /** Updates the shared maximum row count. */
  setRowLimit: (limit: number | null) => void;
}

const ChartDatasetContext = createContext<ChartDatasetContextValue | undefined>(undefined);

/**
 * Owns the dataset shared by all generic charts in one layout-template page.
 *
 * @param props - React children that need the shared dataset selection.
 * @returns A context provider wrapping the chart layout.
 *
 * @remarks
 * Initial defaults: `rowLimit = 100`, `selectedDataset = ""`.
 *
 * Loads available dataset relations through `useGetJSONData` and sorts the result.
 * Axis selections intentionally remain local to individual chart cards. An unavailable requested relation
 * resolves to an empty selection rather than persisting a stale dataset name.
 *
 * @example
 * ```tsx
 * import { ChartDatasetProvider, useChartDataset } from "@/framework";
 *
 * function DatasetLabel() {
 *   const { selectedDataset } = useChartDataset();
 *   return <span>{selectedDataset || "Choose a dataset"}</span>;
 * }
 *
 * function DatasetPage() {
 *   return <ChartDatasetProvider><DatasetLabel /></ChartDatasetProvider>;
 * }
 * ```
 */
export function ChartDatasetProvider({ children }: { children: React.ReactNode }) {
  const [requestedDataset, setRequestedDataset] = useState("");
  const [rowLimit, setRowLimit] = useState<number | null>(100);
  const [isLoading, rawDatasets] = useGetJSONData(apiRoutes.GET_LIST_OF_DATASETS);

  const datasets = useMemo(() => {
    if (!rawDatasets || typeof rawDatasets !== "object" || Array.isArray(rawDatasets)) {
      return [];
    }

    return Object.keys(rawDatasets)
      .sort((left, right) => left.localeCompare(right));
  }, [rawDatasets]);

  const selectedDataset = datasets.includes(requestedDataset) ? requestedDataset : "";

  const error = (rawDatasets as unknown as { error?: string })?.error;
  const value = useMemo(() => ({
    selectedDataset,
    setSelectedDataset: setRequestedDataset,
    datasets,
    isLoading,
    error,
    rowLimit,
    setRowLimit,
  }), [selectedDataset, datasets, isLoading, error, rowLimit]);

  return (
    <ChartDatasetContext.Provider value={value}>
      {children}
    </ChartDatasetContext.Provider>
  );
}

/**
 * Reads the shared dataset and row limit for a generic chart layout.
 *
 * @returns The current selection, available relations, loading/error state, and setters.
 * @remarks Must be called below {@link ChartDatasetProvider}; otherwise it throws.
 *
 * @example
 * ```tsx
 * import { useChartDataset } from "@/framework";
 *
 * function DatasetLabel() {
 *   const { selectedDataset, isLoading } = useChartDataset();
 *   return <span>{isLoading ? "Loading datasets" : selectedDataset || "Choose a dataset"}</span>;
 * }
 * ```
 */
export function useChartDataset() {
  const context = useContext(ChartDatasetContext);
  if (!context) {
    throw new Error("useChartDataset must be used within a ChartDatasetProvider");
  }
  return context;
}
