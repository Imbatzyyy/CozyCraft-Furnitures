import { useCallback, useEffect, useRef, useState } from "react";
import { adminSupabase } from "@/services/supabase/client";
import { ADMIN_DATA_CHANGED } from "@/lib/admin/workspace-events";
import { createRefreshScheduler } from "@/lib/admin/refresh-scheduler";
import { watchVisibleRecovery } from "@/lib/shared/visible-recovery";

export function useAdminQuery<T>(name: string, params: Record<string, unknown>, enabled: boolean, identity: string | null) {
  const key = JSON.stringify(params);
  const [data, setData] = useState<T | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const request = useRef<() => void>(() => {});
  const reload = useCallback(() => request.current(), []);
  useEffect(() => { setData(null); }, [identity]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let controller: AbortController | undefined;
    const scheduler = createRefreshScheduler(async () => {
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 12_000);
      setLoading(true);
      setError("");
      try {
        const { data: result, error: issue } = await adminSupabase.rpc(name, JSON.parse(key)).abortSignal(controller.signal);
        if (issue) throw new Error(issue.message);
        if (!result) throw new Error("No workspace data was returned. Please try again.");
        if (active) { setData(result as T); setLoadedKey(`${identity}:${key}`); }
      } catch (issue) {
        if (active) setError(issue instanceof Error ? issue.message : "Workspace data could not be loaded.");
      } finally {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      }
    }, 200, 2000);
    request.current = scheduler.request;
    scheduler.request();
    const recovery = watchVisibleRecovery(scheduler.request);
    window.addEventListener(ADMIN_DATA_CHANGED, recovery.invalidate);
    return () => {
      active = false;
      scheduler.dispose();
      controller?.abort();
      request.current = () => {};
      recovery.dispose();
      window.removeEventListener(ADMIN_DATA_CHANGED, recovery.invalidate);
    };
  }, [name, key, enabled, identity]);
  const current = enabled && loadedKey === `${identity}:${key}`;
  return { data: current ? data : null, error, loading: loading || (!current && !error), reload };
}
