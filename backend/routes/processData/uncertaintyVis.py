import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.figure import Figure
import uncertainty_toolbox.viz as uct_viz
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
    """Fetch a single pixel row by its primary key `id`."""
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
    """Fetch data for all months, returning {month: row_dict}."""
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
    """Render requested UQ plots to memory from one fetched monthly dataset."""
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
