import type {
  ChatEvent,
  ConversationSummary,
  KnowledgeDoc,
  Lead,
  Product,
  ReindexEvent,
  Stats,
  TranscriptMessage,
} from "./types";

const TOKEN_KEY = "nova_admin_token";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export const auth = {
  get: (): string | null => {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string): void => {
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable */
    }
  },
  clear: (): void => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};

async function errorFrom(res: Response): Promise<ApiError> {
  let message = `Request failed (${res.status})`;
  try {
    const data = await res.json();
    if (typeof data.detail === "string") message = data.detail;
    else if (Array.isArray(data.detail) && data.detail[0]?.msg) message = String(data.detail[0].msg).replace(/^Value error, /, "");
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(message, res.status);
}

async function request<T>(path: string, init: RequestInit = {}, admin = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (admin) headers.set("Authorization", `Bearer ${auth.get() ?? ""}`);
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch {
    throw new ApiError("Can't reach the server. Is the backend running on port 8000?", 0);
  }
  if (!res.ok) {
    if (admin && res.status === 401) {
      auth.clear();
      window.dispatchEvent(new Event("nova-logout"));
    }
    throw await errorFrom(res);
  }
  return res.json() as Promise<T>;
}

/** Parse a `data: {...}\n\n` server-sent-event stream from a fetch Response. */
async function* readEvents<T>(res: Response): AsyncGenerator<T> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const line = frame.split("\n").find((l) => l.startsWith("data: "));
      if (line) yield JSON.parse(line.slice(6)) as T;
    }
  }
}

export async function* streamChat(sessionId: string, message: string, signal?: AbortSignal): AsyncGenerator<ChatEvent> {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, message }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    yield { type: "error", message: "I can't reach the server right now. Please check your connection and try again." };
    return;
  }
  if (!res.ok) {
    const e = await errorFrom(res);
    yield { type: "error", message: e.message };
    return;
  }
  yield* readEvents<ChatEvent>(res);
}

export const api = {
  products: () => request<Product[]>("/api/products"),
  submitLead: (body: { session_id: string; name: string; email: string; question: string }) =>
    request<{ id: number; message: string }>("/api/leads", { method: "POST", body: JSON.stringify(body) }),

  login: (password: string) =>
    request<{ token: string }>("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) }),
  stats: () => request<Stats>("/api/admin/stats", {}, true),
  leads: () => request<Lead[]>("/api/admin/leads", {}, true),
  conversations: () => request<ConversationSummary[]>("/api/admin/conversations", {}, true),
  transcript: (id: string) => request<TranscriptMessage[]>(`/api/admin/conversations/${encodeURIComponent(id)}`, {}, true),
  documents: () => request<KnowledgeDoc[]>("/api/admin/documents", {}, true),
  getDocument: (name: string) =>
    request<{ name: string; content: string }>(`/api/admin/documents/${encodeURIComponent(name)}`, {}, true),
  saveDocument: (name: string, content: string) =>
    request<{ indexed: boolean; chunks: number; warning: string | null }>(
      `/api/admin/documents/${encodeURIComponent(name)}`,
      { method: "PUT", body: JSON.stringify({ content }) },
      true,
    ),
  uploadDocument: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ name: string; indexed: boolean; chunks: number; warning: string | null }>(
      "/api/admin/documents",
      { method: "POST", body: form },
      true,
    );
  },
  deleteDocument: (name: string) =>
    request<{ deleted: string }>(`/api/admin/documents/${encodeURIComponent(name)}`, { method: "DELETE" }, true),
};

export async function* reindex(): AsyncGenerator<ReindexEvent> {
  let res: Response;
  try {
    res = await fetch("/api/admin/reindex", { method: "POST", headers: { Authorization: `Bearer ${auth.get() ?? ""}` } });
  } catch {
    yield { stage: "error", message: "Can't reach the server." };
    return;
  }
  if (!res.ok) {
    yield { stage: "error", message: (await errorFrom(res)).message };
    return;
  }
  yield* readEvents<ReindexEvent>(res);
}
