"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiRoutes } from "@/app/api_routes";
import { useUIContext } from "@/components/contexts/UIContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
/**
 * Editable localized scientific metadata for one database column.
 *
 * @example
 * ```ts
 * const metadata: ColumnMeta = {
 *   columnName: "mosquito_amount",
 *   datatype: "int",
 *   dimension: "observations",
 *   description: "Aedes albopictus observations",
 *   availability: 1,
 * };
 * ```
 */
interface ColumnMeta {
  /** Database column identifier. */
  columnName: string;
  /** Backend datatype name. */
  datatype: string;
  /** Physical or count unit displayed with the field. */
  dimension: string;
  /** Localized explanation of the field. */
  description: string;
  /** Backend availability marker for the column. */
  availability: number;
}

const DATATYPE_OPTIONS = ["string", "float", "int", "date"];

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */
/**
 * Renders the localized editor for per-relation, per-language column metadata.
 *
 * @returns Relation and language selectors plus editable metadata records.
 *
 * @remarks
 * Database mutations are disabled in demo mode and instead open the deployment restriction dialog.
 */
export default function MetadataEditorPage() {
  const t = useTranslations("page_metadata");
  const locale = useLocale();
  const { setIsDemoModeDialogOpen, demoMode, configReady } = useUIContext();

  // ── state ──────────────────────────────────────────────────────────
  const [relations, setRelations] = useState<string[]>([]);
  const [selectedRelation, setSelectedRelation] = useState("");
  const [lang, setLang] = useState<"en" | "de">(locale === "de" ? "de" : "en");
  const [rows, setRows] = useState<ColumnMeta[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);


  // ── load relations list ────────────────────────────────────────────
  useEffect(() => {
    fetch(apiRoutes.GET_LIST_OF_DATASETS)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          throw new Error(data?.error || `HTTP ${r.status}`);
        }
        return data;
      })
      .then((data) => {
        if (data && typeof data === "object") {
          const names = Object.keys(data).filter(
            (n) => n !== "User" && n !== "Test" && !n.startsWith("column_metadata_")
          );
          setRelations(names.sort());
        }
      })
      .catch((err) => {
        console.error(err);
        setFeedback({ type: "error", msg: err instanceof Error ? err.message : "Failed to load datasets" });
      });
  }, []);

  // ── build rows from DB columns + saved metadata ───────────────────
  const buildRows = useCallback(
    (dbCols: string[], savedMeta: ColumnMeta[]) => {
      const savedMap = new Map(savedMeta.map((m) => [m.columnName, m]));

      const result: ColumnMeta[] = dbCols.map((col) => {
        const saved = savedMap.get(col);
        if (saved) return saved;

        // Fallback for columns without saved metadata
        return {
          columnName: col,
          datatype: "string",
          dimension: "",
          description: "",
          availability: 0,
        };
      });

      setRows(result);
    },
    []
  );

  // ── load metadata + columns when relation or lang changes ─────────
  useEffect(() => {
    if (!selectedRelation) return;
    const controller = new AbortController();

    const fetchAll = async () => {
      try {
        setFeedback(null);
        // Fetch column names for the relation
        const colsRes = await fetch(
          apiRoutes.fetchDbColumnNames({ relationName: selectedRelation }),
          { signal: controller.signal }
        );
        const allCols: any = await colsRes.json();
        if (!colsRes.ok || !Array.isArray(allCols)) {
          const errDetail = allCols?.error || `Failed to fetch columns (HTTP ${colsRes.status})`;
          throw new Error(errDetail);
        }
        const dbCols = allCols.filter((c: string) => c !== "id");

        // Fetch existing saved metadata
        const metaRes = await fetch(
          apiRoutes.columnMetadata({ relationName: selectedRelation, lang: lang as "en" | "de" }),
          { signal: controller.signal }
        );
        const metaData: any = await metaRes.json();
        if (!metaRes.ok || !Array.isArray(metaData)) {
          const errDetail = metaData?.error || `Failed to fetch column metadata (HTTP ${metaRes.status})`;
          throw new Error(errDetail);
        }
        const savedMeta: ColumnMeta[] = Array.isArray(metaData)
          ? metaData.map((d) => ({
              columnName: d.column_name,
              datatype: d.datatype,
              dimension: d.dimension ?? "",
              description: d.description ?? "",
              availability: d.availability ?? 0,
            }))
          : [];

        if (!controller.signal.aborted) buildRows(dbCols, savedMeta);
      } catch (e: any) {
        if (!controller.signal.aborted) {
          console.error(e);
          setFeedback({ type: "error", msg: e instanceof Error ? e.message : String(e) });
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void fetchAll();
    return () => controller.abort();
  }, [selectedRelation, lang, buildRows]);

  // ── update a single field ──────────────────────────────────────────
  const updateRow = (idx: number, field: keyof ColumnMeta, value: string | number) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  // ── save all ───────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!configReady) return;
    if (demoMode) {
      setIsDemoModeDialogOpen(true);
      return;
    }
    if (!selectedRelation) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(apiRoutes.COLUMN_METADATA, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lang,
          relationName: selectedRelation,
          columns: rows,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: "success", msg: t("saveSuccess") });
      } else {
        setFeedback({ type: "error", msg: data.error || t("saveError") });
      }
    } catch (e: any) {
      setFeedback({ type: "error", msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */
  return (
    <div className="min-h-[75vh] bg-gray-100 p-6">
      <div className="mx-auto max-w-6xl rounded-lg bg-white p-6 shadow-lg md:p-8">
        <h1 className="mb-6 text-2xl font-bold">{t("heading")}</h1>

        {/* ── Toolbar: relation + language selectors ─────────────── */}
        <div className="mb-6 flex flex-wrap items-end gap-4">
          {/* Relation */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600">{t("relation")}</label>
            <Select value={selectedRelation} onValueChange={(value) => {
              setSelectedRelation(value);
              setLoading(true);
              setFeedback(null);
            }}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder={t("selectRelation")} />
              </SelectTrigger>
              <SelectContent>
                {relations.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Language */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600">{t("language")}</label>
            <Select value={lang} onValueChange={(value) => {
              setLang(value as "en" | "de");
              if (selectedRelation) {
                setLoading(true);
                setFeedback(null);
              }
            }}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Save */}
          <Button onClick={handleSave} disabled={!configReady || !selectedRelation || saving}>
            {saving ? t("saving") : t("save")}
          </Button>
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            className={`mb-4 rounded-md p-3 text-sm ${
              feedback.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {feedback.msg}
          </div>
        )}

        {/* ── Table ─────────────────────────────────────────────── */}
        {selectedRelation ? (
          loading ? (
            <p className="text-center text-sm text-gray-400">{t("loading")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-gray-600">
                    <th className="px-3 py-2 font-medium">{t("columnName")}</th>
                    <th className="px-3 py-2 font-medium">{t("datatype")}</th>
                    <th className="px-3 py-2 font-medium">{t("dimension")}</th>
                    <th className="px-3 py-2 font-medium">{t("description")}</th>
                    <th className="px-3 py-2 font-medium text-center">{t("availability")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.columnName} className="border-b hover:bg-gray-50/80 transition-colors">
                      {/* Column name (read-only, from DB) */}
                      <td className="px-3 py-2">
                        <span className="inline-block rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700">
                          {row.columnName}
                        </span>
                      </td>

                      {/* Datatype */}
                      <td className="px-3 py-2">
                        <Select value={row.datatype} onValueChange={(v) => updateRow(idx, "datatype", v)}>
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DATATYPE_OPTIONS.map((dt) => (
                              <SelectItem key={dt} value={dt}>
                                {dt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Dimension */}
                      <td className="px-3 py-2">
                        <Input
                          value={row.dimension}
                          onChange={(e) => updateRow(idx, "dimension", e.target.value)}
                          className="w-28"
                        />
                      </td>

                      {/* Description */}
                      <td className="px-3 py-2">
                        <Textarea
                          value={row.description}
                          onChange={(e) => updateRow(idx, "description", e.target.value)}
                          className="resize-y w-full min-w-50"
                        />
                      </td>

                      {/* Availability */}
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.availability === 1}
                          onChange={(e) => updateRow(idx, "availability", e.target.checked ? 1 : 0)}
                          className="h-4 w-4 accent-purple-700"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && (
                <p className="mt-4 text-center text-sm text-gray-400">
                  {t("noColumns")}
                </p>
              )}
            </div>
          )
        ) : (
          <p className="text-center text-gray-400">{t("selectRelationPrompt")}</p>
        )}
      </div>
    </div>
  );
}
