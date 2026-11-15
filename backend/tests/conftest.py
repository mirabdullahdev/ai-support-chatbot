"""Shared fixtures. OpenAI is always mocked: embeddings are a deterministic
bag-of-words hash and the chat model is replaced by a scripted async generator."""
from __future__ import annotations

import hashlib
import math
import re
import shutil
import sys
from pathlib import Path
from typing import Any, AsyncIterator

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import ingest, llm, ratelimit  # noqa: E402
from app.config import BASE_DIR, settings  # noqa: E402

DIM = 512
STOP = {"the", "a", "an", "is", "are", "do", "you", "to", "of", "and", "in", "on", "for", "my", "i", "it", "can", "how", "what", "your", "we", "or", "with", "at", "be", "if", "me"}


def fake_embed(texts: list[str]) -> list[list[float]]:
    vectors = []
    for text in texts:
        vec = [0.0] * DIM
        for word in re.findall(r"[a-z]+", text.lower()):
            if word in STOP:
                continue
            idx = int(hashlib.md5(word.encode()).hexdigest(), 16) % DIM
            vec[idx] += 1.0
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        vectors.append([v / norm for v in vec])
    return vectors


class FakeChat:
    """Scripted replacement for llm.stream_chat. Records the prompts it receives."""

    def __init__(self) -> None:
        self.reply = "We ship to more than 40 countries."
        self.calls: list[list[dict[str, Any]]] = []

    async def __call__(self, messages: list[dict[str, Any]]) -> AsyncIterator[str]:
        self.calls.append(messages)
        for word in re.findall(r"\S+\s*", self.reply):
            yield word


@pytest.fixture()
def env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> FakeChat:
    """Isolated storage + knowledge dir, with OpenAI mocked."""
    knowledge = tmp_path / "knowledge"
    shutil.copytree(BASE_DIR / "knowledge", knowledge)
    monkeypatch.setattr(settings, "knowledge_dir", knowledge)
    monkeypatch.setattr(settings, "storage_dir", tmp_path / "storage")
    monkeypatch.setattr(settings, "orders_file", BASE_DIR / "data" / "orders.json")
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    monkeypatch.setattr(settings, "relevance_max_distance", 0.9)
    monkeypatch.setattr(settings, "admin_password", "secret-pass")
    monkeypatch.setattr(llm, "embed", fake_embed)
    chat = FakeChat()
    monkeypatch.setattr(llm, "stream_chat", chat)
    ingest._clients.clear()
    ratelimit.reset()
    return chat


@pytest.fixture()
def client(env: FakeChat) -> TestClient:
    from app.main import app

    with TestClient(app) as c:  # runs lifespan -> first-startup ingestion
        yield c
