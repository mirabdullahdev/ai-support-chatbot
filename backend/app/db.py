"""SQLite storage for conversations, messages and handoff leads."""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator

from .config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    last_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'text',
    meta TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, id);
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    question TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""

# Message kinds that count as the bot successfully helping the customer.
ANSWERED_KINDS = ("answer", "order_card")


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(settings.db_path)
    conn.row_factory = sqlite3.Row
    try:
        conn.executescript(SCHEMA)
        yield conn
        conn.commit()
    finally:
        conn.close()


def add_message(session_id: str, role: str, content: str, kind: str = "text", meta: dict[str, Any] | None = None) -> None:
    ts = now()
    with connect() as conn:
        conn.execute(
            "INSERT INTO conversations(id, created_at, last_at) VALUES(?,?,?) "
            "ON CONFLICT(id) DO UPDATE SET last_at=excluded.last_at",
            (session_id, ts, ts),
        )
        conn.execute(
            "INSERT INTO messages(session_id, role, content, kind, meta, created_at) VALUES(?,?,?,?,?,?)",
            (session_id, role, content, kind, json.dumps(meta) if meta else None, ts),
        )


def get_history(session_id: str, limit: int) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT role, content, kind FROM messages WHERE session_id=? ORDER BY id DESC LIMIT ?",
            (session_id, limit),
        ).fetchall()
    return [dict(r) for r in reversed(rows)]


def add_lead(session_id: str | None, name: str, email: str, question: str) -> int:
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO leads(session_id, name, email, question, created_at) VALUES(?,?,?,?,?)",
            (session_id, name, email, question, now()),
        )
        return int(cur.lastrowid or 0)


def list_leads() -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM leads ORDER BY id DESC").fetchall()
    return [dict(r) for r in rows]


def list_conversations() -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT c.id, c.created_at, c.last_at,
                   COUNT(m.id) AS message_count,
                   (SELECT content FROM messages WHERE session_id=c.id AND role='user' ORDER BY id LIMIT 1) AS first_question
            FROM conversations c LEFT JOIN messages m ON m.session_id = c.id
            GROUP BY c.id ORDER BY c.last_at DESC
            """
        ).fetchall()
    return [dict(r) for r in rows]


def get_transcript(session_id: str) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT role, content, kind, created_at FROM messages WHERE session_id=? ORDER BY id", (session_id,)
        ).fetchall()
    return [dict(r) for r in rows]


def get_stats() -> dict[str, Any]:
    with connect() as conn:
        conversations = conn.execute("SELECT COUNT(*) FROM conversations").fetchone()[0]
        placeholders = ",".join("?" for _ in ANSWERED_KINDS)
        answered = conn.execute(
            f"SELECT COUNT(*) FROM messages WHERE role='assistant' AND kind IN ({placeholders})", ANSWERED_KINDS
        ).fetchone()[0]
        fallbacks = conn.execute("SELECT COUNT(*) FROM messages WHERE kind='handoff'").fetchone()[0]
        leads = conn.execute("SELECT COUNT(*) FROM leads").fetchone()[0]
    total = answered + fallbacks
    rate = round(answered / total * 100) if total else 100
    return {
        "conversations": conversations,
        "questions_answered": answered,
        "handoffs": leads,
        "answer_rate": rate,
    }
