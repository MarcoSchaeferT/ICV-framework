"""Flask request type that streams upload parts directly to their work directory."""

from pathlib import Path
from typing import IO

from flask import Request


UPLOAD_DIR_ENV_KEY = "icv.upload_dir"


class DirectUploadRequest(Request):
    """Avoid Werkzeug's temporary-file-to-work-directory copy for uploads."""

    def _get_file_stream(
        self,
        total_content_length: int | None,
        content_type: str | None,
        filename: str | None = None,
        content_length: int | None = None,
    ) -> IO[bytes]:
        upload_dir_value = self.environ.get(UPLOAD_DIR_ENV_KEY)
        if not upload_dir_value or not filename:
            return super()._get_file_stream(
                total_content_length,
                content_type,
                filename,
                content_length,
            )

        upload_dir = Path(str(upload_dir_value)).resolve()
        upload_dir.mkdir(parents=True, exist_ok=True)

        # Browsers normally send only a basename, but strip both POSIX and
        # Windows path separators before resolving the destination.
        safe_filename = filename.replace("\\", "/").rsplit("/", 1)[-1]
        if safe_filename in {"", ".", ".."}:
            raise ValueError("Invalid upload filename")

        destination = (upload_dir / safe_filename).resolve()
        if destination.parent != upload_dir:
            raise ValueError("Upload filename escapes the upload directory")

        return destination.open("wb+")
