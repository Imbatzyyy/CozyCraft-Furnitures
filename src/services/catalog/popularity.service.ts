import { supabase } from "@/services/supabase/client";
import { withReadDeadline } from "@/lib/shared/read-deadline";
type Counts = { popularity: number; saves: number };
type Listener = (counts: Map<string, Counts>) => void;
let cache = new Map<string, Counts>(), expires = 0, revision = 0, available = false;
let pending: Promise<Map<string, Counts>> | null = null;
const listeners = new Set<Listener>();
export const cachedProductPopularity = (id: string) => cache.get(id) ?? { popularity: 0, saves: 0 };
export const catalogPopularityAvailable = () => available;
export function subscribeCatalogPopularity(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
const publish = () => { for (const listener of listeners) listener(cache); };
/** Compact aggregates only. Share concurrent reads and reuse them for one minute. */
export function getCatalogPopularity(): Promise<Map<string, Counts>> {
  if (pending) return pending;
  if (Date.now() < expires) return Promise.resolve(cache);
  const started = revision;
  pending = (async () => {
    try {
      const { data, error } = await withReadDeadline(signal => supabase.rpc("catalog_visit_counts").abortSignal(signal));
      if (error || !Array.isArray(data)) throw error ?? new Error("Counts unavailable");
      const next = new Map<string, Counts>(data.map((row: { product_id: string; visits: number; saves: number }) => [row.product_id, {
        popularity: Math.max(0, Number(row.visits) || 0), saves: Math.max(0, Number(row.saves) || 0),
      }]));
      // A visit response can arrive during this read. Keep the newer count.
      if (started !== revision) for (const [id, count] of cache) {
        const entry = next.get(id);
        if (entry) entry.popularity = Math.max(entry.popularity, count.popularity);
      }
      cache = next; available = true;
      expires = started === revision ? Date.now() + 60_000 : 0;
      publish();
    } catch { expires = Date.now() + 15_000; }
    return cache;
  })().finally(() => { pending = null; });
  return pending;
}

// Memory only: no visitor cookie, persistent identifier or account ID.
const visits = new Map<string, { eventId: string; until: number; pending?: Promise<void>; complete?: boolean }>();
export function recordProductVisit(productId: string): Promise<void> {
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(productId)) return Promise.resolve();
  const now = Date.now();
  for (const [id, visit] of visits) if (visit.until <= now && !visit.pending) visits.delete(id);
  let visit = visits.get(productId);
  if (visit?.pending) return visit.pending;
  if (visit?.complete) return Promise.resolve();
  if (!visit) {
    if (typeof crypto.randomUUID !== "function") return Promise.resolve();
    visit = { eventId: crypto.randomUUID(), until: now + 30 * 60_000 };
    visits.set(productId, visit);
  }
  const current = visit;
  current.pending = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      // Do not send the customer's bearer token to this anonymous endpoint.
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/record-product-visit`, {
        method: "POST", credentials: "omit", signal: controller.signal,
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ productId, eventId: current.eventId }),
      });
      if (!response.ok) return;
      const result = await response.json();
      current.complete = true;
      // A retry may have been accepted by an earlier timed-out request.
      revision++; expires = 0;
      if (result.accepted === true && Number.isSafeInteger(result.visits) && result.visits >= 0) {
        cache = new Map(cache).set(productId, { ...cachedProductPopularity(productId), popularity: Math.max(cachedProductPopularity(productId).popularity, result.visits) });
        publish();
      }
    } catch { /* Non-blocking; reuse this event ID on a later attempt. */ }
    finally { clearTimeout(timer); current.pending = undefined; }
  })();
  return current.pending;
}
