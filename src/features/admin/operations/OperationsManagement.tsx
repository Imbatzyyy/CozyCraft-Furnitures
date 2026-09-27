import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CircleDollarSign,
  ClipboardList,
  Clock,
  CreditCard,
  MessageCircle,
  PackagePlus,
  RefreshCw,
  ServerCog,
  ShieldAlert,
  ShoppingBag,
  Undo2,
  Warehouse,
  Wifi,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { ResilientImage } from "@/components/media/ResilientImage";
import { primaryProductImage } from "@/lib/catalog/product-images";
import { type DbOrder } from "@/services/supabase/client";
import { useAdminTableInvalidation } from "@/services/admin/use-table-invalidation";
import { useAdminQuery } from "@/services/admin/use-admin-query";
import { buildAdminAttentionItems } from "@/lib/admin/operations-attention";
import { type ClientErrorSummary } from "@/lib/admin/operations-health";
import { formatDateTime, formatTime, plural, relativeTime } from "@/lib/admin/format";
import { money, useAdminSession, useStore, Status } from "@/app/core";
import { AdminShell } from "@/features/admin/shell/AdminShell";
import { Card, CardHeader, EmptyState, PageHeader, Pill, Skeleton, StatStrip, type Tone } from "@/components/admin/ui";
import { RevenueArea } from "@/components/admin/charts";

export { OrdersWorkspacePage } from "./OrdersDesk";
export { PaymentsPage } from "./PaymentsPage";
export { CustomersPage } from "./CustomersPage";
export { ReviewsPage } from "./ReviewsPage";
export { SupportPage } from "./SupportPage";
export { ActivityLogsPage } from "./ActivityLogsPage";
export { ReportsPage } from "./ReportsPage";


type OverviewSnapshot = {
  sales: number;
  monthCount: number;
  pending: number;
  lowStock: number;
  fulfillment: number;
  cancellations: number;
  refunds: number;
  support: number;
  statuses: Record<string, number>;
  salesData: Array<{ m: string; v: number }>;
  recent: DbOrder[];
};

const attentionIcons: Record<string, LucideIcon> = {
  fulfillment: ClipboardList,
  cancellations: Undo2,
  refunds: ShieldAlert,
  inventory: Warehouse,
  support: MessageCircle,
};

export function AdminOverview() {
  const { adminProducts, supportTickets, storeSettings } = useStore();
  const { user, role, userId, workspaceReady } = useAdminSession();
  const snapshot = useAdminQuery<OverviewSnapshot>("admin_overview_snapshot", {}, workspaceReady, userId);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const firstName = user?.trim().split(/\s+/)[0] || "there";
  const hour = Number(new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", hourCycle: "h23" }).format(now));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateLabel = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now);
  const data = snapshot.data;
  const lowStockThreshold = storeSettings.low_stock_threshold ?? 8;
  const attentionItems = buildAdminAttentionItems({ orders: [], products: adminProducts, tickets: supportTickets, role }).map((item) => ({
    ...item,
    count: item.id === "inventory" ? data?.lowStock ?? 0 : data?.[item.id] ?? 0,
  }));
  const openAttentionCount = attentionItems.reduce((sum, item) => sum + item.count, 0);
  const statusRows = [
    ["Delivered", data?.statuses.delivered ?? 0, "bg-[#6f8a66]"],
    ["Processing", data?.statuses.processing ?? 0, "bg-[#b8a58d]"],
    ["Pending", data?.statuses.pending ?? 0, "bg-[#d39a64]"],
    ["Cancelled", data?.statuses.cancelled ?? 0, "bg-[#a8a096]"],
  ] as const;
  const statusTotal = Math.max(1, statusRows.reduce((sum, row) => sum + row[1], 0));
  const lowStockProducts = useMemo(
    () =>
      adminProducts
        .filter((product) => product.status !== "inactive" && (product.stockQuantity ?? 0) <= lowStockThreshold)
        .sort((a, b) => (a.stockQuantity ?? 0) - (b.stockQuantity ?? 0))
        .slice(0, 5),
    [adminProducts, lowStockThreshold],
  );

  return (
    <AdminShell title="Overview">
      <PageHeader
        eyebrow={dateLabel}
        title={`${greeting}, ${firstName}.`}
        description={openAttentionCount ? `${plural(openAttentionCount, "item")} need your attention today.` : "Everything is moving. Here’s today’s view of orders, stock, and sales."}
        actions={
          <>
            <Link to="/admin/inventory" className="adm-btn"><Warehouse size={15} /> Update stock</Link>
            <Link to="/admin/products/new" className="adm-btn adm-btn-primary"><PackagePlus size={15} /> Add product</Link>
          </>
        }
      >
        <StatStrip
          loading={!data}
          items={[
            { label: "Total sales", value: data?.sales, format: (value) => money(Math.round(value)), note: "Paid, non-cancelled orders", icon: CircleDollarSign, tone: "success", to: "/admin/reports" },
            { label: "Orders this month", value: data?.monthCount, note: "Live storefront orders", icon: ShoppingBag, to: "/admin/orders?range=last_30_days" },
            { label: "Pending orders", value: data?.pending, note: data?.pending ? "Waiting to be processed" : "Nothing waiting", icon: Clock, tone: data?.pending ? "warning" : "neutral", to: "/admin/orders?status=pending&range=all" },
            { label: "Low-stock products", value: data?.lowStock, note: `At or below ${lowStockThreshold} units`, icon: Warehouse, tone: data?.lowStock ? "warning" : "neutral", to: "/admin/inventory?filter=low" },
          ]}
        />
      </PageHeader>

      {snapshot.error && (
        <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-warning-soft px-4 py-3 text-sm text-warning-ink">
          <span>{data ? "Showing the last loaded totals." : "The overview could not be loaded."} {snapshot.error}</span>
          <button onClick={snapshot.reload} className="adm-btn adm-btn-sm"><RefreshCw size={13} /> Retry</button>
        </div>
      )}

      <Card className="overflow-hidden">
        <CardHeader
          eyebrow="Action center"
          title="What needs attention now"
          description="Prioritized from current order, inventory, and support totals."
          action={<Pill tone={openAttentionCount ? "warning" : "success"} dot>{data ? (openAttentionCount ? `${openAttentionCount} open actions` : "All caught up") : "Checking…"}</Pill>}
        />
        <div className="adm-rise grid gap-px bg-border [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          {attentionItems.map((item) => {
            const Icon = attentionIcons[item.id] ?? ClipboardList;
            const tone: Tone = item.count === 0 ? "neutral" : item.level === "critical" ? "danger" : item.level === "warning" ? "warning" : "inverse";
            return (
              <Link key={item.id} to={item.route} className="group flex min-h-[9.5rem] flex-col justify-between bg-card p-5 transition-colors hover:bg-subtle">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-muted-foreground transition-colors group-hover:text-foreground"><Icon size={16} /></span>
                  <span className={`adm-num grid h-8 min-w-8 place-items-center rounded-full px-2 text-sm font-bold ${tone === "neutral" ? "bg-secondary text-muted-foreground" : tone === "inverse" ? "bg-foreground text-background" : tone === "danger" ? "bg-danger-soft text-danger-ink" : "bg-warning-soft text-warning-ink"}`}>
                    {data ? item.count : "–"}
                  </span>
                </div>
                <div>
                  <p className="mt-4 text-sm font-semibold">{item.label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-foreground/80 transition group-hover:gap-2 group-hover:text-foreground">Open <ArrowRight size={13} /></span>
                </div>
              </Link>
            );
          })}
        </div>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_.85fr]">
        <Card>
          <CardHeader title="Sales performance" description="Paid revenue · last 7 months" action={<Link to="/admin/reports" className="adm-btn adm-btn-sm">View reports <ArrowRight size={13} /></Link>} />
          <div className="p-3 pr-4 sm:p-5">
            {data ? (
              data.salesData.length ? (
                <RevenueArea data={data.salesData} xKey="m" yKey="v" valueLabel="Paid revenue" format={(value) => money(Math.round(value))} ariaLabel="Paid revenue over the last seven months" />
              ) : (
                <EmptyState icon={Activity} title="No sales yet" description="Revenue appears here once paid orders are recorded." />
              )
            ) : (
              <Skeleton className="h-[240px] w-full" />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Order status" description={data ? `${plural(data.monthCount, "order")} this month` : "Loading…"} />
          <div className="grid gap-4 p-5">
            {statusRows.map(([label, value, color]) => (
              <Link key={label} to={`/admin/orders?status=${label.toLowerCase()}&range=last_30_days`} className="group block">
                <div className="mb-1.5 flex items-baseline justify-between text-xs">
                  <span className="font-medium group-hover:underline">{label}</span>
                  <span className="adm-num text-muted-foreground"><b className="text-foreground">{value}</b> · {Math.round((value / statusTotal) * 100)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div className={`adm-bar-grow h-full rounded-full ${color}`} style={{ width: `${(value / statusTotal) * 100}%` }} />
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_.85fr]">
        <Card className="overflow-hidden">
          <CardHeader title="Recent orders" description="Latest customer purchases" action={<Link to="/admin/orders?range=all&sort=newest" className="adm-btn adm-btn-sm">View all <ArrowRight size={13} /></Link>} />
          {data ? (
            data.recent.length ? (
              <ul className="divide-y divide-border">
                {data.recent.slice(0, 5).map((order) => (
                  <li key={order.id}>
                    <Link to={`/admin/orders?order=${encodeURIComponent(order.id)}&q=${encodeURIComponent(order.id)}&range=all`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-subtle sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto]">
                      <span className="min-w-0">
                        <b className="adm-num block text-[13px]">#{order.order_number}</b>
                        <span className="block truncate text-[11px] text-muted-foreground sm:hidden">{order.shipping_address.name || "Customer"}</span>
                      </span>
                      <span className="hidden truncate text-[13px] sm:block">{order.shipping_address.name || "Customer"}</span>
                      <span className="adm-num text-right text-[13px] font-semibold sm:order-none">{money(Number(order.total))}</span>
                      <span className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:justify-end">
                        <span className="text-[11px] text-muted-foreground">{relativeTime(order.created_at, now)}</span>
                        <Status>{order.status}</Status>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={ClipboardList} title="No orders yet" description="New storefront orders will appear here automatically." compact />
            )
          ) : (
            <div className="grid gap-3 p-5">{[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-9 w-full" />)}</div>
          )}
        </Card>
        <Card className="overflow-hidden">
          <CardHeader title="Low stock" description={`Active pieces at or below ${lowStockThreshold} units`} action={<Link to="/admin/inventory?filter=low" className="adm-btn adm-btn-sm">Restock <ArrowRight size={13} /></Link>} />
          {lowStockProducts.length ? (
            <ul className="divide-y divide-border">
              {lowStockProducts.map((product) => {
                const units = product.stockQuantity ?? 0;
                return (
                  <li key={product.id}>
                    <Link to={`/admin/inventory?q=${encodeURIComponent(product.name)}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-subtle">
                      <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-secondary"><ResilientImage src={primaryProductImage(product) ?? ""} alt="" className="h-full w-full object-cover" /></span>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[13px]">{product.name}</b>
                        <span className="block truncate text-[11px] text-muted-foreground">{product.category}</span>
                      </span>
                      <Pill tone={units === 0 ? "danger" : "warning"}>{units === 0 ? "Sold out" : plural(units, "unit")}</Pill>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={Warehouse} title="Stock looks healthy" description="No active product is at or below the low-stock threshold." compact />
          )}
        </Card>
      </div>
    </AdminShell>
  );
}

/** Kept for existing imports: a compact list of the latest orders. */
export function RecentOrders({ items }: { items?: DbOrder[] } = {}) {
  const store = useStore();
  const orders = items ?? store.orders;
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Recent orders" description="Latest customer purchases" />
      <ul className="divide-y divide-border">
        {orders.slice(0, 5).map((order) => (
          <li key={order.id} className="flex items-center justify-between gap-3 px-5 py-3 text-[13px]">
            <b className="adm-num">#{order.order_number}</b>
            <span className="truncate">{order.shipping_address.name || "Customer"}</span>
            <span className="adm-num">{money(Number(order.total))}</span>
            <Status>{order.status}</Status>
          </li>
        ))}
      </ul>
      {!orders.length && <EmptyState title="No orders yet" compact />}
    </Card>
  );
}

type HealthData = {
  failedPayments: number;
  failedRefunds: number;
  overdueFulfillment: number;
  priorityTickets: number;
  outOfStockProducts: number;
  recentClientErrors: number;
  errors: ClientErrorSummary[];
  generatedAt: string;
};
type JobHealth = { photoQueued: number; photoExhausted: number; voucherQueued: number; voucherFailed: number; voucherOverdue: number; generatedAt: string };

export function SystemHealthPage() {
  const { ordersRealtimeConnected } = useStore();
  const { userId, workspaceReady } = useAdminSession();
  const health = useAdminQuery<HealthData>("admin_operations_snapshot", {}, workspaceReady, userId);
  const jobs = useAdminQuery<JobHealth>("admin_job_health", {}, workspaceReady, userId);
  useAdminTableInvalidation(["client_error_events"], health.reload, workspaceReady);
  const loading = health.loading || jobs.loading;
  const data = health.data;
  const refreshHealth = () => {
    health.reload();
    jobs.reload();
  };
  const overall: "healthy" | "degraded" | "attention" | "checking" =
    !data && !health.error ? "checking"
      : !data || health.error || jobs.error || !jobs.data || jobs.data.photoExhausted + jobs.data.voucherFailed + jobs.data.voucherOverdue > 0 ? "attention"
        : !ordersRealtimeConnected || data.failedRefunds > 0 ? "degraded"
          : data.failedPayments + data.overdueFulfillment + data.priorityTickets + data.outOfStockProducts + data.recentClientErrors > 0 ? "attention"
            : "healthy";
  const errorGroups = useMemo(() => {
    const groups = new Map<string, ClientErrorSummary & { count: number }>();
    (data?.errors ?? []).forEach((event) => {
      const key = `${event.path ?? "unknown"}|${event.message}`;
      const current = groups.get(key);
      if (current) current.count += 1;
      else groups.set(key, { ...event, count: 1 });
    });
    return Array.from(groups.values()).slice(0, 8);
  }, [data?.errors]);
  const cards: Array<{ label: string; value: string; note: string; route: string; attention: boolean; icon: LucideIcon }> = [
    { label: "Realtime connection", value: ordersRealtimeConnected ? "Connected" : "Reconnecting", note: "Live order updates. Refresh to verify the latest data.", route: "/admin/orders", attention: !ordersRealtimeConnected, icon: ordersRealtimeConnected ? Wifi : WifiOff },
    { label: "Payment exceptions", value: String((data?.failedPayments ?? 0) + (data?.failedRefunds ?? 0)), note: `${plural(data?.failedPayments ?? 0, "failed payment")} · ${plural(data?.failedRefunds ?? 0, "failed refund")}`, route: data?.failedRefunds ? "/admin/orders?view=refund_attention&range=all" : "/admin/orders?payment=failed&range=all", attention: (data?.failedPayments ?? 0) + (data?.failedRefunds ?? 0) > 0, icon: CreditCard },
    { label: "48-hour backlog", value: String(data?.overdueFulfillment ?? 0), note: "Pending, processing, or packed orders older than 48 hours.", route: "/admin/orders?view=needs_fulfillment&range=all&sort=longest_waiting", attention: (data?.overdueFulfillment ?? 0) > 0, icon: Clock },
    { label: "Priority support", value: String(data?.priorityTickets ?? 0), note: "Open high and urgent customer tickets.", route: "/admin/support", attention: (data?.priorityTickets ?? 0) > 0, icon: MessageCircle },
    { label: "Out of stock", value: String(data?.outOfStockProducts ?? 0), note: "Visible or draft products at zero units.", route: "/admin/inventory?filter=out", attention: (data?.outOfStockProducts ?? 0) > 0, icon: Warehouse },
    { label: "Browser errors · 24h", value: String(data?.recentClientErrors ?? 0), note: "Exceptions in the last 24 hours; the latest are grouped below.", route: "/admin/activity-logs", attention: (data?.recentClientErrors ?? 0) > 0, icon: AlertTriangle },
  ];
  const statusPill =
    overall === "checking" ? <Pill tone="neutral" dot>Checking services…</Pill>
      : overall === "healthy" ? <Pill tone="success" dot>No monitored exceptions</Pill>
        : overall === "degraded" ? <Pill tone="danger" dot>Degraded — action required</Pill>
          : <Pill tone="warning" dot>Attention required</Pill>;
  return (
    <AdminShell title="Operations health">
      <PageHeader
        eyebrow="Operations health"
        title="Know what needs intervention."
        description="A compact exception view across orders, payments, support, inventory, realtime, and browser errors."
        meta={<>{statusPill}{data && <span className="text-[11px] text-muted-foreground">Checked {formatTime(data.generatedAt)}</span>}</>}
        actions={<button type="button" onClick={refreshHealth} disabled={loading} className="adm-btn"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {loading ? "Checking…" : "Refresh now"}</button>}
      />
      <div className="adm-rise grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.label} to={card.route} className="adm-card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--adm-shadow-pop)]">
            <div className="flex items-start justify-between gap-3">
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${card.attention ? "bg-warning-soft text-warning-ink" : "bg-success-soft text-success-ink"}`}><card.icon size={17} /></span>
              {data || card.label === "Realtime connection" ? <span className="adm-num text-2xl font-semibold">{card.value}</span> : <Skeleton className="h-7 w-10" />}
            </div>
            <h3 className="mt-5 text-sm font-semibold">{card.label}</h3>
            <p className="mt-1 flex-1 text-xs leading-5 text-muted-foreground">{card.note}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold transition-all group-hover:gap-2">Inspect <ArrowRight size={13} /></span>
          </Link>
        ))}
      </div>
      <Card className="mt-5 overflow-hidden" aria-label="Background delivery and photo-analysis jobs">
        <CardHeader eyebrow="Background jobs" title="Delivery and photo-analysis queues" description="Counts only — no recipient details or provider secrets." action={jobs.data && <span className="text-[11px] text-muted-foreground">Checked {formatTime(jobs.data.generatedAt)}</span>} />
        {jobs.error && <p role="alert" className="mx-5 mt-4 rounded-xl bg-danger-soft p-3 text-xs font-semibold text-danger-ink">Queue health could not be checked: {jobs.error}</p>}
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
          {([
            ["Photo analysis waiting", jobs.data?.photoQueued, false],
            ["Photo analysis needs attention", jobs.data?.photoExhausted, true],
            ["Voucher emails waiting", jobs.data?.voucherQueued, false],
            ["Voucher emails failed", jobs.data?.voucherFailed, true],
            ["Voucher emails over 15 min", jobs.data?.voucherOverdue, true],
          ] as const).map(([label, value, critical]) => (
            <div key={label} className="adm-inset p-4">
              <p className="text-[11px] leading-4 text-muted-foreground">{label}</p>
              <strong className={`adm-num mt-2 block text-2xl ${critical && value ? "text-danger-ink" : ""}`}>{value ?? "—"}</strong>
            </div>
          ))}
        </div>
      </Card>
      <Card className="mt-5 overflow-hidden">
        <CardHeader eyebrow="Latest client exceptions" title="Repeated browser issues" description="The latest events from the last 24 hours, grouped by page and message." />
        {health.error && <p className="mx-5 mt-4 rounded-xl bg-danger-soft p-3 text-xs font-semibold text-danger-ink">Health data could not be refreshed: {health.error}</p>}
        <div className="grid gap-2.5 p-5">
          {errorGroups.map((event) => (
            <article key={`${event.path}-${event.message}`} className="adm-inset flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold">{event.message}</p>
                <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{event.path || "Page unavailable"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1.5">
                <Pill tone="warning">{plural(event.count, "event")}</Pill>
                <time className="text-[11px] text-muted-foreground" dateTime={event.created_at}>{formatDateTime(event.created_at)}</time>
              </div>
            </article>
          ))}
          {!loading && !errorGroups.length && !health.error && (
            <div className="flex items-center gap-3 rounded-2xl bg-success-soft p-4 text-sm text-success-ink">
              <ServerCog size={18} />
              <div>
                <b>No browser exceptions recorded in the last 24 hours.</b>
                <p className="mt-0.5 text-xs">The monitored sample is clear.</p>
              </div>
            </div>
          )}
          {loading && !data && [0, 1].map((row) => <Skeleton key={row} className="h-16 w-full" />)}
        </div>
      </Card>
    </AdminShell>
  );
}

export function Admin() {
  return <AdminOverview />;
}

