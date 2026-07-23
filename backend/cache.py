"""
In-memory response cache for database queries, with cross-worker
invalidation via Redis epoch counters.

Cached values stay in each Gunicorn worker's memory — they can be hundreds
of MB, far too big for the small Redis instance. Only INVALIDATION is
coordinated through Redis:

  - every entry is tagged at write time with the current epoch of its
    scopes (relation names it depends on)
  - invalidate(scope) bumps the scope's epoch counter in Redis (visible to
    ALL workers) and evicts matching local entries immediately
  - get() compares the entry's stored epochs against Redis (one MGET per
    hit); a mismatch means another worker invalidated the scope, so the
    local entry is evicted and the caller re-fetches from the DB

If Redis is unreachable the cache fails open: entries are stored and served
without epoch checks (per-worker behavior, as before Redis existed), and a
circuit breaker skips Redis for a while so requests don't pay the
connection timeout. Epoch keys evicted by Redis (allkeys-lru) read as 0,
which at worst causes a spurious cache miss — never stale data.

Limits (whichever is hit first triggers LRU eviction):
  - Max entries : CACHE_MAX_ENTRIES (default 256)
  - Max size    : CACHE_MAX_GB (default 3.0 GB)
  - TTL         : 24 hours

Thread-safe via a threading.Lock.
"""

import sys
import os
import time
import threading
from collections import OrderedDict
from typing import Any, Iterable, Optional

import redis

# Same Redis instance that backs the shared upload progress/error state
from backend.upload_state import REDIS_URL

_EPOCH_KEY_PREFIX = "davis:cache:epoch:"
# Implicit scope attached to every entry so clear() can flush all workers
_GLOBAL_SCOPE = "__all__"
# How long to skip Redis after a failure before probing again
_REDIS_RETRY_SECONDS = 30.0


def _epoch_key(scope: str) -> str:
    return _EPOCH_KEY_PREFIX + scope


# ---------------------------------------------------------------------------
# Deep-size helper – recursively estimates the memory footprint of an object
# ---------------------------------------------------------------------------

def _deep_getsizeof(obj: Any, _seen: Optional[set] = None) -> int:
    """Recursively approximate the memory size of *obj* in bytes."""
    if _seen is None:
        _seen = set()

    obj_id = id(obj)
    if obj_id in _seen:
        return 0
    _seen.add(obj_id)

    size = sys.getsizeof(obj)

    if isinstance(obj, dict):
        size += sum(_deep_getsizeof(k, _seen) + _deep_getsizeof(v, _seen) for k, v in obj.items())
    elif isinstance(obj, (list, tuple, set, frozenset)):
        size += sum(_deep_getsizeof(item, _seen) for item in obj)
    elif hasattr(obj, '__dict__'):
        size += _deep_getsizeof(vars(obj), _seen)

    return size


# ---------------------------------------------------------------------------
# Cache configuration defaults from environment variables
# ---------------------------------------------------------------------------

DEFAULT_CACHE_MAX_GB = float(os.getenv("CACHE_MAX_GB", "3.0"))
DEFAULT_CACHE_MAX_BYTES = int(DEFAULT_CACHE_MAX_GB * 1024 ** 3)
DEFAULT_CACHE_MAX_ENTRIES = int(os.getenv("CACHE_MAX_ENTRIES", "256"))


# ---------------------------------------------------------------------------
# Cache entry
# ---------------------------------------------------------------------------

class _CacheEntry:
    __slots__ = ("value", "created_at", "size_bytes", "scopes", "epochs")

    def __init__(
        self,
        value: Any,
        size_bytes: int,
        scopes: tuple,
        epochs: Optional[tuple],
    ):
        self.value = value
        self.created_at = time.monotonic()
        self.size_bytes = size_bytes
        # Scopes this entry depends on, and their Redis epochs at write
        # time. epochs is None when Redis was unreachable at write time —
        # such entries are served without cross-worker checks (fail open).
        self.scopes = scopes
        self.epochs = epochs


# ---------------------------------------------------------------------------
# ResponseCache
# ---------------------------------------------------------------------------

class ResponseCache:
    """
    Thread-safe, TTL + LRU + size-bounded response cache with cross-worker
    invalidation through Redis epoch counters.

    Parameters
    ----------
    max_entries : int
        Maximum number of cached responses (default dynamically loaded).
    max_bytes : int
        Maximum total memory for cached values (default dynamically loaded).
    ttl_seconds : float
        Time-to-live per entry in seconds (default 86 400 = 24 h).
    """

    def __init__(
        self,
        max_entries: int = DEFAULT_CACHE_MAX_ENTRIES,
        max_bytes: int = DEFAULT_CACHE_MAX_BYTES,
        ttl_seconds: float = 86_400,       # 24 hours
    ):
        self._max_entries = max_entries
        self._max_bytes = max_bytes
        self._ttl = ttl_seconds
        self._lock = threading.Lock()

        # OrderedDict keeps insertion / access order → LRU eviction is O(1)
        self._store: OrderedDict[str, _CacheEntry] = OrderedDict()
        self._current_bytes: int = 0

        # Redis client for epoch counters (lazy, created per worker process
        # after fork — same pattern as backend/upload_state.py)
        self._redis_client: Optional[redis.Redis] = None
        self._redis_client_lock = threading.Lock()
        self._redis_down_until: float = 0.0
        self._warned = False

        # Stats
        self._hits: int = 0
        self._misses: int = 0
        self._epoch_evictions: int = 0

    # ------------------------------------------------------------------
    # Redis epoch helpers
    # ------------------------------------------------------------------

    def _redis(self) -> redis.Redis:
        if self._redis_client is None:
            with self._redis_client_lock:
                if self._redis_client is None:
                    self._redis_client = redis.Redis.from_url(
                        REDIS_URL,
                        decode_responses=True,
                        socket_connect_timeout=1.0,
                        socket_timeout=2.0,
                        health_check_interval=30,
                    )
        return self._redis_client

    def _redis_failed(self, err: Exception) -> None:
        if not self._warned:
            self._warned = True
            print(
                f"WARNING: Redis unavailable ({err}) — response cache falls "
                "back to per-worker invalidation only. Other workers may "
                "serve stale entries until their TTL expires."
            )
        self._redis_down_until = time.monotonic() + _REDIS_RETRY_SECONDS

    def _current_epochs(self, scopes: tuple) -> Optional[tuple]:
        """Fetch the current epoch for each scope (missing key = 0).

        Returns None when Redis is unreachable (fail open). Never called
        while holding self._lock, so a slow Redis cannot serialize all
        handler threads.
        """
        if time.monotonic() < self._redis_down_until:
            return None
        try:
            values = self._redis().mget([_epoch_key(s) for s in scopes])
            return tuple(int(v) if v is not None else 0 for v in values)
        except (redis.RedisError, OSError, ValueError) as e:
            self._redis_failed(e)
            return None

    def _bump_epoch(self, scope: str) -> None:
        """Increment a scope's epoch so every worker drops entries tagged with it."""
        if time.monotonic() < self._redis_down_until:
            return
        try:
            self._redis().incr(_epoch_key(scope))
        except (redis.RedisError, OSError) as e:
            self._redis_failed(e)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get(self, key: str) -> Optional[Any]:
        """Return the cached value for *key*, or ``None`` on miss / expiry."""
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                self._misses += 1
                return None
            # Check TTL
            if (time.monotonic() - entry.created_at) > self._ttl:
                self._evict(key)
                self._misses += 1
                return None
            scopes, stored_epochs, value = entry.scopes, entry.epochs, entry.value

        # Cross-worker invalidation check (outside the lock — Redis I/O)
        if stored_epochs is not None:
            current = self._current_epochs(scopes)
            if current is not None and current != stored_epochs:
                with self._lock:
                    self._evict(key)
                    self._epoch_evictions += 1
                    self._misses += 1
                return None

        with self._lock:
            # Move to end (most-recently used) — entry may have been
            # evicted concurrently, hence the membership check
            if key in self._store:
                self._store.move_to_end(key)
            self._hits += 1
        return value

    def set(self, key: str, value: Any, scopes: Iterable[str] = ()) -> None:
        """Store *value* under *key*, evicting stale / LRU entries as needed.

        *scopes* are the relation names the value depends on; invalidating
        any of them (from any worker) makes this entry stale.
        """
        entry_scopes = (_GLOBAL_SCOPE, *scopes)
        epochs = self._current_epochs(entry_scopes)
        size = _deep_getsizeof(value)
        with self._lock:
            # If key already cached, evict old entry first
            if key in self._store:
                self._evict(key)

            # Evict expired entries first
            self._evict_expired()

            # Evict LRU entries until both limits are satisfied
            while (
                self._store
                and (
                    len(self._store) >= self._max_entries
                    or self._current_bytes + size > self._max_bytes
                )
            ):
                self._evict_lru()

            # If a single entry is bigger than max_bytes, don't cache it
            if size > self._max_bytes:
                return

            entry = _CacheEntry(value, size, entry_scopes, epochs)
            self._store[key] = entry
            self._current_bytes += size

    def invalidate(self, scope: str) -> int:
        """Invalidate *scope* (a relation name) across ALL workers.

        Bumps the scope's Redis epoch (other workers drop their entries
        lazily on next access) and evicts every local entry whose key
        contains *scope*. Returns the number of locally evicted entries.
        """
        self._bump_epoch(scope)
        with self._lock:
            # Match by scope tag OR key substring (substring keeps the old
            # behavior for entries whose keys embed the relation name)
            keys_to_remove = [
                k for k, e in self._store.items()
                if scope in e.scopes or scope in k
            ]
            for k in keys_to_remove:
                self._evict(k)
            return len(keys_to_remove)

    def clear(self) -> None:
        """Flush the entire cache — in every worker, via the global epoch."""
        self._bump_epoch(_GLOBAL_SCOPE)
        with self._lock:
            self._store.clear()
            self._current_bytes = 0

    def stats(self) -> dict:
        """Return cache statistics."""
        with self._lock:
            return {
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": (
                    round(self._hits / (self._hits + self._misses), 3)
                    if (self._hits + self._misses) > 0
                    else 0
                ),
                "entries": len(self._store),
                "max_entries": self._max_entries,
                "size_bytes": self._current_bytes,
                "size_mb": round(self._current_bytes / (1024 ** 2), 2),
                "max_size_gb": round(self._max_bytes / (1024 ** 3), 2),
                "ttl_seconds": self._ttl,
                "epoch_evictions": self._epoch_evictions,
            }

    # ------------------------------------------------------------------
    # Internal helpers (must be called while holding self._lock)
    # ------------------------------------------------------------------

    def _evict(self, key: str) -> None:
        entry = self._store.pop(key, None)
        if entry is not None:
            self._current_bytes -= entry.size_bytes

    def _evict_lru(self) -> None:
        """Remove the least-recently-used entry."""
        if self._store:
            _key, entry = self._store.popitem(last=False)
            self._current_bytes -= entry.size_bytes

    def _evict_expired(self) -> None:
        """Remove all entries that have exceeded their TTL."""
        now = time.monotonic()
        expired = [
            k for k, e in self._store.items()
            if (now - e.created_at) > self._ttl
        ]
        for k in expired:
            self._evict(k)


# ---------------------------------------------------------------------------
# Module-level singleton  — import this in route handlers
# ---------------------------------------------------------------------------

response_cache = ResponseCache()


def make_cache_key(*args: Any) -> str:
    """Build a deterministic cache key from positional arguments.

    Typical usage::

        key = make_cache_key("getDataFromDB", relationName, feature,
                             filterBy, filterValue, startDate, endDate,
                             task, aggregation_level)
    """
    return "|".join(str(a) for a in args)
