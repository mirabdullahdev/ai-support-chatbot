import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
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
      <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Check className="size-4 text-emerald-600" /> Request sent to the team
      </p>
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mt-3 w-full space-y-2 rounded-lg border bg-card p-3.5"
      data-testid="handoff-form"
    >
      <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="name" />
      <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      <Textarea placeholder="Your question" value={text} onChange={(e) => setText(e.target.value)} required maxLength={2000} rows={3} />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={sending}>
        {sending && <Loader2 className="animate-spin" />} Send to team
      </Button>
    </motion.form>
  );
}
