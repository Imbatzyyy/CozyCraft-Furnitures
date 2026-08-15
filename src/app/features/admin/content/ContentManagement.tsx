import { useCallback, useEffect, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { AdminShell } from "@/app/features/admin/shell/AdminShell";
import { adminSupabase as supabase } from "@/services/supabase/client";
import type { ContentPage, HomepageBanner } from "@/services/content/content.service";

type EmailTemplate = {
  event_type: string;
  subject_template: string;
  heading: string;
  body_template: string;
  enabled: boolean;
  updated_at: string;
};

const blankBanner = (): HomepageBanner => ({
  id: crypto.randomUUID(), eyebrow: "", title: "", subtitle: "", image_url: "",
  cta_label: "Shop collection", cta_path: "/new-arrivals", active: true,
  starts_at: null, ends_at: null, sort_order: 100, updated_at: new Date().toISOString(),
});

export function ContentManagementPage() {
  const [view, setView] = useState<"Pages" | "Homepage" | "Email templates" | "Email log">("Pages");
  const [pages, setPages] = useState<ContentPage[]>([]);
  const [banners, setBanners] = useState<HomepageBanner[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const [pageResult, bannerResult, templateResult, logResult] = await Promise.all([
      supabase.from("content_pages").select("*").order("slug"),
      supabase.from("homepage_banners").select("*").order("sort_order"),
      supabase.from("email_templates").select("*").order("event_type"),
      supabase.from("email_delivery_logs").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    if (pageResult.data) setPages(pageResult.data as ContentPage[]);
    if (bannerResult.data) setBanners(bannerResult.data as HomepageBanner[]);
    if (templateResult.data) setTemplates(templateResult.data as EmailTemplate[]);
    if (logResult.data) setLogs(logResult.data as Array<Record<string, unknown>>);
    const error = pageResult.error ?? bannerResult.error ?? templateResult.error ?? logResult.error;
    if (error) setNotice(error.message);
  }, []);
  useEffect(() => {
    void load();
    const channel = supabase.channel("admin-content-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "content_pages" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "homepage_banners" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "email_templates" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "email_delivery_logs" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const savePage = async (page: ContentPage) => {
    const { updated_at: _updated, ...value } = page;
    const { error } = await supabase.from("content_pages").upsert(value);
    setNotice(error?.message ?? `${page.title} published successfully.`);
  };
  const saveBanner = async (banner: HomepageBanner) => {
    if (!banner.title.trim() || !/^https:\/\//.test(banner.image_url) || !/^(\/|https:\/\/)/.test(banner.cta_path)) {
      setNotice("Banner title, HTTPS image, and a safe internal or HTTPS action path are required."); return;
    }
    if (banner.starts_at && banner.ends_at && Date.parse(banner.ends_at) <= Date.parse(banner.starts_at)) {
      setNotice("The campaign end must be later than its start."); return;
    }
    const { updated_at: _updated, ...value } = banner;
    const { error } = await supabase.from("homepage_banners").upsert(value);
    setNotice(error?.message ?? "Homepage banner saved and synchronized.");
  };
  const saveTemplate = async (template: EmailTemplate) => {
    const { updated_at: _updated, ...value } = template;
    const { error } = await supabase.from("email_templates").upsert(value);
    setNotice(error?.message ?? "Transactional email template saved.");
  };
  return (
    <AdminShell title="Content">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[10px] font-bold tracking-[.18em] text-muted-foreground">CONTENT & COMMUNICATIONS</p><h1 className="mt-2 text-4xl font-semibold">Publishing studio</h1><p className="mt-2 text-sm text-muted-foreground">Manage public information, homepage campaigns, and transactional messages from one realtime workspace.</p></div>
        {view === "Homepage" && <button type="button" onClick={() => setBanners((current) => [...current, blankBanner()])} className="flex items-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background"><Plus size={16}/>New banner</button>}
      </div>
      <div className="mt-7 flex gap-2 overflow-x-auto pb-2">{(["Pages", "Homepage", "Email templates", "Email log"] as const).map((item) => <button type="button" key={item} onClick={() => setView(item)} className={`whitespace-nowrap rounded-full px-4 py-2.5 text-xs font-semibold ${view === item ? "bg-foreground text-background" : "border border-border bg-card"}`}>{item}</button>)}</div>
      {notice && <p role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-secondary p-3 text-sm"><Check size={16}/>{notice}</p>}
      {view === "Pages" && <div className="mt-6 grid gap-5">{pages.map((page, index) => <article key={page.slug} className="rounded-2xl border border-border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><span className="text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">/{page.slug}</span><h2 className="mt-1 text-xl font-semibold">{page.title}</h2></div><label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={page.published} onChange={(event) => setPages((current) => current.map((item, i) => i === index ? { ...item, published: event.target.checked } : item))} className="h-5 w-5 accent-foreground"/>Published</label></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Field label="Eyebrow" value={page.eyebrow} onChange={(value) => setPages((current) => current.map((item, i) => i === index ? { ...item, eyebrow: value } : item))}/><Field label="Page title" value={page.title} onChange={(value) => setPages((current) => current.map((item, i) => i === index ? { ...item, title: value } : item))}/><Area label="Summary" value={page.summary} onChange={(value) => setPages((current) => current.map((item, i) => i === index ? { ...item, summary: value } : item))}/><Area label="Page body" value={page.body} onChange={(value) => setPages((current) => current.map((item, i) => i === index ? { ...item, body: value } : item))}/></div><button type="button" onClick={() => void savePage(page)} className="mt-4 rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background">Save page</button></article>)}</div>}
      {view === "Homepage" && <div className="mt-6 grid gap-5">{banners.map((banner, index) => <article key={banner.id} className="rounded-2xl border border-border bg-card p-5"><div className="grid gap-3 sm:grid-cols-2"><Field label="Eyebrow" value={banner.eyebrow} onChange={(value) => setBanners((c) => c.map((item, i) => i === index ? { ...item, eyebrow: value } : item))}/><Field label="Headline" value={banner.title} onChange={(value) => setBanners((c) => c.map((item, i) => i === index ? { ...item, title: value } : item))}/><Field label="Image URL" value={banner.image_url} onChange={(value) => setBanners((c) => c.map((item, i) => i === index ? { ...item, image_url: value } : item))}/><Field label="Button path" value={banner.cta_path} onChange={(value) => setBanners((c) => c.map((item, i) => i === index ? { ...item, cta_path: value } : item))}/><Field label="Button label" value={banner.cta_label} onChange={(value) => setBanners((c) => c.map((item, i) => i === index ? { ...item, cta_label: value } : item))}/><Field label="Sort order" value={String(banner.sort_order)} onChange={(value) => setBanners((c) => c.map((item, i) => i === index ? { ...item, sort_order: Number(value) || 0 } : item))}/><DateTimeField label="Campaign starts (optional)" value={banner.starts_at} onChange={(value) => setBanners((c) => c.map((item, i) => i === index ? { ...item, starts_at: value } : item))}/><DateTimeField label="Campaign ends (optional)" value={banner.ends_at} onChange={(value) => setBanners((c) => c.map((item, i) => i === index ? { ...item, ends_at: value } : item))}/><Area label="Supporting text" value={banner.subtitle} onChange={(value) => setBanners((c) => c.map((item, i) => i === index ? { ...item, subtitle: value } : item))}/><label className="flex items-center gap-2 self-end rounded-xl border border-border p-3 text-xs font-semibold"><input type="checkbox" checked={banner.active} onChange={(event) => setBanners((c) => c.map((item, i) => i === index ? { ...item, active: event.target.checked } : item))} className="h-5 w-5 accent-foreground"/>Active and eligible for scheduling</label></div><div className="mt-4 flex gap-3"><button type="button" onClick={() => void saveBanner(banner)} className="rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background">Save banner</button><button type="button" onClick={async () => { const { error } = await supabase.from("homepage_banners").delete().eq("id", banner.id); if (!error) setBanners((c) => c.filter((item) => item.id !== banner.id)); setNotice(error?.message ?? "Banner removed."); }} className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold"><Trash2 size={14}/>Remove</button></div></article>)}</div>}
      {view === "Email templates" && <div className="mt-6 grid gap-5">{templates.map((template, index) => <article key={template.event_type} className="rounded-2xl border border-border bg-card p-5"><div className="flex justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">{template.event_type.replace(/_/g, " ")}</p><h2 className="mt-1 text-xl font-semibold">{template.heading}</h2></div><label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={template.enabled} onChange={(event) => setTemplates((c) => c.map((item, i) => i === index ? { ...item, enabled: event.target.checked } : item))} className="h-5 w-5 accent-foreground"/>Enabled</label></div><div className="mt-4 grid gap-3"><Field label="Email subject" value={template.subject_template} onChange={(value) => setTemplates((c) => c.map((item, i) => i === index ? { ...item, subject_template: value } : item))}/><Field label="Heading" value={template.heading} onChange={(value) => setTemplates((c) => c.map((item, i) => i === index ? { ...item, heading: value } : item))}/><Area label="Message" value={template.body_template} onChange={(value) => setTemplates((c) => c.map((item, i) => i === index ? { ...item, body_template: value } : item))}/></div><p className="mt-3 text-[10px] text-muted-foreground">Supported variables include {'{{order_number}}'}, {'{{status}}'}, {'{{refund_status}}'}, and {'{{ticket_number}}'}.</p><button type="button" onClick={() => void saveTemplate(template)} className="mt-4 rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background">Save template</button></article>)}</div>}
      {view === "Email log" && <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-secondary"><tr>{["Time", "Event", "Recipient", "Entity", "Status", "Provider result"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{logs.map((log) => <tr key={String(log.id)} className="border-t border-border"><td className="px-4 py-3">{new Date(String(log.created_at)).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</td><td className="px-4 py-3">{String(log.event_type).replace(/_/g, " ")}</td><td className="px-4 py-3">{String(log.recipient)}</td><td className="px-4 py-3">{String(log.entity_type)} {String(log.entity_id ?? "")}</td><td className="px-4 py-3 font-semibold">{String(log.status)}</td><td className="max-w-xs truncate px-4 py-3 text-muted-foreground">{String(log.provider_message_id ?? log.error_message ?? "—")}</td></tr>)}</tbody></table></div>{!logs.length && <p className="p-8 text-center text-sm text-muted-foreground">No transactional email attempts recorded yet.</p>}</div>}
    </AdminShell>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-2 text-xs font-semibold">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-3 font-normal outline-none focus:ring-2 focus:ring-foreground/15"/></label>;
}
function Area({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-2 text-xs font-semibold">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-28 rounded-xl border border-border bg-[#fcfbf8] p-3 font-normal leading-6 outline-none focus:ring-2 focus:ring-foreground/15"/></label>;
}
function DateTimeField({ label, value, onChange }: { label: string; value: string | null; onChange: (value: string | null) => void }) {
  const localValue = value ? new Date(value).toLocaleString("sv-SE", { timeZone: "Asia/Manila" }).replace(" ", "T").slice(0, 16) : "";
  return <label className="grid gap-2 text-xs font-semibold">{label}<input type="datetime-local" value={localValue} onChange={(event) => onChange(event.target.value ? new Date(`${event.target.value}:00+08:00`).toISOString() : null)} className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-3 font-normal outline-none focus:ring-2 focus:ring-foreground/15"/><span className="text-[10px] font-normal text-muted-foreground">Philippine time</span></label>;
}
