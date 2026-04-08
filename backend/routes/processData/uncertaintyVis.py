import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import uncertainty_toolbox.viz as uct_viz
from pathlib import Path
import psycopg
from psycopg import sql as psycopg_sql
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from setFilesToDB.db_utils import get_db_connection_params

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

        gt_col = "sim_" + str(np.random.randint(1, 51))
        data[month] = {
            "lon": float(row["longitude"]),  "lat": float(row["latitude"]),
            "geometry": row["geometry"],
            "mean": float(row["mean"]),      "sd":  float(row["sd"]),
            "cv":   float(row["cv"]),        "q05": float(row["q05"]),
            "q95":  float(row["q95"]),       "groundTruthLabel": float(row[gt_col]),
        }
    return data


def _save_and_cleanup(fig, out_path: Path, filename: str, pattern: str):
    """Delete old SVGs matching pattern, save figure, close it."""
    for old in out_path.glob(pattern):
        old.unlink(missing_ok=True)
    target = out_path / filename
    fig.savefig(target)
    plt.close(fig)
    print(f"  Saved: {target}")


def create_uncertainty_visualizations(
    out_dir=None,
    grid_start=200506,
    grid_end=200506,
    dataset_template="t_2024_monthly_mean_{month}_ocsvm_aegypti_predictions_2023_mod_sim",
    months_range=range(1, 13),
    plot_type="both",  # "uncertainty", "calibration", or "both"
):
    """Generate uncertainty and/or calibration SVG plots for the given grid cell(s)."""

    out_path = Path(out_dir).resolve() if out_dir else _SVG_DIR
    out_path.mkdir(parents=True, exist_ok=True)

    conn_params = get_db_connection_params()

    for row_id in range(grid_start, grid_end + 1):
        print(f"\nProcessing Row ID {row_id}...")

        data = _fetch_monthly_data(row_id, conn_params, dataset_template, months_range)
        if not data:
            print(f"  No data found for row {row_id}. Skipping.")
            continue

        months = sorted(data.keys())
        y_pred = np.array([data[m]["mean"] for m in months])
        y_std  = np.array([data[m]["sd"]   for m in months])
        y_true = np.array([data[m]["groundTruthLabel"] for m in months])
        last   = data[months[-1]]
        title  = f"Lat: {last['lat']:.1f}, Lng: {last['lon']:.1f}"

        cell_id = grid_start

        # ── Uncertainty plot ──
        if plot_type in ("uncertainty", "both"):
            fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
            uct_viz.plot_xy(y_pred, y_std, y_true, np.array(months),
                            num_stds_confidence_bound=2, ax=ax)
            ax.set_xlim(0.5, 12.5)
            ax.set_xticks([3, 6, 9, 12])
            ax.set_ylim(-0.05, 1.05)
            ax.set_title(title)
            ax.set_xlabel("Month")
            ax.set_ylabel("Predicted habitat suitability")
            ax.set_aspect('auto')
            ax.set_position(AXES_RECT)
            fig.set_size_inches(FIG_W, FIG_H)
            _save_and_cleanup(fig, out_path,
                              f"{cell_id}_seasonal_uncertainty_cell.svg",
                              "*_seasonal_uncertainty_cell.svg")

        # ── Calibration plot ──
        if plot_type in ("calibration", "both"):
            fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
            uct_viz.plot_calibration(y_pred, np.maximum(y_std, 1e-8), y_true, ax=ax)
            ax.set_xlim(-0.05, 1.05)
            ax.set_ylim(-0.05, 1.05)
            ax.set_xlabel("Expected proportion")
            ax.set_ylabel("Observed proportion")
            ax.set_title(title)
            ax.set_aspect('auto')
            ax.set_position(AXES_RECT)
            fig.set_size_inches(FIG_W, FIG_H)
            _save_and_cleanup(fig, out_path,
                              f"{cell_id}_seasonal_calibration_cell.svg",
                              "*_seasonal_calibration_cell.svg")


if __name__ == "__main__":
    create_uncertainty_visualizations()
