"""
In-memory response cache for database queries.

Limits (whichever is hit first triggers LRU eviction):
  - Max entries : 128
  - Max size    : 10 GB
  - TTL         : 24 hours

Thread-safe via a threading.Lock.
"""

import sys
import time
import threading
from collections import OrderedDict
from typing import Any, Optional


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
# Cache entry
# ---------------------------------------------------------------------------

class _CacheEntry:
    __slots__ = ("value", "created_at", "size_bytes")

    def __init__(self, value: Any, size_bytes: int):
        self.value = value
        self.created_at = time.monotonic()
        self.size_bytes = size_bytes


# ---------------------------------------------------------------------------
# ResponseCache
# ---------------------------------------------------------------------------

class ResponseCache:
    """
    Thread-safe, TTL + LRU + size-bounded response cache.

    Parameters
    ----------
    max_entries : int
        Maximum number of cached responses (default 265).
    max_bytes : int
        Maximum total memory for cached values (default 7 GB).
    ttl_seconds : float
        Time-to-live per entry in seconds (default 86 400 = 24 h).
    """

    def __init__(
        self,
        max_entries: int = 256,
        max_bytes: int = 7 * 1024 ** 3,  # 7 GB
        ttl_seconds: float = 86_400,       # 24 hours
    ):
        self._max_entries = max_entries
        self._max_bytes = max_bytes
        self._ttl = ttl_seconds
        self._lock = threading.Lock()

        # OrderedDict keeps insertion / access order → LRU eviction is O(1)
        self._store: OrderedDict[str, _CacheEntry] = OrderedDict()
        self._current_bytes: int = 0

        # Stats
        self._hits: int = 0
        self._misses: int = 0

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
            # Move to end (most-recently used)
            self._store.move_to_end(key)
            self._hits += 1
            return entry.value

    def set(self, key: str, value: Any) -> None:
        """Store *value* under *key*, evicting stale / LRU entries as needed."""
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

            entry = _CacheEntry(value, size)
            self._store[key] = entry
            self._current_bytes += size

    def invalidate(self, relation_name: str) -> int:
        """Evict every entry whose key contains *relation_name*.

        Returns the number of evicted entries.
        """
        with self._lock:
            keys_to_remove = [
                k for k in self._store if relation_name in k
            ]
            for k in keys_to_remove:
                self._evict(k)
            return len(keys_to_remove)

    def clear(self) -> None:
        """Flush the entire cache."""
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
