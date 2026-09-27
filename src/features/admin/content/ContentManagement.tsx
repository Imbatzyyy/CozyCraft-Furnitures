import { useCallback, useEffect, useRef, useState } from "react";
import { useDraftCollection } from "@/lib/admin/draft-collection";
import { useAdminSession } from "@/app/core";
import { AlertTriangle, Check, ExternalLink, FileText, History, Image as ImageIcon, Mail, Megaphone, Plus, Trash2 } from "lucide-react";
import { confirmAction } from "@/components/admin/confirm";
import { EmptyState, PageHeader, Pill, Segmented, Switch } from "@/components/admin/ui";
import { AdminShell } from "@/features/admin/shell/AdminShell";
import { NewsletterManagement } from "@/features/admin/content/NewsletterManagement";
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
  starts_at: null, ends_at: null, sort_order: 100, updated_at: "",
});

export function ContentManagementPage() {
  const { userId } = useAdminSession();
  return <ContentEditor key={userId ?? "signed-out"} owner={userId} />;
}

function ContentEditor({ owner }: { owner: string | null }) {
  const [view, setView] = useState<"Pages" | "Homepage" | "Newsletters" | "Email templates" | "Email log">("Pages");
  const draftKey = (section: string) => owner ? `cozycraft-admin-content-v1:${owner}:${section}` : undefined;
  const pageDraft = useDraftCollection<ContentPage>(row => row.slug, draftKey("pages"));
  const bannerDraft = useDraftCollection<HomepageBanner>(row => row.id, draftKey("banners"));
  const templateDraft = useDraftCollection<EmailTemplate>(row => row.event_type, draftKey("templates"));
  const { rows: pages, setRows: setPages, refresh: refreshPages } = pageDraft;
  const { rows: banners, setRows: setBanners, refresh: refreshBanners } = bannerDraft;
  const { rows: templates, setRows: setTemplates, refresh: refreshTemplates } = templateDraft;
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [notice, setNotice] = useState("");
  const active = useRef(true);
  const inFlight = useRef(new Set<string>());
  const queued = useRef(new Set<string>());
  const saving = useRef(new Set<string>());
  const load = useCallback(async (table: string) => {
    if (!owner) return;
    if (inFlight.current.has(table)) { queued.current.add(table); return; }
    inFlight.current.add(table);
    try {
      const sort = table === "content_pages" ? "slug" : table === "homepage_banners" ? "sort_order" : table === "email_templates" ? "event_type" : "created_at";
      const query = supabase.from(table).select("*").order(sort, { ascending: table !== "email_delivery_logs" });
      const { data, error } = await (table === "email_delivery_logs" ? query.limit(100) : query);
      if (!active.current) return;
      if (error) { setNotice(error.message); return; }
      if (table === "content_pages") refreshPages((data as ContentPage[]).filter(page => !["terms", "privacy", "refunds", "cookies"].includes(page.slug)));
      if (table === "homepage_banners") refreshBanners(data as HomepageBanner[]);
      if (table === "email_templates") refreshTemplates(data as EmailTemplate[]);
      if (table === "email_delivery_logs") setLogs(data as Array<Record<string, unknown>>);
    } catch { if (active.current) setNotice("Content could not be loaded. Switch back to this section to retry; your draft is preserved."); }
    finally {
      inFlight.current.delete(table);
      if (queued.current.delete(table) && active.current) void load(table);
    }
  }, [owner, refreshPages, refreshBanners, refreshTemplates]);
  useEffect(() => {
    active.current = true;
    const table = view === "Pages" ? "content_pages" : view === "Homepage" ? "homepage_banners" : view === "Email templates" ? "email_templates" : view === "Email log" ? "email_delivery_logs" : null;
    if (!table) return () => { active.current = false; };
    void load(table);
    const channel = supabase.channel("admin-content-live")
      .on("postgres_changes", { event: "*", schema: "public", table }, () => void load(table))
      .subscribe();
    return () => { active.current = false; void supabase.removeChannel(channel); };
  }, [load, view]);
  const dirty = pageDraft.dirty || bannerDraft.dirty || templateDraft.dirty;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const saveOnce = async (id: string, action: () => Promise<void>) => {
    if (!owner || saving.current.has(id)) return;
    saving.current.add(id);
    try { await action(); }
    catch { if (active.current) setNotice("The save could not be confirmed. Your draft is preserved; check your connection before retrying."); }
    finally { saving.current.delete(id); }
  };
  const saveError = (error: { code?: string; message: string } | null, success: string) => error?.code === "PGRST116"
    ? "This record changed or was removed elsewhere. Your draft is preserved. Copy any edits you need, then discard drafts to review the latest version before saving."
    : error?.message ?? success;

  const savePage = (page: ContentPage) => saveOnce(`page:${page.slug}`, async () => {
    const { updated_at: _updated, ...value } = page;
    const { data, error } = await supabase.from("content_pages").update(value).eq("slug", page.slug).eq("updated_at", page.updated_at).select().single();
    if (data) pageDraft.saved(page, data as ContentPage);
    setNotice(saveError(error, `${page.title} published successfully.`));
  });
  const saveBanner = (banner: HomepageBanner) => saveOnce(`banner:${banner.id}`, async () => {
    if (!banner.title.trim() || !/^https:\/\//.test(banner.image_url) || !/^(\/|https:\/\/)/.test(banner.cta_path)) {
      setNotice("Banner title, HTTPS image, and a safe internal or HTTPS action path are required."); return;
    }
    if (banner.starts_at && banner.ends_at && Date.parse(banner.ends_at) <= Date.parse(banner.starts_at)) {
      setNotice("The campaign end must be later than its start."); return;
    }
    const { updated_at: _updated, ...value } = banner;
    const { data, error } = banner.updated_at ? await supabase.from("homepage_banners").update(value).eq("id", banner.id).eq("updated_at", banner.updated_at).select().single() : await supabase.from("homepage_banners").insert(value).select().single();
    if (data) bannerDraft.saved(banner, data as HomepageBanner);
    setNotice(saveError(error, "Homepage banner saved and synchronized."));
  });
  const saveTemplate = (template: EmailTemplate) => saveOnce(`template:${template.event_type}`, async () => {
    const { updated_at: _updated, ...value } = template;
    const { data, error } = await supabase.from("email_templates").update(value).eq("event_type", template.event_type).eq("updated_at", template.updated_at).select().single();
    if (data) templateDraft.saved(template, data as EmailTemplate);
    setNotice(saveError(error, "Transactional email template saved."));
  });
  const noticeIsError = /could ?n|failed|error|required|changed or was removed|must be|violates|denied/i.test(notice);
  const discardDrafts = async () => {
    const confirmed = await confirmAction({ title: "Discard all unsaved content drafts?", description: "Every unsaved page, banner, and template edit will be lost.", confirmLabel: "Discard drafts", tone: "danger" });
    if (!confirmed) return;
    pageDraft.discard();
    bannerDraft.discard();
    templateDraft.discard();
  };
  const removeBanner = async (banner: HomepageBanner) => {
    const confirmed = await confirmAction({ title: `Remove “${banner.title || "this banner"}”?`, description: "It disappears from the homepage immediately.", confirmLabel: "Remove banner", tone: "danger" });
    if (!confirmed) return;
    const { error } = await supabase.from("homepage_banners").delete().eq("id", banner.id);
    if (!error) setBanners((c) => c.filter((item) => item.id !== banner.id));
    setNotice(error?.message ?? "Banner removed.");
  };
  const views = [
    { value: "Pages", label: <><FileText size={13} />Pages</> },
    { value: "Homepage", label: <><ImageIcon size={13} />Homepage</> },
    { value: "Newsletters", label: <><Megaphone size={13} />Newsletters</> },
    { value: "Email templates", label: <><Mail size={13} />Email templates</> },
    { value: "Email log", label: <><History size={13} />Email log</> },
  ] as const;
  return (
    <AdminShell title="Content">
      <PageHeader
        eyebrow="Content & communications"
        title="Publishing studio"
        description="Public information, homepage campaigns, newsletters, and transactional messages in one realtime workspace."
        actions={view === "Homepage" && <button type="button" onClick={() => setBanners((current) => [...current, blankBanner()])} className="adm-btn adm-btn-primary"><Plus size={15}/>New banner</button>}
      />
      {dirty && <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-warning-soft px-4 py-3 text-sm leading-6 text-warning-ink"><span>You have unsaved edits. Live updates won’t replace them, and drafts are kept in this browser tab for up to 24 hours.</span><button type="button" className="adm-btn adm-btn-sm" onClick={() => void discardDrafts()}>Discard drafts</button></div>}
      <Segmented label="Content sections" value={view} onChange={setView} items={views.map((item) => ({ value: item.value, label: item.label }))} className="max-w-full" />
      {notice && <p role={noticeIsError ? "alert" : "status"} className={`cc-enter-fade mt-4 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm ${noticeIsError ? "bg-danger-soft text-danger-ink" : "bg-success-soft text-success-ink"}`}>{noticeIsError ? <AlertTriangle size={16}/> : <Check size={16}/>}{notice}</p>}
      {view === "Pages" && <aside className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-subtle px-4 py-3 text-xs leading-5 text-muted-foreground"><span>Terms, Privacy, Returns and Cookie policies ship with each website release so published policy text stays consistent. Edit Contact and FAQ below.</span><a className="inline-flex items-center gap-1 font-semibold text-foreground hover:underline" href="/terms" target="_blank" rel="noreferrer">View policies <ExternalLink size={12}/></a></aside>}
      {view === "Pages" && <div className="mt-5 grid gap-5">{pages.map((page, index) => <article key={page.slug} className="adm-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><span className="adm-eyebrow">/{page.slug}</span><h2 className="mt-1 font-serif text-[1.5rem] leading-tight">{page.title}</h2></div><Switch label="Published" description={page.published ? "Visible to customers" : "Hidden from customers"} checked={page.published} onChange={(value) => setPages((current) => current.map((item, i) => i === index ? { ...item, published: value } : item))} className="!p-3"/></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Field label="Eyebrow" value={page.eyebrow} onChange={(value) => setPages((current) => current.map((item, i) => i === index ? { ...item, eyebrow: value } : item))}/><Field label="Page title" value={page.title} onChange={(value) => setPages((current) => current.map((item, i) => i === index ? { ...item, title: value } : item))}/><Area label="Summary" value={page.summary} onChange={(value) => setPages((current) => current.map((item, i) => i === index ? { ...item, summary: value } : item))}/><Area label="Page body" value={page.body} onChange={(value) => setPages((current) => current.map((item, i) => i === index ? { ...item, body: value } : item))}/></div><div className="mt-4 flex items-center gap-2"><button type="button" onClick={() => void savePage(page)} className="adm-btn adm-btn-primary">Save page</button><a href={`/${page.slug}`} target="_blank" rel="noreferrer" className="adm-btn"><ExternalLink size={13}/> Preview</a></div></article>)}{!pages.length && <div className="adm-card"><EmptyState icon={FileText} title="No editable pages yet." compact/></div>}</div>}
      {view === "Homepage" && <div className="mt-5 grid gap-5">{banners.map((banner, index) => <article key={banner.id} className="adm-card overflow-hidden"><div className="grid gap-0 lg:grid-cols-[280px_minmax(0,1fr)]"><div className="relative min-h-40 bg-secondary">{/^https:\/\//.test(banner.image_url) ? <img src={banner.image_url} alt="" className="absolute inset-0 h-full w-full object-cover"/> : <span className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">Add an HTTPS image URL to preview</span>}<div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"/><div className="absolute inset-x-0 bottom-0 p-4 text-white"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/70">{banner.eyebrow || "Eyebrow"}</p><p className="mt-1 font-serif text-xl leading-tight">{banner.title || "Headline"}</p></div><span className="absolute left-3 top-3"><Pill tone={banner.active ? "success" : "neutral"} dot>{banner.active ? "Active" : "Paused"}</Pill></span></div><div className="p-5"><div className="grid gap-3 sm:grid-cols-2"><Field label="Eyebrow" value={banner.eyebrow} onChange={(value) => setBanners((c) => c.map((item, i) => i === index ? { ...item, eyebrow: value } : item))}/><Field label="Headline" value={banner.title} onChange={(value) => setBanners((c) => c.map((item, i) => i === index ? { ...item, title: value } : item))}/><Field label="Image URL" value={banner.image_url} onChange={(value) => setBanners((c) => c.map((item, i) => i === index ? { ...item, image_url: value } : item))}/><Field label="Button path" value={banner.cta_path} onChange={(value) => setBanners((c) => c.map((item, i) => i === index ? { ...item, cta_path: value } : item))}/><Field label="Button label" value={banner.cta_label} onChange={(value) => setBanners((c) => c.map((item, i) => i === index ? { ...item, cta_label: value } : item))}/><Field label="Sort order" value={String(banner.sort_order)} onChange={(value) => setBanners((c) => c.map((item, i) => i === index ? { ...item, sort_order: Number(value) || 0 } : item))}/><DateTimeField label="Campaign starts (optional)" value={banner.starts_at} onChange={(value) => setBanners((c) => c.map((item, i) => i === index ? { ...item, starts_at: value } : item))}/><DateTimeField label="Campaign ends (optional)" value={banner.ends_at} onChange={(value) => setBanners((c) => c.map((item, i) => i === index ? { ...item, ends_at: value } : item))}/><Area label="Supporting text" value={banner.subtitle} onChange={(value) => setBanners((c) => c.map((item, i) => i === index ? { ...item, subtitle: value } : item))}/><div className="self-end"><Switch label="Active" description="Eligible for scheduling" checked={banner.active} onChange={(value) => setBanners((c) => c.map((item, i) => i === index ? { ...item, active: value } : item))} className="!p-3"/></div></div><div className="mt-4 flex gap-2"><button type="button" onClick={() => void saveBanner(banner)} className="adm-btn adm-btn-primary">Save banner</button><button type="button" onClick={() => void removeBanner(banner)} className="adm-btn"><Trash2 size={14}/>Remove</button></div></div></div></article>)}{!banners.length && <div className="adm-card"><EmptyState icon={ImageIcon} title="No homepage banners yet." description="Create a campaign to feature on the storefront homepage." compact/></div>}</div>}
      {view === "Newsletters" && <NewsletterManagement />}
      {view === "Email templates" && <div className="mt-5 grid gap-5 xl:grid-cols-2">{templates.map((template, index) => <article key={template.event_type} className="adm-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="adm-eyebrow">{template.event_type.replace(/_/g, " ")}</p><h2 className="mt-1 text-base font-semibold">{template.heading}</h2></div><Switch label="Enabled" checked={template.enabled} onChange={(value) => setTemplates((c) => c.map((item, i) => i === index ? { ...item, enabled: value } : item))} className="!p-2.5"/></div><div className="mt-4 grid gap-3"><Field label="Email subject" value={template.subject_template} onChange={(value) => setTemplates((c) => c.map((item, i) => i === index ? { ...item, subject_template: value } : item))}/><Field label="Heading" value={template.heading} onChange={(value) => setTemplates((c) => c.map((item, i) => i === index ? { ...item, heading: value } : item))}/><Area label="Message" value={template.body_template} onChange={(value) => setTemplates((c) => c.map((item, i) => i === index ? { ...item, body_template: value } : item))}/></div><p className="mt-3 text-[11px] text-muted-foreground">Variables: <code className="rounded bg-secondary px-1">{'{{order_number}}'}</code> <code className="rounded bg-secondary px-1">{'{{status}}'}</code> <code className="rounded bg-secondary px-1">{'{{refund_status}}'}</code> <code className="rounded bg-secondary px-1">{'{{ticket_number}}'}</code></p><button type="button" onClick={() => void saveTemplate(template)} className="adm-btn adm-btn-primary mt-4">Save template</button></article>)}</div>}
      {view === "Email log" && <div className="adm-card mt-5 overflow-hidden"><div className="overflow-x-auto"><table className="adm-table min-w-[760px]"><thead><tr>{["Time", "Event", "Recipient", "Record", "Status", "Provider result"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{logs.map((log) => <tr key={String(log.id)}><td className="adm-num whitespace-nowrap text-muted-foreground">{new Date(String(log.created_at)).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}</td><td className="capitalize">{String(log.event_type).replace(/_/g, " ")}</td><td>{String(log.recipient)}</td><td className="text-muted-foreground">{String(log.entity_type)} {String(log.entity_id ?? "")}</td><td><Pill tone={/fail|error|bounce/i.test(String(log.status)) ? "danger" : /sent|deliver/i.test(String(log.status)) ? "success" : "neutral"}>{String(log.status)}</Pill></td><td className="max-w-xs truncate text-muted-foreground">{String(log.provider_message_id ?? log.error_message ?? "—")}</td></tr>)}</tbody></table></div>{!logs.length && <EmptyState icon={History} title="No transactional email attempts recorded yet." compact/>}</div>}
    </AdminShell>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="adm-label">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="adm-input font-normal"/></label>;
}
function Area({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="adm-label">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} className="adm-textarea min-h-28 font-normal"/></label>;
}
function DateTimeField({ label, value, onChange }: { label: string; value: string | null; onChange: (value: string | null) => void }) {
  const localValue = value ? new Date(value).toLocaleString("sv-SE", { timeZone: "Asia/Manila" }).replace(" ", "T").slice(0, 16) : "";
  return <label className="adm-label">{label}<input type="datetime-local" value={localValue} onChange={(event) => onChange(event.target.value ? new Date(`${event.target.value}:00+08:00`).toISOString() : null)} className="adm-input font-normal"/><span className="adm-hint">Philippine time</span></label>;
}
