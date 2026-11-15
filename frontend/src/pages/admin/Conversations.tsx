import { MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/progress";
import { api } from "@/lib/api";
import type { ConversationSummary, TranscriptMessage } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = {
  order_card: "Order lookup",
  handoff: "Handed off",
  error: "Error",
  answer: "Answered",
};

export function Conversations() {
  const [list, setList] = useState<ConversationSummary[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);

  useEffect(() => {
    const load = () => api.conversations().then(setList).catch(() => undefined);
    void load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!selected) return;
    api.transcript(selected).then(setTranscript).catch(() => setTranscript([]));
  }, [selected]);

  useEffect(() => {
    if (!selected && list && list.length > 0) setSelected(list[0].id);
  }, [list, selected]);

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <Card className="max-h-[70vh] overflow-hidden">
        <CardHeader><CardTitle>Chat sessions</CardTitle></CardHeader>
        <div className="scrollbar-thin max-h-[calc(70vh-5rem)] overflow-y-auto px-2 pb-2">
          {list === null ? (
            <div className="space-y-2 p-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : list.length === 0 ? (
            <p className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
              <MessageSquare className="size-8 opacity-50" /> No conversations yet.
            </p>
          ) : (
            list.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={cn("w-full rounded-xl p-3 text-left transition hover:bg-muted", selected === c.id && "bg-secondary")}
              >
                <p className="truncate text-sm font-medium">{c.first_question ?? "(no messages)"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(c.last_at, true)} · {c.message_count} messages
                </p>
              </button>
            ))
          )}
        </div>
      </Card>

      <Card className="max-h-[70vh] overflow-hidden">
        <CardHeader>
          <CardTitle>Transcript</CardTitle>
          {selected && <p className="font-mono text-xs text-muted-foreground">{selected}</p>}
        </CardHeader>
        <div className="scrollbar-thin max-h-[calc(70vh-6rem)] space-y-3 overflow-y-auto px-5 pb-5">
          {transcript.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Select a conversation to read it.</p>}
          {transcript.map((m, i) => (
            <div key={i} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm", m.role === "user" ? "bg-brand-gradient text-white" : "border bg-muted/50")}>
                {m.content}
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                {formatDate(m.created_at, true)}
                {KIND_LABEL[m.kind] && (
                  <Badge variant={m.kind === "handoff" || m.kind === "error" ? "warning" : "success"}>{KIND_LABEL[m.kind]}</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
