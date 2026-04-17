import { dictStates_mapGermany, dictStates_TableGermany, dbDATA, IS_DEMO_MODE } from "./const_store";

/**
 * Checks if the application is in demo mode.
 * 
 * @returns {boolean} True if in demo mode, false otherwise.
 */
export function checkDemoMode(): boolean {
  return IS_DEMO_MODE;
}


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

  /***************************
   *** Map to Table Mappers ***
   ****************************/

  /**
   * Maps a state name to its corresponding ID in the table representation using the map representation.
   * @param stateName - The name of the state.
   * @returns The ID of the state, or -1 if the state name is not found.
   */
  public static mapper__MapTable__State_to_ID(stateName: string): number {
    return dictStates_TableGermany[stateName] != undefined
      ? dictStates_TableGermany[stateName]
      : -1;
  }

  /**
   * Maps a state ID to its corresponding name in the map representation.
   * @param stateID - The ID of the state.
   * @returns The name of the state.
   */
  public static mapper__MapTable__ID_to_State(stateID: number): string {
    const stateMap = this.Map__ID_to_State(stateID);
    return stateMap;
  }

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
   * Maps a state name to its corresponding ID in the map representation using the table representation.
   * @param stateName - The name of the state.
   * @returns The ID of the state, or -1 if the state name is not found.
   */
  public static mapper__TableMap__State_to_ID(stateName: string): number {
    return dictStates_mapGermany[stateName] != undefined
      ? dictStates_mapGermany[stateName]
      : -1;
  }

  /**
   * Maps a state ID to its corresponding name in the table representation.
   * @param stateID - The ID of the state.
   * @returns The name of the state.
   */
  public static mapper__TableMap__ID_to_State(stateID: number): string {
    const stateTable = this.Table__ID_to_State(stateID);
    return stateTable;
  }

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

function handleLoadDataERROR(isLoading: boolean, data: dbDATA): any | undefined {
  if (!isLoading) {
    if (data.error != undefined) {
      return String(data.error);
    }
  }
  return undefined;
}

const PrintDataLoadingERRORs = ({
  listOfERRORs,
  position = "absolute",
}: {
  listOfERRORs: any[];
  position?: "absolute" | "relative";
}) => {

  // remove duplicate errors and undefined values
  const uniqueERRORs = [...new Set(listOfERRORs.filter(e => e !== undefined))];
  return (
    <div
      className={`${position} bottom-0 left-[-8px] m-2 p-1 border w-full bg-white bg-opacity-75 z-10000 ${
      uniqueERRORs.length > 0 ? "" : "hidden"
      }`}
    >
      {uniqueERRORs.map((error, index) => (
      <div key={index} className=" text-red-500 wrap-break-word">
        {error}
      </div>
      ))}
    </div>
  );
};

export default stateMappersGermany;
export { handleLoadDataERROR, PrintDataLoadingERRORs };
export type { stateMappersGermany as stateMappersGermanyT };
