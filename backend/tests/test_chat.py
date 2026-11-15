import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import llm
from app.config import settings

SESSION = "test-session-0001"


def chat(client: TestClient, message: str, session: str = SESSION) -> list[dict[str, Any]]:
    resp = client.post("/api/chat", json={"session_id": session, "message": message})
    assert resp.status_code == 200, resp.text
    return [json.loads(line[6:]) for line in resp.text.splitlines() if line.startswith("data: ")]


def text_of(events: list[dict[str, Any]]) -> str:
    return "".join(e["text"] for e in events if e["type"] == "token")


def of_type(events: list[dict[str, Any]], kind: str) -> list[dict[str, Any]]:
    return [e for e in events if e["type"] == kind]


def test_health_reports_key_status(client: TestClient) -> None:
    assert client.get("/api/health").json()["api_key_configured"] is True


def test_knowledge_answer_streams_with_sources(client: TestClient, env) -> None:
    env.reply = "Yes! We ship to more than 40 countries."
    events = chat(client, "Do you ship internationally?")
    assert text_of(events) == env.reply
    assert len(of_type(events, "token")) > 3  # streamed in several pieces
    sources = of_type(events, "sources")[0]["sources"]
    assert "Shipping Policy" in sources or "FAQ" in sources
    assert events[-1] == {"type": "done"}
    # Retrieved context is passed to the model and capped at 4 chunks.
    system_prompt = env.calls[0][0]["content"]
    assert "international" in system_prompt.lower()
    assert system_prompt.count("\n\n---\n\n") <= settings.retrieval_k - 1


def test_order_flow_asks_then_verifies_then_shows_card(client: TestClient, env) -> None:
    first = chat(client, "Where is my order?")
    assert "order number" in text_of(first).lower()
    assert not of_type(first, "order")

    second = chat(client, "NT-10427")
    assert "email" in text_of(second).lower()

    third = chat(client, "mia.johnson@example.com")
    card = of_type(third, "order")
    assert card and card[0]["order"]["tracking_number"] == "781298765432"
    assert env.calls == []  # order lookup never needs the LLM


def test_order_with_wrong_email_is_not_disclosed(client: TestClient) -> None:
    events = chat(client, "Where is my order NT-10427? my email is not.mia@example.com")
    assert not of_type(events, "order")
    assert "couldn't find" in text_of(events).lower()
    assert "781298765432" not in json.dumps(events)


def test_irrelevant_question_triggers_handoff(client: TestClient, env, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "relevance_max_distance", 0.75)
    events = chat(client, "Can you recommend a good pizza restaurant in Berlin?")
    assert of_type(events, "handoff")
    assert "team" in text_of(events).lower()
    assert env.calls == []  # never asks the model when nothing relevant was retrieved


def test_model_can_request_handoff_with_sentinel(client: TestClient, env) -> None:
    env.reply = "[[HANDOFF]]"
    events = chat(client, "Do you ship internationally?")
    assert of_type(events, "handoff")
    assert "[[HANDOFF]]" not in text_of(events)


def test_lead_is_saved_and_visible_to_admin(client: TestClient) -> None:
    resp = client.post(
        "/api/leads",
        json={"session_id": SESSION, "name": "Jo Smith", "email": "jo@example.com", "question": "Do you do custom tailoring?"},
    )
    assert resp.status_code == 201
    token = client.post("/api/admin/login", json={"password": "secret-pass"}).json()["token"]
    leads = client.get("/api/admin/leads", headers={"Authorization": f"Bearer {token}"}).json()
    assert leads[0]["email"] == "jo@example.com"


def test_invalid_lead_email_is_rejected(client: TestClient) -> None:
    resp = client.post("/api/leads", json={"name": "Jo", "email": "nope", "question": "hi"})
    assert resp.status_code == 422


def test_conversation_memory_and_transcript(client: TestClient, env) -> None:
    chat(client, "Do you ship internationally?")
    env.reply = "Canada takes 5 to 8 business days."
    chat(client, "How long to Canada?")
    sent = env.calls[-1]
    assert any(m["role"] == "user" and "internationally" in m["content"] for m in sent)  # history included
    token = client.post("/api/admin/login", json={"password": "secret-pass"}).json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/admin/conversations", headers=headers).json()[0]["message_count"] == 4
    transcript = client.get(f"/api/admin/conversations/{SESSION}", headers=headers).json()
    assert [m["role"] for m in transcript] == ["user", "assistant", "user", "assistant"]
    stats = client.get("/api/admin/stats", headers=headers).json()
    assert stats["conversations"] == 1 and stats["questions_answered"] == 2


def test_missing_api_key_gives_friendly_error(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "openai_api_key", "")
    events = chat(client, "hello there, quick question")
    assert events[0]["type"] == "error" and "OPENAI_API_KEY" in events[0]["message"]


def test_openai_failure_is_reported_not_raised(client: TestClient, env, monkeypatch: pytest.MonkeyPatch) -> None:
    async def boom(_messages: Any):
        raise llm.LLMError("The AI service took too long to respond. Please try again.")
        yield  # pragma: no cover

    monkeypatch.setattr(llm, "stream_chat", boom)
    events = chat(client, "Do you ship internationally?")
    assert events[-1] == {"type": "error", "message": "The AI service took too long to respond. Please try again."}


def test_rate_limit_per_session(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "rate_limit_per_minute", 2)
    for _ in range(2):
        chat(client, "hi")
    resp = client.post("/api/chat", json={"session_id": SESSION, "message": "hi"})
    assert resp.status_code == 429
    assert chat(client, "hi", session="another-session-1")  # other sessions unaffected


def test_admin_endpoints_require_password(client: TestClient) -> None:
    assert client.get("/api/admin/stats").status_code == 401
    assert client.post("/api/admin/login", json={"password": "wrong"}).status_code == 401


def test_admin_upload_then_bot_uses_new_faq(client: TestClient, env) -> None:
    token = client.post("/api/admin/login", json={"password": "secret-pass"}).json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    faq = b"# Gift wrapping\n\n## Do you offer gift wrapping?\nYes, gift wrapping is available for $4 per item at checkout."
    up = client.post("/api/admin/documents", headers=headers, files={"file": ("gift_wrapping.md", faq, "text/markdown")})
    assert up.status_code == 200 and up.json()["indexed"] is True
    env.reply = "Yes, gift wrapping is $4 per item."
    events = chat(client, "Do you offer gift wrapping?")
    assert "Gift Wrapping" in of_type(events, "sources")[0]["sources"]
    bad = client.post("/api/admin/documents", headers=headers, files={"file": ("evil.exe", b"x", "application/octet-stream")})
    assert bad.status_code == 400
    assert client.get("/api/admin/documents/..%2Fsecret.md", headers=headers).status_code in (400, 404)
