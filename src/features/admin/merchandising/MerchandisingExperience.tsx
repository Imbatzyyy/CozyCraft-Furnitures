import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Bell, MapPin, Plus, RefreshCw, Search, SearchX, Sparkles, Trash2, Truck } from "lucide-react";
import { AdminShell } from "@/features/admin/shell/AdminShell";
import { money, useStore, Toast } from "@/app/core";
import { adminSupabase as supabase } from "@/services/supabase/client";
import { ResilientImage } from "@/components/media/ResilientImage";
import { primaryProductImage } from "@/lib/catalog/product-images";
import { plural, relativeTime } from "@/lib/admin/format";
import { confirmAction } from "@/components/admin/confirm";
import { Card, CardHeader, EmptyState, PageHeader, Pill, StatStrip, Switch, useNotice } from "@/components/admin/ui";
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
  const { notice, notify, clear } = useNotice();
  const setNotice = (message: string) => { if (message) notify(message, /could ?n|failed|error|denied|violates|permission/i.test(message) ? "error" : "success"); };
  const termRef = useRef<HTMLInputElement>(null);
  const [savingArea, setSavingArea] = useState<number | null>(null);
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
    setSavingArea(area.id);
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
    setSavingArea(null);
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
    const entry = synonyms.find((item) => item.id === id);
    const confirmed = await confirmAction({ title: `Remove “${entry?.term ?? "this term"}”?`, description: "Customers searching these alternative names may no longer find matching products.", confirmLabel: "Remove", tone: "danger" });
    if (!confirmed) return;
    const { error } = await supabase.from("search_synonyms").delete().eq("id", id);
    setNotice(error?.message ?? "Search language removed.");
    if (!error) { clearExperienceConfigCache(); setSynonyms((current) => current.filter((item) => item.id !== id)); }
  };

  const updateArea = (id: number, patch: Partial<DeliveryServiceArea>) => setAreas((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const productFor = (id: string) => adminProducts.find((product) => product.id === id);
  const zeroResults = searchDemand.filter((item) => item.zero > 0).length;

  return (
    <AdminShell title="Merchandising & experience">
      <PageHeader
        eyebrow="Customer experience"
        title="Merchandising"
        description="Manage delivery promises and search language, then use saved customer intent to make better catalog decisions."
        actions={<button type="button" onClick={() => void load()} disabled={loading} className="adm-btn"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh insights</button>}
      >
        <StatStrip
          loading={loading && !areas.length}
          items={[
            { label: "Watched products", value: alertDemand.length, note: `${plural(alerts.length, "active alert")} for stock or price`, icon: Bell },
            { label: "Searches · 30 days", value: searches.length, note: "Recent customer searches", icon: Search },
            { label: "Zero-result terms", value: zeroResults, note: "Searches that found nothing", icon: SearchX, tone: zeroResults ? "warning" : "neutral" },
            { label: "Delivery areas", value: areas.filter((area) => area.active).length, note: "Active service areas", icon: MapPin },
          ]}
        />
      </PageHeader>
      <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr] xl:items-start">
        <Card className="overflow-hidden">
          <CardHeader eyebrow="Delivery promises" title="Service areas" description="Shown on product pages after the short configuration cache refreshes." />
          {areas.length === 0 ? (
            <EmptyState icon={Truck} title={loading ? "Loading delivery areas…" : "No delivery areas configured."} compact />
          ) : (
            <div className="divide-y divide-border">
              {areas.map((area) => (
                <form key={area.id} onSubmit={(event) => { event.preventDefault(); void saveArea(area); }} className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
                  <label className="adm-label sm:col-span-2">
                    Area name
                    <input value={area.name} onChange={(event) => updateArea(area.id, { name: event.target.value })} className="adm-input font-normal" />
                  </label>
                  <label className="adm-label">
                    Delivery fee
                    <input type="number" min="0" value={area.delivery_fee} onChange={(event) => updateArea(area.id, { delivery_fee: Number(event.target.value) })} className="adm-input adm-num font-normal" />
                  </label>
                  <label className="adm-label">
                    Free from
                    <input type="number" min="0" value={area.free_delivery_minimum ?? ""} placeholder="No minimum" onChange={(event) => updateArea(area.id, { free_delivery_minimum: event.target.value ? Number(event.target.value) : null })} className="adm-input adm-num font-normal" />
                  </label>
                  <label className="adm-label">
                    Lead time from
                    <span className="relative block"><input type="number" min="0" max="60" value={area.lead_time_min_days} onChange={(event) => updateArea(area.id, { lead_time_min_days: Number(event.target.value) })} className="adm-input adm-num pr-12 font-normal" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">days</span></span>
                  </label>
                  <label className="adm-label">
                    Lead time to
                    <span className="relative block"><input type="number" min={area.lead_time_min_days} max="90" value={area.lead_time_max_days} onChange={(event) => updateArea(area.id, { lead_time_max_days: Number(event.target.value) })} className="adm-input adm-num pr-12 font-normal" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">days</span></span>
                  </label>
                  <div className="grid gap-2 sm:col-span-2 lg:col-span-4 sm:grid-cols-2">
                    <Switch label="In-home assembly" description="Offered in this area" checked={area.assembly_available} onChange={(value) => updateArea(area.id, { assembly_available: value })} className="!p-3" />
                    <Switch label="Area active" description="Shown on product pages" checked={area.active} onChange={(value) => updateArea(area.id, { active: value })} className="!p-3" />
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:col-span-2 lg:col-span-4">
                    <span className="text-[11px] text-muted-foreground">{money(area.delivery_fee)} · {area.lead_time_min_days}–{area.lead_time_max_days} days{area.free_delivery_minimum ? ` · free from ${money(area.free_delivery_minimum)}` : ""}</span>
                    <button type="submit" disabled={savingArea === area.id} className="adm-btn adm-btn-primary adm-btn-sm">{savingArea === area.id ? "Saving…" : "Save area"}</button>
                  </div>
                </form>
              ))}
            </div>
          )}
        </Card>
        <Card className="overflow-hidden">
          <CardHeader eyebrow="Search language" title="Alternative names" description="Help customers find products using the words they already know." />
          <form onSubmit={addSynonym} className="grid gap-2.5 border-b border-border p-4 sm:p-5">
            <input ref={termRef} value={newTerm} onChange={(event) => setNewTerm(event.target.value)} placeholder="Catalog term, e.g. ottoman" aria-label="Catalog term" className="adm-input font-normal" />
            <input value={newSynonyms} onChange={(event) => setNewSynonyms(event.target.value)} placeholder="Synonyms, separated by commas" aria-label="Synonyms" className="adm-input font-normal" />
            <button disabled={newTerm.trim().length < 2 || !newSynonyms.trim()} className="adm-btn adm-btn-primary"><Plus size={14} /> Add search language</button>
          </form>
          {synonyms.length ? (
            <ul className="max-h-[440px] divide-y divide-border overflow-y-auto">
              {synonyms.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                  <Sparkles size={14} className="mt-1 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold">{entry.term}</p>
                    <p className="mt-1 flex flex-wrap gap-1">{entry.synonyms.map((word) => <Pill key={word} tone="neutral">{word}</Pill>)}</p>
                  </div>
                  <button type="button" onClick={() => void removeSynonym(entry.id)} className="adm-btn adm-btn-ghost adm-btn-icon adm-btn-sm" aria-label={`Remove ${entry.term}`}><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Sparkles} title="No search language yet." description="Add alternative names above." compact />
          )}
        </Card>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader eyebrow="Customer intent" title="Products customers are watching" description="Back-in-stock and price-drop alerts — prioritize restocks and promotions." />
          {alertDemand.length ? (
            <ul className="divide-y divide-border">
              {alertDemand.map((item) => {
                const product = productFor(item.productId);
                return (
                  <li key={item.productId} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-secondary">{product && <ResilientImage src={primaryProductImage(product)} alt="" className="h-full w-full object-cover" />}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{item.product?.name ?? "Unavailable product"}</p>
                      <p className="text-[11px] text-muted-foreground">{item.back} back-in-stock · {item.price} price-drop</p>
                    </div>
                    <Pill tone="warning" className="adm-num">{plural(item.total, "alert")}</Pill>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={Bell} title="No customer alerts yet." description="Alerts appear when shoppers ask to be notified." compact />
          )}
        </Card>
        <Card className="overflow-hidden">
          <CardHeader eyebrow="Search opportunities" title="What customers search for" description="Zero-result terms come first — add a synonym or a product to close the gap." />
          {searchDemand.length ? (
            <ul className="divide-y divide-border">
              {searchDemand.map((item) => (
                <li key={item.query} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${item.zero ? "bg-warning-soft text-warning-ink" : "bg-secondary text-muted-foreground"}`}>{item.zero ? <SearchX size={15} /> : <Search size={15} />}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">“{item.query}”</p>
                    <p className="text-[11px] text-muted-foreground">{plural(item.count, "search", "searches")} · {relativeTime(item.latest).toLowerCase()}</p>
                  </div>
                  {item.zero ? (
                    <button type="button" onClick={() => { setNewSynonyms(item.query); termRef.current?.focus(); termRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }} className="adm-btn adm-btn-sm">Add synonym</button>
                  ) : (
                    <Pill tone="success">Found results</Pill>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Search} title="No search insights yet." description="They appear after signed-in customers search." compact />
          )}
        </Card>
      </div>
      <p className="mt-5 text-center text-[11px] text-muted-foreground">Insights refresh when this page opens, regains focus, or you choose Refresh — no constant polling.</p>
      {notice && <Toast message={notice.message} tone={notice.tone} close={clear} action={notice.action} />}
    </AdminShell>
  );
}
