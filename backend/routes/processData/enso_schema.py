"""Schema rules for the rolling SEAS5/ENSO suitability datasets."""

from dataclasses import dataclass
import re
from typing import Literal


EnsoSuitabilityColumnKind = Literal["forecast", "reference", "reference_std"]
EnsoClimateColumnKind = Literal["forecast", "reference_mean", "reference_std"]
EnsoClimateVariable = Literal["t2m", "d2m", "si10", "tp"]

MONTH_ABBREVIATIONS = (
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
)
_MONTH_NUMBER = {month: index for index, month in enumerate(MONTH_ABBREVIATIONS, 1)}
_MONTH = "(?:" + "|".join(MONTH_ABBREVIATIONS) + ")"
_FORECAST_COLUMN_RE = re.compile(rf"^forecast_({_MONTH})_(\d{{4}})$")
_REFERENCE_COLUMN_RE = re.compile(
    rf"^(?:referenz|reference)_({_MONTH})_(\d{{4}})_(\d{{4}})(_\(std\))?$"
)
_CLIMATE_REFERENCE_COLUMN_RE = re.compile(
    r"^(t2m|d2m|si10|tp)_ref_(0[1-9]|1[0-2])_(mean|std)$"
)
_CLIMATE_FORECAST_COLUMN_RE = re.compile(
    r"^(t2m|d2m|si10|tp)_fc_(\d{4})_(0[1-9]|1[0-2])$"
)


@dataclass(frozen=True)
class EnsoSuitabilityColumn:
    kind: EnsoSuitabilityColumnKind
    month: int
    year: int | None = None
    reference_start_year: int | None = None
    reference_end_year: int | None = None


@dataclass(frozen=True)
class EnsoClimateColumn:
    kind: EnsoClimateColumnKind
    variable: EnsoClimateVariable
    month: int
    year: int | None = None


def normalize_enso_column_name(column_name: str) -> str:
    """Normalize raw CSV and sanitized database names for schema matching."""
    normalized = re.sub(r"[:\s-]+", "_", column_name.strip().lower())
    return re.sub(r"_+", "_", normalized)


def parse_enso_suitability_column(
    column_name: str,
) -> EnsoSuitabilityColumn | None:
    """Parse one exact rolling suitability column."""
    normalized = normalize_enso_column_name(column_name)
    forecast_match = _FORECAST_COLUMN_RE.fullmatch(normalized)
    if forecast_match:
        return EnsoSuitabilityColumn(
            kind="forecast",
            month=_MONTH_NUMBER[forecast_match.group(1)],
            year=int(forecast_match.group(2)),
        )

    reference_match = _REFERENCE_COLUMN_RE.fullmatch(normalized)
    if reference_match:
        return EnsoSuitabilityColumn(
            kind="reference_std" if reference_match.group(4) else "reference",
            month=_MONTH_NUMBER[reference_match.group(1)],
            reference_start_year=int(reference_match.group(2)),
            reference_end_year=int(reference_match.group(3)),
        )
    return None


def enso_suitability_column_kind(
    column_name: str,
) -> EnsoSuitabilityColumnKind | None:
    """Return the ENSO suitability role of an exact schema column, if any."""
    parsed = parse_enso_suitability_column(column_name)
    return parsed.kind if parsed else None


def is_enso_suitability_column(column_name: str) -> bool:
    """Return whether a column belongs to the ENSO suitability schema."""
    return parse_enso_suitability_column(column_name) is not None


def parse_enso_climate_column(column_name: str) -> EnsoClimateColumn | None:
    """Parse one exact ERA5 reference or SEAS5 climate forecast column."""
    normalized = normalize_enso_column_name(column_name)
    reference_match = _CLIMATE_REFERENCE_COLUMN_RE.fullmatch(normalized)
    if reference_match:
        statistic = reference_match.group(3)
        return EnsoClimateColumn(
            kind="reference_mean" if statistic == "mean" else "reference_std",
            variable=reference_match.group(1),  # type: ignore[arg-type]
            month=int(reference_match.group(2)),
        )

    forecast_match = _CLIMATE_FORECAST_COLUMN_RE.fullmatch(normalized)
    if forecast_match:
        return EnsoClimateColumn(
            kind="forecast",
            variable=forecast_match.group(1),  # type: ignore[arg-type]
            year=int(forecast_match.group(2)),
            month=int(forecast_match.group(3)),
        )
    return None


def is_enso_numeric_column(column_name: str) -> bool:
    """Return whether an exact ENSO schema column must be stored as a float."""
    return (
        parse_enso_suitability_column(column_name) is not None
        or parse_enso_climate_column(column_name) is not None
    )


_MONTH_NAMES = {
    "en": (
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ),
    "de": (
        "Januar", "Februar", "März", "April", "Mai", "Juni",
        "Juli", "August", "September", "Oktober", "November", "Dezember",
    ),
}
_CLIMATE_LABELS = {
    "en": {
        "t2m": "2 m temperature",
        "d2m": "2 m dew-point temperature",
        "si10": "10 m wind speed",
        "tp": "total precipitation",
    },
    "de": {
        "t2m": "2-m-Temperatur",
        "d2m": "2-m-Taupunkttemperatur",
        "si10": "10-m-Windgeschwindigkeit",
        "tp": "Gesamtniederschlag",
    },
}
_CLIMATE_UNITS = {
    "t2m": "°C",
    "d2m": "°C",
    "si10": "m/s",
    "tp": "m/day",
}


def enso_column_metadata(column_name: str, lang: str) -> dict | None:
    """Build localized metadata for one exact ENSO schema column."""
    language = lang if lang in _MONTH_NAMES else "en"
    suitability = parse_enso_suitability_column(column_name)
    if suitability:
        month = _MONTH_NAMES[language][suitability.month - 1]
        if suitability.kind == "forecast":
            description = (
                f"Forecasted habitat suitability ({month} {suitability.year})"
                if language == "en"
                else f"Vorhergesagte Habitateignung ({month} {suitability.year})"
            )
            availability = 1
        else:
            period = (
                f"{suitability.reference_start_year}–"
                f"{suitability.reference_end_year}"
            )
            if suitability.kind == "reference_std":
                description = (
                    f"Reference habitat suitability standard deviation "
                    f"({month} {period})"
                    if language == "en"
                    else f"Standardabweichung der Referenz-Habitateignung "
                    f"({month} {period})"
                )
                availability = 0
            else:
                description = (
                    f"Reference habitat suitability ({month} {period})"
                    if language == "en"
                    else f"Referenz-Habitateignung ({month} {period})"
                )
                availability = 1
        return {
            "datatype": "float",
            "dimension": "%",
            "description": description,
            "availability": availability,
        }

    climate = parse_enso_climate_column(column_name)
    if not climate:
        return None

    month = _MONTH_NAMES[language][climate.month - 1]
    label = _CLIMATE_LABELS[language][climate.variable]
    if climate.kind == "forecast":
        description = (
            f"Forecast {label} ({month} {climate.year})"
            if language == "en"
            else f"Vorhersage der {label} ({month} {climate.year})"
        )
    else:
        statistic = (
            ("Reference mean", "Referenzmittelwert")
            if climate.kind == "reference_mean"
            else ("Reference standard deviation", "Referenz-Standardabweichung")
        )
        description = (
            f"{statistic[0]} {label} ({month}, 2000–2025)"
            if language == "en"
            else f"{statistic[1]} der {label} ({month}, 2000–2025)"
        )
    return {
        "datatype": "float",
        "dimension": _CLIMATE_UNITS[climate.variable],
        "description": description,
        # Climate columns are used by the combined SVG, not as selectable maps.
        "availability": 0,
    }
