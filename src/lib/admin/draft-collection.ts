import { useCallback, useRef, useState, type SetStateAction } from "react";
import { sessionStore } from "@/lib/shared/browser-storage";

function restoreDrafts<T>(storageKey: string | undefined, key: (row: T) => string) {
  try {
    const record = JSON.parse(storageKey ? sessionStore.getItem(storageKey) ?? "null" : "null");
    if (record && Number.isFinite(record.at) && Date.now() - record.at < 86_400_000 && Array.isArray(record.rows)) {
      return new Map<string, T>(record.rows.map((row: T) => [key(row), row]));
    }
  } catch { /* Invalid drafts must never prevent the editor opening. */ }
  return new Map<string, T>();
}

export function mergeDrafts<T>(server: T[], drafts: Map<string, T>, key: (row: T) => string): T[] {
  const merged = server.map(row => drafts.get(key(row)) ?? row);
  const existing = new Set(server.map(key));
  return [...merged, ...[...drafts].filter(([id]) => !existing.has(id)).map(([, row]) => row)];
}
/** Incoming server rows never replace a dirty record. Saving a snapshot must
 * also preserve edits made after that save started. */
export function useDraftCollection<T>(key: (row: T) => string, storageKey?: string) {
  // Callers key the editor by account so drafts never cross administrators.
  const [initial] = useState(() => restoreDrafts(storageKey, key));
  const state = useRef({ server: [] as T[], drafts: initial, visible: [...initial.values()] });
  const keyRef = useRef(key); keyRef.current = key;
  const [rows, render] = useState<T[]>(() => [...initial.values()]);
  const publish = useCallback(() => {
    state.current.visible = mergeDrafts(state.current.server, state.current.drafts, keyRef.current);
    if (storageKey) {
      if (state.current.drafts.size) sessionStore.setItem(storageKey, JSON.stringify({ at: Date.now(), rows: [...state.current.drafts.values()] }));
      else sessionStore.removeItem(storageKey);
    }
    render(state.current.visible);
  }, [storageKey]);
  const setRows = useCallback((update: SetStateAction<T[]>) => {
    const current = state.current;
    const next = typeof update === "function" ? (update as (rows: T[]) => T[])(current.visible) : update;
    const ids = new Set(next.map(keyRef.current));
    for (const row of next) {
      const id = keyRef.current(row);
      const before = current.visible.find(item => keyRef.current(item) === id);
      if (JSON.stringify(before) !== JSON.stringify(row)) {
        const server = current.server.find(item => keyRef.current(item) === id);
        if (JSON.stringify(server) === JSON.stringify(row)) current.drafts.delete(id);
        else current.drafts.set(id, row);
      }
    }
    current.server = current.server.filter(row => ids.has(keyRef.current(row)));
    for (const id of current.drafts.keys()) if (!ids.has(id)) current.drafts.delete(id);
    publish();
  }, [publish]);
  const refresh = useCallback((server: T[]) => { state.current.server = server; publish(); }, [publish]);
  const saved = useCallback((submitted: T, result: T) => {
    const id = keyRef.current(submitted);
    state.current.server = [...state.current.server.filter(row => keyRef.current(row) !== id), result];
    const draft = state.current.drafts.get(id);
    if (JSON.stringify(draft) === JSON.stringify(submitted)) state.current.drafts.delete(id);
    else if (draft && typeof draft === "object" && draft !== null) {
      state.current.drafts.set(id, { ...draft, updated_at: (result as { updated_at?: string }).updated_at });
    }
    publish();
  }, [publish]);
  const discard = useCallback(() => { state.current.drafts.clear(); publish(); }, [publish]);
  return { rows, setRows, refresh, saved, discard, dirty: state.current.drafts.size > 0 };
}
