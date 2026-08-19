"""
Backend route handler for ENSO Suitability static visualization generator.
Generates static SVG/PNG plots containing 4 climatic factor line charts (ERA5 vs SEAS5)
and monthly mean delta bar charts for a selected grid cell.
"""

import numpy as np
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


def cleanup_climate_forecast_svgs(out_dir: Path | str | None = None, pattern: str = "*_climate_forecast_cell.svg"):
    """
    Clean up previously generated SVG plot files from the output directory.
    """
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


def _save_and_cleanup(fig, out_path: Path, filename: str, pattern: str = "*_climate_forecast_cell.svg"):
    """
    Remove previous SVGs matching pattern, save new figure, and close plot context.
    """
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


def create_ENSO_suitability_visualizations(
    cell_id: int,
    out_dir: Path | str | None = None,
    dataset_template: str = "t_2024_monthly_mean_{month}_ocsvm_aegypti_predictions_2023_mod_sim",
) -> Path:
    """
    Generate static plot with 4 climate factors (Temperature, Dewpoint Temp, Wind Speed, Total Precipitation)
    line charts (ERA5 historical mean ±1 std vs SEAS5 forecast) and delta bar charts.
    """
    out_path = Path(out_dir).resolve() if out_dir else _SVG_DIR
    out_path.mkdir(parents=True, exist_ok=True)
    filename = f"{cell_id}_climate_forecast_cell.svg"

    # Months: Jan - Dec
    months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    forecast_months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    # ── Synthetic Data Generation (Placeholder until DB data connected) ──
    np.random.seed(cell_id % 10000)
    
    # 1. Temperature (2m) (°C)
    temp_ref = 20 - 5 * np.cos(np.linspace(0, 2*np.pi, 12))
    temp_fc = temp_ref.copy()
    temp_fc[6:] += np.random.uniform(0.5, 1.8, 6)
    
    # 2. Dewpoint Temperature (°C)
    dew_ref = 15 - 4 * np.cos(np.linspace(0, 2*np.pi, 12))
    dew_fc = dew_ref.copy()
    dew_fc[6:] += np.random.uniform(0.2, 0.9, 6)
    
    # 3. Wind Speed (m/s)
    wind_ref = 2.5 + 0.3 * np.sin(np.linspace(0, 2*np.pi, 12))
    wind_fc = wind_ref.copy()
    wind_fc[6:] += np.random.uniform(-0.3, 0.1, 6)
    
    # 4. Total Precipitation per Day (m/day)
    precip_ref = 0.005 + 0.002 * np.sin(np.linspace(0, 2*np.pi, 12))
    precip_fc = precip_ref.copy()
    precip_fc[6:] += np.random.uniform(-0.001, 0.001, 6)
    
    factors = [
        ("Temperature (2m) (°C)", temp_ref, temp_fc, "#d95f02", "#1b9e77"),
        ("Dewpoint Temperature (°C)", dew_ref, dew_fc, "#e7298a", "#7570b3"),
        ("Wind Speed (m/s)", wind_ref, wind_fc, "#e6ab02", "#66a61e"),
        ("Total Precipitation (m/day)", precip_ref, precip_fc, "#a6761d", "#666666"),
    ]
    fontPlusSize = 4

    fig, axes = plt.subplots(2, 4, figsize=(20, 5), gridspec_kw={'height_ratios': [2, 1]})
    fig.suptitle(f"Grid Cell #{cell_id} - ERA5 (mean ±1 std) vs SEAS5 forecast", fontsize=(12+fontPlusSize), fontweight='bold')

    for col, (title, ref_vals, fc_vals, color_fc, color_ref) in enumerate(factors):
        ax_line = axes[0, col]
        ax_bar = axes[1, col]

        # Line chart
        ax_line.plot(months, ref_vals, label='ERA5 Mean', color='#2b5c8f', marker='o', linewidth=1.5)
        ax_line.fill_between(months, ref_vals - 0.5, ref_vals + 0.5, color='#2b5c8f', alpha=0.15)
        ax_line.plot(months[6:], fc_vals[6:], label='SEAS5 Forecast', color='#e04d39', linestyle='--', marker='s', linewidth=1.5)
        ax_line.set_title(title, fontsize=(9+fontPlusSize), fontweight='semibold')
        ax_line.tick_params(axis='x', labelrotation=45, labelsize=(8+fontPlusSize))
        ax_line.tick_params(axis='y', labelsize=(8+fontPlusSize))
        ax_line.grid(True, linestyle=':', alpha=0.5)

        # Delta bar chart (Jul - Dec)
        deltas = fc_vals[6:] - ref_vals[6:]
        bar_colors = ['#e04d39' if d >= 0 else '#2b5c8f' for d in deltas]
        ax_bar.bar(forecast_months, deltas, color=bar_colors, alpha=0.85, width=0.6)
        ax_bar.set_title("Forecast - Mean Delta", fontsize=(8+fontPlusSize))
        ax_bar.axhline(0, color='black', linewidth=0.8, linestyle='--')
        ax_bar.tick_params(axis='x', labelrotation=45, labelsize=(8+fontPlusSize))
        ax_bar.tick_params(axis='y', labelsize=(8+fontPlusSize))
        ax_bar.grid(True, linestyle=':', alpha=0.4)

    plt.tight_layout()
    target_file = _save_and_cleanup(fig, out_path, filename, pattern="*_climate_forecast_cell.svg")
    return target_file

if __name__ == "__main__":
    create_ENSO_suitability_visualizations(cell_id=200506)
