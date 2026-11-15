const KEY = "nova_chat_session";

/** One id per browser tab, so each demo run is its own conversation. */
export function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem(KEY);
    if (existing) return existing;
  } catch {
    /* storage unavailable */
  }
  return resetSessionId();
}

export function resetSessionId(): string {
  const id = crypto.randomUUID();
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    /* storage unavailable */
  }
  return id;
}
