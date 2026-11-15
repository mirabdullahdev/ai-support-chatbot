"""Thin wrapper around the OpenAI SDK.

Every OpenAI call in the app goes through this module, so tests can mock the
three public functions (`embed`, `stream_chat`) and errors are translated into
friendly, user-facing messages in one place.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Any, AsyncIterator

import openai
from openai import AsyncOpenAI, OpenAI

from .config import settings


class LLMError(Exception):
    """An error whose message is safe to show to the end user."""


NOT_CONFIGURED = (
    "The assistant isn't configured yet. Add your OPENAI_API_KEY to backend/.env and restart the server."
)


def _translate(exc: Exception) -> LLMError:
    if isinstance(exc, openai.AuthenticationError):
        return LLMError("The OpenAI API key looks invalid. Please check OPENAI_API_KEY in backend/.env.")
    if isinstance(exc, openai.RateLimitError):
        return LLMError("The AI service is busy or over quota right now. Please try again in a moment.")
    if isinstance(exc, openai.APITimeoutError):
        return LLMError("The AI service took too long to respond. Please try again.")
    if isinstance(exc, openai.APIConnectionError):
        return LLMError("I couldn't reach the AI service. Please check your connection and try again.")
    if isinstance(exc, openai.NotFoundError):
        return LLMError(f"The model '{settings.openai_model}' wasn't found. Check OPENAI_MODEL in backend/.env.")
    return LLMError("Something went wrong while generating a reply. Please try again.")


@lru_cache(maxsize=2)
def _async_client(key: str) -> AsyncOpenAI:
    return AsyncOpenAI(api_key=key, timeout=settings.request_timeout, max_retries=1)


@lru_cache(maxsize=2)
def _sync_client(key: str) -> OpenAI:
    return OpenAI(api_key=key, timeout=settings.request_timeout, max_retries=1)


def require_key() -> str:
    if not settings.has_api_key:
        raise LLMError(NOT_CONFIGURED)
    return settings.openai_api_key


def embed(texts: list[str]) -> list[list[float]]:
    """Embed texts with text-embedding-3-small (synchronous, batched)."""
    key = require_key()
    if not texts:
        return []
    client = _sync_client(key)
    vectors: list[list[float]] = []
    try:
        for i in range(0, len(texts), 64):
            batch = texts[i : i + 64]
            resp = client.embeddings.create(model=settings.embedding_model, input=batch)
            vectors.extend(d.embedding for d in resp.data)
    except openai.OpenAIError as exc:
        raise _translate(exc) from exc
    return vectors


async def stream_chat(messages: list[dict[str, Any]]) -> AsyncIterator[str]:
    """Stream the assistant reply token by token. Output length is capped."""
    key = require_key()
    client = _async_client(key)
    try:
        stream = await client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,  # type: ignore[arg-type]
            max_tokens=settings.max_output_tokens,
            temperature=0.2,
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    except openai.OpenAIError as exc:
        raise _translate(exc) from exc
