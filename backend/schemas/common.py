"""Shared Pydantic schemas, annotated types, and response wrappers."""

from pydantic import BaseModel, ConfigDict
from backend.types import (
    CellId,
    ImagePath,
    LangCode,
    MapName,
    RelationName,
    UploadId,
)


class BaseSchema(BaseModel):
    """Base schema enforcing clean whitespace handling and attribute docstrings.

    Attribute docstrings under fields are automatically parsed by Pydantic
    (v2.7+) into OpenAPI JSON schemas and extracted by Fumadocs, eliminating
    redundant Field(description=...) definitions.

    Example:
        ```python
        class FilterParams(BaseSchema):
            dataset: str
            \"\"\"PostgreSQL dataset relation name.\"\"\"
        ```
    """

    model_config = ConfigDict(
        use_attribute_docstrings=True,
        str_strip_whitespace=True,
    )


# ────────────────────────────────────────────────
#  Common Response Envelopes
# ────────────────────────────────────────────────

class SuccessResponse(BaseModel):
    """Generic success confirmation payload.

    Example:
        ```python
        res = SuccessResponse(success=True)
        ```
    """

    success: bool = True


class MessageResponse(BaseModel):
    """Generic informative message payload.

    Example:
        ```python
        res = MessageResponse(message="Processing complete")
        ```
    """

    message: str


__all__ = [
    "BaseSchema",
    "CellId",
    "ImagePath",
    "LangCode",
    "MapName",
    "MessageResponse",
    "RelationName",
    "SuccessResponse",
    "UploadId",
]
