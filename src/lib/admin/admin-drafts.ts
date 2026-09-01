export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const browserDraftStorage = (): DraftStorage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export const readAdminDraft = <T>(
  key: string,
  validate: (value: unknown) => value is T,
  storage: DraftStorage | null = browserDraftStorage(),
): T | null => {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (validate(parsed)) return parsed;
    storage.removeItem(key);
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // Storage can be disabled without preventing use of the admin editor.
    }
  }
  return null;
};

export const writeAdminDraft = (
  key: string,
  value: unknown,
  storage: DraftStorage | null = browserDraftStorage(),
) => {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Draft recovery is an enhancement; storage failures must not block edits.
  }
};

export const clearAdminDraft = (
  key: string,
  storage: DraftStorage | null = browserDraftStorage(),
) => {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignore unavailable browser storage.
  }
};
