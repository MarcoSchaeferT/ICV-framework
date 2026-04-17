"use client";

import { useEffect, useState, useCallback } from "react";
import { apiRoutes } from "@/app/api_routes";
import { useUIContext } from "@/app/components/contexts/UIContext";

interface Relation {
  table_name: string;
  row_count: number;
}

export default function ManageDBPage() {
  const { setIsDemoModeDialogOpen, demoMode } = useUIContext();
  const [relations, setRelations] = useState<Relation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string | null>(null);

  /* ───────── Fetch relations ───────── */
  const fetchRelations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiRoutes.MANAGE_DB);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Relation[] = await res.json();
      setRelations(data);
    } catch (e: any) {
      setError(e.message ?? "Failed to fetch relations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRelations();
  }, [fetchRelations]);

  /* ───────── Delete handler ───────── */
  const handleDelete = async (name: string) => {
    if (demoMode) {
      setIsDemoModeDialogOpen(true);
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete the table "${name}"?\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingName(name);
    try {
      const res = await fetch(
        apiRoutes.manageDbRelation({ relationName: name }),
        { method: "DELETE" }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      // Refresh the list after successful deletion
      await fetchRelations();
    } catch (e: any) {
      alert(`Delete failed: ${e.message}`);
    } finally {
      setDeletingName(null);
    }
  };

  /* ───────── Render ───────── */
  return (
    <div className="min-h-[80vh] flex flex-col items-center bg-gray-50 p-6 pt-12">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            Manage Database
          </h1>
          <p className="mt-2 text-gray-500">
            View and manage database relations. Protected system tables are
            hidden.
          </p>
        </div>

        {/* Reload button */}
        <div className="mb-4 flex justify-end">
          <button
            onClick={fetchRelations}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-xs uppercase tracking-wider text-gray-600">
              <tr>
                <th className="px-6 py-3">Table Name</th>
                <th className="px-6 py-3 text-right">≈ Row Count</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && relations.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-gray-400">
                    Loading relations…
                  </td>
                </tr>
              ) : relations.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-gray-400">
                    No relations found.
                  </td>
                </tr>
              ) : (
                relations.map((rel) => (
                  <tr
                    key={rel.table_name}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-gray-800">
                      {rel.table_name}
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums text-gray-600">
                      {rel.row_count.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(rel.table_name)}
                        disabled={deletingName === rel.table_name}
                        className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        {deletingName === rel.table_name
                          ? "Deleting…"
                          : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer note */}
        <p className="mt-4 text-xs text-gray-400">
          Row counts are approximate (based on PostgreSQL statistics). Protected
          system tables are not shown.
        </p>
      </div>
    </div>
  );
}
