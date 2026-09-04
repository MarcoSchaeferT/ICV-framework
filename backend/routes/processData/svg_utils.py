"""Shared helpers for thread-safe SVG rendering and optional file export."""

from io import BytesIO
import os
from pathlib import Path
import tempfile
import threading

import matplotlib.pyplot as plt


# Matplotlib keeps process-global state and is not thread-safe.  API cache
# misses and offline exports therefore share one re-entrant render lock.
SVG_RENDER_LOCK = threading.RLock()


def figure_to_svg_bytes(fig, *, bbox_inches: str | None = None) -> bytes:
    """Serialize and close a Matplotlib figure without touching the filesystem."""
    buffer = BytesIO()
    try:
        fig.savefig(buffer, format="svg", bbox_inches=bbox_inches)
        return buffer.getvalue()
    finally:
        plt.close(fig)
        buffer.close()


def save_svg_atomic(svg_data: bytes, target: Path) -> Path:
    """Atomically replace one explicitly requested offline SVG export."""
    target.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        dir=target.parent,
        prefix=f".{target.name}.",
        suffix=".tmp",
    )
    temporary_path = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as temporary_file:
            temporary_file.write(svg_data)
        os.replace(temporary_path, target)
    except Exception:
        temporary_path.unlink(missing_ok=True)
        raise
    return target
