import time
from collections import defaultdict, deque
from threading import Lock


class RateLimiter:
    """In-memory sliding window. Per-process: use Redis or a reverse proxy
    limit if you run several workers."""

    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def _prune(self, key: str, now: float) -> deque[float]:
        q = self._hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if not q:
            self._hits.pop(key, None)
            return deque()
        return q

    def retry_after(self, key: str) -> int:
        """Seconds until a request is allowed again (0 if allowed now)."""
        now = time.monotonic()
        with self._lock:
            q = self._prune(key, now)
            if len(q) < self.limit:
                return 0
            return max(1, int(self.window - (now - q[0])) + 1)

    def hit(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            self._prune(key, now)
            self._hits[key].append(now)

    def reset(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)
