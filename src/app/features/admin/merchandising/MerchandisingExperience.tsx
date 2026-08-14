import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Bell, Check, MapPin, Plus, RefreshCw, Search, Sparkles, Trash2 } from "lucide-react";
import { AdminShell } from "@/app/features/admin/shell/AdminShell";
import { useStore } from "@/app/core";
import { supabase } from "@/services/supabase/client";
import {
  clearExperienceConfigCache,
  type SearchSynonym,
} from "@/services/catalog/experience.service";
import type { DeliveryServiceArea } from "@/lib/catalog/delivery";

type ProductAlertRow = {
  product_id: string;
  alert_type: "back_in_stock" | "price_drop";
  target_price: number | null;
  created_at: string;
};

type SearchEventRow = {
  normalized_query: string;
  result_count: number;
  collection: string | null;
  created_at: string;
};

export function MerchandisingExperiencePage() {
  const { adminProducts } = useStore();
  const [areas, setAreas] = useState<DeliveryServiceArea[]>([]);
  const [synonyms, setSynonyms] = useState<SearchSynonym[]>([]);
  const [alerts, setAlerts] = useState<ProductAlertRow[]>([]);
  const [searches, setSearches] = useState<SearchEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [newTerm, setNewTerm] = useState("");
  const [newSynonyms, setNewSynonyms] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [areaResult, synonymResult, alertResult, searchResult] = await Promise.all([
      supabase.from("delivery_service_areas").select("id,area_code,name,description,delivery_fee,free_delivery_minimum,lead_time_min_days,lead_time_max_days,assembly_available,active,sort_order").order("sort_order").limit(20),
      supabase.from("search_synonyms").select("id,term,synonyms,active").order("term").limit(100),
      supabase.from("product_alerts").select("product_id,alert_type,target_price,created_at").eq("active", true).order("created_at", { ascending: false }).limit(500),
      supabase.from("search_events").select("normalized_query,result_count,collection,created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(250),
    ]);
    const error = areaResult.error ?? synonymResult.error ?? alertResult.error ?? searchResult.error;
    if (error) setNotice(error.message);
    setAreas(((areaResult.data ?? []) as DeliveryServiceArea[]).map((row) => ({ ...row, delivery_fee: Number(row.delivery_fee), free_delivery_minimum: row.free_delivery_minimum === null ? null : Number(row.free_delivery_minimum) })));
    setSynonyms((synonymResult.data ?? []) as SearchSynonym[]);
    setAlerts((alertResult.data ?? []) as ProductAlertRow[]);
    setSearches((searchResult.data ?? []) as SearchEventRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const onFocus = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [load]);

  const alertDemand = useMemo(() => {
    const counts = new Map<string, { back: number; price: number }>();
    alerts.forEach((alert) => {
      const current = counts.get(alert.product_id) ?? { back: 0, price: 0 };
      if (alert.alert_type === "back_in_stock") current.back += 1;
      else current.price += 1;
      counts.set(alert.product_id, current);
    });
    return [...counts.entries()].map(([productId, demand]) => ({
      product: adminProducts.find((product) => product.id === productId),
      productId,
      ...demand,
      total: demand.back + demand.price,
    })).sort((a, b) => b.total - a.total).slice(0, 12);
  }, [adminProducts, alerts]);

  const searchDemand = useMemo(() => {
    const groups = new Map<string, { count: number; zero: number; latest: string }>();
    searches.forEach((search) => {
      const current = groups.get(search.normalized_query) ?? { count: 0, zero: 0, latest: search.created_at };
      current.count += 1;
      if (search.result_count === 0) current.zero += 1;
      if (search.created_at > current.latest) current.latest = search.created_at;
      groups.set(search.normalized_query, current);
    });
    return [...groups.entries()].map(([query, data]) => ({ query, ...data })).sort((a, b) => b.zero - a.zero || b.count - a.count).slice(0, 15);
  }, [searches]);

  const saveArea = async (area: DeliveryServiceArea) => {
    setNotice("");
    const { error } = await supabase.from("delivery_service_areas").update({
      name: area.name,
      description: area.description,
      delivery_fee: area.delivery_fee,
      free_delivery_minimum: area.free_delivery_minimum,
      lead_time_min_days: area.lead_time_min_days,
      lead_time_max_days: area.lead_time_max_days,
      assembly_available: area.assembly_available,
      active: area.active,
      updated_at: new Date().toISOString(),
    }).eq("id", area.id);
    setNotice(error?.message ?? `${area.name} delivery settings saved.`);
    if (!error) clearExperienceConfigCache();
  };

  const addSynonym = async (event: FormEvent) => {
    event.preventDefault();
    const values = newSynonyms.split(",").map((value) => value.trim()).filter(Boolean).slice(0, 20);
    if (newTerm.trim().length < 2 || values.length === 0) return;
    const { error } = await supabase.from("search_synonyms").insert({ term: newTerm.trim(), synonyms: values, active: true });
    setNotice(error?.message ?? "Search language added.");
    if (!error) { setNewTerm(""); setNewSynonyms(""); clearExperienceConfigCache(); await load(); }
  };

  const removeSynonym = async (id: number) => {
    const { error } = await supabase.from("search_synonyms").delete().eq("id", id);
    setNotice(error?.message ?? "Search language removed.");
    if (!error) { clearExperienceConfigCache(); setSynonyms((current) => current.filter((item) => item.id !== id)); }
  };

  return <AdminShell title="Merchandising & experience"><main className="mx-auto max-w-[1500px] p-5 lg:p-8">
    <header className="flex flex-col gap-4 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold tracking-[.18em] text-muted-foreground">CUSTOMER EXPERIENCE CONTROL</p><h1 className="mt-3 font-serif text-4xl sm:text-5xl">Merchandising & experience</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Manage delivery promises and discovery language, then use saved customer intent to make better catalog decisions.</p></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-semibold disabled:opacity-50"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/>Refresh insights</button></header>
    {notice && <div role="status" className="mt-5 flex items-center gap-2 rounded-xl bg-[#e7eee3] px-4 py-3 text-xs font-semibold text-[#50664b]"><Check size={15}/>{notice}</div>}
    <section className="mt-7 grid gap-4 sm:grid-cols-3"><article className="rounded-2xl border border-border bg-card p-5"><Bell size={18}/><p className="mt-4 text-3xl font-serif">{alerts.length}</p><p className="mt-1 text-xs text-muted-foreground">Active stock and price alerts</p></article><article className="rounded-2xl border border-border bg-card p-5"><Search size={18}/><p className="mt-4 text-3xl font-serif">{searches.length}</p><p className="mt-1 text-xs text-muted-foreground">Deduplicated searches · last 30 days</p></article><article className="rounded-2xl border border-border bg-card p-5"><MapPin size={18}/><p className="mt-4 text-3xl font-serif">{areas.filter((area) => area.active).length}</p><p className="mt-1 text-xs text-muted-foreground">Active delivery service areas</p></article></section>
    <div className="mt-7 grid gap-7 xl:grid-cols-[1.2fr_.8fr]">
      <section className="rounded-2xl border border-border bg-card"><header className="border-b border-border p-5"><h2 className="text-lg font-semibold">Delivery promises</h2><p className="mt-1 text-xs text-muted-foreground">Changes appear on product pages after the short configuration cache expires.</p></header><div className="divide-y divide-border">{areas.map((area) => <article key={area.id} className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4"><label className="grid gap-1 text-[10px] font-bold text-muted-foreground sm:col-span-2">AREA<input value={area.name} onChange={(event) => setAreas((current) => current.map((item) => item.id === area.id ? { ...item, name: event.target.value } : item))} className="h-10 rounded-xl border border-border px-3 text-xs font-normal text-foreground"/></label><label className="grid gap-1 text-[10px] font-bold text-muted-foreground">FEE<input type="number" min="0" value={area.delivery_fee} onChange={(event) => setAreas((current) => current.map((item) => item.id === area.id ? { ...item, delivery_fee: Number(event.target.value) } : item))} className="h-10 rounded-xl border border-border px-3 text-xs font-normal text-foreground"/></label><label className="grid gap-1 text-[10px] font-bold text-muted-foreground">FREE FROM<input type="number" min="0" value={area.free_delivery_minimum ?? ""} onChange={(event) => setAreas((current) => current.map((item) => item.id === area.id ? { ...item, free_delivery_minimum: event.target.value ? Number(event.target.value) : null } : item))} className="h-10 rounded-xl border border-border px-3 text-xs font-normal text-foreground"/></label><label className="grid gap-1 text-[10px] font-bold text-muted-foreground">MIN DAYS<input type="number" min="0" max="60" value={area.lead_time_min_days} onChange={(event) => setAreas((current) => current.map((item) => item.id === area.id ? { ...item, lead_time_min_days: Number(event.target.value) } : item))} className="h-10 rounded-xl border border-border px-3 text-xs font-normal text-foreground"/></label><label className="grid gap-1 text-[10px] font-bold text-muted-foreground">MAX DAYS<input type="number" min={area.lead_time_min_days} max="90" value={area.lead_time_max_days} onChange={(event) => setAreas((current) => current.map((item) => item.id === area.id ? { ...item, lead_time_max_days: Number(event.target.value) } : item))} className="h-10 rounded-xl border border-border px-3 text-xs font-normal text-foreground"/></label><label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={area.assembly_available} onChange={(event) => setAreas((current) => current.map((item) => item.id === area.id ? { ...item, assembly_available: event.target.checked } : item))}/>Assembly available</label><button type="button" onClick={() => void saveArea(area)} className="h-10 rounded-xl bg-foreground px-4 text-xs font-semibold text-background">Save area</button></article>)}</div></section>
      <section className="rounded-2xl border border-border bg-card"><header className="border-b border-border p-5"><h2 className="text-lg font-semibold">Search language</h2><p className="mt-1 text-xs text-muted-foreground">Help customers find products with familiar alternative names.</p></header><form onSubmit={addSynonym} className="grid gap-3 border-b border-border p-5"><input value={newTerm} onChange={(event) => setNewTerm(event.target.value)} placeholder="Catalog term, e.g. ottoman" className="h-10 rounded-xl border border-border px-3 text-xs"/><input value={newSynonyms} onChange={(event) => setNewSynonyms(event.target.value)} placeholder="Synonyms separated by commas" className="h-10 rounded-xl border border-border px-3 text-xs"/><button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-foreground text-xs font-semibold text-background"><Plus size={14}/>Add search language</button></form><div className="max-h-[520px] divide-y divide-border overflow-y-auto">{synonyms.map((entry) => <div key={entry.id} className="flex items-start gap-3 p-4"><Sparkles size={15} className="mt-0.5 shrink-0"/><div className="min-w-0 flex-1"><p className="text-xs font-semibold">{entry.term}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{entry.synonyms.join(" · ")}</p></div><button type="button" onClick={() => void removeSynonym(entry.id)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary" aria-label={`Remove ${entry.term}`}><Trash2 size={14}/></button></div>)}</div></section>
    </div>
    <div className="mt-7 grid gap-7 lg:grid-cols-2"><section className="rounded-2xl border border-border bg-card p-5"><h2 className="text-lg font-semibold">Products customers are watching</h2><p className="mt-1 text-xs text-muted-foreground">Prioritize replenishment and promotions using durable customer intent.</p><div className="mt-4 divide-y divide-border">{alertDemand.length ? alertDemand.map((item) => <div key={item.productId} className="grid grid-cols-[1fr_auto] gap-3 py-3"><div><p className="text-xs font-semibold">{item.product?.name ?? "Unavailable product"}</p><p className="mt-1 text-[10px] text-muted-foreground">{item.product?.subcategory ?? item.product?.category ?? item.productId}</p></div><div className="text-right text-[10px] text-muted-foreground"><p className="font-semibold text-foreground">{item.total} alerts</p><p>{item.back} stock · {item.price} price</p></div></div>) : <p className="py-8 text-center text-xs text-muted-foreground">No customer alerts yet.</p>}</div></section><section className="rounded-2xl border border-border bg-card p-5"><h2 className="text-lg font-semibold">Search opportunities</h2><p className="mt-1 text-xs text-muted-foreground">Zero-result terms come first so the catalog team can add synonyms or products.</p><div className="mt-4 divide-y divide-border">{searchDemand.length ? searchDemand.map((item) => <div key={item.query} className="flex items-center justify-between gap-3 py-3"><div><p className="text-xs font-semibold">“{item.query}”</p><p className="mt-1 text-[10px] text-muted-foreground">Last searched {new Date(item.latest).toLocaleDateString("en-PH")}</p></div><div className="text-right text-[10px]"><p className={item.zero ? "font-semibold text-[#8b5c46]" : "font-semibold text-[#56714f]"}>{item.zero} zero-result</p><p className="mt-1 text-muted-foreground">{item.count} searches</p></div></div>) : <p className="py-8 text-center text-xs text-muted-foreground">Search insights will appear after signed-in customers search.</p>}</div></section></div>
    <p className="mt-6 text-center text-[10px] text-muted-foreground">Analytics refresh when this page opens, regains focus, or you choose Refresh. No continuous polling is used, protecting database egress.</p>
  </main></AdminShell>;
}
