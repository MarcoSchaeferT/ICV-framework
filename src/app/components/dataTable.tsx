"use client";

import * as React from "react";
import { useState, useEffect, useRef, useMemo } from "react";
import  CovidDataStates from "./dataTableClasses/CovidDataStates";
import type { interfaceContextI } from "./contexts/InterfaceContext";
import {
  FilterFn,
  ColumnDef,
  flexRender,
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFacetedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getFacetedMinMaxValues,
  getFacetedUniqueValues,
  RowSelectionState,
  Row,
  SortingState,
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
  EditPencil,
  EyeSolid,
  MoreHorizCircle,
  NavArrowDown,
  NavArrowUp,
  Search,
  Bin,
} from "iconoir-react";
import { twMerge } from "tailwind-merge";
import { rankItem, RankingInfo } from "@tanstack/match-sorter-utils";
import { useInterfaceContext } from "./contexts/InterfaceContext";
import { CardPropsClass } from './layout/cardWrapper';

import {
  metaDataT,
  alignFeature_to_Metadata,
} from '../components/plots/metaDataHandler';
import { apiRoutes } from "../api_routes";
import { useLocale ,useTranslations } from "next-intl";
import { t_richConfig, dbDATA } from "../const_store";
import { Locale } from '@/i18n/routing';
import { useGetJSONData } from "../hooks/customFetchAndCache";
import { LoadingSpinner } from "./plots/maps/helpers";

// Stable references to prevent re-render loops
const EMPTY_ARRAY: any[] = [];
const NO_DATA_FALLBACK: any[] = [{ no_data: "" }];

// define the values and types for the DataTableComponent
export interface dataTableComponentT {
  refDataTableClass: any,
  cardProps: CardPropsClass,
  onClickEvent?: (row: Row<unknown>, key: number, context: interfaceContextI) => void,
};



declare module "@tanstack/react-table" {
  interface FilterFns {
    fuzzy: FilterFn<unknown>;
  }
  interface FilterMeta {
    itemRank: RankingInfo;
  }
}

/***************************
****** FILTER FUNCTION *****
****************************/
// the search field filter function
function fuzzyFilter(row: any, columnId: string, value: any, addMeta: any) {
  const itemRank = rankItem(row.getValue(columnId), value);

  addMeta({ itemRank });

  return itemRank.passed;
}



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
  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  /*
  React.useEffect(() => {
    setValue(dictStates[c.selectedStateID]);
  }, [c.selectedStateID]);
  */

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


/********************************
****** DATA TABLE COMPONENT *****
*********************************

@params refDataClass: dataTypeClass (reference to dataTableClass)
*/
const DataTableComponent = ({ cardProps, refDataTableClass, onClickEvent }: dataTableComponentT) => {

  // activate dataTableContext
  let dataTableCONTEXT = useInterfaceContext();

  // create a new instance of the class
  const DataTableObject = useMemo(() => new refDataTableClass, [refDataTableClass]);

  // get current locale/language
  const locale = useLocale() as Locale;
  const t = useTranslations("component_dataTable");


  // state variables and setters
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [rowHoverID, setRowHoverID] = useState<number>(-1);

  const [rowSelectID, setRowSelectID] = useState<number>(-1);
  const [onTableName, setOnTableName] = useState<string>(DataTableObject.getTableName());

  const [sorting, setSorting] = useState<SortingState>([]) // can set initial sorting state here


  // data loading
  const [isLoading_TableData, rawTableData] = useGetJSONData(DataTableObject.getURL());
  const [isLoading_Metadata, rawMetaData] = useGetJSONData(apiRoutes.getDatasetsMetadata({ LANGID: locale }));
  
  const tableName: string = DataTableObject.getTableName();
  
  // *** SAFEGUARD 1: Default to empty object if rawTableData is null/undefined ***
  const tableData = (rawTableData || {}) as dbDATA;
  const metaData = (rawMetaData || {}) as unknown as metaDataT;

  // *** SAFEGUARD 2: Extract response array safely ***
  
  const responseArray = tableData.response;
  const safeTableData = useMemo(() => 
    Array.isArray(responseArray) && responseArray.length > 0 
      ? responseArray 
      : EMPTY_ARRAY,
    [responseArray]
  );
  const hasData = safeTableData.length > 0;

  // get the table columns from the class
  const columns: ColumnDef<unknown, any>[] = useMemo(() => {
    const columnDefs: ColumnDef<unknown, any>[] = [];

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

    // *** SAFEGUARD 4: Only access index [0] if we know it exists (checked by hasData) ***
    Object.keys(safeTableData[0]).forEach((key) => {
      if (!key.startsWith("_") && !key.includes("geometry") && key !== "id") {
        columnDefs.push({
          header: key,
          accessorKey: key,
          cell: (info) => info.getValue(),
        });
      }
    });
    return columnDefs;
  }, [isLoading_TableData, safeTableData, hasData]);



  // ToDo: pass data specific OnClick function to DataTableComponent
  function SetOnClickEvents(row: Row<unknown>, id: number) {
    if(!hasData) return; // Prevent clicking on "No Data" row
    
    // call the passed onClickEvent function
    onClickEvent && onClickEvent(row, id, dataTableCONTEXT);
    dataTableCONTEXT.setTableName(DataTableObject.getTableName());
    setOnTableName(DataTableObject.getTableName());
  }

  // *** setup table config **** //
  const table = useReactTable({
    // *** SAFEGUARD 5: Ensure data matches the fallback column ***

    data: hasData ? safeTableData : NO_DATA_FALLBACK, 
    columns,
    filterFns: {
      fuzzy: fuzzyFilter,
    },
    enableMultiRowSelection: false,
    state: {
      globalFilter,
      sorting,
    },
    initialState: {
      pagination: {
        pageIndex: 0, //custom initial page index
        pageSize: 20, //custom default page size
      },
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: fuzzyFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    debugTable: false,
    debugHeaders: false,
    debugColumns: false,
  });


  // consume changes from the DataTableContext
  // set the selected row for local context
  // Track if component is mounted to prevent state updates during navigation
  const isMounted = useRef(false);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!isMounted.current) return; // Skip on initial mount during page transition
    if (
      dataTableCONTEXT.selectedTableName === DataTableObject.getTableName() &&
      dataTableCONTEXT.selectedTableRowID != -1
    ) {
      setRowSelectID(dataTableCONTEXT.selectedTableRowID);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataTableCONTEXT.selectedTableRowID, dataTableCONTEXT.selectedTableName]);


  // *** APPLY EXTERNAL SELECTIONS TO TABLE **** //
  // when selectedStateID changes, update the selected row in the table
  
  const selectedStateID = dataTableCONTEXT.selectedStateID;
  useEffect(() => {
    if(!hasData || !isMounted.current) return;
    if(selectedStateID === -1) return; // no selection — nothing to sync
    
    const sortedRows = table.getSortedRowModel().rows;

    const stateName = CovidDataStates.mapperFunctions.Map__ID_to_State(selectedStateID);
    // Use optional chaining for safety
    const matchingRow = sortedRows.findIndex(row => (row.original as any)?.bundesland === stateName)
    const pageSize = table.getState().pagination.pageSize;
    const curPage = Math.floor(matchingRow / pageSize);
    const curPageRow= matchingRow % pageSize;
    console.log("matchingRow for state", stateName, "is", matchingRow, curPageRow);
    
    if (matchingRow !== -1) {
      setRowSelectID(curPageRow);
      // Navigate to the correct page
      table.setPageIndex(curPage);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStateID, sorting, hasData, safeTableData.length]);


  // *** create the table **** //
  if (isLoading_TableData) {
    
    return <><div className="size-full p-2 relative flex flex-col">Loading...</div><LoadingSpinner /></>;
   
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
            value={String(table.getState().pagination.pageSize)}
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
       
          <div className={`size-full flex-col flex overflow-auto rounded-lg border border-surface" id="tableHere`}>
            <Table className=" ">
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
    
              <TableBody className="group flex-1 min-h-0 size-full text-sm border-surface-default bg-surface-light dark:text-white">
                {table.getRowModel().rows.map((row, key) => (
                    <tr
                    onMouseEnter={() => hasData && setRowHoverID(key)}
                    onMouseLeave={() => hasData && setRowHoverID(-1)}
                    onClick={() => SetOnClickEvents(row, key)}
                    key={key}
                    className={`border-b border-surface last:border-0 ${
                      !hasData 
                      ? "cursor-not-allowed opacity-60"
                      : rowSelectID == key && onTableName === tableName
                      ? "bg-[#ffc46c] cursor-pointer"
                      : rowHoverID == key
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
            </div> 
         

          <div className="mt-2 flex flex-wrap justify-between gap-4">
            <span className="flex items-center gap-1 ">
              <div className="text-sm ml-1 text-text-foreground ">{t?.rich('page', {...t_richConfig})}</div>
              <div className="text-sm text-text-foreground ">
                {table.getState().pagination.pageIndex + 1} {t?.rich('pageOf', {...t_richConfig})}{" "}
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
 

  export default DataTableComponent;

