"""Simple in-memory sliding-window rate limiter, keyed by chat session."""
from __future__ import annotations

import time
from collections import defaultdict, deque

from .config import settings

_hits: dict[str, deque[float]] = defaultdict(deque)
WINDOW_SECONDS = 60.0


def allow(key: str) -> bool:
    now = time.monotonic()
    hits = _hits[key]
    while hits and now - hits[0] > WINDOW_SECONDS:
        hits.popleft()
    if len(hits) >= settings.rate_limit_per_minute:
        return False
    hits.append(now)
    return True


def reset() -> None:
    _hits.clear()
