"""
Shared helpers for reading per-language dataset metadata CSV files.
(e.g. en_metaData.csv, de_metaData.csv).
"""

import csv
import os
from pathlib import Path
from typing import Optional

# Base path set once via init(), sourced from DataPaths.meta_data
_META_DATA_BASE: Optional[Path] = None


def init(meta_data_base_path: Path) -> None:
    """Initialise the module with the base metadata path from DataPaths."""
    global _META_DATA_BASE
    _META_DATA_BASE = meta_data_base_path


def getMetaDataPath(lang: str) -> Path:
    """Return the resolved path for the metadata CSV of the given language."""
    if _META_DATA_BASE is None:
        raise RuntimeError("metadata_utils.init() has not been called")
    if not lang:
        lang = "en"
    file_name = lang.lower() + "_" + _META_DATA_BASE.name
    return _META_DATA_BASE.with_name(file_name)


def loadMetadataCSV(lang: str) -> dict[str, dict]:
    """
    Read the metadata CSV for *lang* and return a dict keyed by the first
    column (usually ``valuename``).

    Returns an empty dict when the file does not exist.
    """
    path: Path = getMetaDataPath(lang)
    if not os.path.exists(path):
        return {}

    data: dict[str, dict] = {}
    with open(path, mode="r", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)
        column_names = reader.fieldnames
        if column_names is None:
            return {}
        column_names = [name for name in column_names if name]
        for row in reader:
            data[row[str(column_names[0])]] = row
    return data
