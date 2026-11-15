"""FastAPI application: public chat API + password-protected admin API."""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import re
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncIterator, Iterator

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from . import agent, db, ingest, llm, ratelimit
from .config import settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s: %(message)s")
log = logging.getLogger("nova")

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"}


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    with db.connect():  # create tables
        pass
    if not settings.has_api_key:
        log.warning("OPENAI_API_KEY is not set - chat will show a setup message until you add it to backend/.env")
    else:
        try:  # ingest the knowledge base on first startup
            await asyncio.to_thread(ingest.ensure_indexed)
        except Exception as exc:
            log.warning("Initial ingestion failed: %s", exc)
    yield


app = FastAPI(title="Nova Threads Support API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def sse(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event)}\n\n"


# ------------------------------------------------------------------ models
class ChatIn(BaseModel):
    session_id: str = Field(min_length=8, max_length=64)
    message: str = Field(min_length=1)

    @field_validator("message")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Message is empty")
        return v[: settings.max_message_chars]


class LeadIn(BaseModel):
    session_id: str | None = Field(default=None, max_length=64)
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(max_length=200)
    question: str = Field(min_length=1, max_length=2000)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip()
        if not EMAIL_RE.match(v):
            raise ValueError("Please enter a valid email address")
        return v


class LoginIn(BaseModel):
    password: str


class DocumentIn(BaseModel):
    content: str = Field(max_length=500_000)


# ------------------------------------------------------------------ public API
@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "api_key_configured": settings.has_api_key, "model": settings.openai_model}


@app.get("/api/products")
def products() -> list[dict[str, Any]]:
    path = settings.knowledge_dir / "products.json"
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


@app.post("/api/chat")
async def chat(body: ChatIn) -> StreamingResponse:
    if not ratelimit.allow(body.session_id):
        raise HTTPException(429, "You're sending messages a little too fast. Please wait a moment and try again.")

    async def stream() -> AsyncIterator[str]:
        async for event in agent.run_chat(body.session_id, body.message):
            yield sse(event)

    return StreamingResponse(stream(), media_type="text/event-stream", headers=SSE_HEADERS)


@app.post("/api/leads", status_code=201)
def create_lead(body: LeadIn) -> dict[str, Any]:
    lead_id = db.add_lead(body.session_id, body.name.strip(), body.email, body.question.strip())
    if body.session_id:
        db.add_message(
            body.session_id, "assistant",
            f"Thanks {body.name.strip().split()[0]}! Your request has been sent to our team.", kind="lead_confirmation",
        )
    return {"id": lead_id, "message": "Thanks! Our team will email you within one business day."}


# ------------------------------------------------------------------ admin auth
def _token() -> str:
    return hmac.new(settings.admin_password.encode(), b"nova-admin", hashlib.sha256).hexdigest()


def require_admin(authorization: str | None = Header(default=None)) -> None:
    supplied = (authorization or "").removeprefix("Bearer ").strip()
    if not supplied or not hmac.compare_digest(supplied, _token()):
        raise HTTPException(401, "Admin authentication required")


@app.post("/api/admin/login")
def login(body: LoginIn) -> dict[str, str]:
    if not hmac.compare_digest(body.password.encode(), settings.admin_password.encode()):
        raise HTTPException(401, "Incorrect password")
    return {"token": _token()}


admin = [Depends(require_admin)]


@app.get("/api/admin/stats", dependencies=admin)
def stats() -> dict[str, Any]:
    return db.get_stats()


@app.get("/api/admin/leads", dependencies=admin)
def leads() -> list[dict[str, Any]]:
    return db.list_leads()


@app.get("/api/admin/conversations", dependencies=admin)
def conversations() -> list[dict[str, Any]]:
    return db.list_conversations()


@app.get("/api/admin/conversations/{session_id}", dependencies=admin)
def conversation(session_id: str) -> list[dict[str, Any]]:
    transcript = db.get_transcript(session_id)
    if not transcript:
        raise HTTPException(404, "Conversation not found")
    return transcript


# ------------------------------------------------------------------ admin: knowledge base
def _safe_path(name: str) -> Path:
    clean = Path(name).name
    if clean != name or Path(clean).suffix.lower() not in ingest.SUPPORTED_EXTENSIONS or clean.startswith("."):
        raise HTTPException(400, "Unsupported file name or type (use .md, .txt or .pdf)")
    return settings.knowledge_dir / clean


def _try_ingest(path: Path) -> dict[str, Any]:
    """Index one file right away so the bot can use it immediately."""
    try:
        return {"indexed": True, "chunks": ingest.ingest_file(path), "warning": None}
    except llm.LLMError as exc:
        return {"indexed": False, "chunks": 0, "warning": str(exc)}


@app.get("/api/admin/documents", dependencies=admin)
def documents() -> list[dict[str, Any]]:
    return ingest.list_documents()


@app.get("/api/admin/documents/{name}", dependencies=admin)
def get_document(name: str) -> dict[str, str]:
    path = _safe_path(name)
    if not path.exists():
        raise HTTPException(404, "Document not found")
    if path.suffix.lower() == ".pdf":
        raise HTTPException(400, "PDF files can't be edited in the browser")
    return {"name": name, "content": path.read_text(encoding="utf-8", errors="ignore")}


@app.put("/api/admin/documents/{name}", dependencies=admin)
def save_document(name: str, body: DocumentIn) -> dict[str, Any]:
    path = _safe_path(name)
    if path.suffix.lower() == ".pdf":
        raise HTTPException(400, "PDF files can't be edited in the browser")
    if path.suffix.lower() == ".json":
        try:
            json.loads(body.content)
        except json.JSONDecodeError as exc:
            raise HTTPException(400, f"Invalid JSON: {exc.msg} (line {exc.lineno})") from exc
    path.write_text(body.content, encoding="utf-8")
    return {"name": name, **_try_ingest(path)}


@app.post("/api/admin/documents", dependencies=admin)
async def upload_document(file: UploadFile = File(...)) -> dict[str, Any]:
    raw_name = re.sub(r"[^A-Za-z0-9._-]+", "_", Path(file.filename or "").name).strip("._")
    if Path(raw_name).suffix.lower() not in ingest.UPLOAD_EXTENSIONS:
        raise HTTPException(400, "Only .md, .txt and .pdf files can be uploaded")
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File is too large (max 5 MB)")
    path = _safe_path(raw_name)
    settings.knowledge_dir.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    result = await asyncio.to_thread(_try_ingest, path)
    return {"name": raw_name, **result}


@app.delete("/api/admin/documents/{name}", dependencies=admin)
def delete_document(name: str) -> dict[str, str]:
    path = _safe_path(name)
    if not path.exists():
        raise HTTPException(404, "Document not found")
    path.unlink()
    ingest.remove_file(name)
    return {"deleted": name}


@app.post("/api/admin/reindex", dependencies=admin)
def reindex() -> StreamingResponse:
    """Rebuild the index from scratch, streaming progress events."""

    def stream() -> Iterator[str]:
        for event in ingest.reindex_iter():
            yield sse(event)

    return StreamingResponse(stream(), media_type="text/event-stream", headers=SSE_HEADERS)
