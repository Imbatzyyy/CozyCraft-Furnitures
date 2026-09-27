import { Fragment, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ClipboardList,
  Heart,
  KeyRound,
  MapPin,
  MessageCircle,
  Package,
  RefreshCw,
  Settings,
  ShoppingCart,
  Star,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAdminQuery } from "@/services/admin/use-admin-query";
import { useAdminTableInvalidation } from "@/services/admin/use-table-invalidation";
import { dayLabel, formatTime, manilaDayKey, plural, relativeTime } from "@/lib/admin/format";
import { useAdminSession } from "@/app/core";
import { AdminShell } from "@/features/admin/shell/AdminShell";
import { BusyBar, Card, EmptyState, PageHeader, Pagination, Pill, SearchField, Skeleton, useDebouncedValue } from "@/components/admin/ui";

type ActivityRow = {
  id: number | string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  platform: "web" | "mobile" | "edge" | "system";
  actor_role: string | null;
  profiles: { full_name: string | null; email: string | null; role: string | null } | null;
};

const scopes = [
  ["all", "All actions"],
  ["products", "Products"],
  ["orders", "Orders & payments"],
  ["reviews", "Reviews"],
  ["categories", "Categories"],
  ["store_settings", "Store settings"],
  ["customers", "Customers & team"],
  ["support", "Support"],
  ["cart", "Shopping carts"],
  ["wishlist", "Wishlists"],
  ["addresses", "Delivery addresses"],
  ["authentication", "Authentication"],
  ["errors", "Application errors"],
] as const;

const entityIcons: Array<[RegExp, LucideIcon]> = [
  [/order|payment|refund/, ClipboardList],
  [/product|inventory/, Package],
  [/review/, Star],
  [/categor/, Tag],
  [/setting/, Settings],
  [/profile|customer|team|staff/, Users],
  [/support|ticket/, MessageCircle],
  [/cart/, ShoppingCart],
  [/wishlist/, Heart],
  [/address/, MapPin],
  [/auth|sign|login|logout/, KeyRound],
  [/error|exception/, AlertTriangle],
];
const iconFor = (row: ActivityRow) => entityIcons.find(([pattern]) => pattern.test(`${row.entity_type} ${row.action}`))?.[1] ?? ClipboardList;

const humanizeAction = (action: string) =>
  ({
    customer_account_created: "created a customer account",
    admin_account_created: "received an administrator account",
    customer_sign_in: "signed in to the storefront",
    customer_sign_out: "signed out of the storefront",
    admin_sign_in: "signed in to operations",
    admin_sign_out: "signed out of operations",
    admin_idle_logout: "was automatically signed out after inactivity",
  } as Record<string, string>)[action] ??
  action.replace(/^insert_/, "created ").replace(/^update_/, "updated ").replace(/^delete_/, "deleted ").replace(/_/g, " ");

const detailValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export function ActivityLogsPage() {
  const [scope, setScope] = useState("all");
  const [queryDraft, setQueryDraft] = useState("");
  const query = useDebouncedValue(queryDraft.trim(), 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [expanded, setExpanded] = useState<string | number | null>(null);
  const { userId, workspaceReady } = useAdminSession();
  const activity = useAdminQuery<{ rows: ActivityRow[]; total: number; generatedAt: string }>(
    "admin_activity_page",
    { p_scope: scope, p_query: query.slice(0, 200), p_page: page, p_size: pageSize },
    workspaceReady,
    userId,
    { keepPrevious: true },
  );
  useAdminTableInvalidation(["activity_logs", "client_error_events"], activity.reload, workspaceReady);
  const rows = useMemo(() => activity.data?.rows ?? [], [activity.data]);
  const total = activity.data?.total ?? 0;
  useEffect(() => setPage(1), [scope, query, pageSize]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (activity.data && !activity.refreshing) setPage((current) => Math.min(current, totalPages));
  }, [activity.data, activity.refreshing, totalPages]);
  const scopeLabel = scopes.find(([value]) => value === scope)?.[1] ?? "All actions";
  const now = new Date();

  return (
    <AdminShell title="Activity logs">
      <PageHeader
        eyebrow="Audit trail"
        title="Activity logs"
        description="Every recorded change across the store in the last 7 days — who did it, where, and when."
        meta={activity.data && <span className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="adm-live-dot h-1.5 w-1.5 rounded-full bg-success-ink text-success-ink" /> Live audit trail · updated {formatTime(activity.data.generatedAt)}</span>}
        actions={<button type="button" onClick={activity.reload} className="adm-btn"><RefreshCw size={14} className={activity.loading ? "animate-spin" : ""} /> Refresh</button>}
      />
      <Card className="overflow-clip">
        <div className="flex flex-col gap-2.5 border-b border-border p-3 sm:flex-row sm:items-center sm:p-4">
          <SearchField className="flex-1" value={queryDraft} onChange={setQueryDraft} label="Search activity" placeholder="Search people, actions, or records" />
          <div className="flex gap-2">
            <select value={scope} onChange={(event) => setScope(event.target.value)} aria-label="Activity type" className="adm-select h-11 text-xs font-semibold sm:w-52">
              {scopes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} aria-label="Activity rows per page" className="adm-select h-11 w-auto text-xs font-semibold">
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>
        </div>
        <BusyBar active={activity.refreshing} />
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 text-[11px] text-muted-foreground sm:px-5">
          <span>{scopeLabel} · <span className="adm-num">{plural(total, "event")}</span> · last 7 days</span>
        </div>
        {activity.error && !rows.length ? (
          <EmptyState title="Activity could not be loaded." description={activity.error} action={<button onClick={activity.reload} className="adm-btn adm-btn-primary">Try again</button>} />
        ) : !activity.data ? (
          <div className="grid gap-3 px-5 pb-5">{[0, 1, 2, 3, 4].map((row) => <Skeleton key={row} className="h-12 w-full" />)}</div>
        ) : !rows.length ? (
          <EmptyState icon={ClipboardList} title="No recorded activity for this filter." description="Try a different activity type or search." />
        ) : (
          <ol className={`transition-opacity ${activity.refreshing ? "opacity-60" : ""}`}>
            {rows.map((row, index) => {
              const Icon = iconFor(row);
              const day = manilaDayKey(row.created_at);
              const newDay = index === 0 || manilaDayKey(rows[index - 1].created_at) !== day;
              const actor = row.profiles?.full_name || row.profiles?.email || "System";
              const subject = String(row.details?.name || row.details?.order_number || row.entity_id || row.entity_type || "");
              const detailEntries = Object.entries(row.details ?? {}).filter(([, value]) => value !== null && value !== "");
              const open = expanded === row.id;
              const isError = /error|exception/.test(`${row.entity_type} ${row.action}`);
              return (
                <Fragment key={row.id}>
                  {newDay && <li className="sticky top-14 z-[1] border-y border-border bg-subtle/95 px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-[.12em] text-muted-foreground backdrop-blur sm:top-16 sm:px-5">{dayLabel(row.created_at, now)}</li>}
                  <li className="border-b border-border last:border-b-0">
                    <button type="button" onClick={() => setExpanded(open ? null : row.id)} aria-expanded={open} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-subtle sm:px-5">
                      <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${isError ? "bg-danger-soft text-danger-ink" : "bg-secondary text-muted-foreground"}`}><Icon size={14} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] leading-5"><b>{actor}</b> {humanizeAction(row.action)}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          {subject && <span className="max-w-[18rem] truncate font-medium text-foreground/80">{subject}</span>}
                          <Pill tone="neutral" className="!text-[9.5px] uppercase">{row.platform}</Pill>
                          {(row.actor_role || row.profiles?.role) && <Pill tone={(row.actor_role || row.profiles?.role) === "customer" ? "neutral" : "info"} className="!text-[9.5px] uppercase">{row.actor_role || row.profiles?.role}</Pill>}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
                        <time dateTime={row.created_at} title={new Date(row.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}>{relativeTime(row.created_at, now)}</time>
                        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                      </span>
                    </button>
                    <div className="adm-collapse" data-open={open} aria-hidden={!open}>
                      <div>
                        <dl className="mx-4 mb-3 grid gap-x-6 gap-y-1.5 rounded-xl border border-border bg-subtle p-3 text-[11.5px] sm:mx-5 sm:ml-16 sm:grid-cols-2">
                          <div className="flex gap-2"><dt className="w-24 shrink-0 text-muted-foreground">Time</dt><dd className="adm-num">{new Date(row.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "medium" })}</dd></div>
                          <div className="flex gap-2"><dt className="w-24 shrink-0 text-muted-foreground">Record</dt><dd className="min-w-0 break-all">{row.entity_type}{row.entity_id ? ` · ${row.entity_id}` : ""}</dd></div>
                          {detailEntries.map(([key, value]) => (
                            <div key={key} className="flex gap-2"><dt className="w-24 shrink-0 capitalize text-muted-foreground">{key.replace(/_/g, " ")}</dt><dd className="min-w-0 break-all">{detailValue(value)}</dd></div>
                          ))}
                        </dl>
                      </div>
                    </div>
                  </li>
                </Fragment>
              );
            })}
          </ol>
        )}
        {activity.data && total > 0 && <Pagination page={page} total={total} size={pageSize} onChange={setPage} busy={activity.refreshing} label="Activity pages" />}
      </Card>
    </AdminShell>
  );
}
