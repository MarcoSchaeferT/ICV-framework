import React from "react";
import { dictStates_mapGermany, dictStates_TableGermany, dictStates_AbbrGermany, dbDATA } from "./const_store";


/**
 * A helper class for mapping German states to their respective IDs and vice versa.
 * This class provides methods to map state names to IDs and IDs to state names
 * for both map and table representations. Additionally, it includes methods to
 * map between the map and table representations.
 */
class stateMappersGermany {
  /********************
   *** Map Getters ***
   *********************/

  /**
   * Maps a state name to its corresponding ID in the map representation.
   * @param stateName - The name of the state.
   * @returns The ID of the state, or -1 if the state name is not found.
   */
  public static Map__State_to_ID(stateName: string): number {
    
    return dictStates_mapGermany[stateName] != undefined
      ? dictStates_mapGermany[stateName]
      : -1;
  }

  /**
   * Maps a state ID to its corresponding name in the map representation.
   * @param stateID - The ID of the state.
   * @returns The name of the state, or an empty string if the state ID is not found.
   */
  public static Map__ID_to_State(stateID: number): string {
    const stateName = Object.entries(dictStates_mapGermany).find(
      ([key, value]) => {
        if (value === stateID) {
          return key;
        }
      }
    );
    return stateName === undefined ? "" : stateName[0];
  }

  /********************
   *** Table Getters ***
   *********************/

  /**
   * Maps a state name to its corresponding ID in the table representation.
   * @param stateName - The name of the state.
   * @returns The ID of the state, or -1 if the state name is not found.
   */
  public static Table__State_to_ID(stateName: string): number {
    return dictStates_TableGermany[stateName] != undefined
      ? dictStates_TableGermany[stateName]
      : -1;
  }

  /**
   * Maps a state ID to its corresponding name in the table representation.
   * @param stateID - The ID of the state.
   * @returns The name of the state, or an empty string if the state ID is not found.
   */
  public static Table__ID_to_State(stateID: number): string {
    const stateName = Object.entries(dictStates_TableGermany).find(
      ([key, value]) => {
        if (value === stateID) {
          return key;
        }
      }
    );

    let result = stateName === undefined ? "" : stateName[0];
    console.log(result);
    return result;
  }

  /**
   * Maps a state name or ID to its 3-letter abbreviation.
   * @param state - The name or ID of the state.
   * @returns The 3-letter abbreviation of the state.
   */
  public static Table__State_to_Abbr(state: string | number): string {
    if (typeof state === "number" || (!isNaN(Number(state)) && typeof state === "string" && state.trim() !== "" && !dictStates_AbbrGermany[state])) {
      const stateName = this.Table__ID_to_State(Number(state));
      if (stateName && dictStates_AbbrGermany[stateName]) {
        return dictStates_AbbrGermany[stateName];
      }
    }
    const stateStr = String(state);
    return dictStates_AbbrGermany[stateStr] ?? stateStr;
  }

  /***************************
   *** Map to Table Mappers ***
   ****************************/

  /**
   * Maps a state ID from the map representation to its corresponding ID in the table representation.
   * @param stateID - The ID of the state in the map representation.
   * @returns The ID of the state in the table representation.
   */
  public static mapper__MapTable__ID_to_ID(stateID: number): number {
    const stateMap = this.Map__ID_to_State(stateID);
    const stateIDTable = this.Table__State_to_ID(stateMap);
    return stateIDTable;
  }

  /***************************
   *** Table to Map Mappers ***
   ****************************/

  /**
   * Maps a state ID from the table representation to its corresponding ID in the map representation.
   * @param stateID - The ID of the state in the table representation.
   * @returns The ID of the state in the map representation.
   */
  public static mapper__TableMap__ID_to_ID(stateID: number): number {
    const stateTable = this.Table__ID_to_State(stateID);
    const stateIDMap = this.Map__State_to_ID(stateTable);
    return stateIDMap;
  }
}

/**
 * Extracts a backend error only after a data request has finished.
 *
 * @param isLoading - Whether the associated request remains active.
 * @param data - Standard Flask response wrapper.
 * @returns The error string when available, otherwise `undefined`.
 */
function handleLoadDataError(isLoading: boolean, data: dbDATA): string | undefined {
  if (!isLoading && data && typeof data === "object") {
    const rawError = data.error;
    if (typeof rawError === "string" && rawError !== "" && rawError !== "false") {
      return rawError;
    }
  }
  return undefined;
}

/**
 * Displays unique errors collected from the data and metadata requests of one visualization.
 *
 * @param props - Error candidates and overlay positioning mode.
 * @returns A hidden container when no error remains, otherwise a visible error list.
 *
 * @remarks
 * Deduplication prevents the same shared backend failure from being repeated by several dependent loading operations.
 */
const PrintDataLoadingErrors = ({
  listOfErrors,
  position = "absolute",
}: {
  listOfErrors: any[];
  position?: "absolute" | "relative";
}) => {

  // remove duplicate errors and undefined values
  const uniqueErrors = [...new Set(listOfErrors.filter(e => e !== undefined && e !== null && e !== ""))];
  return (
    <div
      className={`${position} bottom-0 left-0 m-2 p-2.5 border border-red-300 rounded-lg bg-white/95 backdrop-blur-sm shadow-lg max-h-60 max-w-[calc(100%-1rem)] overflow-x-auto overflow-y-auto z-10000 flex flex-col gap-2 ${
      uniqueErrors.length > 0 ? "" : "hidden"
      }`}
    >
      {uniqueErrors.map((error, index) => (
        <div
          key={index}
          className="flex items-start gap-2 p-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 shadow-xs"
        >
          <span className="text-red-500 shrink-0 select-none font-semibold" aria-hidden="true">
            ⚠️
          </span>
          <div className="flex-1 whitespace-pre-wrap break-words min-w-0">
            {typeof error === "string" ? error : React.isValidElement(error) ? error : String(error)}
          </div>
        </div>
      ))}
    </div>
  );
};

/** Default export for German state identifier translation across linked map and table views. */
export default stateMappersGermany;
/** Public loading-error extraction and presentation helpers. */
export { handleLoadDataError, PrintDataLoadingErrors };
