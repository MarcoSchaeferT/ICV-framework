"""Core boundary types and internal TypedDict structures for ICV-framework.

Architecture Rule:
- Pydantic Annotated types are strictly used at the Flask HTTP boundary for
  validating incoming requests (query params, POST bodies).
- Internal layers, database return dictionaries, and analytical processing use
  native Python TypedDicts to prevent runtime validation overhead and code bloat.
"""

from typing import Annotated, Literal, TypedDict, Optional
from pydantic import Field


# ────────────────────────────────────────────────
#  Boundary Types (Pydantic Annotated)
#  Used exclusively for Flask Request Input Validation
# ────────────────────────────────────────────────

RelationName = Annotated[
    str,
    Field(min_length=1, description="Non-empty PostgreSQL relation name."),
]

LangCode = Annotated[
    Literal["en", "de"],
    Field(description="Supported two-letter language code ('en' or 'de')."),
]

CellId = Annotated[
    int,
    Field(ge=0, description="Nonnegative spatial grid cell identifier."),
]

UploadId = Annotated[
    str,
    Field(min_length=1, description="Upload UUID assigned at upload initiation."),
]

MapName = Annotated[
    str,
    Field(min_length=1, description="Packaged GeoJSON map identifier."),
]

ImagePath = Annotated[
    str,
    Field(min_length=1, description="Relative packaged image filename."),
]


# ────────────────────────────────────────────────
#  Internal & Output Data Structures (TypedDict)
#  Zero runtime overhead; full static typing
# ────────────────────────────────────────────────

class ColumnMetadataDict(TypedDict):
    """Internal dictionary structure of a column metadata row."""

    id: Optional[int]
    relation_name: str
    column_name: str
    datatype: str
    dimension: str
    description: str
    availability: int


class RelationSummary(TypedDict):
    """Internal dictionary structure of an unprotected database relation summary."""

    table_name: str
    row_count: int


class DatasetMetadataItem(TypedDict):
    """Internal dictionary structure of a column descriptor in the global metadata catalog."""

    valuename: str
    datatype: str
    dimension: str
    description: str
    availability: str


class GeoPointDict(TypedDict):
    """Internal dictionary structure for spatial coordinate pairs."""

    lat: float
    lon: float
