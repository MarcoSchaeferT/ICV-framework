
export type metaDataT = {
  [valuename: string]: {
    valuename: string;
    dimension: string;
    description: string;
    availability: string;
  };
};

/**
 * Aligns a numerical value to its corresponding metadata, applying necessary transformations
 * based on the metadata's description and dimension. This function adjusts the value and 
 * determines the appropriate unit for display.
 *
 * @param value - The numerical value to be aligned with the metadata.
 * @param featureName - The name of the feature corresponding to the metadata.
 * @param metaData - An object containing metadata information for various features.
 * 
 * @returns An object containing the transformed value and its associated unit.
 * 
 * @remarks
 * - If the feature's description includes "precipitation" or "Niederschlag", the value is 
 *   converted from meters to millimeters and the unit is set to "mm".
 * - If the unit is "%", the value is rounded to a whole number percentage.
 * - If the unit is "K" (Kelvin), the value is converted to Celsius and the unit is set to "°C".
 * - For all other cases, the value is rounded to the nearest whole number.
 * 
 * @todo Avoid hardcoded adjustments by implementing a more flexible and configurable approach.
 */
export function alignFeature_to_Metadata(value: number, featureName: string, metaData: metaDataT, isDecimals?: boolean): { value: number, unit: string } {
  let unit = "";
  let d = value;

  if (metaData[featureName] != undefined) {
    unit = metaData[featureName].dimension;
  } else {
    // Only warn for non-empty feature names; empty string is the expected initial state.
    // Also ignore "id" column used by the database.
    if (featureName !== "" && featureName !== "id") {
      console.warn("Feature not found in metadata: ", featureName);
    }
    return { value: d, unit };
  }


  // ToDo: avoid hardcoded adjustments
  // convert precipitation values from m to mm
  if (metaData[featureName].description.includes("precipitation") || metaData[featureName].description.includes("Niederschlag")) {

    value = Math.round(Number(d) * 1000);
    if (isDecimals) {
      value = Math.round(Number(d) * 1000 * 10) / 10;
    }

    unit = "mm";
    // round percentage values to whole numbers
  } else if (unit === "%") {
    value = Math.round(Number(d) * 100);
    // convert Kelvin to Celsius
  } else if (unit === "K") {
    value = Math.round((Number(d) - 273.15));
    if (isDecimals) {
      value = Math.round((Number(d) - 273.15) * 100) / 100;
    }
    unit = "°C";
  }
  else {

    value = Math.round(Number(d) * 100) / 100;
  }

  return { value, unit };

}





