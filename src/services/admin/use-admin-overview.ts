import { useMemo, useSyncExternalStore } from "react";
import { adminSupabase } from "@/services/supabase/client";
import { ADMIN_DATA_CHANGED } from "@/lib/admin/workspace-events";
import { createRefreshScheduler } from "@/lib/admin/refresh-scheduler";
import { watchVisibleRecovery } from "@/lib/shared/visible-recovery";

type Snapshot = { data: unknown; error: string; loading: boolean };
const EMPTY: Snapshot = { data: null, error: "", loading: false };
const stores = new Map<string, ReturnType<typeof createStore>>();

// One read model shared by the overview and sidebar, scoped to an identity.
function createStore(owner: string) {
  let snapshot: Snapshot = { ...EMPTY, loading: true };
  const listeners = new Set<() => void>();
  let stop: (() => void) | undefined;
  let invalidate = () => {};
  const publish = (next: Snapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  const store = {
    getSnapshot: () => snapshot,
    reload: () => invalidate(),
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (!stop) {
        let active = true;
        let controller: AbortController | undefined;
        const scheduler = createRefreshScheduler(async () => {
          if (document.visibilityState === "hidden") { recovery.invalidate(); return; }
          const request = new AbortController();
          controller = request;
          const deadline = window.setTimeout(() => request.abort(), 12_000);
          publish({ ...snapshot, loading: true, error: "" });
          try {
            const { data, error } = await adminSupabase.rpc("admin_overview_snapshot", {}).abortSignal(request.signal);
            if (error) throw new Error(error.message);
            if (!data) throw new Error("No workspace data was returned. Please try again.");
            if (active) publish({ data, error: "", loading: false });
          } catch (error) {
            if (active) publish({ ...snapshot, loading: false, error: error instanceof Error ? error.message : "Workspace data could not be loaded." });
          } finally {
            window.clearTimeout(deadline);
          }
        }, 200, 2000);
        const recovery = watchVisibleRecovery(scheduler.request);
        invalidate = recovery.invalidate;
        window.addEventListener(ADMIN_DATA_CHANGED, invalidate);
        recovery.invalidate();
        stop = () => {
          active = false;
          scheduler.dispose();
          controller?.abort();
          recovery.dispose();
          window.removeEventListener(ADMIN_DATA_CHANGED, invalidate);
          invalidate = () => {};
        };
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          stop?.();
          stop = undefined;
          // StrictMode reconnects synchronously; release private cached data
          // on a real unmount without splitting StrictMode's consumers.
          queueMicrotask(() => {
            if (!listeners.size && stores.get(owner) === store) stores.delete(owner);
          });
        }
      };
    },
  };
  return store;
}

const disabled = { getSnapshot: () => EMPTY, subscribe: () => () => {}, reload: () => {} };

export function useAdminOverview<T>(owner: string | null, enabled: boolean) {
  const store = useMemo(() => {
    if (!owner || !enabled) return disabled;
    let entry = stores.get(owner);
    if (!entry) { entry = createStore(owner); stores.set(owner, entry); }
    return entry;
  }, [owner, enabled]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, () => EMPTY);
  return { ...snapshot, data: snapshot.data as T | null, reload: store.reload };
}
