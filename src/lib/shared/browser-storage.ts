/** Optional persistence must never crash shopping. Failed removals must not
 * resurrect stale values when the browser starts allowing storage again. */
export function resilientStorage(access: () => Storage | null): Storage {
  const memory = new Map<string, string>();
  const pending = new Set<string>();
  const disk = () => { try { return access(); } catch { return null; } };
  const keys = () => {
    const result = new Set(memory.keys());
    try {
      const storage = disk();
      for (let i = 0; storage && i < storage.length; i++) {
        const key = storage.key(i);
        if (key !== null && (!pending.has(key) || memory.has(key))) result.add(key);
      }
    } catch { /* In-memory keys remain available. */ }
    return [...result];
  };
  return {
    get length() { return keys().length; },
    key(index) { return keys()[index] ?? null; },
    getItem(key) {
      if (pending.has(key)) {
        const value = memory.get(key) ?? null;
        try {
          const storage = disk();
          if (storage) {
            if (value === null) storage.removeItem(key); else storage.setItem(key, value);
            pending.delete(key);
          }
        } catch { /* Keep the newer value until persistence becomes available. */ }
        return value;
      }
      try {
        const storage = disk();
        if (storage) {
          const value = storage.getItem(key);
          if (value === null) memory.delete(key); else memory.set(key, value);
          return value;
        }
      } catch { /* Fall back for blocked reads. */ }
      return memory.get(key) ?? null;
    },
    setItem(key, value) {
      memory.set(key, String(value)); pending.add(key);
      try {
        const storage = disk();
        if (storage) { storage.setItem(key, String(value)); pending.delete(key); }
      } catch { /* Quota/private-mode failure: keep this session's value. */ }
    },
    removeItem(key) {
      memory.delete(key); pending.add(key);
      try {
        const storage = disk();
        if (storage) { storage.removeItem(key); pending.delete(key); }
      } catch { /* Deletion takes precedence over old disk data. */ }
    },
    clear() { for (const key of keys()) this.removeItem(key); },
  };
}

export const localStore = resilientStorage(() => typeof window === "undefined" ? null : window.localStorage);
export const sessionStore = resilientStorage(() => typeof window === "undefined" ? null : window.sessionStorage);

export function storageKeys(storage: Storage) {
  return Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((key): key is string => key !== null);
}
