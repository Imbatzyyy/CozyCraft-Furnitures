import { supabase } from "@/services/supabase/client";
import type { DeliveryServiceArea } from "@/lib/catalog/delivery";

export type SearchSynonym = {
  id: number;
  term: string;
  synonyms: string[];
  active: boolean;
};

const CACHE_MS = 10 * 60 * 1000;
let deliveryCache: { at: number; rows: DeliveryServiceArea[] } | null = null;
let synonymCache: { at: number; rows: SearchSynonym[] } | null = null;

export function clearExperienceConfigCache() {
  deliveryCache = null;
  synonymCache = null;
}

export async function getDeliveryServiceAreas(force = false): Promise<DeliveryServiceArea[]> {
  if (!force && deliveryCache && Date.now() - deliveryCache.at < CACHE_MS) return deliveryCache.rows;
  const { data, error } = await supabase
    .from("delivery_service_areas")
    .select("id,area_code,name,description,delivery_fee,free_delivery_minimum,lead_time_min_days,lead_time_max_days,assembly_available,active,sort_order")
    .eq("active", true)
    .order("sort_order")
    .limit(20);
  if (error) throw error;
  const rows = (data ?? []).map((row) => ({
    ...row,
    delivery_fee: Number(row.delivery_fee),
    free_delivery_minimum: row.free_delivery_minimum === null ? null : Number(row.free_delivery_minimum),
  })) as DeliveryServiceArea[];
  deliveryCache = { at: Date.now(), rows };
  return rows;
}

export async function getSearchSynonyms(force = false): Promise<SearchSynonym[]> {
  if (!force && synonymCache && Date.now() - synonymCache.at < CACHE_MS) return synonymCache.rows;
  const { data, error } = await supabase
    .from("search_synonyms")
    .select("id,term,synonyms,active")
    .eq("active", true)
    .order("term")
    .limit(100);
  if (error) throw error;
  const rows = (data ?? []) as SearchSynonym[];
  synonymCache = { at: Date.now(), rows };
  return rows;
}

export function expandCatalogQuery(query: string, synonyms: SearchSynonym[]): string {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return "";
  const alternatives = new Set<string>([normalized]);
  synonyms.forEach((entry) => {
    const values = [entry.term, ...(entry.synonyms ?? [])].map((value) => value.toLocaleLowerCase());
    if (values.some((value) => value.includes(normalized) || normalized.includes(value))) {
      values.forEach((value) => alternatives.add(value));
    }
  });
  return [...alternatives].join("|");
}

export async function recordCatalogSearch(query: string, resultCount: number, collection: string) {
  const { error } = await supabase.rpc("record_catalog_search", {
    p_query: query,
    p_result_count: resultCount,
    p_collection: collection,
  });
  if (error) throw error;
}

export async function getProductAlerts(userId: string, productId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("product_alerts")
    .select("alert_type")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .eq("active", true)
    .limit(2);
  if (error) throw error;
  return (data ?? []).map((row) => row.alert_type);
}

export async function setProductAlert(
  userId: string,
  productId: string,
  alertType: "back_in_stock" | "price_drop",
  enabled: boolean,
  targetPrice?: number,
) {
  if (!enabled) {
    const { error } = await supabase
      .from("product_alerts")
      .delete()
      .eq("user_id", userId)
      .eq("product_id", productId)
      .eq("alert_type", alertType);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("product_alerts").upsert(
    {
      user_id: userId,
      product_id: productId,
      alert_type: alertType,
      target_price: alertType === "price_drop" ? targetPrice ?? null : null,
      active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,product_id,alert_type" },
  );
  if (error) throw error;
}
