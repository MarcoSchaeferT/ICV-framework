"""
Backend route handler for ENSO Suitability static visualization generator.
Generates static SVG/PNG plots containing 5 panels (4 climatic factors + habitat
suitability) with ERA5 2000-2025 reference (mean ±1 std) and SEAS5 forecast for a
selected grid cell from the seas5_forecast_* database tables.
"""

import numpy as np
import re
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from pathlib import Path
import psycopg
from psycopg import sql as psycopg_sql
import sys, os, time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from setFilesToDB.db_utils import get_db_connection_params

_SVG_DIR = Path(__file__).resolve().parent / "results_svg"

# Climate variables and their display labels / units
CLIMATE_VARS = [
    ("t2m", "Temperature (2m) (°C)"),
    ("d2m", "Dewpoint Temperature (°C)"),
    ("si10", "Wind Speed (m/s)"),
    ("tp",  "Total Precipitation (m/day)"),
]

# Suitability display label
SUITABILITY_LABEL = "Habitat Suitability"

# Month labels for display
MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

# Color scheme
COLOR_REF_LINE = '#2b5c8f'
COLOR_REF_BAND = '#2b5c8f'
COLOR_FC_MARK  = '#e04d39'
COLOR_DELTA_POS = '#e04d39'
COLOR_DELTA_NEG = '#2b5c8f'


def cleanup_climate_forecast_svgs(out_dir: Path | str | None = None,
                                  pattern: str = "*_climate_forecast_cell.svg"):
    """Clean up previously generated SVG plot files from the output directory."""
    out_path = Path(out_dir).resolve() if out_dir else _SVG_DIR
    if not out_path.exists():
        return
    removed_count = 0
    for svg_file in out_path.glob(pattern):
        try:
            svg_file.unlink(missing_ok=True)
            removed_count += 1
        except Exception as e:
            print(f"Error deleting old SVG {svg_file}: {e}")
    if removed_count > 0:
        print(f"Cleaned up {removed_count} old climate forecast SVG file(s) in {out_path}")


def _save_and_cleanup(fig, out_path: Path, filename: str,
                      pattern: str = "*_climate_forecast_cell.svg"):
    """Remove previous SVGs matching pattern, save new figure, and close plot context."""
    for old in out_path.glob(pattern):
        try:
            old.unlink(missing_ok=True)
        except Exception:
            pass
    target = out_path / filename
    fig.savefig(target, format='svg', bbox_inches='tight')
    plt.close(fig)
    print(f"  Saved and cleaned up SVG plot: {target}")
    return target


# ==============================================================================
# Database query helpers
# ==============================================================================

# Sanitized DB column names of the consolidated forecast tables
# (CSV header -> DB name, see parseCSVdata.sanitize_names):
#   "Referenz: Jan 2000-2025"       -> referenz_jan_2000_2025
#   "Referenz: Jan 2000-2025 (std)" -> referenz_jan_2000_2025_(std)
#   "Forecast: Jan 2027"            -> forecast_jan_2027
_FC_PROB_RE = re.compile(r"^forecast_([a-z]{3})_(\d{4})$")
_REF_PROB_RE = re.compile(r"^referenz_([a-z]{3})_(\d{4}_\d{4})$")

# lowercase month abbreviation -> 1-based calendar month index
_MONTH_IDX = {mon.lower(): i + 1 for i, mon in enumerate(MONTHS)}


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
        m = _FC_PROB_RE.fullmatch(key)
        if m and m.group(1) in _MONTH_IDX:
            items.append((int(m.group(2)), _MONTH_IDX[m.group(1)], key))
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
    period = None
    for key in row.keys():
        m = _REF_PROB_RE.fullmatch(key)
        if m:
            period = m.group(2)
            break
    if period is None:
        return mean, std
    for i, mon in enumerate(MONTHS):
        lc = mon.lower()
        mean_col = f"referenz_{lc}_{period}"
        std_col = f"referenz_{lc}_{period}_(std)"
        if mean_col in row:
            val = row[mean_col]
            mean[i] = float(val) if val is not None else np.nan
        if std_col in row:
            val = row[std_col]
            std[i] = float(val) if val is not None else np.nan
    return mean, std


# ==============================================================================
# Main visualization generator
# ==============================================================================

def create_ENSO_suitability_visualizations(
    cell_id: int,
    out_dir: Path | str | None = None,
    dataset_template: str = "seas5_forecast_albopictus_habitat_probability",
    active_month: str | None = None,
) -> Path:
    """
    Generate static plot with 5 panels: 4 climate factors + habitat suitability.
    Each panel shows ERA5 2000-2025 reference (blue line ±1 std band) and
    SEAS5 forecast points (orange markers) for the selected grid cell.
    """
    out_path = Path(out_dir).resolve() if out_dir else _SVG_DIR
    out_path.mkdir(parents=True, exist_ok=True)
    filename = f"{cell_id}_climate_forecast_cell.svg"

    # ── Fetch real data from DB ──
    row = _fetch_forecast_cell_row(cell_id, dataset_template)
    if row is None:
        # Fallback: generate a "no data" placeholder SVG
        fig, ax = plt.subplots(figsize=(20, 5))
        ax.text(0.5, 0.5, f"No data for cell_id={cell_id}\ntable={dataset_template}",
                transform=ax.transAxes, ha='center', va='center', fontsize=14)
        target = out_path / filename
        fig.savefig(target, format='svg', bbox_inches='tight')
        plt.close(fig)
        return target

    # forecast_{mon}_{year} columns, chronological — fc_labels feed the
    # climate series ({var}_fc_YYYY_MM), fc_months the X-axis positions
    fc_items = _forecast_prob_items(row)
    fc_labels = [f"{y}_{m:02d}" for y, m, _ in fc_items]
    fc_months = [m for _, m, _ in fc_items]  # 1-based calendar months

    # Build data series for each of the 5 panels
    panels: list[tuple[str, np.ndarray, np.ndarray, np.ndarray, list[int]]] = []

    # 4 climate variables
    for var, label in CLIMATE_VARS:
        ref_mean, ref_std = _build_ref_series(row, var)
        fc_vals = _build_fc_series(row, var, fc_labels)
        panels.append((label, ref_mean, ref_std, fc_vals, fc_months))

    # Suitability (consolidated column names, see _REF_PROB_RE / _FC_PROB_RE)
    suit_ref_mean, suit_ref_std = _build_ref_suitability_series(row)
    suit_fc_vals = np.array([
        float(row[c]) if row.get(c) is not None else np.nan
        for c in (c for _, _, c in fc_items)
    ])
    panels.append((SUITABILITY_LABEL, suit_ref_mean, suit_ref_std,
                   suit_fc_vals, fc_months))

    # Highlight the forecast month selected in the UI (optional "month" query
    # param, e.g. "aug") — only when it lies inside the forecast window.
    fc_active_month = 0
    if active_month:
        mon_idx = _MONTH_IDX.get(active_month.lower())
        if mon_idx is not None and mon_idx in fc_months:
            fc_active_month = mon_idx

    # ── Render SVG ──
    n_panels = len(panels)  # 5
    fontPlusSize = 4

    fig, axes = plt.subplots(1, n_panels, figsize=(4 * n_panels, 6))  # doubled height
    fig.suptitle(
        f"Grid Cell #{cell_id} — ERA5 2000-2025 (mean ±1 std) vs SEAS5 forecast",
        fontsize=(12 + fontPlusSize), fontweight='bold'
    )

    coord = float(row["latitude"]), float(row["longitude"])
    title_sub = f"Lat: {coord[0]:.1f}, Lng: {coord[1]:.1f}"
    # fc_active_month set above — used to highlight the active lead month

    for col, (title, ref_mean, ref_std, fc_vals, fc_months) in enumerate(panels):
        ax = axes[col]

        # Blue reference line with ±1 std band
        ax.fill_between(MONTHS,
                        ref_mean - ref_std, ref_mean + ref_std,
                        color=COLOR_REF_BAND, alpha=0.15)
        ax.plot(MONTHS, ref_mean, label='ERA5 Mean (2000-2025)',
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
            seg_x.append(MONTHS[m - 1])
            seg_y.append(float(v))
        fc_segments.append((seg_x, seg_y))

        for si, (sx, sy) in enumerate(fc_segments):
            ax.plot(sx, sy, label=('SEAS5 Forecast' if si == 0 else None),
                    color=COLOR_FC_MARK, linestyle='--', marker='s',
                    linewidth=1.5, markersize=6, zorder=5)

        ax.set_title(title, fontsize=(9 + fontPlusSize), fontweight='semibold')
        ax.set_title(f"{title}\n{title_sub}", fontsize=(8 + fontPlusSize),
                     fontweight='semibold')
        ax.tick_params(axis='x', labelrotation=45, labelsize=(8 + fontPlusSize))
        ax.tick_params(axis='y', labelsize=(8 + fontPlusSize))
        ax.grid(True, linestyle=':', alpha=0.5)
        if col == 0:
            ax.legend(fontsize=(8 + fontPlusSize))

    plt.tight_layout()
    # Highlight the active lead month's X-axis label in dark red
    for ax in axes:
        if fc_active_month and fc_active_month <= len(MONTHS):
            for tick in ax.get_xticklabels():
                if tick.get_text() == MONTHS[fc_active_month - 1]:
                    tick.set_color('#8b0000')  # dark red
                    tick.set_fontweight('bold')
                    break
    target_file = _save_and_cleanup(fig, out_path, filename,
                                    pattern="*_climate_forecast_cell.svg")
    return target_file


if __name__ == "__main__":
    create_ENSO_suitability_visualizations(cell_id=1)