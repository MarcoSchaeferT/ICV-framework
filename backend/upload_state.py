"""
Shared upload state (progress + error) backed by Redis, keyed by upload_id.

Gunicorn runs multiple worker processes, so module-level globals are
per-process: the worker handling an upload writes its own copy of the
progress/error state while the frontend's polling requests land on other
workers and read stale values. Redis gives all workers one shared view.

State is keyed by the upload_id generated in route_setFilesToDB and returned
to the client, so concurrent uploads (multiple users/tabs) don't clobber each
other's progress. The client polls GET /api/uploadStatus?id=<upload_id>.

Falls back to process-local state when Redis is unreachable (e.g. local
development with the single-process Flask dev server and no Redis running).

Configuration:
  REDIS_URL — connection URL (default: redis://localhost:6379/0)
"""

import os
import threading

import redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Redis keys — upload_id is a UUID, so the per-upload keys cannot collide
# with the file-lock namespace below.
_FILE_LOCK_PREFIX = "davis:upload:processing:"


def _progress_key(upload_id: str) -> str:
    return f"davis:upload:{upload_id}:progress"


def _error_key(upload_id: str) -> str:
    return f"davis:upload:{upload_id}:error"


# Progress/error state is transient — expire keys so stale values never
# survive long past an upload.
_STATE_TTL_SECONDS = 24 * 3600

# Per-file processing lock TTL: safety net so a worker that dies without
# releasing the lock cannot block re-uploads of that file forever.
_FILE_LOCK_TTL_SECONDS = 30 * 60

# Returned for ids whose keys are missing (e.g. evicted under memory
# pressure). 1.0 means "in progress": the next set_progress() write recreates
# the key, so a benign default self-heals; reporting an error here would
# abort a healthy upload on the client.
_DEFAULT_PROGRESS = 1.0
NO_ERROR = "false"


class _UploadState:
    """Thread-safe accessor for the shared per-upload progress/error state."""

    def __init__(self):
        self._client: redis.Redis | None = None
        self._client_lock = threading.Lock()
        self._warned = False

        # Process-local fallback (only used when Redis is unreachable)
        self._local_lock = threading.Lock()
        self._local_progress: dict[str, float] = {}
        self._local_errors: dict[str, str] = {}
        self._local_file_locks: set[str] = set()

    # ------------------------------------------------------------------
    # Redis client (lazy, created per worker process after fork)
    # ------------------------------------------------------------------

    def _redis(self) -> redis.Redis:
        if self._client is None:
            with self._client_lock:
                if self._client is None:
                    self._client = redis.Redis.from_url(
                        REDIS_URL,
                        decode_responses=True,
                        socket_connect_timeout=1.0,
                        socket_timeout=2.0,
                        health_check_interval=30,
                    )
        return self._client

    def _warn_once(self, err: Exception) -> None:
        if not self._warned:
            self._warned = True
            print(
                f"WARNING: Redis unavailable ({err}) — falling back to "
                "process-local upload state. Progress/error polling is NOT "
                "reliable with multiple Gunicorn workers in this mode."
            )

    # ------------------------------------------------------------------
    # Per-upload progress/error state
    # ------------------------------------------------------------------

    def start(self, upload_id: str) -> None:
        """Initialize state for a new upload (progress=1, no error).

        Called by the upload route BEFORE it returns the upload_id to the
        client, so the keys always exist by the time polling starts.
        """
        try:
            pipe = self._redis().pipeline()
            pipe.set(_progress_key(upload_id), _DEFAULT_PROGRESS, ex=_STATE_TTL_SECONDS)
            pipe.set(_error_key(upload_id), NO_ERROR, ex=_STATE_TTL_SECONDS)
            pipe.execute()
        except (redis.RedisError, OSError) as e:
            self._warn_once(e)
            with self._local_lock:
                self._local_progress[upload_id] = _DEFAULT_PROGRESS
                self._local_errors[upload_id] = NO_ERROR

    def set_progress(self, upload_id: str, progress: float) -> None:
        try:
            self._redis().set(
                _progress_key(upload_id), float(progress), ex=_STATE_TTL_SECONDS
            )
        except (redis.RedisError, OSError) as e:
            self._warn_once(e)
            with self._local_lock:
                self._local_progress[upload_id] = float(progress)

    def set_error(self, upload_id: str, message: str) -> None:
        try:
            self._redis().set(_error_key(upload_id), message, ex=_STATE_TTL_SECONDS)
        except (redis.RedisError, OSError) as e:
            self._warn_once(e)
            with self._local_lock:
                self._local_errors[upload_id] = message

    def get_status(self, upload_id: str) -> dict:
        """Return {"progress": float, "error": str} in a single Redis round-trip."""
        try:
            progress_raw, error_raw = self._redis().mget(
                _progress_key(upload_id), _error_key(upload_id)
            )
            return {
                "progress": float(progress_raw) if progress_raw is not None else _DEFAULT_PROGRESS,
                "error": error_raw if error_raw is not None else NO_ERROR,
            }
        except (redis.RedisError, OSError, ValueError) as e:
            self._warn_once(e)
            with self._local_lock:
                return {
                    "progress": self._local_progress.get(upload_id, _DEFAULT_PROGRESS),
                    "error": self._local_errors.get(upload_id, NO_ERROR),
                }

    # ------------------------------------------------------------------
    # Per-file processing lock (prevents two workers processing the same
    # file concurrently — the old in-memory set only guarded one process)
    # ------------------------------------------------------------------

    def try_acquire_file_lock(self, file_name: str) -> bool:
        """Return True if the lock was acquired, False if already held."""
        try:
            return bool(
                self._redis().set(
                    _FILE_LOCK_PREFIX + file_name,
                    "1",
                    nx=True,
                    ex=_FILE_LOCK_TTL_SECONDS,
                )
            )
        except (redis.RedisError, OSError) as e:
            self._warn_once(e)
            with self._local_lock:
                if file_name in self._local_file_locks:
                    return False
                self._local_file_locks.add(file_name)
                return True

    def release_file_lock(self, file_name: str) -> None:
        try:
            self._redis().delete(_FILE_LOCK_PREFIX + file_name)
        except (redis.RedisError, OSError) as e:
            self._warn_once(e)
        with self._local_lock:
            self._local_file_locks.discard(file_name)


# ---------------------------------------------------------------------------
# Module-level singleton — import this in route handlers
# ---------------------------------------------------------------------------

upload_state = _UploadState()
