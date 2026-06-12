"use client";

import { useState, useEffect } from "react";
import { apiRoutes } from "@/app/api_routes";

export default function AssignCountriesPage() {
  const [tableName, setTableName] = useState("");
  const [reprocessAll, setReprocessAll] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  interface TableInfo {
    name: string;
    hasIsoA3: boolean;
  }

  interface QueueItem {
    name: string;
    status: "pending" | "processing" | "completed" | "error";
    message?: string;
    updatedRows?: number;
  }

  // ── Eligible tables (those with a geometry column like geo_pos) ────
  const [eligibleTables, setEligibleTables] = useState<TableInfo[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(true);
  const [progress, setProgress] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const loadEligibleTables = async (signal?: AbortSignal) => {
    setIsLoadingTables(true);
    try {
      // 1. Fetch all relations
      const listRes = await fetch(apiRoutes.GET_LIST_OF_DATASETS, { signal });
      const listData = await listRes.json();
      const allNames: string[] = Object.keys(listData).filter(
        (n) => n !== "User" && n !== "Test" && !n.startsWith("column_metadata_")
      );

      // 2. For each relation, check if it has a geometry column
      const checks = await Promise.all(
        allNames.map(async (name) => {
          try {
            const colRes = await fetch(
              apiRoutes.fetchDbColumnNames({ relationName: name }),
              { signal }
            );
            const cols: string[] = await colRes.json();
            // Keep tables that have geo_pos or geometry column
            const hasGeometry = cols.some((c) => c === "geometry");
            const hasIsoA3 = cols.some((c) => c === "iso_a3");
            return hasGeometry ? { name, hasIsoA3 } : null;
          } catch {
            return null;
          }
        })
      );

      const filtered = (checks.filter(Boolean) as TableInfo[]).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      setEligibleTables(filtered);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Failed to load eligible tables:", err);
      }
    } finally {
      setIsLoadingTables(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadEligibleTables(controller.signal);
    return () => {
      controller.abort();
    };
  }, []);

  const handleProcess = async () => {
    if (!tableName.trim()) return;
    setIsLoading(true);
    setResult(null);
    setProgress(null);

    const missingTables = eligibleTables.filter((t) => !t.hasIsoA3).map((t) => t.name);
    const tablesToProcess =
      tableName === "all_missing_iso_a3"
        ? (missingTables.length > 0 ? missingTables : eligibleTables.map((t) => t.name))
        : [tableName];

    if (tablesToProcess.length === 0) {
      setResult({ status: "error", message: "No tables to process" });
      setIsLoading(false);
      return;
    }

    const initialQueue: QueueItem[] = tablesToProcess.map((name) => ({
      name,
      status: "pending",
    }));
    setQueue(initialQueue);

    try {
      const resultsList: any[] = [];
      let hasError = false;

      for (let i = 0; i < tablesToProcess.length; i++) {
        const currentTable = tablesToProcess[i];
        
        setQueue((prev) =>
          prev.map((item) =>
            item.name === currentTable ? { ...item, status: "processing" } : item
          )
        );

        if (tablesToProcess.length > 1) {
          setProgress(`Processing table ${i + 1} of ${tablesToProcess.length}: ${currentTable}...`);
        } else {
          setProgress(`Processing ${currentTable}...`);
        }

        try {
          const response = await fetch(apiRoutes.ASSIGN_COUNTRIES_TO_DATASET, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ tableName: currentTable, reprocessAll }),
          });

          const data = await response.json();
          resultsList.push({
            tableName: currentTable,
            status: response.status,
            data,
          });

          if (response.status === 200) {
            setQueue((prev) =>
              prev.map((item) =>
                item.name === currentTable
                  ? {
                      ...item,
                      status: "completed",
                      updatedRows: data.updatedRows,
                      message: data.message,
                    }
                  : item
              )
            );
          } else {
            hasError = true;
            setQueue((prev) =>
              prev.map((item) =>
                item.name === currentTable
                  ? {
                      ...item,
                      status: "error",
                      message: data.error || "Failed to process",
                    }
                  : item
              )
            );
          }
        } catch (err: any) {
          hasError = true;
          resultsList.push({
            tableName: currentTable,
            status: "error",
            message: err.message,
          });
          setQueue((prev) =>
            prev.map((item) =>
              item.name === currentTable
                ? {
                    ...item,
                    status: "error",
                    message: err.message || "Network error",
                  }
                : item
            )
          );
        }
      }

      setResult({
        status: hasError ? 500 : 200,
        data: tablesToProcess.length === 1 ? resultsList[0].data : resultsList,
      });

      // Reload tables to refresh their state
      await loadEligibleTables();

      if (tableName === "all_missing_iso_a3") {
        setTableName("");
      }
    } catch (error: any) {
      setResult({ status: "error", message: error.message || "An unknown error occurred" });
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 bg-gradient-to-br from-indigo-900/50 to-slate-900 flex items-center justify-center p-6 text-white font-sans">
      <div className="w-full max-w-lg bg-white/10 backdrop-blur-lg rounded-3xl border border-white/10 shadow-2xl p-8 transition-all duration-300 ease-in-out hover:shadow-[0_0_40px_rgba(59,130,246,0.3)]">
        <h1 className="text-3xl font-extrabold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
          Assign Countries
        </h1>
        <p className="text-sm text-slate-300 mb-8 leading-relaxed">
          Select a database table to trigger spatial assignment. Only tables with a geometry column are shown. The process assigns ISO codes to points based on their geometric location.
        </p>

        <div className="space-y-6">
          <div className="flex flex-col group">
            <label className="text-sm font-semibold mb-2 text-slate-300 group-focus-within:text-blue-400 transition-colors" htmlFor="tableName">
              Table Name
            </label>

            {isLoadingTables ? (
              <div className="flex items-center space-x-2 bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3.5">
                <svg className="animate-spin h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm text-slate-400">Loading tables…</span>
              </div>
            ) : eligibleTables.length === 0 ? (
              <div className="bg-slate-800/60 border border-amber-600/40 rounded-xl px-4 py-3.5 text-sm text-amber-400">
                No tables with a geometry column found.
              </div>
            ) : (
              <select
                id="tableName"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                className="bg-slate-800/60 border border-slate-700/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 outline-none rounded-xl px-4 py-3.5 text-white transition-all duration-300 shadow-inner appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8.825a.5.5 0 01-.354-.146l-4-4a.5.5 0 01.708-.708L6 7.617l3.646-3.646a.5.5 0 01.708.708l-4 4a.5.5 0 01-.354.146z'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 1rem center",
                  paddingRight: "2.5rem",
                }}
              >
                <option value="" disabled className="bg-slate-800 text-slate-400">
                  — Select a table —
                </option>
                <option value="all_missing_iso_a3" className="bg-slate-800 text-amber-400 font-semibold">
                  ★ All tables {eligibleTables.some((t) => !t.hasIsoA3) ? "with missing iso_a3" : ""} ★
                </option>
                {eligibleTables.map((table) => (
                  <option key={table.name} value={table.name} className="bg-slate-800 text-white">
                    {table.name} {!table.hasIsoA3 ? " (missing iso_a3)" : ""}
                  </option>
                ))}
              </select>
            )}

            {!isLoadingTables && eligibleTables.length > 0 && (
              <span className="text-xs text-slate-500 mt-1.5">
                {eligibleTables.length} table{eligibleTables.length !== 1 ? "s" : ""} with geometry column
                {eligibleTables.some((t) => !t.hasIsoA3) && (
                  <> ({eligibleTables.filter((t) => !t.hasIsoA3).length} missing iso_a3)</>
                )}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/30">
            <input
              id="reprocessAll"
              type="checkbox"
              checked={reprocessAll}
              onChange={(e) => setReprocessAll(e.target.checked)}
              className="w-5 h-5 rounded border-slate-600 text-blue-500 focus:ring-blue-500 bg-slate-800/50 cursor-pointer form-checkbox"
            />
            <label htmlFor="reprocessAll" className="text-sm text-slate-300 cursor-pointer select-none font-medium">
              Reprocess All Rows (Overwrite Existing)
            </label>
          </div>

          {progress && isLoading && (
            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-400 font-medium flex items-center space-x-2.5 animate-pulse">
              <svg className="animate-spin h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{progress}</span>
            </div>
          )}

          <button
            onClick={handleProcess}
            disabled={isLoading || !tableName.trim()}
            className="w-full relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed transition-all duration-300 px-4 py-4 font-semibold shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] disabled:shadow-none"
          >
            <div className="flex items-center justify-center space-x-3">
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="tracking-wide">Processing...</span>
                </>
              ) : (
                <span className="tracking-wide">
                  {tableName === "all_missing_iso_a3"
                    ? (eligibleTables.some((t) => !t.hasIsoA3) ? "Process All Missing Tables" : "Process All Tables")
                    : "Process Table"}
                </span>
              )}
            </div>
          </button>
        </div>

        {queue.length > 0 && (
          <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center">
                <span className="bg-slate-700/60 px-2.5 py-1 rounded-md mr-2 text-xs">Queue</span>
                <span>Processing Status</span>
              </h2>
              {isLoading && (
                <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full font-medium animate-pulse">
                  Running
                </span>
              )}
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {queue.map((item) => (
                <div
                  key={item.name}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${
                    item.status === "processing"
                      ? "bg-blue-500/10 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)] animate-pulse"
                      : item.status === "completed"
                      ? "bg-emerald-500/5 border-emerald-500/20"
                      : item.status === "error"
                      ? "bg-rose-500/5 border-rose-500/20"
                      : "bg-slate-800/40 border-slate-700/30 opacity-60"
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-4">
                    <span className="text-sm font-semibold text-white truncate">
                      {item.name}
                    </span>
                    {item.status === "completed" && (
                      <span className="text-xs text-emerald-400/80 mt-0.5 font-medium animate-in fade-in">
                        Updated {item.updatedRows ?? 0} rows
                      </span>
                    )}
                    {item.status === "error" && (
                      <span className="text-xs text-rose-400/80 mt-0.5 truncate font-medium animate-in fade-in">
                        {item.message || "Error processing table"}
                      </span>
                    )}
                    {item.status === "processing" && (
                      <span className="text-xs text-blue-400/80 mt-0.5 font-medium animate-pulse">
                        Geo-matching locations...
                      </span>
                    )}
                    {item.status === "pending" && (
                      <span className="text-xs text-slate-500 mt-0.5 font-medium">
                        Queued
                      </span>
                    )}
                  </div>

                  <div className="flex-shrink-0">
                    {item.status === "completed" && (
                      <div className="h-6 w-6 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30">
                        <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    {item.status === "error" && (
                      <div className="h-6 w-6 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/30">
                        <svg className="h-3.5 w-3.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    )}
                    {item.status === "processing" && (
                      <div className="h-6 w-6 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/30">
                        <svg className="animate-spin h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                    )}
                    {item.status === "pending" && (
                      <div className="h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700/50">
                        <svg className="h-3 w-3 text-slate-500" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="4" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider flex items-center">
              <span className="bg-slate-700 px-2 py-1 rounded-md mr-2">Result</span>
            </h2>
            <div className="bg-[#0f172a] rounded-xl p-5 overflow-x-auto border border-white/5 shadow-inner">
              <pre className={`text-sm font-mono whitespace-pre-wrap ${result.status === 200 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
