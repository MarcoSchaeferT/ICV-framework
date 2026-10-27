import { apiRoutes } from "./api_routes";

/**
 * JSON fields accepted by the RKI state-aggregation `POST /api/processData/aggregateRKI` command.
 *
 * @example
 * ```ts
 * import type { RkiAggregationCommand } from "@/framework";
 *
 * const command: RkiAggregationCommand = {
 *   sourceTable: "aktuell_deutschland_sarscov2_infektionen",
 *   targetDate: "2022-02-14",
 * };
 * ```
 */
export interface RkiAggregationCommand {
    /** Raw relation; defaults to the standard RKI infection dataset (`"aktuell_deutschland_sarscov2_infektionen"`). */
    sourceTable?: string;
    /** Destination relation; defaults to `sourceTable` with `_aggregated` appended. */
    targetTable?: string;
    /** Report date in YYYY-MM-DD format; defaults to the latest source date. */
    targetDate?: string;
}

/**
 * Triggers backend aggregation of district-level RKI SARS-CoV-2 infection data into a state-level snapshot table.
 *
 * @param command - Optional source relation, target relation, and report date overrides.
 * @returns A promise that resolves once the aggregated table is ready, or rejects with an `Error` on HTTP failure.
 *
 * @remarks
 * Posts `command` to `/api/processData/aggregateRKI`, which populates or updates the target relation and invalidates
 * cached responses for that table.
 */
export async function aggregateRKI(command: RkiAggregationCommand = {}): Promise<void> {
    const response = await fetch(apiRoutes.AGGREGATE_RKI, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
    });
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok) {
        const message = result && typeof result === "object" && "error" in result
            && typeof result.error === "string"
            ? result.error
            : `RKI aggregation failed (HTTP ${response.status}).`;
        throw new Error(message);
    }
}
