"use client";

import { useState } from "react";
import { apiRoutes } from "../../api_routes";

export default function AssignCountriesPage() {
  const [tableName, setTableName] = useState("");
  const [reprocessAll, setReprocessAll] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleProcess = async () => {
    if (!tableName.trim()) return;
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch(apiRoutes.ASSIGN_COUNTRIES_TO_DATASET, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tableName: tableName.trim(), reprocessAll }),
      });

      const data = await response.json();
      setResult({ status: response.status, data });
    } catch (error: any) {
      setResult({ status: "error", message: error.message || "An unknown error occurred" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 bg-gradient-to-br from-indigo-900/50 to-slate-900 flex items-center justify-center p-6 text-white font-sans">
      <div className="w-full max-w-lg bg-white/10 backdrop-blur-lg rounded-3xl border border-white/10 shadow-2xl p-8 transition-all duration-300 ease-in-out hover:shadow-[0_0_40px_rgba(59,130,246,0.3)]">
        <h1 className="text-3xl font-extrabold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
          Assign Countries
        </h1>
        <p className="text-sm text-slate-300 mb-8 leading-relaxed">
          Enter the name of the database table to trigger spatial assignment. The process assigns ISO codes to points based on their geometric location (geo_pos).
        </p>

        <div className="space-y-6">
          <div className="flex flex-col group">
            <label className="text-sm font-semibold mb-2 text-slate-300 group-focus-within:text-blue-400 transition-colors" htmlFor="tableName">
              Table Name
            </label>
            <input
              id="tableName"
              type="text"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="e.g. dataset_table_name"
              className="bg-slate-800/60 border border-slate-700/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 outline-none rounded-xl px-4 py-3.5 text-white placeholder:text-slate-500 transition-all duration-300 shadow-inner"
            />
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
                <span className="tracking-wide">Process Table</span>
              )}
            </div>
          </button>
        </div>

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
