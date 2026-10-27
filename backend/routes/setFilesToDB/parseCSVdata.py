"""Read uploaded CSV headers and stream rows without materializing the file."""

import csv
import io
from pathlib import Path
from typing import Generator, Optional, Union

# Set to a reasonable 10MB limit per field
csv.field_size_limit(10485760)

class ParsedData:
    """CSV header and upload metadata shared by schema creation and COPY.

    ``column_names`` preserves source headers; ``sanitized_column_names``
    aligns by index with them and names the PostgreSQL columns. ``file_size``
    is measured in bytes for progress reporting. Rows remain on disk.

    Example:
        ```python
        parsed = ParsedData()
        parsed.db_name = "dengue_serotype_counts"
        parsed.column_names = ["Country", "Year", "Serotype Count"]
        parsed.sanitized_column_names = ["country", "year", "serotype_count"]
        parsed.file_size = 18432
        ```
    """
    db_name: str
    column_names: list[str]
    sanitized_column_names: list[str]
    file_size: int
    file_path: Optional[Path]
    inferred_types: Optional[dict[str, str]]
    column_sql_types: list[str]

    def __init__(self):
        """Initialize empty header, type, path, and size metadata."""
        self.db_name: str = ""
        self.column_names: list[str] = []
        self.sanitized_column_names: list[str] = []
        self.file_size: int = 0
        self.file_path: Optional[Path] = None
        self.inferred_types: Optional[dict[str, str]] = None
        self.column_sql_types: list[str] = []


async def parseCSVdata(file_path: Path) -> Union[ParsedData, dict]:
    """Read a UTF-8 CSV header and derive its PostgreSQL relation name.

    Returns a ``ParsedData`` instance without scanning rows, or a
    ``{"error": ...}`` dictionary if reading or parsing fails. The caller
    checks that error result before creating a table.
    """
    filename = file_path.name
    parsedCSVdata = ParsedData()
    try:
        with open(file_path, mode="r", encoding="utf-8-sig") as csvfile:
            parserObj = csv.DictReader(csvfile)
            column_names = [name for name in parserObj.fieldnames if name] if parserObj.fieldnames is not None else []

            db_name: str = sanitize_names([Path(filename).stem])[0]
            sanitized_column_names: list[str] = sanitize_names(column_names)

            # Set the parsed data (no rows stored in memory). No row counting —
            # progress is derived from bytes consumed while streaming, so the
            # file does not need to be read twice.
            parsedCSVdata.db_name = db_name
            parsedCSVdata.column_names = column_names
            parsedCSVdata.sanitized_column_names = sanitized_column_names
            parsedCSVdata.file_size = file_path.stat().st_size
            parsedCSVdata.file_path = file_path

            return parsedCSVdata
    except Exception as e:
        print("ERROR reading CSV file", e)
        data = {"error": "ERROR reading CSV file: " + str(e)}
        return data


def stream_csv_rows(file_path: Path) -> Generator[tuple[dict, int], None, None]:
    """Yield ``(row, bytes_consumed)`` pairs one at a time without loading the file into memory.

    Args:
        file_path: Path to a UTF-8 (or UTF-8 with BOM) CSV file on disk.

    Yields:
        Tuples of ``(row_dict, bytes_consumed)`` where ``bytes_consumed`` is the
        underlying binary stream offset read so far (used with
        ``ParsedData.file_size`` for upload progress reporting).

    Raises:
        OSError: If ``file_path`` cannot be opened or read.
        csv.Error: If the CSV stream contains malformed fields exceeding the 10 MB limit.
    """
    try:
        with open(file_path, mode="rb") as rawfile:
            csvfile = io.TextIOWrapper(rawfile, encoding="utf-8-sig", newline="")
            parserObj = csv.DictReader(csvfile)
            for row in parserObj:
                yield row, rawfile.tell()
    except Exception as e:
        print(f"ERROR streaming CSV file: {e}")
        raise



# PostgreSQL truncates identifiers to 63 characters (NAMEDATALEN - 1).
_PG_NAMEDATALEN = 63

# Sanitize column names to have allowed strings for PostgreSQL
def sanitize_names(column_names) -> list[str]:
    """Convert non-empty CSV names to PostgreSQL-compatible identifiers.

    Spaces, hyphens, colons, and dots are replaced; leading digits receive
    ``t_``. Identifiers are truncated to PostgreSQL's 63-character limit.
    The function does not resolve collisions between sanitized names.
    """
    sanitized_column_names: list[str] = []
    for name in column_names:
        sanitized_name: str = (
            name.lower()
            .replace(" ", "_")
            .replace("-", "_")
            .replace(":", "__")
            .replace(".", "_")
        )
        if sanitized_name[0].isdigit():
            sanitized_name = "t_" + sanitized_name
        # Truncate to PostgreSQL's max identifier length
        sanitized_name = sanitized_name[:_PG_NAMEDATALEN]
        sanitized_column_names.append(sanitized_name)

    return sanitized_column_names


def snanitize_date(column_value) -> str:
    """Normalize legacy incomplete date text before database ingestion.

    Unknown year and month markers become ``0001`` and ``01``. For a slash-
    separated value, only the final segment is kept; missing components are
    filled with the first month or day.
    """
    
    sanitized_column_value: str = (
          column_value.replace("XXXX", "0001")
        )
    sanitized_column_value: str = (
          sanitized_column_value.replace("XX", "01")
        )
    # handle double data as one entry... facepalm
    tmpSplit = sanitized_column_value.split("/")
    sanitized_column_value = tmpSplit[len(tmpSplit) - 1]

    # handle incomplete dates... facepalm
    tmpSplit = sanitized_column_value.split("-")
    if len(tmpSplit) <= 2:
        sanitized_column_value = sanitized_column_value + "-01"
    if len(tmpSplit) <= 1:
        sanitized_column_value = sanitized_column_value + "-01"


    return sanitized_column_value
