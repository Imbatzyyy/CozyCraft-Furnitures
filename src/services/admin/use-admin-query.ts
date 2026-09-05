import { useCallback, useEffect, useRef, useState } from "react";
import { adminSupabase } from "@/services/supabase/client";
import { ADMIN_DATA_CHANGED } from "@/lib/admin/workspace-events";

// Component-lifetime memory only: no customer records in persistent storage.
// Coalesce realtime bursts and focus/visibility pairs; never poll continuously.
export function useAdminQuery<T>(name: string, params: Record<string, unknown>, enabled: boolean, identity: string | null) {
  const key = JSON.stringify(params);
  const [data, setData] = useState<T | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const lastFinished = useRef(0);
  useEffect(() => { setData(null); }, [identity]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    setLoading(true);
    setError("");
    // Small debounce also bounds requests while typing in the queue search.
    const timer = window.setTimeout(async () => {
      try {
        const { data: result, error: issue } = await adminSupabase.rpc(name, JSON.parse(key)).abortSignal(controller.signal);
        if (issue) throw new Error(issue.message);
        if (!result) throw new Error("No workspace data was returned. Please try again.");
        if (active) { setData(result as T); setLoadedKey(`${identity}:${key}`); lastFinished.current = Date.now(); }
      } catch (issue) {
        if (active) setError(issue instanceof Error ? issue.message : "Workspace data could not be loaded.");
      } finally {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      }
    }, 200);
    return () => { active = false; window.clearTimeout(timer); window.clearTimeout(timeout); controller.abort(); };
  }, [name, key, enabled, identity, revision]);
  useEffect(() => {
    if (!enabled) return;
    let timer: number | undefined;
    const changed = () => { window.clearTimeout(timer); timer = window.setTimeout(reload, 500); };
    const focus = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFinished.current > 30_000) changed();
    };
    window.addEventListener(ADMIN_DATA_CHANGED, changed);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => { window.clearTimeout(timer); window.removeEventListener(ADMIN_DATA_CHANGED, changed); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); };
  }, [enabled, reload]);
  const current = loadedKey === `${identity}:${key}`;
  return { data: current ? data : null, error, loading: loading || (!current && !error), reload };
}
