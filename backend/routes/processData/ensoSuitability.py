"""
Backend route handler for ENSO Suitability static visualization generator.
Generates static SVG/PNG plots containing 5 panels (4 climatic factors + habitat
suitability) with ERA5 2000-2025 reference (mean ±1 std) and SEAS5 forecast for a
selected grid cell from the seas5_forecast_* database tables.
"""

from functools import lru_cache
import json

import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.figure import Figure
from matplotlib.lines import Line2D
from matplotlib.ticker import ScalarFormatter
from pathlib import Path
import psycopg
from psycopg import sql as psycopg_sql
from backend.routes.processData.enso_schema import parse_enso_suitability_column
from backend.routes.setFilesToDB.db_utils import get_db_connection_params
from backend.routes.processData.svg_utils import (
    SVG_RENDER_LOCK,
    figure_to_svg_bytes,
    save_svg_atomic,
)

_SVG_DIR = Path(__file__).resolve().parent / "results_svg"
_MESSAGES_DIR = Path(__file__).resolve().parents[3] / "messages"

# Stable schema month tokens. Display labels are localized separately below.
MONTH_KEYS = ('jan', 'feb', 'mar', 'apr', 'may', 'jun',
              'jul', 'aug', 'sep', 'oct', 'nov', 'dec')
CLIMATE_VARS = ("t2m", "d2m", "si10", "tp")

# Color scheme
COLOR_REF_LINE = '#2b5c8f'
COLOR_REF_BAND = '#2b5c8f'
COLOR_FC_MARK  = '#e04d39'


def _output_filename(cell_id: int, dataset_template: str, active_month: str | None) -> str:
    """Build the stable filename used only by explicit offline exports."""
    suffix_parts = [str(cell_id)]
    if dataset_template:
        suffix_parts.append(dataset_template)
    suffix_parts.append(active_month.lower() if active_month else "all")
    suffix_parts.append("climate_forecast_cell.svg")
    return "_".join(suffix_parts)


# ==============================================================================
# Database query helpers
# ==============================================================================

# lowercase schema month abbreviation -> 1-based calendar month index
_MONTH_IDX = {mon: i + 1 for i, mon in enumerate(MONTH_KEYS)}


def normalize_enso_locale(locale: str | None) -> str:
    """Return a supported plot locale, defaulting safely to English."""
    return "de" if locale and locale.lower().split("-")[0] == "de" else "en"


@lru_cache(maxsize=2)
def _load_plot_text(locale: str) -> dict:
    """Load ENSO plot labels from the same messages used by Next.js."""
    language = normalize_enso_locale(locale)
    message_path = _MESSAGES_DIR / f"{language}.json"
    with message_path.open(encoding="utf-8") as message_file:
        messages = json.load(message_file)
    return messages["page_home"]["ShowCases"]["page_ENSO_Suitability"]["svg"]


def _fetch_forecast_cell_row(cell_id: int, table_name: str) -> dict | None:
    """Fetch a single grid-cell row from a seas5_forecast_* table by primary key.

    Uses SELECT * — the consolidated tables carry all reference and forecast
    columns, so no explicit column list has to be maintained.
    """
    query = psycopg_sql.SQL("SELECT * FROM {tbl} WHERE {id} = {val}").format(
        tbl=psycopg_sql.Identifier(table_name),
        id=psycopg_sql.Identifier("id"),
        val=psycopg_sql.Literal(cell_id),
    )
    with psycopg.connect(**get_db_connection_params()) as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            if cur.description is None:
                return None
            columns = [d[0] for d in cur.description]
            row = cur.fetchone()
    return dict(zip(columns, row)) if row else None


def _forecast_prob_items(row: dict) -> list[tuple[int, int, str]]:
    """Find the forecast suitability columns (forecast_{mon}_{year}) in the row.

    Returns chronologically sorted (year, month_idx_1based, column_name) tuples.
    """
    items = []
    for key in row.keys():
        parsed = parse_enso_suitability_column(key)
        if parsed and parsed.kind == "forecast" and parsed.year is not None:
            items.append((parsed.year, parsed.month, key))
    return sorted(items)


def _build_ref_series(row: dict, prefix: str, length: int = 12):
    """Extract mean and std arrays for a reference variable across 12 calendar months."""
    mean = np.full(length, np.nan)
    std  = np.full(length, np.nan)
    for m in range(1, length + 1):
        mean_col = f"{prefix}_ref_{m:02d}_mean"
        std_col  = f"{prefix}_ref_{m:02d}_std"
        if mean_col in row:
            val = row[mean_col]
            mean[m - 1] = float(val) if val is not None else np.nan
        if std_col in row:
            val = row[std_col]
            std[m - 1] = float(val) if val is not None else np.nan
    return mean, std


def _build_fc_series(row: dict, prefix: str, fc_labels: list[str]):
    """Extract forecast values for the given variable from {prefix}_fc_YYYY_MM columns."""
    vals = []
    for label in fc_labels:
        col = f"{prefix}_fc_{label}"
        if col in row:
            val = row[col]
            vals.append(float(val) if val is not None else np.nan)
        else:
            vals.append(np.nan)
    return np.array(vals)


def _build_ref_suitability_series(row: dict) -> tuple[np.ndarray, np.ndarray]:
    """Extract reference suitability mean/std per calendar month (Jan..Dec).

    Columns: referenz_{mon}_{period} and referenz_{mon}_{period}_(std),
    where the period (e.g. "2000_2025") is discovered from the row.
    """
    mean = np.full(12, np.nan)
    std = np.full(12, np.nan)
    period: tuple[int | None, int | None] | None = None
    for key in row.keys():
        parsed = parse_enso_suitability_column(key)
        if not parsed or parsed.kind == "forecast":
            continue
        parsed_period = (
            parsed.reference_start_year,
            parsed.reference_end_year,
        )
        if period is None:
            period = parsed_period
        if parsed_period != period:
            continue
        value = row[key]
        target = std if parsed.kind == "reference_std" else mean
        target[parsed.month - 1] = (
            float(value) if value is not None else np.nan
        )
    return mean, std


try:
    from backend.routes.processData.geo_utils import extract_centroid, format_coord
except ImportError:
    from geo_utils import extract_centroid, format_coord


# ==============================================================================
# Main visualization generator
# ==============================================================================

def _build_enso_figure(
    cell_id: int,
    row: dict | None,
    dataset_template: str,
    active_month: str | None = None,
    locale: str = "en",
) -> Figure:
    """
    Build a plot with 5 panels: 4 climate factors + habitat suitability.
    Each panel shows ERA5 2000-2025 reference (blue line ±1 std band) and
    SEAS5 forecast points (orange markers) for the selected grid cell.
    """
    text = _load_plot_text(locale)
    month_labels = tuple(text["months"][month] for month in MONTH_KEYS)

    if row is None:
        fig, ax = plt.subplots(figsize=(20, 5))
        ax.text(0.5, 0.5, text["no_data"].format(cell_id=cell_id, dataset=dataset_template),
                transform=ax.transAxes, ha='center', va='center', fontsize=14)
        return fig

    # forecast_{mon}_{year} columns, chronological — fc_labels feed the
    # climate series ({var}_fc_YYYY_MM), fc_months the X-axis positions
    fc_items = _forecast_prob_items(row)
    fc_labels = [f"{y}_{m:02d}" for y, m, _ in fc_items]
    fc_months = [m for _, m, _ in fc_items]  # 1-based calendar months

    # Build data series for each of the 5 panels
    panels: list[tuple[str, np.ndarray, np.ndarray, np.ndarray, list[int]]] = []

    # 4 climate variables
    for var in CLIMATE_VARS:
        label = text["climateVariables"][var]
        ref_mean, ref_std = _build_ref_series(row, var)
        fc_vals = _build_fc_series(row, var, fc_labels)
        if var == "tp":
            # Convert precipitation from m/day to mm/day (1 m = 1000 mm)
            ref_mean = ref_mean * 1000.0
            ref_std = ref_std * 1000.0
            fc_vals = fc_vals * 1000.0
        panels.append((label, ref_mean, ref_std, fc_vals, fc_months))

    # Suitability columns from the shared rolling ENSO schema.
    suit_ref_mean, suit_ref_std = _build_ref_suitability_series(row)
    suit_fc_vals = np.array([
        float(row[c]) if row.get(c) is not None else np.nan
        for c in (c for _, _, c in fc_items)
    ])
    # Convert habitat suitability probability (0.0 - 1.0) to percentage (0% - 100%)
    panels.append((text["suitability"], suit_ref_mean * 100.0, suit_ref_std * 100.0,
                   suit_fc_vals * 100.0, fc_months))

    # Highlight the forecast month selected in the UI (optional "month" query
    # param, e.g. "aug") — only when it lies inside the forecast window.
    fc_active_month = 0
    if active_month:
        mon_idx = _MONTH_IDX.get(active_month.lower())
        if mon_idx is not None and mon_idx in fc_months:
            fc_active_month = mon_idx

    # ── Render SVG ──
    n_panels = len(panels)  # 5
    fontPlusSize = 10

    fig, axes = plt.subplots(1, n_panels, figsize=(5.5 * n_panels, 6))
    coord = extract_centroid(row)

    for col, (title, ref_mean, ref_std, fc_vals, fc_months) in enumerate(panels):
        ax = axes[col]

        # Blue reference line with ±1 std band
        ax.fill_between(month_labels,
                        ref_mean - ref_std, ref_mean + ref_std,
                        color=COLOR_REF_BAND, alpha=0.15)
        ax.plot(month_labels, ref_mean,
                color=COLOR_REF_LINE, marker='o', linewidth=1.5)

        # Orange forecast points — split into segments so the line doesn't
        # wrap backwards across the year boundary (Dec → Jan).
        fc_segments: list[tuple[list[str], list[float]]] = []
        seg_x: list[str] = []
        seg_y: list[float] = []
        for idx, (m, v) in enumerate(zip(fc_months, fc_vals)):
            if idx > 0 and m < fc_months[idx - 1]:
                # year boundary reached — push current segment and start new one
                fc_segments.append((seg_x, seg_y))
                seg_x, seg_y = [], []
            seg_x.append(month_labels[m - 1])
            seg_y.append(float(v))
        fc_segments.append((seg_x, seg_y))

        for sx, sy in fc_segments:
            ax.plot(sx, sy,
                    color=COLOR_FC_MARK, linestyle='--', marker='s',
                    linewidth=1.5, markersize=6, zorder=5)

        # Matplotlib otherwise adds offset text such as "1e-5 + 1e-1"
        # when a cell's values occupy a very narrow range. Full values are
        # clearer here and avoid a detached annotation below the panel title.
        y_formatter = ScalarFormatter(useOffset=False)
        y_formatter.set_scientific(False)
        ax.yaxis.set_major_formatter(y_formatter)
        ax.yaxis.get_offset_text().set_visible(False)

        ax.set_title(title, fontsize=(9 + fontPlusSize), fontweight='semibold')
        ax.tick_params(axis='x', labelrotation=45, labelsize=(8 + fontPlusSize))
        ax.tick_params(axis='y', labelsize=(8 + fontPlusSize))
        ax.grid(True, linestyle=':', alpha=0.5)

    fig.tight_layout(rect=(0, 0, 1, 0.94))

    # Three-part header aligned to the actual outer plot boundaries:
    # comparison title (left), coordinates (center), inline legend (right).
    plot_left = axes[0].get_position().x0
    plot_right = axes[-1].get_position().x1
    plot_center = (plot_left + plot_right) / 2
    header_y = 0.985
    header_font_size = 10 + fontPlusSize
    fig.text(
        plot_left,
        header_y,
        text["title"],
        ha='left',
        va='top',
        fontsize=header_font_size,
        fontweight='normal',
    )
    fig.text(
        plot_center,
        header_y,
        f"Lat: {format_coord(coord[0])}°, Lng: {format_coord(coord[1])}°",
        ha='center',
        va='top',
        fontsize=header_font_size,
        fontweight='normal',
    )
    fig.legend(
        handles=(
            Line2D(
                [0], [0],
                color=COLOR_REF_LINE,
                marker='o',
                linewidth=1.5,
            ),
            Line2D(
                [0], [0],
                color=COLOR_FC_MARK,
                linestyle='--',
                marker='s',
                linewidth=1.5,
                markersize=6,
            ),
        ),
        labels=(text["reference_legend"], text["forecast_legend"]),
        loc='upper right',
        bbox_to_anchor=(plot_right, 0.99),
        ncol=2,
        frameon=False,
        borderaxespad=0,
        borderpad=0,
        columnspacing=1.25,
        handlelength=2,
        fontsize=header_font_size,
    )

    for ax in axes:
        if fc_active_month and fc_active_month <= len(month_labels):
            for tick in ax.get_xticklabels():
                if tick.get_text() == month_labels[fc_active_month - 1]:
                    tick.set_color('#8b0000')  # dark red
                    tick.set_fontweight('bold')
                    break
    return fig


def render_ENSO_suitability_svg(
    cell_id: int,
    dataset_template: str = "seas5_forecast_albopictus_habitat_probability",
    active_month: str | None = None,
    locale: str = "en",
) -> bytes:
    """Render one ENSO suitability chart directly to SVG bytes."""
    row = _fetch_forecast_cell_row(cell_id, dataset_template)
    with SVG_RENDER_LOCK:
        fig = _build_enso_figure(
            cell_id,
            row,
            dataset_template,
            active_month,
            locale,
        )
        return figure_to_svg_bytes(fig, bbox_inches="tight")


def create_ENSO_suitability_visualizations(
    cell_id: int,
    out_dir: Path | str | None = None,
    dataset_template: str = "seas5_forecast_albopictus_habitat_probability",
    active_month: str | None = None,
    locale: str = "en",
) -> Path:
    """Export one ENSO suitability SVG atomically for offline/CLI use."""
    out_path = Path(out_dir).resolve() if out_dir else _SVG_DIR
    filename = _output_filename(cell_id, dataset_template, active_month)
    svg_data = render_ENSO_suitability_svg(
        cell_id,
        dataset_template,
        active_month,
        locale,
    )
    target = save_svg_atomic(svg_data, out_path / filename)
    print(f"  Saved SVG plot: {target}")
    return target


if __name__ == "__main__":
    create_ENSO_suitability_visualizations(cell_id=1)
