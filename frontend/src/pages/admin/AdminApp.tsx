import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, CheckCircle2, ExternalLink, Inbox, Loader2, Lock, LogOut, MessageSquare, Sparkles, UserRoundPlus } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, auth } from "@/lib/api";
import type { Stats } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Conversations } from "./Conversations";
import { KnowledgeBase } from "./KnowledgeBase";
import { Leads } from "./Leads";

function Login({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { token } = await api.login(password);
      auth.set(token);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-8 shadow-float"
      >
        <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-gradient text-white"><Lock className="size-5" /></div>
        <div>
          <h1 className="text-2xl font-bold">Admin sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Nova Threads support dashboard</p>
        </div>
        <Input type="password" placeholder="Admin password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" variant="gradient" className="w-full" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />} Sign in
        </Button>
        <a href="/" className="block text-center text-xs text-muted-foreground hover:text-foreground">← Back to storefront</a>
      </motion.form>
    </div>
  );
}

function StatCards({ stats }: { stats: Stats | null }) {
  const items = [
    { label: "Conversations", value: stats?.conversations, icon: MessageSquare, tone: "text-violet-600 bg-violet-100" },
    { label: "Questions answered", value: stats?.questions_answered, icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-100" },
    { label: "Handoffs", value: stats?.handoffs, icon: UserRoundPlus, tone: "text-amber-600 bg-amber-100" },
    { label: "Answer rate", value: stats ? `${stats.answer_rate}%` : undefined, icon: Sparkles, tone: "text-pink-600 bg-pink-100" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((s, i) => (
        <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
          <Card className="flex items-center gap-4 p-4">
            <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", s.tone)}><s.icon className="size-5" /></span>
            <div>
              <p className="font-display text-2xl font-bold leading-none">{s.value ?? "–"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

const NAV = [
  { to: "/admin/knowledge", label: "Knowledge Base", icon: BookOpen },
  { to: "/admin/leads", label: "Leads", icon: Inbox },
  { to: "/admin/conversations", label: "Conversations", icon: MessageSquare },
];

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const location = useLocation();

  const refresh = useCallback(() => {
    api.stats().then(setStats).catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh, location.pathname]);

  return (
    <div className="min-h-screen bg-muted/40 lg:flex">
      <aside className="border-b bg-card lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 p-4 lg:flex-col lg:items-stretch lg:p-5">
          <div className="flex items-center gap-2.5 font-display font-bold">
            <span className="flex size-8 items-center justify-center rounded-xl bg-brand-gradient text-white"><Sparkles className="size-4" /></span>
            Nova Support
          </div>
          <nav className="flex gap-1 overflow-x-auto lg:mt-6 lg:flex-col">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition",
                    isActive ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                <n.icon className="size-4" /> {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="hidden space-y-1 p-4 lg:absolute lg:bottom-0 lg:block lg:w-64">
          <a href="/" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground">
            <ExternalLink className="size-4" /> View storefront
          </a>
          <button onClick={onLogout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
        <StatCards stats={stats} />
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <Routes>
              <Route path="knowledge" element={<KnowledgeBase />} />
              <Route path="leads" element={<Leads />} />
              <Route path="conversations" element={<Conversations />} />
              <Route path="*" element={<Navigate to="/admin/knowledge" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
        <button onClick={onLogout} className="flex items-center gap-2 text-sm text-muted-foreground lg:hidden"><LogOut className="size-4" /> Sign out</button>
      </main>
    </div>
  );
}

export function AdminApp() {
  const [authed, setAuthed] = useState(() => !!auth.get());

  useEffect(() => {
    const onLogout = () => setAuthed(false);
    window.addEventListener("nova-logout", onLogout);
    return () => window.removeEventListener("nova-logout", onLogout);
  }, []);

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;
  return (
    <Dashboard
      onLogout={() => {
        auth.clear();
        setAuthed(false);
      }}
    />
  );
}
