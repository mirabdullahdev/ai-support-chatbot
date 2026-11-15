import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

interface Props {
  question: string;
  status: "open" | "submitted";
  onSubmit: (form: { name: string; email: string; question: string }) => Promise<void>;
}

export function HandoffForm({ question, status, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [text, setText] = useState(question);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "submitted") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mt-2 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
      >
        <CheckCircle2 className="size-4 shrink-0" /> Request sent to the Nova team
      </motion.div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await onSubmit({ name: name.trim(), email: email.trim(), question: text.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send your request. Please try again.");
      setSending(false);
    }
  };

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className="mt-2 w-full space-y-2.5 rounded-2xl border bg-card p-4 shadow-soft"
      data-testid="handoff-form"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Talk to our team</p>
      <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="name" />
      <Input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      <Textarea placeholder="Your question" value={text} onChange={(e) => setText(e.target.value)} required maxLength={2000} rows={3} />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" variant="gradient" className="w-full" disabled={sending}>
        {sending ? <Loader2 className="animate-spin" /> : <Send />} Send to team
      </Button>
    </motion.form>
  );
}
