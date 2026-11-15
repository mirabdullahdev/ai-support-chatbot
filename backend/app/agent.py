"""LangGraph support agent.

Flow:
    route ─┬─ smalltalk ─────────────────────────────► END
           ├─ order (ask / verify / show card) ───────► END
           └─ retrieve ─┬─ (relevant docs) ─ answer ─┬─► END
                        └─ (nothing relevant) ───────┴─► handoff ─► END

Nodes push UI events (tokens, sources, order card, handoff form) through the
LangGraph custom stream writer; `run_chat` turns those into SSE-ready dicts.
"""
from __future__ import annotations

import asyncio
import logging
import re
from typing import Any, AsyncIterator, TypedDict

from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from . import db, ingest, llm, orders
from .config import settings

log = logging.getLogger(__name__)

HANDOFF_SENTINEL = "[[HANDOFF]]"

SYSTEM_PROMPT = """You are Nova, the friendly customer support assistant for Nova Threads, an online clothing store.

Answer the customer using ONLY the CONTEXT below.

Rules:
- Keep answers short and natural: 1-3 sentences, a short bullet list only when listing options.
- Never invent policies, prices, shipping times, sizes or product details. Quote numbers exactly as in the context.
- If the context does not contain the answer, reply with exactly {sentinel} and nothing else.
- Never mention "context" or "documents". Do not make promises on behalf of the company beyond what the context says.
- Light markdown (**bold**, bullet lists) is fine. No headings.
- If asked about a specific order, tell them to say "Where is my order?" and you will look it up.

CONTEXT:
{context}"""

SMALLTALK = [
    (re.compile(r"^\s*(hi|hello|hey|hiya|good (morning|afternoon|evening)|yo)\b[\s!.,?]*$", re.I),
     "Hi there! I'm Nova, the Nova Threads assistant. I can help with shipping, returns, sizing and tracking your order. What can I do for you?"),
    (re.compile(r"^\s*(thanks|thank you|thx|ty|cheers|great,? thanks|perfect,? thanks)\b[\s!.,]*$", re.I),
     "You're very welcome! Is there anything else I can help you with?"),
    (re.compile(r"^\s*(bye|goodbye|see you|that'?s all|no,? that'?s (all|it))\b[\s!.,]*$", re.I),
     "Thanks for stopping by Nova Threads. Have a great day!"),
]

ORDER_WORDS = re.compile(r"\b(order|package|parcel|shipment|delivery)\b", re.I)
ORDER_ACTION = re.compile(r"\b(track|tracking|where('s| is| are)|status|arrive|arrived|delivered|shipped|check|late|find)\b", re.I)
POLICY_QUESTION = re.compile(r"^\s*(how (do|can|long|much)|can i|could i|do you|does|what('s| is| are)|is there|are there)\b", re.I)


class AgentState(TypedDict, total=False):
    message: str
    history: list[dict[str, Any]]
    intent: str
    docs: list[dict[str, Any]]
    needs_handoff: bool
    answer: str
    kind: str
    sources: list[str]
    order_number: str | None


# ------------------------------------------------------------------ helpers
async def _say(text: str) -> None:
    """Stream a canned reply word by word so it feels like the model typing."""
    writer = get_stream_writer()
    for part in re.findall(r"\S+\s*", text):
        writer({"type": "token", "text": part})
        await asyncio.sleep(0.012)


def _find_order_details(state: AgentState) -> tuple[str | None, str | None]:
    """Order number and email: current message first, then earlier user messages."""
    number = orders.extract_order_number(state["message"])
    email = orders.extract_email(state["message"])
    for past in reversed(state.get("history", [])):
        if number and email:
            break
        if past["role"] != "user":
            continue
        number = number or orders.extract_order_number(past["content"])
        email = email or orders.extract_email(past["content"])
    return number, email


# ------------------------------------------------------------------ nodes
async def route(state: AgentState) -> AgentState:
    msg = state["message"]
    for pattern, reply in SMALLTALK:
        if pattern.match(msg):
            return {"intent": "smalltalk", "answer": reply}

    history = state.get("history", [])
    awaiting_order = bool(history) and history[-1]["role"] == "assistant" and history[-1]["kind"] == "order_prompt"
    has_details = bool(orders.extract_email(msg) or orders.ORDER_FULL_RE.search(msg))

    if awaiting_order and (has_details or orders.ORDER_RE.search(msg)):
        return {"intent": "order"}
    if ORDER_WORDS.search(msg) and ORDER_ACTION.search(msg) and (has_details or not POLICY_QUESTION.match(msg)):
        return {"intent": "order"}
    return {"intent": "knowledge"}


async def smalltalk(state: AgentState) -> AgentState:
    await _say(state["answer"])
    return {"kind": "text"}


async def order(state: AgentState) -> AgentState:
    writer = get_stream_writer()
    number, email = _find_order_details(state)

    if not number and not email:
        text = "Happy to help you track it! Please share your **order number** (like NT-10427) and the **email** you used at checkout."
    elif not number:
        text = "Thanks! What's your **order number**? It starts with NT- and is in your confirmation email."
    elif not email:
        text = f"Thanks! I'll also need the **email address** used for order {number} so I can verify it's yours."
    else:
        found = orders.lookup_order(number, email)
        if found:
            first = found["customer_name"].split()[0]
            await _say(f"Found it, {first}! Here's the latest on order **{found['order_number']}**.")
            writer({"type": "order", "order": found})
            return {"kind": "order_card", "answer": f"Order {found['order_number']} status: {found['status']}", "order_number": found["order_number"]}
        text = (
            "I couldn't find an order matching that order number and email. "
            "Please double-check both - they're in your order confirmation email - and send them again."
        )
    await _say(text)
    return {"kind": "order_prompt", "answer": text}


async def retrieve(state: AgentState) -> AgentState:
    query = state["message"]
    if len(query.split()) < 6:  # short follow-up: add the previous question for context
        previous = [m["content"] for m in state.get("history", []) if m["role"] == "user"]
        if previous:
            query = f"{previous[-1]} {query}"
    docs = await asyncio.to_thread(ingest.retrieve, query, settings.retrieval_k)
    relevant = [d for d in docs if d["distance"] <= settings.relevance_max_distance]
    log.info("retrieval: %d/%d chunks relevant (best=%.3f)", len(relevant), len(docs), docs[0]["distance"] if docs else -1)
    return {"docs": relevant, "needs_handoff": not relevant}


async def answer(state: AgentState) -> AgentState:
    writer = get_stream_writer()
    docs = state["docs"]
    context = "\n\n---\n\n".join(d["text"] for d in docs)
    messages: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT.format(sentinel=HANDOFF_SENTINEL, context=context)}]
    for m in state.get("history", [])[-settings.max_history_messages :]:
        messages.append({"role": m["role"], "content": m["content"]})
    messages.append({"role": "user", "content": state["message"]})

    full, buf, decided = "", "", False
    async for token in llm.stream_chat(messages):
        full += token
        if decided:
            writer({"type": "token", "text": token})
            continue
        buf += token
        probe = buf.lstrip()
        if HANDOFF_SENTINEL.startswith(probe) and len(probe) < len(HANDOFF_SENTINEL):
            continue  # could still turn into the sentinel; keep buffering
        if probe.startswith(HANDOFF_SENTINEL):
            return {"needs_handoff": True}
        decided = True
        writer({"type": "token", "text": buf})
    if not decided:
        if buf.strip().startswith(HANDOFF_SENTINEL) or not buf.strip():
            return {"needs_handoff": True}
        writer({"type": "token", "text": buf})

    sources: list[str] = []
    for d in docs:
        if d["source"] not in sources:
            sources.append(d["source"])
    sources = sources[:3]
    writer({"type": "sources", "sources": sources})
    return {"answer": full.strip(), "kind": "answer", "sources": sources, "needs_handoff": False}


async def handoff(state: AgentState) -> AgentState:
    writer = get_stream_writer()
    text = (
        "I don't want to guess on that one, so I'll connect you with our team. "
        "Leave your details below and someone will get back to you within one business day."
    )
    await _say(text)
    writer({"type": "handoff", "question": state["message"]})
    return {"kind": "handoff", "answer": text}


# ------------------------------------------------------------------ graph
def _after_route(state: AgentState) -> str:
    return state["intent"]


def _after_retrieve(state: AgentState) -> str:
    return "handoff" if state.get("needs_handoff") else "answer"


def _after_answer(state: AgentState) -> str:
    return "handoff" if state.get("needs_handoff") else END


def build_graph() -> Any:
    g = StateGraph(AgentState)
    g.add_node("route", route)
    g.add_node("smalltalk", smalltalk)
    g.add_node("order", order)
    g.add_node("retrieve", retrieve)
    g.add_node("answer", answer)
    g.add_node("handoff", handoff)
    g.add_edge(START, "route")
    g.add_conditional_edges("route", _after_route, {"smalltalk": "smalltalk", "order": "order", "knowledge": "retrieve"})
    g.add_conditional_edges("retrieve", _after_retrieve, {"answer": "answer", "handoff": "handoff"})
    g.add_conditional_edges("answer", _after_answer, {"handoff": "handoff", END: END})
    g.add_edge("smalltalk", END)
    g.add_edge("order", END)
    g.add_edge("handoff", END)
    return g.compile()


graph = build_graph()


# ------------------------------------------------------------------ runner
async def run_chat(session_id: str, message: str) -> AsyncIterator[dict[str, Any]]:
    """Run one turn of the conversation, yielding UI events and persisting the transcript."""
    history = db.get_history(session_id, settings.max_history_messages)
    db.add_message(session_id, "user", message)
    final: dict[str, Any] = {}
    try:
        if not settings.has_api_key:
            raise llm.LLMError(llm.NOT_CONFIGURED)
        await asyncio.to_thread(ingest.ensure_indexed)
        async for mode, payload in graph.astream(
            {"message": message, "history": history}, stream_mode=["custom", "values"]
        ):
            if mode == "custom":
                yield payload
            else:
                final = payload
    except llm.LLMError as exc:
        db.add_message(session_id, "assistant", str(exc), kind="error")
        yield {"type": "error", "message": str(exc)}
        return
    except Exception:  # never leak internals to the customer
        log.exception("Unexpected chat failure")
        msg = "Sorry, something went wrong on our side. Please try again in a moment."
        db.add_message(session_id, "assistant", msg, kind="error")
        yield {"type": "error", "message": msg}
        return

    meta = {k: final[k] for k in ("sources", "order_number") if final.get(k)}
    db.add_message(session_id, "assistant", final.get("answer", ""), kind=final.get("kind", "text"), meta=meta or None)
    yield {"type": "done"}
