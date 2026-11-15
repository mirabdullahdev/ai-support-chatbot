from pathlib import Path

import pytest

from app import ingest, llm
from app.config import settings


def test_markdown_is_chunked_by_heading() -> None:
    chunks = ingest.chunk_markdown("# Title\n\n## One\nFirst body\n\n## Two\nSecond body", "Doc")
    assert len(chunks) == 2
    assert chunks[0].startswith("Doc - One")
    assert "Second body" in chunks[1]


def test_long_text_is_split_below_limit() -> None:
    chunks = ingest.chunk_plain("word " * 1000, "Doc")
    assert len(chunks) > 1
    assert all(len(c) <= ingest.MAX_CHUNK_CHARS + 20 for c in chunks)


def test_full_ingest_indexes_every_document(env) -> None:
    events = list(ingest.reindex_iter())
    assert events[0]["stage"] == "start" and events[-1]["stage"] == "done"
    docs = {d["name"]: d for d in ingest.list_documents()}
    assert set(docs) == {"faq.md", "shipping_policy.md", "returns_policy.md", "products.json"}
    assert docs["products.json"]["chunks"] == 12  # one chunk per product
    assert docs["faq.md"]["chunks"] >= 15
    assert events[-1]["chunks"] == sum(d["chunks"] for d in docs.values())


def test_reindex_is_idempotent(env) -> None:
    first = ingest.reindex()
    second = ingest.reindex()
    assert first == second == ingest.get_collection().count()


def test_retrieval_returns_relevant_source(env) -> None:
    ingest.reindex()
    hits = ingest.retrieve("do you ship internationally to other countries")
    assert 0 < len(hits) <= settings.retrieval_k
    assert hits[0]["distance"] < 0.9
    assert any(h["source"] in {"Shipping Policy", "FAQ"} for h in hits)


def test_new_document_is_usable_immediately(env) -> None:
    ingest.reindex()
    path = settings.knowledge_dir / "loyalty_program.md"
    path.write_text("# Loyalty\n\n## Points\nEarn 2 points per dollar with the Nova Rewards loyalty program.")
    ingest.ingest_file(path)
    hit = ingest.retrieve("loyalty rewards points")[0]
    assert hit["source"] == "Loyalty Program"


def test_missing_api_key_raises_friendly_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "openai_api_key", "")
    with pytest.raises(llm.LLMError, match="OPENAI_API_KEY"):
        llm.embed(["hello"])


def test_pdf_text_is_extracted(env, tmp_path: Path) -> None:
    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(200, 200)
    pdf = tmp_path / "blank.pdf"
    with open(pdf, "wb") as f:
        writer.write(f)
    assert ingest.chunks_for_file(pdf) == []  # blank page yields no chunks, but doesn't crash
