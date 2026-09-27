import { useEffect, useState } from "react";
import { adminSupabase } from "@/services/supabase/client";
import { ADMIN_DATA_CHANGED } from "@/lib/admin/workspace-events";

export type AttentionCounts = {
  pending: number;
  fulfillment: number;
  cancellations: number;
  refunds: number;
  support: number;
  lowStock: number;
};

type CacheEntry = { owner: string; at: number; data: AttentionCounts | null; request: Promise<void> | null };

// One small shared summary for sidebar badges. It is cached across page
// changes and refreshed at most every 90 seconds to keep database egress low.
const FRESH_MS = 90_000;
let cache: CacheEntry | null = null;
const listeners = new Set<(data: AttentionCounts | null) => void>();

function publish(data: AttentionCounts | null) {
  listeners.forEach((listener) => listener(data));
}

async function load(owner: string, force = false) {
  if (cache?.owner === owner && cache.request) return cache.request;
  if (!force && cache?.owner === owner && Date.now() - cache.at < FRESH_MS) return;
  const entry: CacheEntry = { owner, at: Date.now(), data: cache?.owner === owner ? cache.data : null, request: null };
  cache = entry;
  entry.request = (async () => {
    try {
      const { data, error } = await adminSupabase.rpc("admin_overview_snapshot", {});
      if (error || !data || cache !== entry) return;
      const counts: AttentionCounts = {
        pending: Number(data.pending) || 0,
        fulfillment: Number(data.fulfillment) || 0,
        cancellations: Number(data.cancellations) || 0,
        refunds: Number(data.refunds) || 0,
        support: Number(data.support) || 0,
        lowStock: Number(data.lowStock) || 0,
      };
      entry.data = counts;
      entry.at = Date.now();
      publish(counts);
    } catch {
      // Badges are optional; the pages themselves show errors.
    } finally {
      entry.request = null;
    }
  })();
  return entry.request;
}

export function useAttentionCounts(owner: string | null, enabled: boolean) {
  const [counts, setCounts] = useState<AttentionCounts | null>(() => (owner && cache?.owner === owner ? cache.data : null));
  useEffect(() => {
    if (!owner || !enabled) return;
    listeners.add(setCounts);
    if (cache?.owner === owner && cache.data) setCounts(cache.data);
    void load(owner);
    let throttle = 0;
    const onChange = () => {
      window.clearTimeout(throttle);
      throttle = window.setTimeout(() => void load(owner, cache ? Date.now() - cache.at > 20_000 : true), 1500);
    };
    window.addEventListener(ADMIN_DATA_CHANGED, onChange);
    return () => {
      listeners.delete(setCounts);
      window.clearTimeout(throttle);
      window.removeEventListener(ADMIN_DATA_CHANGED, onChange);
    };
  }, [owner, enabled]);
  return owner && cache?.owner === owner ? counts : null;
}
