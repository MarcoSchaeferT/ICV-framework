const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
] as const;

const MONTH_PATTERN = `(?:${MONTHS.join("|")})`;
const FORECAST_COLUMN_RE = new RegExp(
  `^forecast_(${MONTH_PATTERN})_(\\d{4})$`,
);
const REFERENCE_COLUMN_RE = new RegExp(
  `^(?:referenz|reference)_(${MONTH_PATTERN})_(\\d{4})_(\\d{4})(?:_\\(std\\))?$`,
);

/**
 * Calendar metadata parsed from a SEAS5 habitat-suitability forecast column.
 *
 * @remarks `monthIndex` is one-based, matching the calendar month rather than an array index.
 *
 * @example
 * ```ts
 * const augustForecast: EnsoForecastColumn = {
 *   month: "aug",
 *   monthIndex: 8,
 *   year: 2026,
 * };
 * ```
 */
export type EnsoForecastColumn = {
  /** Three-letter lowercase English month abbreviation. */
  month: string;
  /** Calendar month from 1 (January) through 12 (December). */
  monthIndex: number;
  /** Four-digit forecast year. */
  year: number;
};

/**
 * Normalizes a backend column name before matching the ENSO schema.
 *
 * @param columnName - Raw database column name or display label.
 * @returns Lowercase name with surrounding whitespace removed and separators replaced by underscores.
 *
 * @remarks The normalization makes case, spaces, colons, and hyphens equivalent for schema checks.
 *
 * @example
 * ```ts
 * normalizeEnsoColumnName(" Forecast: Aug 2026 "); // "forecast_aug_2026"
 * ```
 */
export function normalizeEnsoColumnName(columnName: string): string {
  return columnName
    .trim()
    .toLowerCase()
    .replace(/[:\s-]+/g, "_")
    .replace(/_+/g, "_");
}

/**
 * Parses a `forecast_<month>_<year>` suitability column.
 *
 * @param columnName - Column name from a SEAS5 species relation.
 * @returns Parsed month and year, or `null` when the name is not a forecast column.
 *
 * @remarks Uses {@link normalizeEnsoColumnName}; callers should check for `null`
 * before using the month to pair a forecast with a reference field.
 *
 * @example
 * ```ts
 * const forecast = parseEnsoForecastColumn("forecast_aug_2026");
 * if (forecast) console.log(forecast.monthIndex); // 8
 * ```
 */
export function parseEnsoForecastColumn(
  columnName: string,
): EnsoForecastColumn | null {
  const match = FORECAST_COLUMN_RE.exec(normalizeEnsoColumnName(columnName));
  if (!match) return null;
  return {
    month: match[1],
    monthIndex: MONTHS.indexOf(match[1] as (typeof MONTHS)[number]) + 1,
    year: Number(match[2]),
  };
}

/**
 * Checks whether a column belongs to the ENSO forecast or reference schema.
 *
 * @param columnName - Candidate database column name.
 * @returns `true` for a forecast field or a matching reference-period field.
 *
 * @example
 * ```ts
 * isEnsoSuitabilityColumn("referenz_aug_2000_2025"); // true
 * isEnsoSuitabilityColumn("species"); // false
 * ```
 */
export function isEnsoSuitabilityColumn(columnName: string): boolean {
  const normalized = normalizeEnsoColumnName(columnName);
  return FORECAST_COLUMN_RE.test(normalized)
    || REFERENCE_COLUMN_RE.test(normalized);
}

/**
 * Finds the fixed-period reference column paired with a forecast month.
 *
 * @param columnName - Forecast column such as `forecast_aug_2026`.
 * @returns The same-month `referenz_<month>_2000_2025` field, or an empty
 * string when the input does not match the forecast schema.
 *
 * @remarks The baseline period is intentionally fixed at 2000–2025; the
 * forecast year does not change the reference column name.
 *
 * @example
 * ```ts
 * referenceColumnForForecast("forecast_aug_2026"); // "referenz_aug_2000_2025"
 * ```
 */
export function referenceColumnForForecast(columnName: string): string {
  const forecast = parseEnsoForecastColumn(columnName);
  return forecast ? `referenz_${forecast.month}_2000_2025` : "";
}
