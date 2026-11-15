import { useCallback, useEffect, useRef, useState } from "react";

import { api, streamChat } from "@/lib/api";
import { getSessionId, resetSessionId } from "@/lib/session";
import type { ChatEvent, ChatMessage } from "@/lib/types";

const STORE_KEY = "nova_chat_messages";

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "Hi! I'm **Nova**, your Nova Threads assistant. Ask me about shipping, returns, sizing or where your order is.",
};

function load(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ChatMessage[];
      return parsed.map((m) => ({ ...m, streaming: false }));
    }
  } catch {
    /* ignore corrupt or unavailable storage */
  }
  return [WELCOME];
}

const uid = (): string => Math.random().toString(36).slice(2, 10);

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(load);
  const [busy, setBusy] = useState(false);
  const sessionId = useRef(getSessionId());
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(messages));
    } catch {
      /* ignore */
    }
  }, [messages]);

  useEffect(() => () => abort.current?.abort(), []);

  const patch = useCallback((id: string, fn: (m: ChatMessage) => ChatMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
  }, []);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || busy) return;
      const botId = uid();
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "user", content },
        { id: botId, role: "assistant", content: "", streaming: true },
      ]);
      setBusy(true);
      abort.current = new AbortController();

      const apply = (e: ChatEvent) => {
        switch (e.type) {
          case "token":
            patch(botId, (m) => ({ ...m, content: m.content + e.text }));
            break;
          case "sources":
            patch(botId, (m) => ({ ...m, sources: e.sources }));
            break;
          case "order":
            patch(botId, (m) => ({ ...m, order: e.order }));
            break;
          case "handoff":
            patch(botId, (m) => ({ ...m, handoff: { question: e.question, status: "open" } }));
            break;
          case "error":
            patch(botId, (m) => ({ ...m, content: e.message, error: true, streaming: false }));
            break;
          case "done":
            break;
        }
      };

      try {
        for await (const event of streamChat(sessionId.current, content, abort.current.signal)) apply(event);
      } finally {
        patch(botId, (m) => ({ ...m, streaming: false }));
        setBusy(false);
      }
    },
    [busy, patch],
  );

  const submitHandoff = useCallback(
    async (messageId: string, form: { name: string; email: string; question: string }) => {
      await api.submitLead({ session_id: sessionId.current, ...form });
      patch(messageId, (m) => (m.handoff ? { ...m, handoff: { ...m.handoff, status: "submitted" } } : m));
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: `Thanks ${form.name.split(" ")[0]}! I've passed your question to our team. They'll email you within one business day.`,
        },
      ]);
    },
    [patch],
  );

  const reset = useCallback(() => {
    abort.current?.abort();
    sessionId.current = resetSessionId();
    setMessages([WELCOME]);
    setBusy(false);
  }, []);

  return { messages, busy, send, submitHandoff, reset, isFresh: messages.length <= 1 };
}
