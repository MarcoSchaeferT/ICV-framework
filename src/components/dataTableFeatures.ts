import {
  columnFacetingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  constructFilterFn,
  createFacetedMinMaxValues,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  type Row,
  type RowData,
} from "@tanstack/react-table";
import { rankItem, type RankingInfo } from "@tanstack/match-sorter-utils";

const fuzzyFilter = constructFilterFn({
  filter: (dataValue, filterValue, _row, _columnId, addMeta) => {
    const itemRank = rankItem(dataValue, filterValue);
    addMeta?.({ itemRank });
    return itemRank.passed;
  },
});

/**
 * TanStack Table feature set used by database-backed data tables.
 *
 * @remarks
 * Enables sorting, pagination, selection, column visibility, and faceting.
 * The `fuzzy` global filter records match ranking in `itemRank` metadata;
 * consumers pass this feature set to `useTable` and select `globalFilterFn: "fuzzy"`.
 *
 * @example
 * ```ts
 * import { dataTableFeatures } from "@/framework";
 *
 * const featuresForMosquitoObservations = dataTableFeatures;
 * ```
 */
export const dataTableFeatures = tableFeatures({
  columnFacetingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  facetedMinMaxValues: createFacetedMinMaxValues(),
  filterFns: { fuzzy: fuzzyFilter },
  filterMeta: {} as { itemRank: RankingInfo },
});

/**
 * Inferred TanStack feature contract for the configured table instance.
 *
 * @example
 * ```ts
 * import { dataTableFeatures, type DataTableFeatures } from "@/framework";
 * const configuredFeatures: DataTableFeatures = dataTableFeatures;
 * ```
 */
export type DataTableFeatures = typeof dataTableFeatures;
/**
 * Flexible database row shape before dataset-specific column narrowing.
 *
 * @remarks Rows from heterogeneous relations are narrowed by the table's
 * column definitions and linked-view selection callbacks.
 *
 * @example
 * ```ts
 * import type { DataTableData } from "@/framework";
 * const mosquitoObservation: DataTableData = {
 *   id: 200509,
 *   species: "albopictus",
 *   mosquito_amount: 18,
 * };
 * ```
 */
export type DataTableData = Record<string, any>;
/**
 * TanStack row carrying the project's feature set and a relation-specific record.
 *
 * @typeParam TData - Original record shape; defaults to {@link DataTableData}.
 *
 * @example
 * ```ts
 * import type { DataTableRow } from "@/framework";
 * function selectedSpecies(row: DataTableRow<{ species: string }>): string {
 *   return row.original.species;
 * }
 * ```
 */
export type DataTableRow<TData extends RowData = DataTableData> = Row<DataTableFeatures, TData>;
