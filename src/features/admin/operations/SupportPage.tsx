import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BookmarkPlus, ChevronDown, Inbox, MessageSquareText, Paperclip, Send, UserRound } from "lucide-react";
import { adminSupabase as supabase, type DbSupportTicket } from "@/services/supabase/client";
import { SupportHandover } from "@/components/admin/SupportHandover";
import { localStore } from "@/lib/shared/browser-storage";
import { defaultTicketFilter, type TicketFilter } from "@/lib/admin/ticket-filter";
import { ageLabel, formatDateTime, hoursSince, humanize, relativeTime } from "@/lib/admin/format";
import { useAdminSession, useStore, Status, Toast } from "@/app/core";
import { AdminShell } from "@/features/admin/shell/AdminShell";
import { promptAction } from "@/components/admin/confirm";
import { ActionMenu, Avatar, BusyBar, Card, EmptyState, PageHeader, Pagination, Pill, Segmented, Sheet, useMediaQuery, useNotice, type Tone } from "@/components/admin/ui";

const SAVED_REPLIES_KEY = "cozycraft-admin-saved-replies";
const defaultReplies = [
  { label: "Checking with the team", body: "Hi {name}, thank you for reaching out. I’m checking this with our fulfillment team now and will update you within the day." },
  { label: "Delivery schedule", body: "Hi {name}, your order is scheduled for delivery within the next 3–5 business days. Our team will text you on the day of delivery." },
  { label: "Resolved — thank you", body: "Hi {name}, this has been resolved on our side. Thank you for your patience, and let us know if there’s anything else we can help with." },
];
type SavedReply = { label: string; body: string };
function readSavedReplies(): SavedReply[] {
  try {
    const value = JSON.parse(localStore.getItem(SAVED_REPLIES_KEY) ?? "null");
    return Array.isArray(value) ? value.filter((item) => item && typeof item.label === "string" && typeof item.body === "string") : defaultReplies;
  } catch {
    return defaultReplies;
  }
}

const priorityTone: Record<string, Tone> = { urgent: "danger", high: "warning", normal: "neutral", low: "neutral" };

export function SupportPage() {
  const { userId: staffId } = useAdminSession();
  const { supportTickets, ticketPagination, refreshTickets, replyToTicket, updateTicketStatus } = useStore();
  const [searchParams] = useSearchParams();
  const [activeId, setActiveId] = useState(() => searchParams.get("ticket") ?? "");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [savedReplies, setSavedReplies] = useState<SavedReply[]>(readSavedReplies);
  useEffect(() => {
    setReplyDrafts({});
    setActiveId("");
  }, [staffId]);
  const [ticketStatus, setTicketStatus] = useState<DbSupportTicket["status"]>("open");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const { notice, notify, clear } = useNotice();
  const [assignedTo, setAssignedTo] = useState("");
  const [ticketPriority, setTicketPriority] = useState<DbSupportTicket["priority"]>("normal");
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; full_name: string; role: string }>>([]);
  const filter = ticketPagination?.filter ?? defaultTicketFilter;
  const setFilter = (next: Partial<TicketFilter>) => ticketPagination?.setFilter?.({ ...filter, ...next });
  useEffect(() => {
    void refreshTickets();
  }, [refreshTickets]);
  useEffect(() => {
    const linked = searchParams.get("ticket");
    if (linked) setActiveId(linked);
  }, [searchParams]);
  useEffect(() => {
    if (supportTickets.length && !supportTickets.some((ticket) => ticket.id === activeId)) setActiveId(supportTickets[0].id);
  }, [activeId, supportTickets]);
  const active = supportTickets.find((item) => item.id === activeId) ?? supportTickets[0];
  // Realtime inserts and page navigation can change the visible ticket. Keep
  // drafts keyed by ticket so a reply can never migrate to another customer.
  const reply = active ? replyDrafts[active.id] ?? "" : "";
  const setReply = (value: string) => {
    if (active) setReplyDrafts((current) => ({ ...current, [active.id]: value }));
  };
  useEffect(() => {
    if (!active) return;
    setTicketStatus(active.status);
    setAssignedTo(active.assigned_to ?? "");
    setTicketPriority(active.priority ?? "normal");
  }, [active?.id, active?.status, active?.assigned_to, active?.priority]);
  useEffect(() => {
    void supabase.from("profiles").select("id,full_name,role").in("role", ["staff", "admin", "superadmin"]).eq("staff_active", true).then(({ data }) => setTeamMembers((data ?? []) as typeof teamMembers));
  }, []);
  const teamName = useMemo(() => new Map(teamMembers.map((member) => [member.id, member.full_name || member.role])), [teamMembers]);
  const firstName = (active?.profiles?.full_name || "there").split(/\s+/)[0];

  const sendReply = async () => {
    if (!active || !reply.trim() || sending) return;
    const nextStatus = ticketStatus === "open" ? "in_progress" : ticketStatus;
    setSending(true);
    const error = await replyToTicket(active.id, reply.trim(), nextStatus);
    setSending(false);
    if (error) {
      notify(error, "error");
      return;
    }
    notify(`Reply sent to ${active.profiles?.full_name || "the customer"}.`);
    setReply("");
    setTicketStatus(nextStatus);
  };
  const workflowDirty = active ? ticketStatus !== active.status || assignedTo !== (active.assigned_to ?? "") || ticketPriority !== active.priority : false;
  const saveWorkflow = async () => {
    if (!active || updatingStatus || !workflowDirty) return;
    setUpdatingStatus(true);
    let error: string | null = null;
    if (assignedTo !== (active.assigned_to ?? "") || ticketPriority !== active.priority) {
      const result = await supabase.from("support_tickets").update({ assigned_to: assignedTo || null, priority: ticketPriority }).eq("id", active.id);
      error = result.error?.message ?? null;
    }
    if (!error && ticketStatus !== active.status) error = await updateTicketStatus(active.id, ticketStatus);
    else if (!error) await refreshTickets();
    setUpdatingStatus(false);
    if (error) notify(error, "error");
    else notify(`Ticket ${active.ticket_number} updated.`);
  };
  const openSupportAttachment = async (path: string) => {
    const { data, error } = await supabase.storage.from("support-attachments").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      notify(error?.message ?? "Attachment could not be opened.", "error");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };
  const insertReply = (template: SavedReply) => setReply(template.body.replace(/\{name\}/g, firstName));
  const saveCurrentReply = async () => {
    if (!reply.trim()) return;
    const label = await promptAction({ title: "Save as a reply template", label: "Template name", placeholder: "e.g. Delivery delay apology", maxLength: 60, confirmLabel: "Save template", description: "Use {name} in the text to insert the customer’s first name." });
    if (!label) return;
    const body = active?.profiles?.full_name ? reply.trim().replaceAll(firstName, "{name}") : reply.trim();
    const next = [...savedReplies.filter((item) => item.label !== label), { label, body }].slice(-12);
    setSavedReplies(next);
    localStore.setItem(SAVED_REPLIES_KEY, JSON.stringify(next));
    notify(`Saved “${label}” to your reply templates.`);
  };
  const choose = (id: string) => {
    setActiveId(id);
    if (!isDesktop) setSheetOpen(true);
  };

  const conversation = active ? (
    <div key={active.id} className="adm-swap flex min-h-full flex-col">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="adm-num text-[11px] text-muted-foreground">Ticket #{active.ticket_number} · {formatDateTime(active.created_at)}</p>
            <h2 className="mt-1 text-lg font-semibold leading-snug">{active.subject}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Status>{humanize(active.status)}</Status>
              <Pill tone={priorityTone[active.priority] ?? "neutral"}>{humanize(active.priority)} priority</Pill>
              <Pill tone="neutral">{humanize(active.category)}</Pill>
              {active.assigned_to && <Pill tone="info"><UserRound size={11} /> {teamName.get(active.assigned_to) ?? "Assigned"}</Pill>}
            </div>
          </div>
          {active.order_id && <Link to={`/admin/orders?range=all&q=${encodeURIComponent(active.order_id)}&order=${encodeURIComponent(active.order_id)}`} className="adm-btn adm-btn-sm">Related order <ArrowRight size={13} /></Link>}
        </div>
      </div>
      <div className="flex-1 space-y-4 px-4 py-5 sm:px-5">
        <div className="flex items-end gap-2.5">
          <Avatar name={active.profiles?.full_name || active.profiles?.email || "Customer"} size="sm" />
          <div className="max-w-[85%]">
            <p className="mb-1 text-[11px] text-muted-foreground">{active.profiles?.full_name || active.profiles?.email || "Customer"} · {relativeTime(active.created_at)}</p>
            <div className="whitespace-pre-wrap rounded-2xl rounded-bl-md bg-secondary px-4 py-3 text-sm leading-6">{active.message}</div>
            {active.attachment_paths?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {active.attachment_paths.map((path, index) => <button key={path} type="button" onClick={() => void openSupportAttachment(path)} className="adm-btn adm-btn-sm"><Paperclip size={12} /> Attachment {index + 1}</button>)}
              </div>
            )}
          </div>
        </div>
        {active.admin_reply && (
          <div className="flex justify-end">
            <div className="max-w-[85%]">
              <p className="mb-1 text-right text-[11px] text-muted-foreground">CozyCraft Care · latest reply</p>
              <div className="whitespace-pre-wrap rounded-2xl rounded-br-md bg-foreground px-4 py-3 text-sm leading-6 text-background">{active.admin_reply}</div>
            </div>
          </div>
        )}
        <SupportHandover key={active.id} ticketId={active.id} authorId={staffId} />
      </div>
      <div className="sticky bottom-0 border-t border-border bg-card px-4 py-3 sm:px-5">
        <details className="group mb-3 rounded-xl border border-border bg-subtle/70 open:bg-subtle">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold [&::-webkit-details-marker]:hidden">
            <span>Status, owner &amp; priority</span>
            <span className="flex items-center gap-1.5 text-muted-foreground">{workflowDirty && <Pill tone="warning">Unsaved</Pill>}<ChevronDown size={14} className="transition-transform group-open:rotate-180" /></span>
          </summary>
          <div className="grid gap-2.5 border-t border-border p-3 sm:grid-cols-3">
            <label className="adm-label text-[11px]">
              Status
              <select value={ticketStatus} onChange={(event) => setTicketStatus(event.target.value as DbSupportTicket["status"])} className="adm-select h-10 bg-card text-xs font-normal">
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <label className="adm-label text-[11px]">
              Owner
              <select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} className="adm-select h-10 bg-card text-xs font-normal">
                <option value="">Unassigned</option>
                {teamMembers.map((member) => <option key={member.id} value={member.id}>{member.id === staffId ? "Me" : member.full_name || member.role} · {member.role}</option>)}
              </select>
            </label>
            <label className="adm-label text-[11px]">
              Priority
              <select value={ticketPriority} onChange={(event) => setTicketPriority(event.target.value as DbSupportTicket["priority"])} className="adm-select h-10 bg-card text-xs font-normal">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <div className="flex justify-end gap-2 sm:col-span-3">
              {workflowDirty && <button type="button" onClick={() => { setTicketStatus(active.status); setAssignedTo(active.assigned_to ?? ""); setTicketPriority(active.priority); }} className="adm-btn adm-btn-sm">Reset</button>}
              <button type="button" onClick={() => void saveWorkflow()} disabled={updatingStatus || !workflowDirty} className="adm-btn adm-btn-primary adm-btn-sm">{updatingStatus ? "Saving…" : "Save ticket details"}</button>
            </div>
          </div>
        </details>
        <label className="sr-only" htmlFor="support-reply">Reply to customer</label>
        <textarea
          id="support-reply"
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void sendReply();
            }
          }}
          rows={3}
          className="adm-textarea min-h-[5.5rem] font-normal"
          placeholder={`Write a helpful reply to ${firstName}…`}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <ActionMenu
              label="Insert a saved reply"
              align="left"
              trigger={<span className="flex items-center gap-1.5 px-1 text-xs font-semibold"><MessageSquareText size={14} /> Saved replies</span>}
              items={savedReplies.map((template) => ({ label: template.label, onSelect: () => insertReply(template) }))}
            />
            <button type="button" onClick={() => void saveCurrentReply()} disabled={!reply.trim()} className="adm-btn adm-btn-ghost adm-btn-sm" title="Save this reply as a template"><BookmarkPlus size={14} /> <span className="hidden sm:inline">Save template</span></button>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-[10.5px] text-muted-foreground sm:inline"><kbd className="adm-kbd">⌘</kbd> <kbd className="adm-kbd">↵</kbd> to send</span>
            <button onClick={() => void sendReply()} disabled={!reply.trim() || sending} className="adm-btn adm-btn-primary"><Send size={14} /> {sending ? "Sending…" : "Send reply"}</button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const statusItems: Array<{ value: TicketFilter["status"]; label: string }> = [
    { value: "all", label: "All" },
    { value: "active", label: "Needs reply" },
    { value: "resolved", label: "Resolved" },
    { value: "closed", label: "Closed" },
  ];

  return (
    <AdminShell title="Support">
      <PageHeader
        eyebrow="Customer care"
        title="Support inbox"
        description="Reply to customers, hand tickets over with internal notes, and keep ownership clear."
        meta={ticketPagination && <Pill tone="neutral"><Inbox size={12} /> <span className="adm-num">{ticketPagination.total}</span> {filter.status === "all" && filter.owner === "all" && filter.priority === "all" ? "tickets" : "matching"}</Pill>}
      />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-border p-3 sm:p-4 xl:flex-row xl:items-center xl:justify-between">
          <Segmented label="Ticket status" value={filter.status} onChange={(status) => setFilter({ status })} items={statusItems} />
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Ticket owner" value={filter.owner} onChange={(event) => setFilter({ owner: event.target.value as TicketFilter["owner"] })} className="adm-select h-9 min-h-0 w-auto py-0 text-xs font-semibold">
              <option value="all">Any owner</option>
              <option value="mine">Assigned to me</option>
              <option value="unassigned">Unassigned</option>
            </select>
            <select aria-label="Ticket priority" value={filter.priority} onChange={(event) => setFilter({ priority: event.target.value as TicketFilter["priority"] })} className="adm-select h-9 min-h-0 w-auto py-0 text-xs font-semibold">
              <option value="all">Any priority</option>
              <option value="urgent">High &amp; urgent</option>
            </select>
          </div>
        </div>
        <BusyBar active={Boolean(ticketPagination?.busy)} />
        {ticketPagination?.error && <p role="alert" className="border-b border-border bg-danger-soft px-4 py-2.5 text-xs font-semibold text-danger-ink">{ticketPagination.error}</p>}
        {!active ? (
          <EmptyState icon={Inbox} title={filter.status === "all" && filter.owner === "all" && filter.priority === "all" ? "No customer support tickets yet." : "No tickets match these filters."} description="New customer messages appear here automatically." />
        ) : (
          <div className="grid lg:min-h-[640px] lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
            <div className="flex min-h-0 flex-col border-border lg:border-r">
              <ul className={`flex-1 divide-y divide-border transition-opacity lg:max-h-[calc(100dvh-17rem)] lg:overflow-y-auto ${ticketPagination?.busy ? "opacity-60" : ""}`}>
                {supportTickets.map((item) => {
                  const selected = active.id === item.id && isDesktop;
                  const waiting = ["open", "in_progress"].includes(item.status) ? hoursSince(item.created_at) : 0;
                  return (
                    <li key={item.id} className="relative">
                      {selected && <span className="absolute inset-y-0 left-0 w-[3px] bg-foreground" aria-hidden="true" />}
                      <button onClick={() => choose(item.id)} className={`w-full px-4 py-3.5 text-left transition-colors ${selected ? "bg-brand/25" : "hover:bg-subtle"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <b className="line-clamp-1 text-[13px]">{item.subject}</b>
                          <span className="shrink-0 text-[10.5px] text-muted-foreground">{relativeTime(item.created_at)}</span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.profiles?.full_name || item.profiles?.email || "Customer"}</p>
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground/90">{item.message}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Status>{humanize(item.status)}</Status>
                          {["urgent", "high"].includes(item.priority) && <Pill tone={priorityTone[item.priority]}>{humanize(item.priority)}</Pill>}
                          {waiting >= 24 && <Pill tone={waiting >= 48 ? "danger" : "warning"}>Waiting {ageLabel(item.created_at)}</Pill>}
                          {item.assigned_to && <span className="text-[10.5px] text-muted-foreground">· {item.assigned_to === staffId ? "You" : teamName.get(item.assigned_to) ?? "Assigned"}</span>}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {ticketPagination && <Pagination page={ticketPagination.page} total={ticketPagination.total} size={10} onChange={ticketPagination.setPage} busy={ticketPagination.busy} label="Support inbox pages" />}
            </div>
            {isDesktop && <div className="min-w-0">{conversation}</div>}
          </div>
        )}
      </Card>
      {!isDesktop && active && (
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} eyebrow={`Ticket #${active.ticket_number}`} title={active.subject}>
          {conversation}
        </Sheet>
      )}
      {notice && <Toast message={notice.message} tone={notice.tone} close={clear} action={notice.action} />}
    </AdminShell>
  );
}
