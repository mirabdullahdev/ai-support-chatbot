import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
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
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-xs space-y-4">
        <h1 className="font-display text-4xl">Admin</h1>
        <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />} Sign in
        </Button>
        <a href="/" className="block text-sm text-muted-foreground transition-colors hover:text-foreground">Back to storefront</a>
      </form>
    </div>
  );
}

function StatCards({ stats }: { stats: Stats | null }) {
  const items = [
    { label: "Conversations", value: stats?.conversations },
    { label: "Questions answered", value: stats?.questions_answered },
    { label: "Handoffs", value: stats?.handoffs },
    { label: "Answer rate", value: stats ? `${stats.answer_rate}%` : undefined },
  ];
  return (
    <dl className="grid grid-cols-2 divide-x divide-y rounded-lg border bg-card lg:grid-cols-4 lg:divide-y-0">
      {items.map((s) => (
        <div key={s.label} className="p-5">
          <dt className="text-[13px] text-muted-foreground">{s.label}</dt>
          <dd className="mt-2 font-display text-4xl leading-none">{s.value ?? "–"}</dd>
        </div>
      ))}
    </dl>
  );
}

const NAV = [
  { to: "/admin/knowledge", label: "Knowledge Base" },
  { to: "/admin/leads", label: "Leads" },
  { to: "/admin/conversations", label: "Conversations" },
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
    <div className="min-h-screen lg:flex">
      <aside className="border-b lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:justify-between lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-4 px-5 py-4 lg:block lg:py-6">
          <a href="/admin" className="font-display text-2xl leading-none">Nova Threads</a>
          <nav className="flex gap-1 overflow-x-auto lg:mt-8 lg:flex-col">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn(
                    "whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors",
                    isActive ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="hidden space-y-1 px-5 py-6 text-sm text-muted-foreground lg:block">
          <a href="/" className="block py-1 transition-colors hover:text-foreground">View storefront</a>
          <button onClick={onLogout} className="block py-1 transition-colors hover:text-foreground">Sign out</button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 space-y-6 p-5 lg:p-10">
        <StatCards stats={stats} />
        <Routes>
          <Route path="knowledge" element={<KnowledgeBase />} />
          <Route path="leads" element={<Leads />} />
          <Route path="conversations" element={<Conversations />} />
          <Route path="*" element={<Navigate to="/admin/knowledge" replace />} />
        </Routes>
        <button onClick={onLogout} className="text-sm text-muted-foreground lg:hidden">Sign out</button>
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
