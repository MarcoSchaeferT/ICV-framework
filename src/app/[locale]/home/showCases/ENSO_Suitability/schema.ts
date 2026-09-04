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

export type EnsoForecastColumn = {
  month: string;
  monthIndex: number;
  year: number;
};

export function normalizeEnsoColumnName(columnName: string): string {
  return columnName
    .trim()
    .toLowerCase()
    .replace(/[:\s-]+/g, "_")
    .replace(/_+/g, "_");
}

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

export function isEnsoSuitabilityColumn(columnName: string): boolean {
  const normalized = normalizeEnsoColumnName(columnName);
  return FORECAST_COLUMN_RE.test(normalized)
    || REFERENCE_COLUMN_RE.test(normalized);
}

export function referenceColumnForForecast(columnName: string): string {
  const forecast = parseEnsoForecastColumn(columnName);
  return forecast ? `referenz_${forecast.month}_2000_2025` : "";
}
