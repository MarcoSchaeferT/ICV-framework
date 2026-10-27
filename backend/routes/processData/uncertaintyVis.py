"""Build cell-level uncertainty data and deterministic calibration/SVG plots.

The module reads monthly prediction fields from PostgreSQL. JSON chart data
and the non-interactive Matplotlib SVG renderer use the same monthly inputs.
"""

import numpy as np
import math
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.figure import Figure
import uncertainty_toolbox.viz as uct_viz
from uncertainty_toolbox.metrics_calibration import (
    get_proportion_lists_vectorized,
    miscalibration_area_from_proportions,
)
from pathlib import Path
import psycopg
from psycopg import sql as psycopg_sql
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from setFilesToDB.db_utils import get_db_connection_params

try:
    from backend.routes.processData.svg_utils import (
        SVG_RENDER_LOCK,
        figure_to_svg_bytes,
        save_svg_atomic,
    )
except ImportError:
    from svg_utils import SVG_RENDER_LOCK, figure_to_svg_bytes, save_svg_atomic

# Columns needed from each monthly table
_BASE_COLS = ["longitude", "latitude", "geometry", "mean", "sd", "cv", "q05", "q95"]
_SIM_COLS  = [f"sim_{s}" for s in range(1, 51)]
_NEEDED_COLS = _BASE_COLS + _SIM_COLS

# Fixed plot dimensions (inches) — identical for every cell
FIG_W, FIG_H = 4, 4
# Fixed axes rect [left, bottom, width, height] in figure coords
AXES_RECT = (0.18, 0.15, 0.75, 0.72)

# Default SVG output directory
_SVG_DIR = Path(__file__).resolve().parent / "results_svg"


def fetch_pixel_row(month: int, pixel_id: int, conn_params: dict, dataset_template: str) -> dict | None:
    """Fetch a single spatial grid-cell row by primary key ``id`` for a given month.

    Args:
        month: Calendar month index (1–12) substituted into ``dataset_template``.
        pixel_id: Database row primary key ``id`` for the selected grid cell.
        conn_params: Keyword arguments passed to ``psycopg.connect``.
        dataset_template: Relation name template containing ``{month}``.

    Returns:
        Dictionary mapping ``_NEEDED_COLS`` (coordinates, summary statistics,
        and ``sim_1..sim_50``) to column values, or ``None`` if no row matches.
    """
    table = dataset_template.format(month=month)
    cols = psycopg_sql.SQL(", ").join(psycopg_sql.Identifier(c) for c in _NEEDED_COLS)
    query = psycopg_sql.SQL("SELECT {cols} FROM {tbl} WHERE {id} = {val}").format(
        cols=cols,
        tbl=psycopg_sql.Identifier(table),
        id=psycopg_sql.Identifier("id"),
        val=psycopg_sql.Literal(pixel_id),
    )
    with psycopg.connect(**conn_params) as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            if cur.description is None:
                return None
            columns = [d[0] for d in cur.description]
            row = cur.fetchone()
    return dict(zip(columns, row)) if row else None


try:
    from backend.routes.processData.geo_utils import extract_centroid, format_coord
except ImportError:
    from geo_utils import extract_centroid, format_coord


def _fetch_monthly_data(row_id: int, conn_params: dict, dataset_template: str, months_range: range) -> dict[int, dict]:
    """Fetch monthly prediction and deterministic simulation values across ``months_range``.

    Missing monthly tables or missing ``row_id`` entries are logged and skipped
    so partial seasonal series can still be rendered.

    Returns:
        Mapping from calendar month integer to a dictionary with ``lon``, ``lat``,
        ``geometry``, ``mean``, ``sd``, ``cv``, ``q05``, ``q95``, and
        deterministic ``groundTruthLabel``.
    """
    data: dict[int, dict] = {}
    for month in months_range:
        try:
            row = fetch_pixel_row(month, row_id, conn_params, dataset_template)
        except psycopg.errors.UndefinedTable:
            print(f"  WARNING: Table for month {month} does not exist, skipping.")
            continue
        except Exception as e:
            print(f"  ERROR fetching month {month}: {e}")
            continue
        if row is None:
            print(f"  WARNING: No row with id={row_id} for month {month}, skipping.")
            continue

        lat, lon = extract_centroid(row)
        # Use a stable pseudo-random simulation per cell/month. This keeps UQ
        # output identical across workers while retaining varied test labels.
        gt_col = _SIM_COLS[(row_id * 31 + month * 17) % len(_SIM_COLS)]
        data[month] = {
            "lon": lon,                      "lat": lat,
            "geometry": row["geometry"],
            "mean": float(row["mean"]),      "sd":  float(row["sd"]),
            "cv":   float(row["cv"]),        "q05": float(row["q05"]),
            "q95":  float(row["q95"]),       "groundTruthLabel": float(row[gt_col]),
        }
    return data


def _json_number(value: float) -> float | None:
    """Encode nonfinite numeric fields as JSON null."""
    number = float(value)
    return number if math.isfinite(number) else None


def build_uncertainty_chart_data(
    row_id: int,
    dataset_template: str = "t_2024_monthly_mean_{month}_ocsvm_aegypti_predictions_2023_mod_sim",
    months_range: range = range(1, 13),
) -> dict | None:
    """Return temporal and calibration series for one selected cell as JSON data.

    Calibration uses the same centered-interval calculation as the SVG. The
    comparison values are deterministic samples from ``sim_*`` fields, not
    independently observed ground truth. Temporal bounds are mean ±2 SD.
    Non-finite floats are serialized as ``None`` (JSON ``null``).

    Example:
        ```python
        payload = {
            "version": "uncertainty-v1",
            "cellID": 200509,
            "coordinates": {"latitude": 52.5, "longitude": 13.25},
            "temporal": [
                {
                    "month": 7,
                    "mean": 0.68,
                    "sd": 0.09,
                    "lower": 0.50,
                    "upper": 0.86,
                    "simulatedValue": 0.71,
                    "cv": 0.13,
                    "q05": 0.53,
                    "q95": 0.82,
                }
            ],
            "calibration": [{"expected": 0.5, "observed": 0.5}],
            "miscalibrationArea": 0.04,
        }
        ```
    """
    data = _fetch_monthly_data(
        row_id, get_db_connection_params(), dataset_template, months_range
    )
    if not data:
        return None

    months = sorted(data)
    y_pred = np.array([data[month]["mean"] for month in months])
    y_std = np.array([data[month]["sd"] for month in months])
    y_simulated = np.array([data[month]["groundTruthLabel"] for month in months])
    expected, observed = get_proportion_lists_vectorized(
        y_pred, np.maximum(y_std, 1e-8), y_simulated, prop_type="interval"
    )
    miscalibration_area = miscalibration_area_from_proportions(expected, observed)
    last = data[months[-1]]
    return {
        "version": "uncertainty-v1",
        "cellID": row_id,
        "coordinates": {
            "latitude": _json_number(last["lat"]),
            "longitude": _json_number(last["lon"]),
        },
        "temporal": [
            {
                "month": month,
                "mean": _json_number(data[month]["mean"]),
                "sd": _json_number(data[month]["sd"]),
                "lower": _json_number(data[month]["mean"] - 2 * data[month]["sd"]),
                "upper": _json_number(data[month]["mean"] + 2 * data[month]["sd"]),
                "simulatedValue": _json_number(data[month]["groundTruthLabel"]),
                "cv": _json_number(data[month]["cv"]),
                "q05": _json_number(data[month]["q05"]),
                "q95": _json_number(data[month]["q95"]),
            }
            for month in months
        ],
        "calibration": [
            {"expected": _json_number(exp), "observed": _json_number(obs)}
            for exp, obs in zip(expected, observed)
        ],
        "miscalibrationArea": _json_number(miscalibration_area),
    }


def _build_uncertainty_figure(data: dict[int, dict], plot_type: str) -> Figure:
    """Build one UQ figure from an already fetched monthly data series."""
    months = sorted(data.keys())
    y_pred = np.array([data[m]["mean"] for m in months])
    y_std = np.array([data[m]["sd"] for m in months])
    y_true = np.array([data[m]["groundTruthLabel"] for m in months])
    last = data[months[-1]]
    title = f"Lat: {format_coord(last['lat'])}°, Lng: {format_coord(last['lon'])}°"

    fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
    if plot_type == "uncertainty":
        uct_viz.plot_xy(
            y_pred,
            y_std,
            y_true,
            np.array(months),
            num_stds_confidence_bound=2,
            ax=ax,
        )
        ax.set_xlim(0.5, 12.5)
        ax.set_xticks([3, 6, 9, 12])
        ax.set_ylim(-0.05, 1.05)
        ax.set_xlabel("Month")
        ax.set_ylabel("Predicted habitat suitability")
    elif plot_type == "calibration":
        uct_viz.plot_calibration(y_pred, np.maximum(y_std, 1e-8), y_true, ax=ax)
        ax.set_xlim(-0.05, 1.05)
        ax.set_ylim(-0.05, 1.05)
        ax.set_xlabel("Expected proportion")
        ax.set_ylabel("Observed proportion")
    else:
        plt.close(fig)
        raise ValueError(f"Unsupported uncertainty plot type: {plot_type}")

    ax.set_title(title, fontweight='normal')
    ax.set_aspect('auto')
    ax.set_position(AXES_RECT)
    fig.set_size_inches(FIG_W, FIG_H)
    return fig


def render_uncertainty_svgs(
    row_id: int,
    dataset_template: str = "t_2024_monthly_mean_{month}_ocsvm_aegypti_predictions_2023_mod_sim",
    months_range=range(1, 13),
    plot_types=("uncertainty", "calibration"),
) -> dict[str, bytes]:
    """Render requested UQ plots to in-memory SVG bytes from one fetched monthly dataset.

    Serializes Matplotlib figure creation under ``SVG_RENDER_LOCK`` so concurrent
    worker threads do not collide on global pyplot state.

    Raises:
        ValueError: If ``plot_types`` contains an unsupported plot identifier.
    """
    requested_types = tuple(plot_types)
    invalid_types = set(requested_types) - {"uncertainty", "calibration"}
    if invalid_types:
        raise ValueError(f"Unsupported uncertainty plot types: {sorted(invalid_types)}")

    data = _fetch_monthly_data(
        row_id,
        get_db_connection_params(),
        dataset_template,
        months_range,
    )
    if not data:
        return {}

    rendered: dict[str, bytes] = {}
    with SVG_RENDER_LOCK:
        for current_type in requested_types:
            fig = _build_uncertainty_figure(data, current_type)
            rendered[current_type] = figure_to_svg_bytes(fig)
    return rendered


def create_uncertainty_visualizations(
    out_dir=None,
    grid_start=200506,
    grid_end=200506,
    dataset_template="t_2024_monthly_mean_{month}_ocsvm_aegypti_predictions_2023_mod_sim",
    months_range=range(1, 13),
    plot_type="both",  # "uncertainty", "calibration", or "both"
):
    """Export uncertainty and/or calibration SVG plots for offline/CLI use."""

    out_path = Path(out_dir).resolve() if out_dir else _SVG_DIR
    out_path.mkdir(parents=True, exist_ok=True)

    for row_id in range(grid_start, grid_end + 1):
        print(f"\nProcessing Row ID {row_id}...")
        plot_types = (
            ("uncertainty", "calibration")
            if plot_type == "both"
            else (plot_type,)
        )
        rendered = render_uncertainty_svgs(
            row_id,
            dataset_template=dataset_template,
            months_range=months_range,
            plot_types=plot_types,
        )
        if not rendered:
            print(f"  No data found for row {row_id}. Skipping.")
            continue
        for current_type, svg_data in rendered.items():
            target = out_path / f"{row_id}_seasonal_{current_type}_cell.svg"
            save_svg_atomic(svg_data, target)
            print(f"  Saved: {target}")


if __name__ == "__main__":
    create_uncertainty_visualizations()
