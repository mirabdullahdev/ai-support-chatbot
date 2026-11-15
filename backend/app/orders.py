"""Order lookup tool. An order is only returned if BOTH number and email match."""
from __future__ import annotations

import json
import re
from typing import Any

from .config import settings

ORDER_RE = re.compile(r"\b(?:NT[-\s]?)?(\d{5})\b", re.IGNORECASE)
ORDER_FULL_RE = re.compile(r"\bNT[-\s]?(\d{5})\b", re.IGNORECASE)
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")


def normalize_order_number(value: str) -> str | None:
    m = ORDER_FULL_RE.search(value) or ORDER_RE.search(value)
    return f"NT-{m.group(1)}" if m else None


def extract_order_number(text: str) -> str | None:
    return normalize_order_number(text)


def extract_email(text: str) -> str | None:
    m = EMAIL_RE.search(text)
    return m.group(0).lower() if m else None


def _load() -> list[dict[str, Any]]:
    with open(settings.orders_file, encoding="utf-8") as f:
        return json.load(f)


def lookup_order(order_number: str | None, email: str | None) -> dict[str, Any] | None:
    """Return the order if the number AND email both match, otherwise None."""
    if not order_number or not email:
        return None
    number = normalize_order_number(order_number)
    if not number:
        return None
    for order in _load():
        if order["order_number"] == number and order["email"].lower() == email.strip().lower():
            return order
    return None
