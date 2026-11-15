import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, MessageSquare, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { useChat } from "@/hooks/useChat";
import { BotAvatar, ChatMessageView } from "./ChatMessage";

const SUGGESTIONS = ["Do you ship internationally?", "Where is my order?", "How do I return an item?"];

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, busy, send, submitHandoff, reset, isFresh } = useChat();
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the newest content in view while tokens stream in.
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250);
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || busy) return;
    void send(input);
    setInput("");
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.section
            key="panel"
            role="dialog"
            aria-label="Nova Threads support chat"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            style={{ transformOrigin: "bottom right" }}
            className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[640px] sm:max-h-[calc(100vh-7rem)] sm:w-[400px] sm:rounded-xl sm:border sm:shadow-float"
          >
            <header className="flex items-center gap-3 border-b bg-card px-4 py-3.5">
              <BotAvatar />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">Nova Assistant</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Online
                </p>
              </div>
              <button onClick={reset} className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Start a new conversation" title="New conversation">
                <RotateCcw className="size-4" />
              </button>
              <button onClick={() => setOpen(false)} className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Close chat">
                <X className="size-[18px]" />
              </button>
            </header>

            <div ref={scroller} className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-4 py-5">
              {messages.map((m) => (
                <ChatMessageView key={m.id} message={m} onHandoff={submitHandoff} />
              ))}
              {isFresh && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="space-y-1.5 pt-1">
                  {SUGGESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => void send(q)}
                      className="block w-full rounded-md border bg-card px-3.5 py-2.5 text-left text-[13.5px] transition-colors hover:border-foreground/40"
                    >
                      {q}
                    </button>
                  ))}
                </motion.div>
              )}
            </div>

            <form onSubmit={submit} className="border-t bg-card p-3">
              <div className="flex items-center gap-2 rounded-md border border-input bg-background py-1 pl-3.5 pr-1 transition-colors focus-within:border-foreground">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question"
                  maxLength={1000}
                  className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  aria-label="Message"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || busy}
                  className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-85 disabled:opacity-30"
                  aria-label="Send message"
                >
                  <ArrowUp className="size-4" />
                </button>
              </div>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-5 right-5 z-[60] flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-float transition-transform hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6 ${open ? "max-sm:hidden" : ""}`}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {open ? <X className="size-5" /> : <MessageSquare className="size-5" />}
      </button>
    </>
  );
}
