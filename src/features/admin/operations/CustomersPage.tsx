import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, ClipboardList, Mail, MapPin, MessageCircle, Pencil, Phone, ShieldOff, ShieldCheck, UserRound, Users } from "lucide-react";
import { adminSupabase as supabase, type DbCustomerProfile, type DbOrder } from "@/services/supabase/client";
import { privateAvatarUrls } from "@/lib/shared/avatar-url";
import { useAdminQuery } from "@/services/admin/use-admin-query";
import { formatDate, formatDateTime, humanize, plural, relativeTime } from "@/lib/admin/format";
import { money, useAdminSession, Status, Toast } from "@/app/core";
import { AdminShell } from "@/features/admin/shell/AdminShell";
import { confirmAction } from "@/components/admin/confirm";
import { Avatar, BusyBar, Card, CopyButton, EmptyState, PageHeader, Pagination, Pill, SearchField, Sheet, Skeleton, useDebouncedValue, useMediaQuery, useNotice } from "@/components/admin/ui";

type CustomerDirectoryRecord = DbCustomerProfile & { order_count: number; address_count: number; ticket_count: number; lifetime_value: number };
type RecentOrder = Pick<DbOrder, "id" | "order_number" | "status" | "payment_status" | "total" | "created_at">;
type RecentTicket = { id: string; ticket_number: string; subject: string; status: string; created_at: string };

export function CustomersPage() {
  const [searchParams] = useSearchParams();
  const [queryDraft, setQueryDraft] = useState(() => searchParams.get("q") ?? "");
  const customerQuery = useDebouncedValue(queryDraft.trim(), 300);
  const linkedQuery = searchParams.get("q");
  useEffect(() => {
    if (linkedQuery !== null) setQueryDraft(linkedQuery);
  }, [linkedQuery]);
  const { userId, workspaceReady } = useAdminSession();
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [customerQuery]);
  const directory = useAdminQuery<{ profiles: CustomerDirectoryRecord[]; total: number }>("admin_customer_page", { p_page: page, p_query: customerQuery }, workspaceReady, userId, { keepPrevious: true });
  const customerProfiles = directory.data?.profiles ?? [];
  const [avatars, setAvatars] = useState<Record<string, string | null>>({});
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [sheetOpen, setSheetOpen] = useState(false);
  useEffect(() => {
    let active = true;
    const profiles = directory.data?.profiles ?? [];
    void privateAvatarUrls(profiles.map((profile) => profile.avatar_url), supabase).then((urls) => {
      if (active) setAvatars(Object.fromEntries(profiles.map((profile, index) => [profile.id, urls[index] ?? null])));
    });
    return () => {
      active = false;
    };
  }, [directory.data]);
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ fullName: "", username: "", phone: "", gender: "", dateOfBirth: "" });
  const { notice, notify, clear } = useNotice();
  const [busy, setBusy] = useState(false);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[] | null>(null);
  const [recentTickets, setRecentTickets] = useState<RecentTicket[] | null>(null);
  useEffect(() => {
    if (!customerProfiles.length) return;
    if (!customerProfiles.some((profile) => profile.id === selectedId)) setSelectedId(customerProfiles[0].id);
  }, [customerProfiles, selectedId]);
  const customer = customerProfiles.find((item) => item.id === selectedId) ?? customerProfiles[0];
  const primaryAddress = customer?.addresses.find((address) => address.is_primary) ?? customer?.addresses[0];
  useEffect(() => {
    if (!customer) return;
    setDraft({ fullName: customer.full_name, username: customer.username, phone: customer.phone ?? "", gender: customer.gender, dateOfBirth: customer.date_of_birth ?? "" });
    setEditing(false);
  }, [customer?.id]);
  // Small, bounded look-ups for the selected customer only.
  useEffect(() => {
    if (!customer?.id || !workspaceReady) return;
    let active = true;
    setRecentOrders(null);
    setRecentTickets(null);
    void Promise.all([
      supabase.from("orders").select("id,order_number,status,payment_status,total,created_at").eq("user_id", customer.id).order("created_at", { ascending: false }).limit(5),
      supabase.from("support_tickets").select("id,ticket_number,subject,status,created_at").eq("user_id", customer.id).order("created_at", { ascending: false }).limit(3),
    ]).then(([ordersResult, ticketsResult]) => {
      if (!active) return;
      setRecentOrders(ordersResult.error ? [] : ((ordersResult.data ?? []) as RecentOrder[]));
      setRecentTickets(ticketsResult.error ? [] : ((ticketsResult.data ?? []) as RecentTicket[]));
    });
    return () => {
      active = false;
    };
  }, [customer?.id, workspaceReady]);

  const manageCustomer = async (body: Record<string, unknown>) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("manage-customer", { body });
    setBusy(false);
    if (error || data?.error) {
      notify(data?.error ?? error?.message ?? "The customer account could not be updated.", "error");
      return;
    }
    notify(data?.message ?? "Customer account updated.");
    setEditing(false);
    directory.reload();
  };
  const toggleStatus = async () => {
    if (!customer) return;
    const active = customer.customer_active !== false;
    const confirmed = await confirmAction({
      title: active ? `Suspend ${customer.full_name || "this customer"}?` : `Reactivate ${customer.full_name || "this customer"}?`,
      description: active ? "They will be signed out and can’t shop or sign in until you reactivate the account. Orders already placed are not affected." : "They will be able to sign in and shop again right away.",
      confirmLabel: active ? "Suspend account" : "Reactivate account",
      tone: active ? "danger" : "default",
    });
    if (confirmed) void manageCustomer({ action: "set-status", userId: customer.id, active: !active });
  };
  const choose = (id: string) => {
    setSelectedId(id);
    if (!isDesktop) setSheetOpen(true);
  };

  const detail = customer ? (
    <div key={customer.id} className="adm-swap">
      <div className="bg-inverse p-5 text-inverse-foreground sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={customer.full_name || customer.email || "Customer"} src={avatars[customer.id]} size="lg" className="!rounded-2xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-inverse-muted">Customer account</p>
              <Pill tone={customer.customer_active !== false ? "success" : "danger"} dot>{customer.customer_active !== false ? "Active" : "Suspended"}</Pill>
            </div>
            <h2 className="mt-1 truncate font-serif text-[2rem] leading-tight">{customer.full_name || "Customer"}</h2>
            <p className="text-sm text-inverse-muted">@{customer.username || "username-not-set"} · Joined {formatDate(customer.created_at)}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Lifetime value", money(Number(customer.lifetime_value))],
            ["Orders", customer.order_count],
            ["Addresses", customer.address_count],
            ["Support tickets", customer.ticket_count],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white/[.07] p-3">
              <p className="text-[10.5px] text-inverse-muted">{label}</p>
              <b className="adm-num mt-1 block text-base">{value}</b>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditing((value) => !value)} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3.5 text-xs font-semibold text-[#201f1d]"><Pencil size={13} /> {editing ? "Close editor" : "Edit profile"}</button>
          {customer.email && <a href={`mailto:${customer.email}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/20 px-3.5 text-xs font-semibold hover:bg-white/10"><Mail size={13} /> Email</a>}
          {customer.phone && <a href={`tel:${customer.phone.replace(/\s+/g, "")}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/20 px-3.5 text-xs font-semibold hover:bg-white/10"><Phone size={13} /> Call</a>}
          <button type="button" disabled={busy} onClick={() => void toggleStatus()} className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold disabled:opacity-50 ${customer.customer_active !== false ? "border-[#d7a28d]/60 text-[#f2c7b5] hover:bg-[#d7a28d]/10" : "border-[#9fbd92]/60 text-[#cde6c3] hover:bg-[#9fbd92]/10"}`}>
            {customer.customer_active !== false ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
            {customer.customer_active !== false ? "Suspend" : "Reactivate"}
          </button>
        </div>
      </div>
      <div className="adm-collapse" data-open={editing} aria-hidden={!editing}>
        <div>
          <form onSubmit={(event) => { event.preventDefault(); void manageCustomer({ action: "update", userId: customer.id, ...draft }); }} className="border-b border-border bg-subtle p-5">
            <p className="adm-eyebrow">Edit customer profile</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {([["Full name", "fullName"], ["Username", "username"], ["Phone", "phone"], ["Gender", "gender"], ["Date of birth", "dateOfBirth"]] as const).map(([label, key]) => (
                <label key={key} className="adm-label">
                  {label}
                  <input tabIndex={editing ? undefined : -1} type={key === "dateOfBirth" ? "date" : "text"} value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} className="adm-input bg-card font-normal" />
                </label>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button type="submit" tabIndex={editing ? undefined : -1} disabled={busy} className="adm-btn adm-btn-primary">{busy ? "Saving…" : "Save changes"}</button>
              <button type="button" tabIndex={editing ? undefined : -1} onClick={() => setEditing(false)} className="adm-btn">Cancel</button>
            </div>
          </form>
        </div>
      </div>
      <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-2">
        <section className="adm-inset p-4">
          <p className="adm-eyebrow">Contact</p>
          <dl className="mt-3 grid gap-3 text-sm">
            <div>
              <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Mail size={12} /> Email</dt>
              <dd className="mt-0.5 flex items-center gap-1 font-medium">{customer.email ? <><span className="min-w-0 truncate">{customer.email}</span><CopyButton value={customer.email} label="email" /></> : "Not provided"}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Phone size={12} /> Phone</dt>
              <dd className="mt-0.5 flex items-center gap-1 font-medium">{customer.phone ? <><span className="adm-num">{customer.phone}</span><CopyButton value={customer.phone} label="phone" /></> : "Not provided"}</dd>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><dt className="text-[11px] text-muted-foreground">Gender</dt><dd className="mt-0.5 font-medium">{customer.gender || "—"}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Birthday</dt><dd className="mt-0.5 font-medium">{customer.date_of_birth ? formatDate(`${customer.date_of_birth}T12:00:00`) : "—"}</dd></div>
            </div>
            <div><dt className="text-[11px] text-muted-foreground">Payment preference</dt><dd className="mt-0.5 font-medium">{customer.preferred_payment_method === "cod" ? "Cash on delivery" : customer.preferred_payment_method === "gcash" ? "GCash" : customer.preferred_payment_method === "card" ? "Card" : "—"}</dd></div>
          </dl>
        </section>
        <section className="adm-inset p-4">
          <p className="adm-eyebrow">Default delivery address</p>
          {primaryAddress ? (
            <div className="mt-3 text-sm">
              <p className="flex items-center gap-1.5 font-semibold"><MapPin size={13} /> {primaryAddress.label} · {primaryAddress.recipient_name}</p>
              <p className="mt-2 leading-6 text-muted-foreground">
                {primaryAddress.address_line}, {primaryAddress.barangay}
                <br />
                {primaryAddress.city}, {primaryAddress.province} {primaryAddress.postal_code}
              </p>
              <p className="adm-num mt-2 text-xs text-muted-foreground">{primaryAddress.mobile}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No saved address yet.</p>
          )}
        </section>
        <section className="adm-inset p-4 xl:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <p className="adm-eyebrow">Recent orders</p>
            <Link to={`/admin/orders?range=all&sort=newest&q=${encodeURIComponent(customer.email || customer.full_name || "")}`} className="inline-flex items-center gap-1 text-xs font-semibold hover:underline">All orders <ArrowRight size={12} /></Link>
          </div>
          {recentOrders === null ? (
            <div className="mt-3 grid gap-2">{[0, 1].map((row) => <Skeleton key={row} className="h-10 w-full" />)}</div>
          ) : recentOrders.length ? (
            <ul className="mt-2 divide-y divide-border">
              {recentOrders.map((order) => (
                <li key={order.id}>
                  <Link to={`/admin/orders?order=${encodeURIComponent(order.id)}&q=${encodeURIComponent(order.id)}&range=all`} className="flex items-center gap-3 py-2.5 text-[13px] hover:underline-offset-4">
                    <ClipboardList size={14} className="shrink-0 text-muted-foreground" />
                    <b className="adm-num">#{order.order_number}</b>
                    <span className="hidden text-xs text-muted-foreground sm:inline">{relativeTime(order.created_at)}</span>
                    <span className="ml-auto flex items-center gap-2"><Status>{humanize(order.status)}</Status><b className="adm-num w-20 text-right">{money(Number(order.total))}</b></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No orders yet.</p>
          )}
        </section>
        <section className="adm-inset p-4 xl:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <p className="adm-eyebrow">Support history</p>
            <Link to="/admin/support" className="inline-flex items-center gap-1 text-xs font-semibold hover:underline">Inbox <ArrowRight size={12} /></Link>
          </div>
          {recentTickets === null ? (
            <Skeleton className="mt-3 h-10 w-full" />
          ) : recentTickets.length ? (
            <ul className="mt-2 divide-y divide-border">
              {recentTickets.map((ticket) => (
                <li key={ticket.id}>
                  <Link to={`/admin/support?ticket=${encodeURIComponent(ticket.id)}`} className="flex items-center gap-3 py-2.5 text-[13px]">
                    <MessageCircle size={14} className="shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{ticket.subject}</span>
                    <Status>{humanize(ticket.status)}</Status>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No support tickets.</p>
          )}
        </section>
        <section className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-muted-foreground xl:col-span-2">
          <span className="flex items-center gap-1 font-mono">ID {customer.id}<CopyButton value={customer.id} label="account ID" /></span>
          <span>Registered {formatDateTime(customer.created_at)}</span>
        </section>
      </div>
    </div>
  ) : null;

  return (
    <AdminShell title="Customers">
      <PageHeader
        eyebrow="Customer relationships"
        title="Customers"
        description="Registered shoppers, what they’ve bought, and how to reach them — even before their first order."
        meta={directory.data && <Pill tone="neutral"><Users size={12} /> <span className="adm-num">{directory.data.total.toLocaleString("en-PH")}</span> {customerQuery ? "matching" : "registered"}</Pill>}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] lg:items-start">
        <Card className="overflow-hidden lg:sticky lg:top-[5.25rem]">
          <div className="border-b border-border p-3">
            <SearchField value={queryDraft} onChange={setQueryDraft} label="Search customers" placeholder="Name, username, email, or phone" />
          </div>
          <BusyBar active={directory.refreshing} />
          {directory.error && !customerProfiles.length ? (
            <EmptyState title="Customer records could not be loaded." description={directory.error} action={<button className="adm-btn adm-btn-primary" onClick={directory.reload}>Try again</button>} compact />
          ) : !directory.data ? (
            <div className="grid gap-2 p-3">{[0, 1, 2, 3, 4, 5].map((row) => <Skeleton key={row} className="h-14 w-full" />)}</div>
          ) : !customerProfiles.length ? (
            <EmptyState icon={UserRound} title={customerQuery ? `No customers match “${customerQuery}”` : "No registered customers yet."} description={customerQuery ? "Try a different name, email, or phone number." : "New sign-ups will appear here."} compact />
          ) : (
            <ul className={`divide-y divide-border transition-opacity lg:max-h-[calc(100dvh-15rem)] lg:overflow-y-auto ${directory.refreshing ? "opacity-60" : ""}`}>
              {customerProfiles.map((profile) => {
                const active = customer?.id === profile.id;
                return (
                  <li key={profile.id} className="relative">
                    {active && isDesktop && <span className="absolute inset-y-0 left-0 w-[3px] bg-foreground" aria-hidden="true" />}
                    <button onClick={() => choose(profile.id)} className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${active && isDesktop ? "bg-brand/25" : "hover:bg-subtle"}`}>
                      <span className="relative">
                        <Avatar name={profile.full_name || profile.email || "Customer"} src={avatars[profile.id]} />
                        {profile.customer_active === false && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-danger-ink ring-2 ring-card" title="Suspended" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[13px]">{profile.full_name || "Customer"}</b>
                        <span className="block truncate text-[11px] text-muted-foreground">{profile.email || "No email"}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <b className="adm-num block text-[13px]">{money(Number(profile.lifetime_value))}</b>
                        <span className="block text-[10.5px] text-muted-foreground">{plural(profile.order_count, "order")}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {directory.data && <Pagination page={page} total={directory.data.total} size={10} onChange={setPage} busy={directory.refreshing} label="Customer pages" />}
        </Card>
        {isDesktop && (
          <Card className="overflow-hidden">
            {detail ?? (!directory.data ? <div className="grid gap-4 p-6"><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" /></div> : <EmptyState icon={UserRound} title="Select a customer" description="Their profile, orders, and support history appear here." />)}
          </Card>
        )}
      </div>
      {!isDesktop && customer && (
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} eyebrow="Customer" title={customer.full_name || "Customer"}>
          {detail}
        </Sheet>
      )}
      {notice && <Toast message={notice.message} tone={notice.tone} close={clear} action={notice.action} />}
    </AdminShell>
  );
}
