import csv
import io
from pathlib import Path
from typing import Generator, Optional, Union

# Set to a reasonable 10MB limit per field
csv.field_size_limit(10485760)

class ParsedData:
    """Metadata about the CSV file without loading all rows into memory"""
    db_name: str
    column_names: list[str]
    sanitized_column_names: list[str]
    file_size: int
    file_path: Optional[Path]

    def __init__(self):
        self.db_name: str = ""
        self.column_names: list[str] = []
        self.sanitized_column_names: list[str] = []
        self.file_size: int = 0
        self.file_path: Optional[Path] = None


async def parseCSVdata(file_path: Path) -> Union[ParsedData, dict]:
    """Parse CSV metadata without loading all rows into memory"""
    filename = file_path.name
    parsedCSVdata = ParsedData()
    try:
        with open(file_path, mode="r", encoding="utf-8") as csvfile:
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
        data = {"ERROR": "ERROR reading CSV file:" + str(e)}
        return data


def stream_csv_rows(file_path: Path) -> Generator[tuple[dict, int], None, None]:
    """Generator that yields (row, bytes_consumed) pairs one at a time without
    loading the entire file into memory.

    bytes_consumed is the byte offset the underlying reader has consumed so
    far — used together with ParsedData.file_size for progress reporting
    (slightly ahead of the parsed row due to read buffering, which is fine
    for a progress bar).
    """
    try:
        with open(file_path, mode="rb") as rawfile:
            csvfile = io.TextIOWrapper(rawfile, encoding="utf-8", newline="")
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


def snanitize_values(column_values) -> list[str]:
    sanitized_column_values: list[str] = []
    for value in column_values:
        sanitized_value: str = snanitize_value(value)
        sanitized_column_values.append(sanitized_value)

    return sanitized_column_values

def snanitize_value(column_value) -> str:
    
    sanitized_column_value: str = (
          column_value.replace("'", "`")
        )

    return sanitized_column_value


def snanitize_date(column_value) -> str:
    
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