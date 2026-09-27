import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Clock3, Mail, RefreshCw, Send, Users } from "lucide-react";
import { confirmAction } from "@/components/admin/confirm";
import { EmptyState, Pill, StatStrip } from "@/components/admin/ui";
import {
  blankNewsletterDraft,
  cancelNewsletterCampaign,
  loadNewsletterWorkspace,
  saveNewsletterCampaign,
  scheduleNewsletterCampaign,
  sendNewsletterTest,
  validateNewsletterDraft,
  type NewsletterCampaign,
  type NewsletterDraft,
  type NewsletterOverview,
} from "@/services/content/newsletter-admin.service";
import {
  clearAdminDraft,
  readAdminDraft,
  writeAdminDraft,
} from "@/lib/admin/admin-drafts";

const phDate = (value: string | null) => value
  ? new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })
  : "—";
const inputClass = "adm-input font-normal";
const newsletterEditorDraftKey = "cozycraft:admin:newsletter-editor:v1";

type NewsletterEditorDraft = {
  campaign: NewsletterDraft;
  scheduledAt: string;
  testEmail: string;
};

const isNewsletterEditorDraft = (value: unknown): value is NewsletterEditorDraft => {
  if (!value || typeof value !== "object") return false;
  const editor = value as Partial<NewsletterEditorDraft>;
  return (
    typeof editor.scheduledAt === "string" &&
    typeof editor.testEmail === "string" &&
    !!editor.campaign &&
    typeof editor.campaign === "object" &&
    typeof editor.campaign.subject === "string" &&
    typeof editor.campaign.body === "string" &&
    Array.isArray(editor.campaign.product_ids)
  );
};

export function NewsletterManagement() {
  const recovered = useMemo(
    () => readAdminDraft(newsletterEditorDraftKey, isNewsletterEditorDraft),
    [],
  );
  const [workspace, setWorkspace] = useState<NewsletterOverview | null>(null);
  const [draft, setDraft] = useState<NewsletterDraft>(() =>
    recovered?.campaign ?? blankNewsletterDraft(),
  );
  const [scheduledAt, setScheduledAt] = useState(recovered?.scheduledAt ?? "");
  const [testEmail, setTestEmail] = useState(recovered?.testEmail ?? "");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    setBusy((value) => value || "loading");
    try {
      const data = await loadNewsletterWorkspace();
      setWorkspace(data); setTestEmail((current) => current || data.adminEmail); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Newsletter workspace unavailable."); }
    finally { setBusy((value) => value === "loading" ? "" : value); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    writeAdminDraft(newsletterEditorDraftKey, {
      campaign: draft,
      scheduledAt,
      testEmail,
    } satisfies NewsletterEditorDraft);
  }, [draft, scheduledAt, testEmail]);
  const selectedProducts = useMemo(() => workspace?.products.filter((product) => draft.product_ids.includes(product.id)) ?? [], [draft.product_ids, workspace?.products]);
  const summaryCards = [
    { label: "Active readers", value: workspace?.counts.active, note: "Confirmed subscribers", icon: Users, tone: "success" as const },
    { label: "Awaiting confirmation", value: workspace?.counts.pending, note: "Double opt-in pending", icon: Mail },
    { label: "Unsubscribed", value: workspace?.counts.unsubscribed, note: "Opted out", icon: Clock3 },
    { label: "Campaigns", value: workspace?.campaigns.length, note: "Drafts, scheduled and sent", icon: Send },
  ];

  const save = async () => {
    const validation = validateNewsletterDraft(draft);
    if (validation) { setError(validation); return null; }
    setBusy("save"); setError(""); setNotice("");
    try {
      const result = await saveNewsletterCampaign(draft);
      setDraft((current) => ({ ...current, id: result.campaign.id })); setNotice("Draft saved securely."); await load(); return result.campaign;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Draft could not be saved."); return null; }
    finally { setBusy(""); }
  };
  const ensureSaved = async () => draft.id ? draft.id : (await save())?.id ?? null;
  const test = async () => {
    const id = await ensureSaved(); if (!id) return;
    setBusy("test"); setError("");
    try { setNotice((await sendNewsletterTest(id, testEmail)).message); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Preview could not be sent."); }
    finally { setBusy(""); }
  };
  const schedule = async (sendNow: boolean) => {
    const id = await ensureSaved(); if (!id) return;
    const when = sendNow ? new Date().toISOString() : scheduledAt ? new Date(`${scheduledAt}:00+08:00`).toISOString() : "";
    if (!when) { setError("Choose a Philippine delivery date and time."); return; }
    const confirmed = await confirmAction({
      title: sendNow ? "Send to every active subscriber now?" : `Schedule for ${phDate(when)}?`,
      description: sendNow ? `The saved campaign goes to ${workspace?.counts.active ?? 0} confirmed readers right away. This can’t be undone.` : "Confirmed subscribers receive it at the scheduled Philippine time. You can cancel before then.",
      confirmLabel: sendNow ? "Send campaign" : "Schedule campaign",
      tone: sendNow ? "danger" : "default",
    });
    if (!confirmed) return;
    setBusy("schedule"); setError("");
    try { setNotice((await scheduleNewsletterCampaign(id, when)).message); clearAdminDraft(newsletterEditorDraftKey); setDraft(blankNewsletterDraft()); setScheduledAt(""); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Campaign could not be scheduled."); }
    finally { setBusy(""); }
  };
  const editCampaign = (campaign: NewsletterCampaign) => {
    setDraft({ id: campaign.id, internal_name: campaign.internal_name, subject: campaign.subject, preheader: campaign.preheader, heading: campaign.heading, body: campaign.body, cta_label: campaign.cta_label, cta_path: campaign.cta_path, product_ids: campaign.product_ids });
    setError(""); setNotice(`Editing ${campaign.internal_name}.`); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return <div className="mt-6 grid gap-6">
    <StatStrip loading={!workspace && busy === "loading"} items={summaryCards} />
    {(notice || error) && <p role={error ? "alert" : "status"} className={`cc-enter-fade flex items-center gap-2 rounded-2xl px-4 py-3 text-sm ${error ? "bg-danger-soft text-danger-ink" : "bg-success-soft text-success-ink"}`}>{error ? <AlertTriangle size={16}/> : <Check size={16}/>}{error || notice}</p>}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
      <section className="adm-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="adm-eyebrow">Campaign editor</p><h2 className="mt-1.5 font-serif text-[1.6rem] leading-tight">{draft.id ? "Refine the draft" : "Create an occasional edit"}</h2></div>{draft.id && <button type="button" onClick={() => { clearAdminDraft(newsletterEditorDraftKey); setDraft(blankNewsletterDraft()); setScheduledAt(""); }} className="adm-btn adm-btn-sm">New draft</button>}</div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Internal campaign name" value={draft.internal_name} onChange={(value) => setDraft((current) => ({ ...current, internal_name: value }))}/><Field label="Email subject" value={draft.subject} onChange={(value) => setDraft((current) => ({ ...current, subject: value }))}/><Field label="Inbox preview text" value={draft.preheader} onChange={(value) => setDraft((current) => ({ ...current, preheader: value }))}/><Field label="Customer-facing heading" value={draft.heading} onChange={(value) => setDraft((current) => ({ ...current, heading: value }))}/><label className="adm-label sm:col-span-2">Message<textarea value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} rows={6} className="adm-textarea font-normal"/></label><Field label="Action label" value={draft.cta_label} onChange={(value) => setDraft((current) => ({ ...current, cta_label: value }))}/><Field label="CozyCraft action path" value={draft.cta_path} onChange={(value) => setDraft((current) => ({ ...current, cta_path: value }))}/></div>
        <div className="mt-6"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Featured products</h3><p className="text-xs text-muted-foreground">Choose up to four active pieces; their details are snapshotted when saved.</p></div><Pill tone={draft.product_ids.length ? "inverse" : "neutral"} className="adm-num">{draft.product_ids.length}/4</Pill></div><div className="mt-3 grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">{workspace?.products.map((product) => { const selected = draft.product_ids.includes(product.id); return <label key={product.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 transition-colors ${selected ? "border-foreground bg-subtle" : "border-border hover:bg-subtle"}`}><input type="checkbox" checked={selected} disabled={!selected && draft.product_ids.length >= 4} onChange={() => setDraft((current) => ({ ...current, product_ids: selected ? current.product_ids.filter((id) => id !== product.id) : [...current.product_ids, product.id] }))} className="adm-check"/><img src={product.image_url} alt="" className="h-11 w-11 rounded-lg object-cover"/><span className="min-w-0"><strong className="block truncate text-xs">{product.name}</strong><span className="text-[10px] text-muted-foreground">{product.category} · ₱{product.price.toLocaleString("en-PH")}</span></span></label>; })}</div></div>
        <div className="mt-6 flex flex-wrap gap-2"><button type="button" disabled={!!busy} onClick={() => void save()} className="adm-btn adm-btn-primary">{busy === "save" ? "Saving…" : "Save draft"}</button><button type="button" disabled={!!busy} onClick={() => void test()} className="adm-btn"><Send size={13}/> {busy === "test" ? "Sending…" : "Send test"}</button></div>
      </section>
      <aside className="grid content-start gap-5"><section className="rounded-[1.25rem] border border-border bg-inverse p-5 text-inverse-foreground shadow-[var(--adm-shadow-card)] sm:p-6"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-inverse-muted">Live preview</p><h2 className="mt-5 font-serif text-3xl leading-tight">{draft.heading || "A quieter edit for considered homes."}</h2><p className="mt-4 whitespace-pre-line text-sm leading-6 text-white/70">{draft.body || "Your campaign message will appear here."}</p>{selectedProducts.length > 0 && <div className="mt-5 grid grid-cols-2 gap-2">{selectedProducts.map((product) => <div key={product.id}><img src={product.image_url} alt="" className="aspect-square w-full rounded-xl object-cover"/><p className="mt-2 truncate text-[11px] font-semibold">{product.name}</p></div>)}</div>}<span className="mt-6 inline-flex rounded-xl bg-white px-4 py-3 text-xs font-semibold text-[#25221e]">{draft.cta_label || "Explore"}</span></section><section className="adm-card p-5"><h3 className="text-sm font-semibold">Delivery controls</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Only confirmed subscribers are queued. Every message includes one-click unsubscribe.</p><label className="adm-label mt-4">Test recipient<input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} className={inputClass}/></label><label className="adm-label mt-4">Schedule in Philippine time<input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className={inputClass}/></label><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={!!busy} onClick={() => void schedule(false)} className="adm-btn">Schedule</button><button type="button" disabled={!!busy} onClick={() => void schedule(true)} className="adm-btn adm-btn-primary">Send now</button></div></section></aside>
    </div>
    <section className="adm-card overflow-hidden"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="text-[15px] font-semibold">Campaign history</h2><p className="text-xs text-muted-foreground">Delivery totals refresh without exposing the subscriber list.</p></div><button type="button" onClick={() => void load()} aria-label="Refresh campaign history" className="adm-btn adm-btn-icon"><RefreshCw size={15} className={busy === "loading" ? "animate-spin" : ""}/></button></div><div className="overflow-x-auto"><table className="adm-table min-w-[820px]"><thead><tr>{["Campaign", "Status", "Delivery time", "Recipients", "Sent", "Failed", "Actions"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{workspace?.campaigns.map((campaign) => <tr key={campaign.id}><td><strong>{campaign.internal_name}</strong><span className="mt-1 block max-w-xs truncate text-muted-foreground">{campaign.subject}</span></td><td><Pill tone={campaign.status === "sent" ? "success" : campaign.status === "failed" ? "danger" : campaign.status === "scheduled" ? "info" : "neutral"}>{campaign.status}</Pill></td><td className="adm-num whitespace-nowrap text-muted-foreground">{phDate(campaign.sent_at ?? campaign.scheduled_at)}</td><td className="adm-num">{campaign.recipient_count}</td><td className="adm-num">{campaign.sent_count}</td><td className={`adm-num ${campaign.failed_count ? "text-danger-ink" : ""}`}>{campaign.failed_count}</td><td><div className="flex gap-1.5">{["draft", "failed"].includes(campaign.status) && <button type="button" onClick={() => editCampaign(campaign)} className="adm-btn adm-btn-sm">Edit</button>}{["draft", "scheduled", "failed"].includes(campaign.status) && <button type="button" onClick={async () => { if (!(await confirmAction({ title: `Cancel “${campaign.internal_name}”?`, description: "It won’t be sent. Drafts can be edited again later.", confirmLabel: "Cancel campaign", tone: "danger" }))) return; try { setNotice((await cancelNewsletterCampaign(campaign.id)).message); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to cancel."); } }} className="adm-btn adm-btn-sm">Cancel</button>}</div></td></tr>)}</tbody></table></div>{!workspace?.campaigns.length && <EmptyState icon={Send} title="No campaigns yet." description="Save the first thoughtful edit above." compact/>}</section>
  </div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="adm-label">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}/></label>;
}
