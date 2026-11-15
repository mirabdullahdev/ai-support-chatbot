import { motion } from "framer-motion";
import { AlertTriangle, BookOpenText, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ChatMessage as Message } from "@/lib/types";
import { HandoffForm } from "./HandoffForm";
import { Markdown } from "./Markdown";
import { OrderCard } from "./OrderCard";

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1.5" aria-label="Assistant is typing">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 animate-bounceDot rounded-full bg-primary/60" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}

export function BotAvatar({ className }: { className?: string }) {
  return (
    <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-white shadow-sm", className)}>
      <Sparkles className="size-3.5" />
    </div>
  );
}

interface Props {
  message: Message;
  onHandoff: (id: string, form: { name: string; email: string; question: string }) => Promise<void>;
}

export function ChatMessageView({ message, onHandoff }: Props) {
  const isUser = message.role === "user";
  const waiting = message.streaming && !message.content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && <BotAvatar className="mt-0.5" />}
      <div className={cn("flex min-w-0 max-w-[85%] flex-col", isUser ? "items-end" : "items-start")}>
        {(message.content || waiting) && (
          <div
            className={cn(
              "rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed shadow-sm",
              isUser && "rounded-br-md bg-brand-gradient text-white",
              !isUser && !message.error && "rounded-bl-md border bg-card",
              message.error && "rounded-bl-md border border-red-200 bg-red-50 text-red-800",
            )}
          >
            {message.error && <AlertTriangle className="mb-0.5 mr-1.5 inline size-3.5" />}
            {waiting ? <TypingIndicator /> : isUser ? message.content : <Markdown text={message.content} />}
          </div>
        )}

        {message.sources && message.sources.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1.5 flex flex-wrap gap-1.5">
            {message.sources.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
                <BookOpenText className="size-3" /> {s}
              </span>
            ))}
          </motion.div>
        )}

        {message.order && <OrderCard order={message.order} />}
        {message.handoff && (
          <HandoffForm
            question={message.handoff.question}
            status={message.handoff.status}
            onSubmit={(form) => onHandoff(message.id, form)}
          />
        )}
      </div>
    </motion.div>
  );
}
