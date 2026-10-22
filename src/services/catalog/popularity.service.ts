import { supabase } from "@/services/supabase/client";
import { withReadDeadline } from "@/lib/shared/read-deadline";
type Counts = { popularity: number; saves: number };
let cache = new Map<string, Counts>(), expires = 0;
let pending: Promise<Map<string, Counts>> | null = null;
export const cachedProductPopularity = (id: string) => cache.get(id) ?? { popularity: 0, saves: 0 };
/** One compact read, reused by the catalog. Never downloads browsing history. */
export function getCatalogPopularity() {
  if (Date.now() < expires) return Promise.resolve(cache);
  if (pending) return pending;
  pending = (async () => {
    try {
      const { data, error } = await withReadDeadline(signal => supabase.rpc("catalog_popularity").abortSignal(signal));
      if (error) throw error;
      cache = new Map((data ?? []).map((row: {product_id:string;viewers:number;saves:number}) => [row.product_id, {popularity: Math.max(0, Number(row.viewers) || 0), saves: Math.max(0, Number(row.saves) || 0)}]));
      expires = Date.now() + 60_000;
    } catch { expires = Date.now() + 15_000; }
    return cache;
  })().finally(() => { pending = null; });
  return pending;
}
