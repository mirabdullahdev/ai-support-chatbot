import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, FileJson, FileText, Loader2, Pencil, RefreshCw, Save, Trash2, Upload, X, AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, reindex } from "@/lib/api";
import type { KnowledgeDoc } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Notice {
  tone: "success" | "error";
  text: string;
}

function formatSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export function KnowledgeBase() {
  const [docs, setDocs] = useState<KnowledgeDoc[] | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [editing, setEditing] = useState<{ name: string; content: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ value: number; label: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(() => api.documents().then(setDocs).catch((e: Error) => setNotice({ tone: "error", text: e.message })), []);
  useEffect(() => void load(), [load]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const upload = async (files: FileList | File[]) => {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const res = await api.uploadDocument(file);
        setNotice(
          res.indexed
            ? { tone: "success", text: `${res.name} uploaded and indexed (${res.chunks} chunks). The bot can use it now.` }
            : { tone: "error", text: `${res.name} uploaded but not indexed: ${res.warning}` },
        );
      }
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const edit = async (name: string) => {
    try {
      setEditing(await api.getDocument(name));
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Couldn't open document" });
    }
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await api.saveDocument(editing.name, editing.content);
      setNotice(
        res.indexed
          ? { tone: "success", text: `Saved and re-indexed ${editing.name} (${res.chunks} chunks).` }
          : { tone: "error", text: `Saved, but indexing failed: ${res.warning}` },
      );
      setEditing(null);
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (name: string) => {
    if (!window.confirm(`Delete ${name}? The bot will no longer use it.`)) return;
    try {
      await api.deleteDocument(name);
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Delete failed" });
    }
  };

  const runReindex = async () => {
    setProgress({ value: 2, label: "Starting..." });
    let failed = false;
    for await (const ev of reindex()) {
      if (ev.stage === "error") {
        failed = true;
        setNotice({ tone: "error", text: ev.message ?? "Re-index failed" });
      } else if (ev.stage === "indexing") {
        setProgress({ value: ((ev.done ?? 0) / (ev.total || 1)) * 100, label: `Embedding ${ev.file}` });
      } else if (ev.stage === "done") {
        setProgress({ value: 100, label: "Done" });
        setNotice({ tone: "success", text: `Re-indexed ${ev.total} documents into ${ev.chunks} chunks.` });
      }
    }
    await new Promise((r) => setTimeout(r, failed ? 0 : 900));
    setProgress(null);
    await load();
  };

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="status"
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm",
              notice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800",
            )}
          >
            {notice.tone === "success" ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />}
            {notice.text}
          </motion.div>
        )}
      </AnimatePresence>

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>Knowledge base</CardTitle>
            <p className="text-sm text-muted-foreground">Everything the bot is allowed to answer from.</p>
          </div>
          <div className="flex gap-2">
            <input ref={fileInput} type="file" accept=".md,.txt,.pdf" multiple hidden onChange={(e) => e.target.files && void upload(e.target.files)} />
            <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="animate-spin" /> : <Upload />} Upload
            </Button>
            <Button variant="gradient" onClick={() => void runReindex()} disabled={!!progress}>
              <RefreshCw className={cn(progress && "animate-spin")} /> Re-index
            </Button>
          </div>
        </CardHeader>

        <AnimatePresence>
          {progress && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-5 pb-4">
              <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                <span>{progress.label}</span>
                <span>{Math.round(progress.value)}%</span>
              </div>
              <Progress value={progress.value} />
            </motion.div>
          )}
        </AnimatePresence>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); void upload(e.dataTransfer.files); }}
          className={cn("mx-5 mb-4 rounded-xl border-2 border-dashed px-4 py-5 text-center text-sm text-muted-foreground transition", dragging ? "border-primary bg-secondary" : "border-border")}
        >
          Drop <span className="font-medium text-foreground">.md</span>, <span className="font-medium text-foreground">.txt</span> or <span className="font-medium text-foreground">.pdf</span> files here to teach the bot
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Chunks</TableHead>
              <TableHead>Size</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(docs ?? []).map((d) => (
              <TableRow key={d.name}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    {d.type === "json" ? <FileJson className="size-4 text-amber-600" /> : <FileText className="size-4 text-primary" />}
                    <div>
                      <p className="font-medium">{d.title}</p>
                      <p className="text-xs text-muted-foreground">{d.name}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell><Badge variant="secondary" className="uppercase">{d.type}</Badge></TableCell>
                <TableCell>{d.chunks === 0 ? <Badge variant="warning">not indexed</Badge> : d.chunks}</TableCell>
                <TableCell className="text-muted-foreground">{formatSize(d.size)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" disabled={!d.editable} onClick={() => void edit(d.name)}><Pencil /> Edit</Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => void remove(d.name)} aria-label={`Delete ${d.name}`}><Trash2 /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {docs?.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No documents yet. Upload one to get started.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96 }} className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-card shadow-float">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <h3 className="font-semibold">Edit {editing.name}</h3>
                  <p className="text-xs text-muted-foreground">Saving re-indexes this document instantly.</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setEditing(null)} aria-label="Close"><X /></Button>
              </div>
              <Textarea
                value={editing.content}
                onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                className="m-5 min-h-[50vh] flex-1 resize-none font-mono text-[13px] leading-relaxed"
                spellCheck={false}
              />
              <div className="flex justify-end gap-2 border-t px-5 py-3">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button variant="gradient" onClick={() => void save()} disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : <Save />} Save and index
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
