
import { isEnsoSuitabilityColumn } from "@/app/[locale]/home/showCases/ENSO_Suitability/schema";

/**
 * Metadata dictionary mapping feature column names to physical dimension units, descriptions, and dataset availability metadata.
 *
 * @see {@link alignFeature_to_Metadata} for feature unit transformation.
 * @see {@link ColorMapLegend} for legend scale rendering consuming metadata.
 *
 * @example
 * ```ts
 * import type { MetadataRecord } from "@/framework";
 *
 * const habitatMetadata: MetadataRecord = {
 *   mean: {
 *     valuename: "mean",
 *     dimension: "probability",
 *     description: "Aedes albopictus habitat suitability",
 *     availability: "2024-01 to 2024-12",
 *   },
 * };
 * ```
 */
export type metaDataT = {
  [valuename: string]: {
    /** Feature column name identifier string */
    valuename: string;
    /** Physical dimension unit (e.g. "K", "m", "%", "counts") */
    dimension: string;
    /** Human-readable description of the environmental variable */
    description: string;
    /** Temporal or spatial dataset availability range string */
    availability: string;
  };
};

const warnedFeatures = new Set<string>();
/**
 * Aligns raw dataset numerical features to human-readable physical units (e.g. Kelvin to Celsius, meters to millimeters).
 *
 * Performs physical unit transformations based on metadata definitions:
 * - Precipitation: multiplies meters by 1000 and displays millimeters.
 * - Temperature: subtracts 273.15 from Kelvin and displays Celsius.
 * - Percentages: multiplies a ratio by 100.
 *
 * @param value - Raw numerical feature value extracted from database response.
 * @param featureName - Dataset column feature name (e.g. `"temperature_surface"`, `"precipitation"`, `"prob_7"`).
 * @param metaData - Metadata dictionary matching {@link metaDataT}.
 * @param isDecimals - When true, precipitation is rounded to one decimal and
 * Kelvin conversions to two decimals; percentages still round to whole numbers.
 * @returns Object containing transformed numerical `value` and display `unit` string.
 *
 * @remarks
 * Features missing from the metadata dictionary issue a single console warning per feature name to prevent log flooding.
 *
 * @see {@link metaDataT} for metadata schema definitions.
 * @see {@link ColorMapLegend} for legend scale tick rendering.
 * @see {@link LeafD3MapLayerProps} for map tooltip feature formatting.
 *
 * @example
 * ```ts
 * import { alignFeature_to_Metadata, type MetadataRecord } from "@/framework";
 *
 * const metaData: MetadataRecord = {
 *   temp_kelvin: { valuename: "temp_kelvin", dimension: "K", description: "Surface temperature", availability: "2020" }
 * };
 * const { value, unit } = alignFeature_to_Metadata(300.15, "temp_kelvin", metaData, true);
 * // Returns { value: 27, unit: "°C" }
 * ```
 */
export function alignFeature_to_Metadata(value: number, featureName: string, metaData: metaDataT, isDecimals?: boolean): { value: number, unit: string } {
  let unit = "";
  let d = value;

  const isSuitability = isEnsoSuitabilityColumn(featureName);

  if (metaData && metaData[featureName] != undefined) {
    unit = metaData[featureName].dimension;
  } else {
    // Only warn for non-empty feature names; empty string is the expected initial state.
    // Also ignore "id" column used by the database.
    if (featureName !== "" && featureName !== "id") {
      if (!warnedFeatures.has(featureName)) {
        console.warn("Feature not found in metadata: ", featureName);
        warnedFeatures.add(featureName);
      }
    }
    if (isSuitability) {
      unit = "%";
      d = Math.round(Number(d) * 100);
    }
    return { value: d, unit };
  }

  if (isSuitability && (!unit || unit === "NA")) {
    unit = "%";
  }


  // ToDo: avoid hardcoded adjustments
  // convert precipitation values from m to mm
  if (metaData[featureName].description.includes("precipitation") || metaData[featureName].description.includes("Niederschlag")) {

    value = Math.round(Number(d) * 1000);
    if (isDecimals) {
      value = Math.round(Number(d) * 1000 * 10) / 10;
    }

    unit = unit === "m/day" ? "mm/day" : "mm";
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






