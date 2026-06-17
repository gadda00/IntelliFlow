"""
common/smart_cache.py
IntelliFlow Smart Cache — TTL + LRU eviction
"""
import time
import threading
import hashlib
import json
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger("intelliflow.cache")


class SmartCache:
    """
    Thread-safe in-memory cache with TTL expiry and LRU eviction.
    For production, replace the backend with Redis by swapping _store.
    """

    def __init__(self, max_size: int = 500, ttl_minutes: int = 60):
        self._max_size = max_size
        self._ttl = ttl_minutes * 60
        self._store: Dict[str, Dict] = {}  # key → {value, ts, hits}
        self._lock = threading.RLock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._store.get(key)
            if not entry:
                return None
            if time.time() - entry["ts"] > self._ttl:
                del self._store[key]
                return None
            entry["hits"] += 1
            entry["last_accessed"] = time.time()
            return entry["value"]

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            if len(self._store) >= self._max_size:
                self._evict()
            self._store[key] = {
                "value": value,
                "ts": time.time(),
                "last_accessed": time.time(),
                "hits": 0
            }

    def delete(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()

    def stats(self) -> Dict:
        with self._lock:
            now = time.time()
            live = {k: v for k, v in self._store.items() if now - v["ts"] <= self._ttl}
            return {
                "total_keys": len(live),
                "max_size": self._max_size,
                "ttl_minutes": self._ttl // 60,
                "hit_counts": {k: v["hits"] for k, v in live.items()}
            }

    def _evict(self) -> None:
        """Evict: first expired, then LRU."""
        now = time.time()
        expired = [k for k, v in self._store.items() if now - v["ts"] > self._ttl]
        for k in expired:
            del self._store[k]
        if len(self._store) >= self._max_size:
            # LRU: remove least recently accessed
            lru_key = min(self._store, key=lambda k: self._store[k]["last_accessed"])
            del self._store[lru_key]

    @staticmethod
    def make_key(*args) -> str:
        raw = json.dumps(args, sort_keys=True, default=str)
        return hashlib.sha256(raw.encode()).hexdigest()[:32]
