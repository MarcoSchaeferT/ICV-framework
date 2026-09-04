"""Geospatial helper utilities for processData modules."""

from decimal import Decimal, ROUND_HALF_UP


def extract_centroid(row: dict) -> tuple[float, float]:
    """Return (latitude, longitude) of the cell centroid.

    If `geometry` (WKT POLYGON) is present in the row, computes the center
    from the polygon boundary coordinates. Otherwise falls back to
    `latitude` and `longitude` fields in the row dict.
    """
    geom = row.get("geometry")
    if geom and isinstance(geom, str) and "POLYGON" in geom:
        try:
            raw = geom.replace("POLYGON", "").replace("(", "").replace(")", "").strip()
            pts = [list(map(float, p.strip().split())) for p in raw.split(",") if p.strip()]
            if pts:
                lngs = [p[0] for p in pts]
                lats = [p[1] for p in pts]
                center_lat = (min(lats) + max(lats)) / 2.0
                center_lng = (min(lngs) + max(lngs)) / 2.0
                return center_lat, center_lng
        except Exception:
            pass
    return float(row["latitude"]), float(row["longitude"])


def format_coord(val: float, decimals: int = 2) -> str:
    """Format coordinate using standard half-up rounding to match frontend tooltips."""
    quant = Decimal("0." + "0" * (decimals - 1) + "1") if decimals > 0 else Decimal("1")
    d = Decimal(str(val)).quantize(quant, rounding=ROUND_HALF_UP)
    return f"{d:.{decimals}f}"


# Convenience private aliases for backward-compatible call sites
_extract_centroid = extract_centroid
_format_coord = format_coord
