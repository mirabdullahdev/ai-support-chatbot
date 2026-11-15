"""Knowledge ingestion: read documents, chunk them, embed and store in Chroma."""
from __future__ import annotations

import json
import logging
import re
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator

from . import llm
from .config import settings

log = logging.getLogger(__name__)

COLLECTION = "nova_knowledge"
SUPPORTED_EXTENSIONS = {".md", ".txt", ".pdf", ".json"}
UPLOAD_EXTENSIONS = {".md", ".txt", ".pdf"}
MAX_CHUNK_CHARS = 900

_lock = threading.RLock()
_clients: dict[str, Any] = {}


@dataclass
class Chunk:
    text: str
    source: str  # human-friendly title shown as a source chip
    file: str


# ---------------------------------------------------------------- helpers
def title_for(filename: str) -> str:
    stem = Path(filename).stem
    if stem.lower() == "faq":
        return "FAQ"
    if stem.lower() == "products":
        return "Product Catalog"
    return re.sub(r"[_\-]+", " ", stem).strip().title()


def _pack(paragraphs: list[str], limit: int = MAX_CHUNK_CHARS) -> list[str]:
    """Greedily pack paragraphs into pieces of at most `limit` characters."""
    pieces: list[str] = []
    current = ""
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        while len(para) > limit:  # hard-split very long paragraphs on a sentence/space
            cut = para.rfind(". ", 0, limit)
            cut = cut + 1 if cut > limit // 2 else para.rfind(" ", 0, limit)
            cut = cut if cut > 0 else limit
            pieces.append(para[:cut].strip())
            para = para[cut:].strip()
        if current and len(current) + len(para) + 2 > limit:
            pieces.append(current)
            current = para
        else:
            current = f"{current}\n\n{para}" if current else para
    if current:
        pieces.append(current)
    return pieces


def chunk_markdown(text: str, title: str) -> list[str]:
    """Split markdown by heading; each heading + body becomes its own chunk."""
    sections: list[tuple[str, list[str]]] = []
    heading, buf = "", []
    for line in text.splitlines():
        m = re.match(r"^#{1,6}\s+(.*\S)\s*$", line)
        if m:
            sections.append((heading, buf))
            heading, buf = m.group(1).strip(), []
        else:
            buf.append(line)
    sections.append((heading, buf))

    chunks: list[str] = []
    for head, lines in sections:
        body = "\n".join(lines).strip()
        if not body:
            continue
        paras = re.split(r"\n\s*\n", body)
        for piece in _pack(paras):
            prefix = f"{title} - {head}" if head else title
            chunks.append(f"{prefix}\n{piece}")
    return chunks


def chunk_plain(text: str, title: str) -> list[str]:
    paras = re.split(r"\n\s*\n", text.replace("\r\n", "\n"))
    return [f"{title}\n{p}" for p in _pack(paras)]


def product_to_text(p: dict[str, Any]) -> str:
    return (
        f"Product: {p.get('name')} ({p.get('category', 'Clothing')})\n"
        f"Price: ${p.get('price')}\n"
        f"{p.get('description', '')}\n"
        f"Sizes: {', '.join(p.get('sizes', []))}\n"
        f"Colors: {', '.join(p.get('colors', []))}\n"
        f"Materials: {p.get('materials', 'n/a')}\n"
        f"Care instructions: {p.get('care', 'n/a')}\n"
        f"Availability: {p.get('availability', 'n/a')}"
    )


def read_text(path: Path) -> str:
    if path.suffix.lower() == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(str(path))
        return "\n\n".join((page.extract_text() or "") for page in reader.pages)
    return path.read_text(encoding="utf-8", errors="ignore")


def chunks_for_file(path: Path) -> list[Chunk]:
    title = title_for(path.name)
    suffix = path.suffix.lower()
    if suffix == ".json":
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            log.warning("Skipping invalid JSON file %s", path.name)
            return []
        items = data if isinstance(data, list) else [data]
        texts = [product_to_text(p) if "price" in p else json.dumps(p) for p in items if isinstance(p, dict)]
    elif suffix == ".md":
        texts = chunk_markdown(read_text(path), title)
    else:
        texts = chunk_plain(read_text(path), title)
    return [Chunk(text=t, source=title, file=path.name) for t in texts if t.strip()]


def list_files() -> list[Path]:
    settings.knowledge_dir.mkdir(parents=True, exist_ok=True)
    return sorted(
        p for p in settings.knowledge_dir.iterdir() if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS
    )


# ---------------------------------------------------------------- Chroma
def _client() -> Any:
    import chromadb  # imported lazily: heavy, and not needed for chunking
    from chromadb.config import Settings as ChromaSettings

    key = str(settings.chroma_dir)
    with _lock:
        if key not in _clients:
            settings.chroma_dir.mkdir(parents=True, exist_ok=True)
            _clients[key] = chromadb.PersistentClient(
                path=key, settings=ChromaSettings(anonymized_telemetry=False)
            )
        return _clients[key]


def get_collection(reset: bool = False) -> Any:
    client = _client()
    with _lock:
        if reset:
            try:
                client.delete_collection(COLLECTION)
            except Exception:  # collection may not exist yet
                pass
        return client.get_or_create_collection(COLLECTION, metadata={"hnsw:space": "cosine"})


def _add(collection: Any, file: str, chunks: list[Chunk], vectors: list[list[float]]) -> None:
    if not chunks:
        return
    collection.add(
        ids=[f"{file}::{i}" for i in range(len(chunks))],
        documents=[c.text for c in chunks],
        embeddings=vectors,
        metadatas=[{"source": c.source, "file": c.file, "chunk": i} for i, c in enumerate(chunks)],
    )


def ingest_file(path: Path) -> int:
    """(Re)index one document so the bot can use it immediately."""
    chunks = chunks_for_file(path)
    vectors = llm.embed([c.text for c in chunks]) if chunks else []
    with _lock:
        col = get_collection()
        col.delete(where={"file": path.name})
        _add(col, path.name, chunks, vectors)
    return len(chunks)


def remove_file(name: str) -> None:
    with _lock:
        get_collection().delete(where={"file": name})


def reindex_iter() -> Iterator[dict[str, Any]]:
    """Rebuild the whole index, yielding progress events for the UI."""
    files = list_files()
    total = len(files)
    yield {"stage": "start", "done": 0, "total": total}
    prepared: list[tuple[Path, list[Chunk], list[list[float]]]] = []
    try:
        for i, path in enumerate(files):
            chunks = chunks_for_file(path)
            vectors = llm.embed([c.text for c in chunks]) if chunks else []
            prepared.append((path, chunks, vectors))
            yield {"stage": "indexing", "file": path.name, "done": i + 1, "total": total}
    except llm.LLMError as exc:
        yield {"stage": "error", "message": str(exc)}
        return
    with _lock:
        col = get_collection(reset=True)
        count = 0
        for path, chunks, vectors in prepared:
            _add(col, path.name, chunks, vectors)
            count += len(chunks)
    yield {"stage": "done", "done": total, "total": total, "chunks": count}


def reindex() -> int:
    chunks = 0
    for event in reindex_iter():
        if event["stage"] == "error":
            raise llm.LLMError(event["message"])
        chunks = event.get("chunks", chunks)
    return chunks


def ensure_indexed() -> None:
    """Ingest everything on first startup (when the collection is empty)."""
    if get_collection().count() == 0 and settings.has_api_key:
        log.info("Knowledge index is empty - ingesting documents...")
        reindex()


def retrieve(query: str, k: int | None = None) -> list[dict[str, Any]]:
    k = k or settings.retrieval_k
    col = get_collection()
    if col.count() == 0:
        return []
    vector = llm.embed([query])[0]
    res = col.query(
        query_embeddings=[vector],
        n_results=min(k, col.count()),
        include=["documents", "metadatas", "distances"],
    )
    docs, metas, dists = res["documents"][0], res["metadatas"][0], res["distances"][0]
    return [
        {"text": d, "source": m.get("source", "Knowledge Base"), "file": m.get("file"), "distance": float(dist)}
        for d, m, dist in zip(docs, metas, dists)
    ]


def list_documents() -> list[dict[str, Any]]:
    col = get_collection()
    docs = []
    for path in list_files():
        got = col.get(where={"file": path.name}, include=[])
        docs.append(
            {
                "name": path.name,
                "title": title_for(path.name),
                "type": path.suffix.lower().lstrip("."),
                "size": path.stat().st_size,
                "chunks": len(got["ids"]),
                "editable": path.suffix.lower() != ".pdf",
            }
        )
    return docs
