"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import { apiRoutes } from "@/app/api_routes";
import { useGetJSONData } from "@/app/hooks/useFetchAndCache";

interface ChartDatasetContextValue {
  selectedDataset: string;
  setSelectedDataset: (dataset: string) => void;
  datasets: string[];
  isLoading: boolean;
  error?: string;
  rowLimit: number | null;
  setRowLimit: (limit: number | null) => void;
}

const ChartDatasetContext = createContext<ChartDatasetContextValue | undefined>(undefined);

const INTERNAL_RELATIONS = new Set([
  "column_metadata_de",
  "column_metadata_en",
  "spatial_ref_sys",
]);

/**
 * Owns the dataset shared by all generic charts in one layout-template page.
 * Axis selections intentionally remain local to the individual chart cards.
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
      .filter((relationName) => !INTERNAL_RELATIONS.has(relationName))
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

export function useChartDataset() {
  const context = useContext(ChartDatasetContext);
  if (!context) {
    throw new Error("useChartDataset must be used within a ChartDatasetProvider");
  }
  return context;
}
