import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import type { ChatMessage as Message } from "@/lib/types";
import { HandoffForm } from "./HandoffForm";
import { Markdown } from "./Markdown";
import { OrderCard } from "./OrderCard";

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-2" aria-label="Assistant is typing">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 animate-bounceDot rounded-full bg-foreground" style={{ animationDelay: `${i * 0.18}s` }} />
      ))}
    </div>
  );
}

export function BotAvatar({ className }: { className?: string }) {
  return (
    <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-display text-base leading-none text-primary-foreground", className)}>
      N
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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex", isUser ? "justify-end" : "justify-start")}
    >
      <div className={cn("flex min-w-0 flex-col", isUser ? "max-w-[82%] items-end" : "w-full items-start")}>
        {(message.content || waiting) &&
          (isUser ? (
            <div className="rounded-lg bg-primary px-3.5 py-2 text-[14px] leading-relaxed text-primary-foreground">{message.content}</div>
          ) : (
            <div className={cn("text-[14px] leading-relaxed", message.error && "border-l-2 border-destructive pl-3 text-destructive")}>
              {waiting ? <TypingIndicator /> : <Markdown text={message.content} />}
            </div>
          ))}

        {message.sources && message.sources.length > 0 && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-xs text-muted-foreground">
            Source: {message.sources.join(", ")}
          </motion.p>
        )}

        {message.order && <OrderCard order={message.order} />}
        {message.handoff && (
          <HandoffForm question={message.handoff.question} status={message.handoff.status} onSubmit={(form) => onHandoff(message.id, form)} />
        )}
      </div>
    </motion.div>
  );
}
