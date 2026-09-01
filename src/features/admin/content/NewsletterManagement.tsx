import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock3, Mail, RefreshCw, Send, Users, type LucideIcon } from "lucide-react";
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
const inputClass = "h-11 rounded-xl border border-border bg-[#fcfbf8] px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/15";
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
  const summaryCards: Array<{ label: string; value: number; icon: LucideIcon }> = [
    { label: "Active readers", value: workspace?.counts.active ?? 0, icon: Users },
    { label: "Awaiting confirmation", value: workspace?.counts.pending ?? 0, icon: Mail },
    { label: "Unsubscribed", value: workspace?.counts.unsubscribed ?? 0, icon: Clock3 },
    { label: "Campaigns", value: workspace?.campaigns.length ?? 0, icon: Send },
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
    if (!window.confirm(sendNow ? "Send this saved campaign to every active subscriber?" : `Schedule delivery for ${phDate(when)}?`)) return;
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
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {summaryCards.map(({ label, value, icon: Icon }) => <article key={label} className="rounded-2xl border border-border bg-card p-5"><Icon size={18} className="text-muted-foreground"/><p className="mt-5 text-3xl font-semibold">{value}</p><p className="mt-1 text-xs font-semibold text-muted-foreground">{label}</p></article>)}
    </section>
    {(notice || error) && <p role={error ? "alert" : "status"} className={`flex items-center gap-2 rounded-xl p-3 text-sm ${error ? "bg-[#f5e4d5] text-[#845238]" : "bg-[#e8efe3] text-[#4e6846]"}`}><Check size={16}/>{error || notice}</p>}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold tracking-[.18em] text-muted-foreground">CAMPAIGN EDITOR</p><h2 className="mt-2 text-2xl font-semibold">{draft.id ? "Refine the draft" : "Create an occasional edit"}</h2></div>{draft.id && <button type="button" onClick={() => { clearAdminDraft(newsletterEditorDraftKey); setDraft(blankNewsletterDraft()); setScheduledAt(""); }} className="text-xs font-semibold underline">New draft</button>}</div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Internal campaign name" value={draft.internal_name} onChange={(value) => setDraft((current) => ({ ...current, internal_name: value }))}/><Field label="Email subject" value={draft.subject} onChange={(value) => setDraft((current) => ({ ...current, subject: value }))}/><Field label="Inbox preview text" value={draft.preheader} onChange={(value) => setDraft((current) => ({ ...current, preheader: value }))}/><Field label="Customer-facing heading" value={draft.heading} onChange={(value) => setDraft((current) => ({ ...current, heading: value }))}/><label className="grid gap-2 text-xs font-semibold sm:col-span-2">Message<textarea value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} rows={6} className="rounded-xl border border-border bg-[#fcfbf8] p-3 text-sm font-normal leading-6 outline-none focus:ring-2 focus:ring-foreground/15"/></label><Field label="Action label" value={draft.cta_label} onChange={(value) => setDraft((current) => ({ ...current, cta_label: value }))}/><Field label="CozyCraft action path" value={draft.cta_path} onChange={(value) => setDraft((current) => ({ ...current, cta_path: value }))}/></div>
        <div className="mt-6"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Featured products</h3><p className="text-xs text-muted-foreground">Choose up to four active pieces; their details are snapshotted when saved.</p></div><span className="text-xs font-semibold">{draft.product_ids.length}/4</span></div><div className="mt-3 grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">{workspace?.products.map((product) => { const selected = draft.product_ids.includes(product.id); return <label key={product.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${selected ? "border-foreground bg-secondary" : "border-border"}`}><input type="checkbox" checked={selected} disabled={!selected && draft.product_ids.length >= 4} onChange={() => setDraft((current) => ({ ...current, product_ids: selected ? current.product_ids.filter((id) => id !== product.id) : [...current.product_ids, product.id] }))} className="h-4 w-4 accent-foreground"/><img src={product.image_url} alt="" className="h-11 w-11 rounded-lg object-cover"/><span className="min-w-0"><strong className="block truncate text-xs">{product.name}</strong><span className="text-[10px] text-muted-foreground">{product.category} · ₱{product.price.toLocaleString("en-PH")}</span></span></label>; })}</div></div>
        <div className="mt-6 flex flex-wrap gap-2"><button type="button" disabled={!!busy} onClick={() => void save()} className="rounded-xl bg-foreground px-5 py-3 text-xs font-semibold text-background disabled:opacity-50">{busy === "save" ? "Saving…" : "Save draft"}</button><button type="button" disabled={!!busy} onClick={() => void test()} className="rounded-xl border border-border px-5 py-3 text-xs font-semibold disabled:opacity-50">Send test</button></div>
      </section>
      <aside className="grid content-start gap-5"><section className="rounded-2xl border border-border bg-[#25221e] p-5 text-white sm:p-6"><p className="text-[10px] font-bold tracking-[.18em] text-white/55">LIVE PREVIEW</p><h2 className="mt-5 font-[Playfair_Display] text-3xl leading-tight">{draft.heading || "A quieter edit for considered homes."}</h2><p className="mt-4 whitespace-pre-line text-sm leading-6 text-white/70">{draft.body || "Your campaign message will appear here."}</p>{selectedProducts.length > 0 && <div className="mt-5 grid grid-cols-2 gap-2">{selectedProducts.map((product) => <div key={product.id}><img src={product.image_url} alt="" className="aspect-square w-full rounded-xl object-cover"/><p className="mt-2 truncate text-[11px] font-semibold">{product.name}</p></div>)}</div>}<span className="mt-6 inline-flex rounded-xl bg-white px-4 py-3 text-xs font-semibold text-[#25221e]">{draft.cta_label || "Explore"}</span></section><section className="rounded-2xl border border-border bg-card p-5"><h3 className="text-sm font-semibold">Delivery controls</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Only confirmed subscribers are queued. Every message includes one-click unsubscribe.</p><label className="mt-4 grid gap-2 text-xs font-semibold">Test recipient<input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} className={inputClass}/></label><label className="mt-4 grid gap-2 text-xs font-semibold">Schedule in Philippine time<input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className={inputClass}/></label><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={!!busy} onClick={() => void schedule(false)} className="rounded-xl border border-border px-3 py-3 text-xs font-semibold disabled:opacity-50">Schedule</button><button type="button" disabled={!!busy} onClick={() => void schedule(true)} className="rounded-xl bg-foreground px-3 py-3 text-xs font-semibold text-background disabled:opacity-50">Send now</button></div></section></aside>
    </div>
    <section className="overflow-hidden rounded-2xl border border-border bg-card"><div className="flex items-center justify-between p-5"><div><h2 className="text-xl font-semibold">Campaign history</h2><p className="text-xs text-muted-foreground">Delivery totals refresh without exposing the subscriber list.</p></div><button type="button" onClick={() => void load()} aria-label="Refresh campaign history" className="rounded-xl border border-border p-2"><RefreshCw size={16}/></button></div><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-xs"><thead className="bg-secondary"><tr>{["Campaign", "Status", "Delivery time", "Recipients", "Sent", "Failed", "Actions"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{workspace?.campaigns.map((campaign) => <tr key={campaign.id} className="border-t border-border"><td className="px-4 py-3"><strong>{campaign.internal_name}</strong><span className="mt-1 block max-w-xs truncate text-muted-foreground">{campaign.subject}</span></td><td className="px-4 py-3 font-semibold capitalize">{campaign.status}</td><td className="px-4 py-3">{phDate(campaign.sent_at ?? campaign.scheduled_at)}</td><td className="px-4 py-3">{campaign.recipient_count}</td><td className="px-4 py-3">{campaign.sent_count}</td><td className="px-4 py-3">{campaign.failed_count}</td><td className="px-4 py-3"><div className="flex gap-3">{["draft", "failed"].includes(campaign.status) && <button type="button" onClick={() => editCampaign(campaign)} className="font-semibold underline">Edit</button>}{["draft", "scheduled", "failed"].includes(campaign.status) && <button type="button" onClick={async () => { if (!window.confirm("Cancel this campaign?")) return; try { setNotice((await cancelNewsletterCampaign(campaign.id)).message); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to cancel."); } }} className="font-semibold underline">Cancel</button>}</div></td></tr>)}</tbody></table></div>{!workspace?.campaigns.length && <p className="p-8 text-center text-sm text-muted-foreground">No campaigns yet. Save the first thoughtful edit above.</p>}</section>
  </div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-2 text-xs font-semibold">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}/></label>;
}
