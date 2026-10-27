import stateMappersGermany from "@/app/helpers";

/** PostgreSQL relation containing the state-level RKI snapshots. */
export const COVID_STATES_RELATION = "aktuell_deutschland_sarscov2_infektionen_aggregated";

/** Resolve a database state record to the feature index of the Germany map. */
export function getCovidStateMapId(record: Record<string, unknown>): number {
  const code = record.idbundesland ?? record.IdBundesland;
  const stateCode = Number(code);
  if (code != null && code !== "" && Number.isInteger(stateCode) && stateCode >= 1 && stateCode <= 16) {
    return stateMappersGermany.mapper__TableMap__ID_to_ID(stateCode);
  }

  const name = record.bundesland ?? record.Bundesland;
  return typeof name === "string" ? stateMappersGermany.Map__State_to_ID(name) : -1;
}
