"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  ColumnDef,
  flexRender,
  RowSelectionState,
  SortingState,
  useTable,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  NavArrowDown,
  NavArrowUp,
  Search,
} from "iconoir-react";
import { twMerge } from "tailwind-merge";
import {
  dataTableFeatures,
  type DataTableData,
  type DataTableFeatures,
  type DataTableRow,
} from "./dataTableFeatures";
import { CardPropsClass } from './layout/CardWrapper';

import { metaDataT } from '@/components/plots/MetaDataHandler';
import { apiRoutes } from '@/app/api_routes';
import { useLocale ,useTranslations } from "next-intl";
import { t_richConfig, dbDATA } from '@/app/const_store';
import { Locale } from '@/i18n/routing';
import { useGetJSONData } from '@/app/hooks/useFetchAndCache';
import { useLoadingTask, LoadingSpinnerAnimation } from "./plots/maps/utils/loadingSpinner";

// Stable references to prevent re-render loops
const EMPTY_ARRAY: DataTableData[] = [];
const NO_DATA_FALLBACK: DataTableData[] = [{ no_data: "" }];

/**
 * Configuration for a database-backed data table.
 *
 * @remarks
 * Columns come from the database response. `relationName` selects the dataset;
 * optional row-selection fields let a linked view identify a matching record.
 * `targetDate` narrows relations that support dated snapshots.
 * Row clicks can notify a parent through `onClickEvent`; no Vis. Interface context is required.
 * An external selection opens its page and scrolls the row into view.
 *
 * @example
 * ```tsx
 * import { CardPropsClass, type DataTableProps } from "@/framework";
 *
 * const config: DataTableProps = {
 *   relationName: "dengue_serotypes",
 *   cardProps: CardPropsClass(
 *     "regional-data-table",
 *     "Regional observations",
 *     "Select a row to coordinate linked views",
 *     "Source: Surveillance",
 *   ),
 *   onClickEvent: (row) => console.log(row.original),
 * };
 * ```
 */
export interface dataTableComponentT {
  /** Public database relation whose current snapshot populates the table. */
  relationName: string,
  /** Optional date filter for relations with dated snapshots. */
  targetDate?: string,
  /** Column containing a unique, stable row key; defaults to `id`, then the source index. @defaultValue "id" */
  rowKeyColumn?: string,
  /** Standard Vis. Interface card presentation. */
  cardProps: CardPropsClass,
  /** Optional row-click handler receiving the record and its stable table key. */
  onClickEvent?: (row: DataTableRow, rowKey: string) => void,
  /** Column used to match an external selection; the matching row is paged into view. */
  selectedRowColumn?: string,
  /** Value to locate in `selectedRowColumn`; omit to disable linked selection. */
  selectedRowValue?: string | number,
};



/***************************
****** SEARCH HANDLING *****
****************************/
// debounced input for search (wait until user finishes typing)
function DebouncedInput({
  onChange,
  debounce = 500,
  value: initialValue,
  ...props
}: {
  debounce?: number;
  value: string | number;
  onChange: (value: string | number) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) {
  const [value, setValue] = React.useState(initialValue);
  const [previousInitialValue, setPreviousInitialValue] = React.useState(initialValue);
  if (initialValue !== previousInitialValue) {
    setPreviousInitialValue(initialValue);
    setValue(initialValue);
  }

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(value);
    }, debounce);

    return () => clearTimeout(timeout);
  }, [value, debounce, onChange]);

  return (
    <div className={`relative  w-60 max-w-sm ${props.className || ''}`}>
      <Input
        className="pl-9 bg-accent"
        type="text"
        {...props}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setValue(e.target.value)
        }
      ></Input>
     
      <Search className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${props.disabled ? 'text-gray-300' : 'text-gray-400'} h-4 w-4`} />
    </div>
  );
}


/**
 * Renders a searchable, sortable, and paginated data table backed by a database relation.
 *
 * Fetches all columns (`feature: "ALL"`) for `relationName` via {@link useGetJSONData} and
 * aligns numeric feature values with localized physical units from {@link alignFeature_to_Metadata}.
 *
 * @param props - Relation, card, and optional linked-selection settings defined in {@link dataTableComponentT}.
 * @returns A rendered table view with debounced global search, column sorting, pagination, and linked row selection.
 *
 * @remarks
 * When `selectedRowColumn` and `selectedRowValue` match a row in the dataset, the table
 * automatically switches to the page containing that record and scrolls the row into view.
 *
 * @see {@link dataTableComponentT} for configuration options.
 * @see {@link dataTableFeatures} for the registered TanStack Table feature bundle.
 *
 * @example
 * ```tsx
 * import { CardPropsClass, DataTable } from "@/framework";
 *
 * const cardProps = CardPropsClass(
 *   "surveillance-table",
 *   "Dengue Surveillance Records",
 *   "Click a row to inspect regional observations",
 *   "Source: ECDC / WHO",
 * );
 *
 * <DataTable
 *   relationName="dengue_serotypes"
 *   cardProps={cardProps}
 *   selectedRowColumn="country"
 *   selectedRowValue="Brazil"
 *   onClickEvent={(row, rowKey) => console.log(rowKey, row.original)}
 * />
 * ```
 */
const DataTableComponent = (props: dataTableComponentT) => {
  const { relationName, targetDate, rowKeyColumn = "id", onClickEvent, selectedRowColumn, selectedRowValue } = props;

  // get current locale/language
  const locale = useLocale() as Locale;
  const t = useTranslations("component_dataTable");


  // state variables and setters
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [rowHoverID, setRowHoverID] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selectedRowRef = useRef<HTMLTableRowElement>(null);

  const [sorting, setSorting] = useState<SortingState>([]) // can set initial sorting state here


  // data loading
  const [isLoading_TableData, rawTableData] = useGetJSONData(apiRoutes.fetchDbData({
    relationName,
    feature: "ALL",
    targetDate,
  }));

  const L_tableLoader = useLoadingTask('Table Data');
  useEffect(() => {
    if (isLoading_TableData) {
      L_tableLoader.start();
    } else {
      L_tableLoader.stop();
    }
  }, [isLoading_TableData, L_tableLoader]);
  const [, rawMetaData] = useGetJSONData(apiRoutes.getDatasetsMetadata({ LANGID: locale }));
  
  // *** SAFEGUARD 1: Default to empty object if rawTableData is null/undefined ***
  const tableData = (rawTableData || {}) as dbDATA;
  const metaData = useMemo(() => (rawMetaData || {}) as unknown as metaDataT, [rawMetaData]);

  // *** SAFEGUARD 2: Extract response array safely ***
  
  const responseArray = tableData.response;
  const safeTableData: DataTableData[] = useMemo(() =>
    Array.isArray(responseArray) && responseArray.length > 0 
      ? responseArray 
      : EMPTY_ARRAY,
    [responseArray]
  );
  const hasData = safeTableData.length > 0;

  // Build columns from the database response and its metadata.
  const columns: ColumnDef<DataTableFeatures, DataTableData, any>[] = useMemo(() => {
    const columnDefs: ColumnDef<DataTableFeatures, DataTableData, any>[] = [];

    // If loading, we might return empty or specific skeleton columns (returning empty for now)
    if (isLoading_TableData) return columnDefs;

    // *** SAFEGUARD 3: Check explicitly for empty data ***
    if (!hasData) {
      columnDefs.push({
        header: "Information",
        accessorKey: "no_data", // This key matches the fallback data
        cell: () => "No data available",
        enableSorting: false,
      });
      return columnDefs;
    }

    // *** SAFEGUARD 4: Only access keys if data exists (prefer DB ordinal order in tableData.header) ***
    const columnKeys = (Array.isArray(tableData.header) && tableData.header.length > 0)
      ? tableData.header
      : Object.keys(safeTableData[0]);

    columnKeys.forEach((key) => {
      if (!key.startsWith("_") && !key.includes("geometry") && key !== "id") {
        const colMeta = metaData[key];
        const isAvailable = colMeta?.availability === "1" || colMeta?.availability === undefined;
        if (isAvailable) {
          columnDefs.push({
            header: key,
            accessorKey: key,
            cell: (info) => info.getValue(),
          });
        }
      }
    });
    return columnDefs;
  }, [isLoading_TableData, safeTableData, hasData, tableData.header, metaData]);



  function handleRowClick(row: DataTableRow) {
    if(!hasData) return; // Prevent clicking on "No Data" row

    table.setRowSelection({ [row.id]: true });
    onClickEvent?.(row, row.id);
  }

  // *** setup table config **** //
  const table = useTable({
    features: dataTableFeatures,
    // *** SAFEGUARD 5: Ensure data matches the fallback column ***

    data: hasData ? safeTableData : NO_DATA_FALLBACK, 
    columns,
    getRowId: (row, index) => {
      const value: unknown = row[rowKeyColumn];
      const hasKey = (typeof value === "string" && value.length > 0)
        || (typeof value === "number" && Number.isFinite(value));
      const key = hasKey
        ? `key:${String(value)}`
        : `index:${index}`;
      return `${relationName}:${key}`;
    },
    enableMultiRowSelection: false,
    state: {
      globalFilter,
      sorting,
      rowSelection,
    },
    initialState: {
      pagination: {
        pageIndex: 0, //custom initial page index
        pageSize: 20, //custom default page size
      },
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "fuzzy",
    debugTable: false,
    debugHeaders: false,
    debugColumns: false,
  });


  const selectedRowId = Object.keys(rowSelection)[0];
  const pageIndex = table.state.pagination.pageIndex;
  const pageSize = table.state.pagination.pageSize;

  // Link an external selection to the source row independently of pagination.
  useEffect(() => {
    if (!hasData || !selectedRowColumn || selectedRowValue === undefined || selectedRowValue === "") return;

    const matchingRow = table.getCoreRowModel().rows.find(
      row => String(row.original?.[selectedRowColumn]) === String(selectedRowValue)
    );
    if (matchingRow && !rowSelection[matchingRow.id]) table.setRowSelection({ [matchingRow.id]: true });
  // useTable returns a new facade on render; the relation and source rows are the triggers.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasData, selectedRowColumn, selectedRowValue, safeTableData, relationName, rowKeyColumn]);

  // Keep the selected row on the correct page after selection, sorting, or filtering.
  useEffect(() => {
    if (!selectedRowId) return;
    const visibleIndex = table.getPrePaginatedRowModel().rows.findIndex(row => row.id === selectedRowId);
    if (visibleIndex < 0) return;
    const targetPage = Math.floor(visibleIndex / pageSize);
    if (targetPage !== table.state.pagination.pageIndex) table.setPageIndex(targetPage);
  // Current page and the useTable facade are excluded so manual pagination remains possible.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRowId, sorting, globalFilter, pageSize, safeTableData]);

  // Scroll only the table viewport after the selected row has rendered on its page.
  useEffect(() => {
    if (!selectedRowId || isLoading_TableData) return;
    const frame = requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      const selectedRow = selectedRowRef.current;
      if (!container || !selectedRow || !container.contains(selectedRow)) return;

      const containerRect = container.getBoundingClientRect();
      const rowRect = selectedRow.getBoundingClientRect();
      const headerHeight = container.querySelector("thead")?.getBoundingClientRect().height ?? 0;
      const visibleTop = containerRect.top + headerHeight;
      const visibleBottom = containerRect.top + container.clientHeight;
      if (rowRect.top >= visibleTop && rowRect.bottom <= visibleBottom) return;

      const centerOffset = Math.max(0, (container.clientHeight - headerHeight - rowRect.height) / 2);
      const top = container.scrollTop + rowRect.top - containerRect.top - headerHeight - centerOffset;
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      container.scrollTo({ top: Math.max(0, top), behavior });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedRowId, pageIndex, pageSize, sorting, globalFilter, safeTableData, isLoading_TableData]);


  // *** create the table **** //
  if (isLoading_TableData) {
    return <><div className="size-full p-2 relative flex flex-col">Loading...</div><LoadingSpinnerAnimation /></>;
  }
    return (
      <>     
      <div className="size-full p-2 relative flex flex-col">
      <div className="mb-2 flex justify-between gap-4">
          <DebouncedInput
            value={globalFilter ?? ""}
            onChange={(value) => setGlobalFilter(String(value))}
            placeholder={t?.rich('searchfield', {...t_richConfig})?.toString() || ''}
            disabled={!hasData}
            className={!hasData ? "opacity-50 cursor-not-allowed" : ""}
          />
          <Select
            value={String(table.state.pagination.pageSize)}
            onValueChange={(selectedValue) => {
              table.setPageSize(Number(selectedValue));
            }}
            disabled={!hasData}
          >
            <SelectTrigger className={`w-fit mr-1 ${!hasData ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <SelectValue
                className="text-text-foreground"
                placeholder="size"
              />
            </SelectTrigger>
            <SelectContent className="bg-surface-light text-text-foreground">
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <SelectItem
                  className="text-text-foreground"
                  key={pageSize}
                  value={String(pageSize)}
                >
                   {t?.rich('dropdown', {...t_richConfig})} {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
       
            <Table
              containerRef={scrollContainerRef}
              containerClassName="min-h-0 flex-auto rounded-lg border border-surface"
            >
              <TableHeader className="min-h-10 border-b sticky top-0 border-surface-default bg-surface-default text-sm text-text-dark">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                        
                      return (
                        <TableHead
                          key={header.id}
                          colSpan={header.colSpan}
                          className="px-2.5 py-2 text-start font-semibold hover:bg-gray-300 transition-colors"
                        >
                          <div title={metaData && !('error' in metaData) ? metaData[header.column.id]?.description : undefined} 
                            className={twMerge(
                              "flex items-center gap-2",
                               "cursor-pointer",
                            )}
                            onClick={() => {
                              if (header.column.getCanSort()) {
                                header.column.toggleSorting();
                              }
                            }}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            {{
                              asc: <NavArrowUp className="h-4 w-4 stroke-2" />,
                              desc: <NavArrowDown className="h-4 w-4 stroke-2" />,
                            }[header.column.getIsSorted() as string] ?? null}
                          </div>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
    
              <TableBody className="group text-sm border-surface-default bg-surface-light dark:text-white">
                {table.getRowModel().rows.map((row) => (
                    <tr
                    onMouseEnter={() => hasData && setRowHoverID(row.id)}
                    onMouseLeave={() => hasData && setRowHoverID(null)}
                    onClick={() => handleRowClick(row)}
                    key={row.id}
                    ref={row.getIsSelected() ? selectedRowRef : null}
                    className={`border-b border-surface last:border-0 ${
                      !hasData 
                      ? "cursor-not-allowed opacity-60"
                      : row.getIsSelected()
                      ? "bg-[#ffc46c] cursor-pointer"
                      : rowHoverID === row.id
                      ? "bg-primary-foreground cursor-pointer"
                      : "bg-secondary-light cursor-pointer"
                    } `}
                    >
                    {row.getVisibleCells().map((cell, idx) => (
                      <TableCell
                      key={idx}
                      className={`p-3 place-content-center text-${
                        typeof cell.renderValue() === "string"
                        ? "left"
                        : "center"
                      }`}
                      >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                      </TableCell>
                    ))}
                    </tr>
                ))}
              </TableBody>
            </Table>
         

          <div className="mt-2 flex flex-wrap justify-between gap-4">
            <span className="flex items-center gap-1 ">
              <div className="text-sm ml-1 text-text-foreground ">{t?.rich('page', {...t_richConfig})}</div>
              <div className="text-sm text-text-foreground ">
                {table.state.pagination.pageIndex + 1} {t?.rich('pageOf', {...t_richConfig})}{" "}
                {table.getPageCount().toLocaleString()}
              </div>
            </span>
            <div className="flex items-center mb-1 gap-2">
              <Button
                variant="outline"
                color="secondary"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                {t?.rich('button_previous', {...t_richConfig})}
              </Button>
              <Button
                className="text-text-default mr-1"
                variant="outline"
                color="secondary"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                {t?.rich('button_next', {...t_richConfig})}
              </Button>
            </div>
          </div>

       
      </div>
            </>
    ); 


  }   
 

/** Default export for the database-backed data table. */
export default DataTableComponent;

