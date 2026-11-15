import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, RotateCcw, SendHorizontal, X } from "lucide-react";
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
            initial={{ opacity: 0, scale: 0.9, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            style={{ transformOrigin: "bottom right" }}
            className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background shadow-float sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[640px] sm:max-h-[calc(100vh-7rem)] sm:w-[400px] sm:rounded-3xl sm:border"
          >
            <header className="flex items-center gap-3 bg-brand-gradient px-4 py-3.5 text-white">
              <div className="relative">
                <div className="flex size-10 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                  <BotAvatar className="size-8 bg-white text-primary" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-semibold leading-tight">Nova Assistant</p>
                <p className="flex items-center gap-1.5 text-xs text-white/85">
                  <span className="size-1.5 rounded-full bg-emerald-300" /> Online
                </p>
              </div>
              <button onClick={reset} className="rounded-full p-2 transition hover:bg-white/15" aria-label="Start a new conversation" title="New conversation">
                <RotateCcw className="size-4" />
              </button>
              <button onClick={() => setOpen(false)} className="rounded-full p-2 transition hover:bg-white/15" aria-label="Close chat">
                <X className="size-5" />
              </button>
            </header>

            <div ref={scroller} className="scrollbar-thin flex-1 space-y-3 overflow-y-auto bg-muted/40 px-3.5 py-4">
              {messages.map((m) => (
                <ChatMessageView key={m.id} message={m} onHandoff={submitHandoff} />
              ))}
              {isFresh && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex flex-wrap gap-2 pl-9 pt-1">
                  {SUGGESTIONS.map((q, i) => (
                    <motion.button
                      key={q}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 + i * 0.08 }}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => void send(q)}
                      className="rounded-full border border-primary/25 bg-card px-3.5 py-1.5 text-[13px] font-medium text-primary shadow-sm transition hover:bg-secondary"
                    >
                      {q}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </div>

            <form onSubmit={submit} className="border-t bg-card p-3">
              <div className="flex items-center gap-2 rounded-full border border-input bg-background py-1 pl-4 pr-1 transition focus-within:ring-2 focus-within:ring-ring">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message..."
                  maxLength={1000}
                  className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  aria-label="Message"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || busy}
                  className="flex size-9 items-center justify-center rounded-full bg-brand-gradient text-white shadow-md transition hover:brightness-110 disabled:opacity-40"
                  aria-label="Send message"
                >
                  <SendHorizontal className="size-4" />
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-muted-foreground">AI assistant · answers come from Nova Threads policies</p>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className={`fixed bottom-5 right-5 z-[60] flex size-14 items-center justify-center rounded-full bg-brand-gradient text-white shadow-float sm:bottom-6 sm:right-6 ${open ? "max-sm:hidden" : ""}`}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {!open && <span className="absolute inset-0 animate-pulseRing rounded-full bg-primary" />}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={open ? "x" : "m"}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="relative"
          >
            {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </>
  );
}
