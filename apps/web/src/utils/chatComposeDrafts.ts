const STORAGE_KEY = "wm_compose_drafts_v1";

function loadAll(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, string>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

export function resolveComposeDraftKey(chatId?: string, draftPeerId?: string): string | null {
  if (chatId) return `chat:${chatId}`;
  if (draftPeerId) return `peer:${draftPeerId}`;
  return null;
}

export function getComposeDraft(key: string): string {
  return loadAll()[key] ?? "";
}

export function setComposeDraft(key: string, text: string) {
  const all = loadAll();
  if (!text) {
    delete all[key];
  } else {
    all[key] = text;
  }
  saveAll(all);
}

export function clearComposeDraft(key: string) {
  setComposeDraft(key, "");
}
