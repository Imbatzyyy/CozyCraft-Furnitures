import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  createBrowserRouter,
  Link,
  RouterProvider,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Archive,
  Bell,
  Boxes,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock,
  ClipboardList,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FileText,
  Grid2X2,
  Heart,
  ImagePlus,
  LayoutDashboard,
  List,
  LockKeyhole,
  MessageCircle,
  LogOut,
  Menu,
  Minus,
  MoreHorizontal,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Printer,
  Search,
  ServerCog,
  Settings,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Star,
  Tag,
  Trash2,
  Upload,
  UserRound,
  Users,
  Warehouse,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { ResilientImage } from "@/components/media/ResilientImage";
import { primaryProductImage } from "@/lib/catalog/product-images";
import { privateAvatarUrls } from "@/lib/shared/avatar-url";
import cozyCraftLogo from "@/assets/branding/cozycraft-logo.png";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  isStaffRole,
  safeFileName,
  adminSupabase as supabase,
  type DbBillingProfile,
  type DbCustomerProfile,
  type DbOrder,
  type DbProduct,
  type DbRole,
  type DbSupportTicket,
} from "@/services/supabase/client";
import { canManageFinancialOperations } from "@/lib/admin/access";
import {
  ADMIN_ORDER_VIEW_OPTIONS,
  ADMIN_ORDERS_PER_PAGE,
  DEFAULT_ADMIN_ORDER_FILTERS,
  adminOrderSelectionParams,
  countAdminOrderView,
  filterAdminOrders,
  hasActiveAdminOrderFilters,
  paginateAdminOrders,
  type AdminOrderDateRange,
  type AdminOrderDeskFilters,
  type AdminOrderSort,
  type AdminOrderView,
} from "@/lib/admin/order-desk";
import { buildAdminAttentionItems } from "@/lib/admin/operations-attention";
import { buildPackingListData } from "@/lib/admin/packing-list";
import {
  buildOperationsHealthSnapshot,
  type ClientErrorSummary,
} from "@/lib/admin/operations-health";

import {
  Product,
  fallbackProducts,
  CartLine,
  Address,
  Store,
  StoreContext,
  AdminRole,
  AdminSession,
  AdminSessionContext,
  useAdminSession,
  money,
  materialFor,
  subcategoryFor,
  useStore,
  Logo,
  Header,
  Layout,
  ProductCard,
  Empty,
  ConfirmSignOut,
  Status,
  ManagedProduct,
  Toast,
  Metric,
  Splash,
  ShopSignInPrompt
} from "@/app/core";

import { AdminShell } from "@/features/admin/shell/AdminShell";
import { allowedFulfillmentStatuses, currentPaymentTransaction } from "@/lib/commerce/order-workflow";
import { allowedReturnStatuses, type ReturnStatus } from "@/lib/commerce/return-workflow";
import {
  customerLifetimeValue,
  isSettledSale,
  reportRangeStart,
  settledRevenue,
  type AdminReportRange,
} from "@/lib/admin/metrics";

export function AdminOverview() {
  const { orders, adminProducts, supportTickets, refreshOrders } = useStore();
  const { user, role } = useAdminSession();
  const [now, setNow] = useState(() => new Date());
  const firstName = user?.trim().split(/\s+/)[0] || "there";
  const philippineHour = Number(
    new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
  const greeting =
    philippineHour < 12
      ? "Good morning"
      : philippineHour < 18
        ? "Good afternoon"
        : "Good evening";
  const philippineDate = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
    .format(now)
    .toUpperCase();
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    void refreshOrders();
  }, [refreshOrders]);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthOrders = orders.filter(
    (order) => new Date(order.created_at) >= monthStart,
  );
  const sales = settledRevenue(orders);
  const pending = orders.filter(order=>order.status==="pending").length;
  const lowStock = adminProducts.filter(product=>(product.stockQuantity??0)<=8).length;
  const attentionItems = buildAdminAttentionItems({
    orders,
    products: adminProducts,
    tickets: supportTickets,
    role,
  });
  const openAttentionCount = attentionItems.reduce(
    (sum, item) => sum + item.count,
    0,
  );
  const salesData = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (6 - index), 1);
    const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return {
      m: date.toLocaleDateString("en-PH", { month: "short" }),
      v: orders
        .filter(
          (order) =>
            isSettledSale(order) &&
            new Date(order.created_at) >= date &&
            new Date(order.created_at) < next,
        )
        .reduce((sum, order) => sum + Number(order.total), 0),
    };
  });
  const statusRows = [
    ["Delivered", monthOrders.filter((order) => order.status === "delivered").length, "bg-[#68805f]"],
    ["Processing", monthOrders.filter((order) => ["processing", "packed", "shipped"].includes(order.status)).length, "bg-[#b8a58d]"],
    ["Pending", monthOrders.filter((order) => order.status === "pending").length, "bg-[#d39a64]"],
    ["Cancelled", monthOrders.filter((order) => order.status === "cancelled").length, "bg-[#bbb5ac]"],
  ] as const;
  const maxStatus = Math.max(1, ...statusRows.map((row) => row[1]));
  return (
    <AdminShell title="Overview">
      <section className="relative overflow-hidden rounded-3xl bg-[#25221f] px-6 py-7 text-[#f4f2ee] shadow-[0_18px_40px_rgba(33,31,29,.16)] sm:px-8">
        <div className="absolute -right-10 -top-12 h-48 w-48 rounded-full bg-[#b8a58d]/20" />
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-bold tracking-[.18em] text-[#d8c7b0]">
              {philippineDate}
            </p>
            <h2 className="mt-3 font-[Playfair_Display] text-4xl tracking-[-.04em]">
              {greeting}, {firstName}.
            </h2>
            <p className="mt-2 text-sm text-[#f4f2ee]/65">
              A clear view of today’s orders, inventory, and sales momentum.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/admin/inventory"
              className="rounded-xl border border-white/25 bg-white/8 px-3.5 py-2.5 text-sm font-semibold"
            >
              Update stock
            </Link>
            <Link
              to="/admin/products/new"
              className="inline-flex items-center gap-2 rounded-xl bg-[#f4f2ee] px-3.5 py-2.5 text-sm font-semibold text-foreground"
            >
              <PackagePlus size={16} />
              Add product
            </Link>
          </div>
        </div>
      </section>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Total sales"
          value={money(sales)}
          note="Paid, non-cancelled orders"
        />
        <Metric
          label="Orders this month"
          value={String(monthOrders.length)}
          note="Live storefront orders"
        />
        <Metric label="Pending orders" value={String(pending)} note="Requires attention" />
        <Metric label="Low-stock products" value={String(lowStock)} note="Review inventory" />
      </div>
      <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-[10px] font-bold tracking-[.17em] text-muted-foreground">
              ACTION CENTER
            </p>
            <h3 className="mt-1 text-xl font-semibold">What needs attention now</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Prioritized from the live order, inventory, and support records already loaded in this workspace.
            </p>
          </div>
          <span className={`w-fit rounded-full px-3 py-1.5 text-[11px] font-semibold ${openAttentionCount ? "bg-[#f2e8d7] text-[#765d3c]" : "bg-[#e5eee1] text-[#45603f]"}`}>
            {openAttentionCount ? `${openAttentionCount} open actions` : "All caught up"}
          </span>
        </div>
        <div className="grid gap-px bg-border [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
          {attentionItems.map((item) => (
            <Link
              key={item.id}
              to={item.route}
              className="group flex min-h-40 flex-col justify-between bg-card p-5 transition hover:bg-secondary/55"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-semibold">{item.label}</span>
                <span className={`grid h-9 min-w-9 place-items-center rounded-full px-2 text-sm font-bold ${item.count === 0 ? "bg-secondary text-muted-foreground" : item.level === "critical" ? "bg-[#f2dfd8] text-[#8f4f38]" : item.level === "warning" ? "bg-[#f2e8d7] text-[#765d3c]" : "bg-foreground text-background"}`}>
                  {item.count}
                </span>
              </div>
              <div>
                <p className="mt-5 text-xs leading-5 text-muted-foreground">{item.description}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold underline-offset-4 group-hover:underline">
                  Open workspace <ArrowRight size={13}/>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_.85fr]">
        <section className="border border-border bg-card p-5">
          <div className="flex justify-between">
            <div>
              <h3 className="font-semibold">Sales performance</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Revenue · last 7 months
              </p>
            </div>
            <button className="text-xs font-semibold">
              This year <ChevronDown className="inline" size={14} />
            </button>
          </div>
          <div className="mt-6 h-[245px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData}>
                <defs>
                  <linearGradient id="adminSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#b8a58d" stopOpacity=".45" />
                    <stop offset="100%" stopColor="#b8a58d" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="m"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#706d67" }}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    border: "1px solid #ded9d0",
                    borderRadius: 0,
                  }}
                />
                <Area
                  dataKey="v"
                  stroke="#211f1d"
                  strokeWidth={2}
                  fill="url(#adminSales)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="border border-border bg-card p-5">
          <h3 className="font-semibold">Order status</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {monthOrders.length} orders this month
          </p>
          <div className="mt-7 grid gap-4">
            {statusRows.map(([label, value, color]) => (
              <div key={label}>
                <div className="mb-2 flex justify-between text-xs">
                  <span>{label}</span>
                  <b>{value}</b>
                </div>
                <div className="h-1.5 bg-secondary">
                  <div
                    className={`h-full ${color}`}
                    style={{ width: `${(value / maxStatus) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_.85fr]">
        <RecentOrders />
        <section className="border border-border bg-[#ece7df] p-5">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#d8c7b0]">
            <Warehouse size={17} />
          </span>
          <p className="mt-5 text-sm font-semibold">Inventory needs a look.</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {lowStock} {lowStock === 1 ? "piece is" : "pieces are"} nearing the reorder point.
          </p>
          <Link
            to="/admin/inventory"
            className="mt-6 inline-flex text-sm font-semibold underline underline-offset-4"
          >
            Review low stock
          </Link>
        </section>
      </div>
    </AdminShell>
  );
}

export function RecentOrders() {
  const { orders } = useStore();
  return <section className="overflow-hidden border border-border bg-card"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h3 className="font-semibold">Recent orders</h3><p className="mt-1 text-xs text-muted-foreground">Live customer purchases</p></div><Link to="/admin/orders" className="text-xs font-semibold underline underline-offset-4">View all</Link></div><div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm"><thead className="bg-[#faf9f6] text-[10px] tracking-[.1em] text-muted-foreground"><tr><th className="px-5 py-3">ORDER</th><th>CUSTOMER</th><th>TOTAL</th><th>STATUS</th></tr></thead><tbody>{orders.slice(0,5).map(order=><tr className="border-t border-border" key={order.id}><td className="px-5 py-4 text-xs font-semibold">#{order.order_number}</td><td className="py-4 text-xs">{order.shipping_address.name||"Customer"}</td><td className="py-4 text-xs">{money(Number(order.total))}</td><td className="py-4"><Status>{order.status}</Status></td></tr>)}</tbody></table>{!orders.length&&<p className="p-6 text-center text-sm text-muted-foreground">No orders yet.</p>}</div></section>;
}

export function SystemHealthPage() {
  const {
    orders,
    adminProducts,
    supportTickets,
    ordersRealtimeConnected,
    refreshOrders,
    refreshTickets,
  } = useStore();
  const [clientErrors, setClientErrors] = useState<ClientErrorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  const loadClientErrors = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("client_error_events")
      .select("id,message,path,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      setLoadError(error.message);
    } else {
      setClientErrors((data ?? []) as ClientErrorSummary[]);
      setLastCheckedAt(new Date());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadClientErrors();
  }, [loadClientErrors]);

  const refreshHealth = async () => {
    setLoading(true);
    const [orderIssue] = await Promise.all([
      refreshOrders(),
      refreshTickets(),
      loadClientErrors(),
    ]);
    if (orderIssue) setLoadError(orderIssue);
    setLastCheckedAt(new Date());
    setLoading(false);
  };

  const snapshot = useMemo(
    () =>
      buildOperationsHealthSnapshot({
        orders,
        products: adminProducts,
        tickets: supportTickets,
        clientErrors,
        liveOrdersConnected: ordersRealtimeConnected,
      }),
    [adminProducts, clientErrors, orders, ordersRealtimeConnected, supportTickets],
  );
  const errorGroups = useMemo(() => {
    const groups = new Map<
      string,
      ClientErrorSummary & { count: number }
    >();
    clientErrors.forEach((event) => {
      const key = `${event.path ?? "unknown"}|${event.message}`;
      const current = groups.get(key);
      if (current) current.count += 1;
      else groups.set(key, { ...event, count: 1 });
    });
    return Array.from(groups.values()).slice(0, 8);
  }, [clientErrors]);
  const statusTone =
    snapshot.overall === "healthy"
      ? "bg-[#e5eee1] text-[#45603f]"
      : snapshot.overall === "degraded"
        ? "bg-[#f2dfd8] text-[#8f4f38]"
        : "bg-[#f2e8d7] text-[#765d3c]";
  const cards = [
    {
      label: "Live order sync",
      value: snapshot.liveOrdersConnected ? "Connected" : "Reconnecting",
      note: "Storefront changes flowing into fulfillment.",
      route: "/admin/orders",
      attention: !snapshot.liveOrdersConnected,
      icon: snapshot.liveOrdersConnected ? Wifi : WifiOff,
    },
    {
      label: "Payment exceptions",
      value: String(snapshot.failedPayments + snapshot.failedRefunds),
      note: `${snapshot.failedPayments} failed payments · ${snapshot.failedRefunds} failed refunds`,
      route: snapshot.failedRefunds ? "/admin/orders?view=refund_attention&range=all" : "/admin/payments",
      attention: snapshot.failedPayments + snapshot.failedRefunds > 0,
      icon: CreditCard,
    },
    {
      label: "48-hour backlog",
      value: String(snapshot.overdueFulfillment),
      note: "Pending, processing, or packed orders older than 48 hours.",
      route: "/admin/orders?view=needs_fulfillment&range=all&sort=longest_waiting",
      attention: snapshot.overdueFulfillment > 0,
      icon: Clock,
    },
    {
      label: "Priority support",
      value: String(snapshot.priorityTickets),
      note: "Open high and urgent customer tickets.",
      route: "/admin/support",
      attention: snapshot.priorityTickets > 0,
      icon: MessageCircle,
    },
    {
      label: "Out of stock",
      value: String(snapshot.outOfStockProducts),
      note: "Visible or draft products currently at zero units.",
      route: "/admin/inventory",
      attention: snapshot.outOfStockProducts > 0,
      icon: Warehouse,
    },
    {
      label: "Browser errors · 24h",
      value: String(snapshot.recentClientErrors),
      note: "A bounded sample of the latest customer and admin UI errors.",
      route: "/admin/activity-logs",
      attention: snapshot.recentClientErrors > 0,
      icon: AlertTriangle,
    },
  ];

  return (
    <AdminShell title="Operations health">
      <section className="overflow-hidden rounded-3xl bg-[#25221f] px-6 py-7 text-[#f4f2ee] shadow-[0_18px_40px_rgba(33,31,29,.16)] sm:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ServerCog size={17} className="text-[#d8c7b0]"/>
              <p className="text-[10px] font-bold tracking-[.18em] text-[#d8c7b0]">OPERATIONS HEALTH</p>
            </div>
            <h2 className="mt-3 font-[Playfair_Display] text-4xl tracking-[-.04em]">Know what needs intervention.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#f4f2ee]/65">
              A compact exception view using existing order, support, inventory, realtime, and client-error records.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-2 text-xs font-semibold capitalize ${statusTone}`}>
              {snapshot.overall === "healthy" ? "All systems healthy" : `${snapshot.overall} required`}
            </span>
            <button
              type="button"
              onClick={() => void refreshHealth()}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 px-4 text-xs font-semibold disabled:opacity-50"
            >
              <Activity size={14} className={loading ? "animate-pulse" : ""}/>
              {loading ? "Checking…" : "Refresh now"}
            </button>
          </div>
        </div>
      </section>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.label} to={card.route} className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${card.attention ? "bg-[#f2e8d7] text-[#765d3c]" : "bg-[#e5eee1] text-[#45603f]"}`}>
                <card.icon size={17}/>
              </span>
              <span className="text-2xl font-semibold">{card.value}</span>
            </div>
            <h3 className="mt-5 text-sm font-semibold">{card.label}</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{card.note}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold group-hover:underline">Inspect <ArrowRight size={13}/></span>
          </Link>
        ))}
      </div>
      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-2 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">LATEST CLIENT EXCEPTIONS</p>
            <h3 className="mt-1 text-lg font-semibold">Repeated browser issues</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Only the latest 30 events from the last 24 hours are requested, grouped locally to keep database egress controlled.
            </p>
          </div>
          {lastCheckedAt && <time className="text-[11px] text-muted-foreground" dateTime={lastCheckedAt.toISOString()}>Checked {lastCheckedAt.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}</time>}
        </div>
        {loadError && <p className="mt-4 rounded-xl bg-[#f3e5d4] p-3 text-xs font-semibold text-[#8b5c46]">Health data could not be refreshed: {loadError}</p>}
        <div className="mt-5 grid gap-3">
          {errorGroups.map((event) => (
            <article key={`${event.path}-${event.message}`} className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/35 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold">{event.message}</p>
                <p className="mt-1 break-all text-xs text-muted-foreground">{event.path || "Page unavailable"}</p>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <span className="rounded-full bg-card px-2.5 py-1 text-[10px] font-bold">{event.count} event{event.count === 1 ? "" : "s"}</span>
                <time className="mt-2 block text-[10px] text-muted-foreground" dateTime={event.created_at}>{new Date(event.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}</time>
              </div>
            </article>
          ))}
          {!loading && !errorGroups.length && !loadError && (
            <div className="rounded-xl bg-[#e5eee1] p-5 text-sm text-[#45603f]">
              <b>No browser exceptions recorded in the last 24 hours.</b>
              <p className="mt-1 text-xs">The bounded health sample is clear.</p>
            </div>
          )}
        </div>
      </section>
    </AdminShell>
  );
}

export function AdminRecordList({ kind }: { kind: string }) {
  const { products } = useStore();
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const name = kind.charAt(0).toUpperCase() + kind.slice(1);
  const records =
    kind === "products"
      ? products.map((p, i) => ({
          title: p.name,
          detail: `${p.category} · ${p.color}`,
          amount: money(p.price),
          state: i === 1 ? "Low stock" : "Active",
          image: primaryProductImage(p),
        }))
      : kind === "orders"
        ? [
            ["#CC-2026-0814", "Althea Cruz · 3 items", "₱42,700", "Processing"],
            ["#CC-2026-0813", "Julian Santos · 1 item", "₱18,900", "Completed"],
            ["#CC-2026-0812", "Mika Tan · 2 items", "₱30,500", "Pending"],
          ].map((x) => ({
            title: x[0],
            detail: x[1],
            amount: x[2],
            state: x[3],
          }))
        : [
            ["Luna Reyes", "luna@email.com", "₱72,300", "Active"],
            ["Carlos Lim", "carlos@email.com", "₱43,900", "Active"],
            ["Elena Cruz", "elena@email.com", "₱19,800", "Active"],
          ].map((x) => ({
            title: x[0],
            detail: x[1],
            amount: x[2],
            state: x[3],
          }));
  const shown = records.filter((r) =>
    r.title.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <AdminShell title={name}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs text-muted-foreground">Operations</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-[-.04em]">
            {name}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage every {kind} record from one considered workspace.
          </p>
        </div>
        <button
          onClick={() => setNotice(`${name.slice(0, -1)} draft created.`)}
          className="inline-flex w-fit items-center gap-2 rounded-xl bg-foreground px-3.5 py-2.5 text-sm font-semibold text-background"
        >
          <Plus size={16} />
          Add {name.slice(0, -1)}
        </button>
      </div>
      <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_8px_25px_rgba(33,31,29,.035)]">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row">
          <label className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3">
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 w-full bg-transparent text-sm outline-none"
              placeholder={`Search ${kind}`}
            />
          </label>
          <button className="inline-flex items-center justify-center gap-2 border border-border px-3 text-xs">
            <SlidersHorizontal size={15} />
            Filters
          </button>
          <button className="inline-flex items-center justify-center gap-2 border border-border px-3 text-xs">
            <Download size={15} />
            Export
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead className="bg-[#faf9f6] text-[10px] tracking-[.1em] text-muted-foreground">
              <tr>
                <th className="px-5 py-3">RECORD</th>
                <th>DETAILS</th>
                <th>VALUE</th>
                <th>STATUS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((r: any) => (
                <tr className="border-t border-border" key={r.title}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {r.image && (
                        <ResilientImage
                          src={r.image}
                          alt=""
                          className="h-10 w-10 object-cover"
                        />
                      )}
                      <b className="text-sm">{r.title}</b>
                    </div>
                  </td>
                  <td className="py-3 text-xs text-muted-foreground">
                    {r.detail}
                  </td>
                  <td className="py-3 text-xs">{r.amount}</td>
                  <td className="py-3">
                    <Status>{r.state}</Status>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => setNotice(`${r.title} opened for review.`)}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shown.length === 0 && (
          <div className="p-16 text-center text-sm text-muted-foreground">
            No matching {kind} found.
          </div>
        )}
      </section>
      {notice && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#201f1d] px-4 py-3 text-sm text-white">
          <Check size={16} />
          {notice}
          <button onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </AdminShell>
  );
}

export const moduleContent = {
  categories: {
    title: "Categories",
    icon: Boxes,
    eyebrow: "CATALOG STRUCTURE",
    description: "Organize every room, collection, and shoppable product type.",
    action: "Add category",
    stats: [
      ["3", "Room categories"],
      ["9", "Primary groups"],
      ["45", "Subcategories"],
    ],
    rows: [
      ["Living Room", "3 groups · 15 types", "Active"],
      ["Bedroom", "3 groups · 15 types", "Active"],
      ["Dining Room", "3 groups · 15 types", "Active"],
    ],
  },
  inventory: {
    title: "Inventory",
    icon: Warehouse,
    eyebrow: "STOCK CONTROL",
    description:
      "Monitor availability, reorder points, and latest stock movements.",
    action: "Adjust stock",
    stats: [
      ["128", "Units on hand"],
      ["7", "Below reorder point"],
      ["2", "Out of stock"],
    ],
    rows: [
      ["Mara Lounge Chair", "4 units · reorder at 6", "Low stock"],
      ["Lino Oak Console", "9 units · reorder at 4", "Active"],
      ["Santo Bed Frame", "0 units · reorder at 3", "Out of stock"],
    ],
  },
  payments: {
    title: "Payments",
    icon: CircleDollarSign,
    eyebrow: "FINANCIAL CONTROL",
    description:
      "Review payment status, settlement timing, and recent transaction activity.",
    action: "Export payments",
    stats: [
      ["₱248,500", "Collected this month"],
      ["₱34,200", "Awaiting settlement"],
      ["98.4%", "Successful payments"],
    ],
    rows: [
      ["PAY-10482", "Order #CC-2026-0814 · Visa", "Paid"],
      ["PAY-10479", "Order #CC-2026-0812 · GCash", "Pending"],
      ["PAY-10475", "Order #CC-2026-0808 · Mastercard", "Paid"],
    ],
  },
  reviews: {
    title: "Reviews",
    icon: Star,
    eyebrow: "CUSTOMER VOICE",
    description:
      "Monitor automatically published feedback and protect the quality of the CozyCraft catalog.",
    action: "Review feedback",
    stats: [
      ["184", "Visible reviews"],
      ["12", "With customer photos"],
      ["4.8", "Average rating"],
    ],
    rows: [
      ["Mara Lounge Chair", "Luna Reyes · 5 stars", "Visible"],
      ["Arco Dining Table", "Jerome Lim · 5 stars", "Visible"],
      ["Santo Bed Frame", "Elena Cruz · 4 stars", "Visible"],
    ],
  },
  reports: {
    title: "Reports",
    icon: ChartNoAxesCombined,
    eyebrow: "REPORTING",
    description:
      "Generate clear, export-ready views of sales, catalog, and inventory health.",
    action: "Generate report",
    stats: [
      ["₱248,500", "Sales this month"],
      ["126", "Orders this month"],
      ["38", "Products sold"],
    ],
    rows: [
      ["Monthly sales", "Jun 1 — Jun 30", "Ready"],
      ["Inventory status", "Current stock position", "Ready"],
      ["Product performance", "Last 90 days", "Ready"],
    ],
  },
  "activity-logs": {
    title: "Activity logs",
    icon: Activity,
    eyebrow: "AUDIT TRAIL",
    description:
      "A clear record of the operational changes made across the store.",
    action: "Export log",
    stats: [
      ["42", "Actions this week"],
      ["5", "Administrators"],
      ["0", "Unresolved flags"],
    ],
    rows: [
      ["Mara Mendoza", "Adjusted Mara Lounge Chair inventory", "Today · 09:42"],
      ["Jules Santos", "Reviewed customer feedback", "Today · 08:15"],
      [
        "Mara Mendoza",
        "Published Lino Oak Console update",
        "Yesterday · 16:20",
      ],
    ],
  },
  settings: {
    title: "Settings",
    icon: Settings,
    eyebrow: "STORE PREFERENCES",
    description:
      "Manage the defaults and operational rules behind the CozyCraft storefront.",
    action: "Save settings",
    stats: [
      ["Metro Manila", "Delivery zone"],
      ["8 units", "Default reorder point"],
      ["5", "Operations members"],
    ],
    rows: [
      ["Store information", "CozyCraft Furnitures · Est. 2026", "Ready"],
      ["Delivery & fulfillment", "Metro Manila delivery enabled", "Active"],
      ["Security & access", "Role permissions enabled", "Active"],
    ],
  },
} as const;

export function OrdersPage() {
  const { orders, updateOrderStatus, refreshOrders } = useStore();
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(()=>{ void refreshOrders(); },[refreshOrders]);
  useEffect(()=>{
    if (!orders.length) {
      if (selectedId) setSelectedId("");
      return;
    }
    if (!orders.some((order) => order.id === selectedId)) setSelectedId(orders[0].id);
  },[orders,selectedId]);
  const selected=orders.find(order=>order.id===selectedId)??orders[0];
  const update=async(status:DbOrder["status"])=>{if(!selected)return;const issue=await updateOrderStatus(selected.id,status);setNotice(issue??("Order "+selected.order_number+" updated to "+status+"."));};
  return <AdminShell title="Orders"><div className="flex flex-wrap justify-between gap-4"><div><p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">LIVE FULFILLMENT</p><h2 className="mt-2 text-3xl font-semibold">Customer orders</h2><p className="mt-2 text-sm text-muted-foreground">Orders placed at checkout appear here immediately.</p></div><div className="rounded-xl bg-card px-4 py-3 text-sm shadow-sm"><b>{orders.length}</b> total orders</div></div>{!selected?<div className="mt-7 rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">No customer orders yet.</div>:<div className="mt-7 grid gap-5 xl:grid-cols-[.8fr_1.2fr]"><section className="overflow-hidden rounded-2xl border border-border bg-card">{orders.map(order=>{const addr=order.shipping_address;return <button key={order.id} onClick={()=>setSelectedId(order.id)} className={"flex w-full items-center justify-between border-b border-border p-4 text-left "+(selected.id===order.id?"bg-secondary":"hover:bg-secondary")}><span><b className="text-sm">#{order.order_number}</b><span className="mt-1 block text-xs text-muted-foreground">{addr.name||"Customer"} · {new Date(order.created_at).toLocaleDateString("en-PH")}</span></span><span className="text-right"><Status>{order.status}</Status><b className="mt-2 block text-xs">{money(Number(order.total))}</b></span></button>})}</section><section className="rounded-2xl border border-border bg-card p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs text-muted-foreground">ORDER #{selected.order_number}</p><h3 className="mt-2 font-serif text-3xl">{selected.shipping_address.name||"Customer"}</h3><p className="mt-2 text-sm text-muted-foreground">{selected.shipping_address.email} · {selected.shipping_address.mobile}</p></div><Status>{selected.status}</Status></div><div className="mt-6 rounded-xl bg-secondary p-4 text-sm"><b>Deliver to</b><p className="mt-2 text-muted-foreground">{[selected.shipping_address.line,selected.shipping_address.barangay,selected.shipping_address.city,selected.shipping_address.province,selected.shipping_address.postal].filter(Boolean).join(", ")}</p></div><div className="mt-6 divide-y divide-border border-y border-border">{selected.order_items.map(item=><div key={item.id} className="flex justify-between py-3 text-sm"><span>{item.product_name} × {item.quantity}</span><b>{money(Number(item.unit_price)*item.quantity)}</b></div>)}</div><div className="mt-5 flex justify-between text-lg font-semibold"><span>Total</span><span>{money(Number(selected.total))}</span></div><label className="mt-6 grid gap-2 text-sm font-semibold">Update fulfillment status<select value={selected.status} onChange={e=>void update(e.target.value as DbOrder["status"])} className="h-11 rounded-xl border border-border bg-card px-3 font-normal">{allowedFulfillmentStatuses(selected.status).filter(status=>status!=="cancelled").map(status=><option key={status} value={status}>{status[0].toUpperCase()+status.slice(1)}</option>)}</select></label></section></div>}{notice&&<Toast message={notice} close={()=>setNotice("")}/>}</AdminShell>;
}

const adminOrderStatuses: Array<DbOrder["status"]> = [
  "pending",
  "processing",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
];
const adminPaymentStatuses: Array<DbOrder["payment_status"]> = [
  "pending",
  "paid",
  "failed",
  "refunded",
];
const adminOrderViews = new Set<AdminOrderView>(
  ADMIN_ORDER_VIEW_OPTIONS.map((option) => option.id),
);
const adminOrderDateRanges = new Set<AdminOrderDateRange>([
  "all",
  "today",
  "last_7_days",
  "last_30_days",
]);
const adminOrderSorts = new Set<AdminOrderSort>([
  "newest",
  "oldest",
  "highest_total",
  "longest_waiting",
]);
const adminOrderTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  hour: "numeric",
  minute: "2-digit",
});
const adminOrderDateFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function adminOrderFiltersFromParams(params: URLSearchParams): AdminOrderDeskFilters {
  const view = params.get("view") as AdminOrderView | null;
  const status = params.get("status") as DbOrder["status"] | null;
  const paymentStatus = params.get("payment") as DbOrder["payment_status"] | null;
  const dateRange = params.get("range") as AdminOrderDateRange | null;
  const sort = params.get("sort") as AdminOrderSort | null;
  const historicalQueueLink =
    !dateRange && (params.has("order") || params.has("view"));
  return {
    query: params.get("q") ?? "",
    view: view && adminOrderViews.has(view) ? view : DEFAULT_ADMIN_ORDER_FILTERS.view,
    status: status && adminOrderStatuses.includes(status) ? status : "all",
    paymentStatus:
      paymentStatus && adminPaymentStatuses.includes(paymentStatus)
        ? paymentStatus
        : "all",
    paymentMethod: params.get("method") || "all",
    dateRange:
      dateRange && adminOrderDateRanges.has(dateRange)
        ? dateRange
        : historicalQueueLink
          ? "all"
          : DEFAULT_ADMIN_ORDER_FILTERS.dateRange,
    sort: sort && adminOrderSorts.has(sort) ? sort : DEFAULT_ADMIN_ORDER_FILTERS.sort,
  };
}

function AdminPackingList({
  order,
  printedAt,
}: {
  order: DbOrder;
  printedAt: Date;
}) {
  const packingList = buildPackingListData(order, printedAt);
  return createPortal(
    <section
      className="admin-packing-list"
      aria-hidden="true"
      data-order-number={packingList.orderNumber}
    >
      <header className="admin-packing-list__header">
        <div>
          <img
            src={cozyCraftLogo}
            alt="CozyCraft Furnitures"
            className="admin-packing-list__logo"
          />
          <p className="admin-packing-list__eyebrow">FULFILLMENT DOCUMENT</p>
          <h1>Packing list</h1>
        </div>
        <div className="admin-packing-list__order-number">
          <span>ORDER</span>
          <strong>#{packingList.orderNumber}</strong>
        </div>
      </header>

      <div className="admin-packing-list__meta">
        <div>
          <span>Placed</span>
          <strong>
            {new Date(packingList.placedAt).toLocaleString("en-PH", {
              timeZone: "Asia/Manila",
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </strong>
        </div>
        <div>
          <span>Payment</span>
          <strong>{packingList.paymentSummary}</strong>
        </div>
        <div>
          <span>Contents</span>
          <strong>
            {packingList.itemCount} {packingList.itemCount === 1 ? "line" : "lines"} ·{" "}
            {packingList.unitCount} {packingList.unitCount === 1 ? "unit" : "units"}
          </strong>
        </div>
        <div>
          <span>Printed</span>
          <strong>
            {new Date(packingList.printedAt).toLocaleString("en-PH", {
              timeZone: "Asia/Manila",
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </strong>
        </div>
      </div>

      <section className="admin-packing-list__delivery">
        <div>
          <p className="admin-packing-list__eyebrow">DELIVER TO</p>
          <h2>{packingList.customerName}</h2>
          <p>{packingList.deliveryAddress}</p>
        </div>
        <dl>
          <div>
            <dt>Mobile</dt>
            <dd>{packingList.customerMobile}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{packingList.customerEmail}</dd>
          </div>
        </dl>
      </section>

      <table className="admin-packing-list__items">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Product</th>
            <th scope="col">Product ID</th>
            <th scope="col">Qty</th>
            <th scope="col">Packed</th>
          </tr>
        </thead>
        <tbody>
          {packingList.lines.map((line) => (
            <tr key={`${line.id}-${line.productId}`}>
              <td>{line.id}</td>
              <td><strong>{line.productName}</strong></td>
              <td>{line.productId}</td>
              <td><strong>{line.quantity}</strong></td>
              <td><span className="admin-packing-list__checkbox" /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="admin-packing-list__note">
        <p className="admin-packing-list__eyebrow">DELIVERY NOTE</p>
        <p>{packingList.deliveryNote}</p>
      </section>

      <footer className="admin-packing-list__footer">
        <div><span>Prepared by</span><i /></div>
        <div><span>Checked by</span><i /></div>
        <div><span>Date / time</span><i /></div>
        <p>
          Internal CozyCraft fulfillment document · Reference {packingList.orderId}
        </p>
      </footer>
    </section>,
    document.body,
  );
}

export function OrdersWorkspacePage() {
  const {
    orders,
    ordersRealtimeConnected,
    storeSettings,
    updateOrderStatus,
    cancelOrder,
    refreshOrders,
  } = useStore();
  const {
    role: workspaceRole,
    authReady: adminAuthReady,
    userId: adminUserId,
  } = useAdminSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const canManageFinancials = canManageFinancialOperations(workspaceRole);
  const [selectedId, setSelectedId] = useState(() => searchParams.get("order") ?? "");
  const [notice, setNotice] = useState("");
  const [showCancellation, setShowCancellation] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [sendingRefundEmail, setSendingRefundEmail] = useState(false);
  const [orderPage, setOrderPage] = useState(1);
  const [returnRequests, setReturnRequests] = useState<Array<{id:string;order_id:string;return_number:string;reason:string;details:string;status:string;admin_note:string|null;evidence_paths:string[];created_at:string}>>([]);
  const [returnNote, setReturnNote] = useState("");
  const [processingReturnRefund, setProcessingReturnRefund] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersLoadError, setOrdersLoadError] = useState("");
  const [ordersReloadKey, setOrdersReloadKey] = useState(0);
  const [invoiceDownloadId, setInvoiceDownloadId] = useState<string | null>(null);
  const [packingListPrintedAt, setPackingListPrintedAt] = useState(() => new Date());
  const [deskNow, setDeskNow] = useState(() => new Date());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const ordersPerPage = ADMIN_ORDERS_PER_PAGE;
  const fulfillmentSteps: DbOrder["status"][] = [
    "pending",
    "processing",
    "packed",
    "shipped",
    "delivered",
  ];
  const searchParamsKey = searchParams.toString();
  const filters = useMemo(
    () => adminOrderFiltersFromParams(new URLSearchParams(searchParamsKey)),
    [searchParamsKey],
  );
  const returnOrderIds = useMemo(
    () => new Set(returnRequests.map((request) => request.order_id)),
    [returnRequests],
  );
  const filteredOrders = useMemo(
    () => filterAdminOrders(orders, filters, { returnOrderIds, now: deskNow }),
    [deskNow, filters, orders, returnOrderIds],
  );
  const todayOrders = useMemo(
    () =>
      filterAdminOrders(orders, DEFAULT_ADMIN_ORDER_FILTERS, {
        returnOrderIds,
        now: deskNow,
      }),
    [deskNow, orders, returnOrderIds],
  );
  const readyToFulfillCount = useMemo(
    () => countAdminOrderView(orders, "needs_fulfillment", returnOrderIds),
    [orders, returnOrderIds],
  );
  const awaitingPaymentCount = useMemo(
    () => countAdminOrderView(orders, "awaiting_payment", returnOrderIds),
    [orders, returnOrderIds],
  );
  const attentionCount = useMemo(
    () =>
      countAdminOrderView(orders, "cancellation_requests", returnOrderIds) +
      countAdminOrderView(orders, "refund_attention", returnOrderIds),
    [orders, returnOrderIds],
  );
  const todayQueueActive =
    filters.view === "all" && filters.dateRange === "today";
  const allOrdersActive =
    filters.view === "all" && filters.dateRange === "all";
  const activeFilterCount = [
    filters.status !== "all",
    filters.paymentStatus !== "all",
    filters.paymentMethod !== "all",
    filters.dateRange !== DEFAULT_ADMIN_ORDER_FILTERS.dateRange,
    filters.sort !== DEFAULT_ADMIN_ORDER_FILTERS.sort,
  ].filter(Boolean).length;
  const queueTitle = todayQueueActive
    ? "Today's order queue"
    : filters.view !== "all"
      ? ADMIN_ORDER_VIEW_OPTIONS.find((option) => option.id === filters.view)?.label ??
        "Filtered orders"
      : "All customer orders";
  const queueSortLabel =
    filters.sort === "oldest" || filters.sort === "longest_waiting"
      ? "First placed appears first"
      : filters.sort === "newest"
        ? "Most recent appears first"
        : "Highest total appears first";
  const manilaDateLabel = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(deskNow);
  const availablePaymentMethods = useMemo(
    () =>
      Array.from(
        new Set(orders.map((order) => order.payment_method.toLocaleLowerCase())),
      ).sort(),
    [orders],
  );
  const updateDeskParams = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(changes).forEach(([key, value]) => {
        if (!value) next.delete(key);
        else next.set(key, value);
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );
  const selectOrder = useCallback(
    (orderId: string) => {
      setSelectedId(orderId);
      setSearchParams(
        adminOrderSelectionParams(searchParams, orderId, filters.dateRange),
        { replace: true },
      );
    },
    [filters.dateRange, searchParams, setSearchParams],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setDeskNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!adminAuthReady) {
      setOrdersLoading(true);
      return;
    }
    if (!adminUserId) {
      setOrdersLoading(false);
      setOrdersLoadError("Your administrator session is not available. Please sign in again.");
      return;
    }
    let active = true;
    setOrdersLoading(true);
    setOrdersLoadError("");
    const timeout = window.setTimeout(() => {
      if (!active) return;
      setOrdersLoading(false);
      setOrdersLoadError("Orders are taking longer than expected. Check your connection and try again.");
    }, 8_000);
    void refreshOrders()
      .then((issue) => {
        if (!active) return;
        setOrdersLoadError(issue ?? "");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setOrdersLoadError(error instanceof Error ? error.message : "Orders could not be loaded.");
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (active) setOrdersLoading(false);
      });
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [adminAuthReady, adminUserId, ordersReloadKey, refreshOrders]);
  useEffect(() => {
    const refresh = async () => { const { data } = await supabase.from("return_requests").select("id,order_id,return_number,reason,details,status,admin_note,evidence_paths,created_at").order("created_at", { ascending:false }); setReturnRequests((data ?? []) as typeof returnRequests); };
    void refresh();
    const refreshVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    const channel = supabase.channel("admin-return-requests").on("postgres_changes", {event:"*",schema:"public",table:"return_requests"}, refresh).subscribe();
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => { window.removeEventListener("focus", refreshVisible); document.removeEventListener("visibilitychange", refreshVisible); void supabase.removeChannel(channel); };
  }, []);
  useEffect(() => {
    const requestedOrderId = searchParams.get("order");
    if (requestedOrderId && filteredOrders.some((order) => order.id === requestedOrderId)) {
      if (selectedId !== requestedOrderId) setSelectedId(requestedOrderId);
      return;
    }
    if (!filteredOrders.length) {
      if (selectedId) setSelectedId("");
      return;
    }
    if (!filteredOrders.some((order) => order.id === selectedId)) {
      setSelectedId(filteredOrders[0].id);
    }
  }, [filteredOrders, searchParams, selectedId]);

  const orderPageCount = Math.max(1, Math.ceil(filteredOrders.length / ordersPerPage));
  const visibleOrders = paginateAdminOrders(
    filteredOrders,
    orderPage,
    ordersPerPage,
  );
  useEffect(() => {
    setOrderPage(1);
  }, [
    filters.dateRange,
    filters.paymentMethod,
    filters.paymentStatus,
    filters.query,
    filters.sort,
    filters.status,
    filters.view,
  ]);
  useEffect(() => {
    if (orderPage > orderPageCount) setOrderPage(orderPageCount);
  }, [orderPage, orderPageCount]);
  const changeOrderPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), orderPageCount);
    setOrderPage(nextPage);
    const firstOrder = filteredOrders[(nextPage - 1) * ordersPerPage];
    if (firstOrder) selectOrder(firstOrder.id);
  };

  const selected =
    filteredOrders.find((order) => order.id === selectedId) ?? filteredOrders[0];
  const selectedPayment = currentPaymentTransaction(selected?.payment_transactions);
  const selectedReturn = selected ? returnRequests.find((request) => request.order_id === selected.id) : undefined;
  const downloadInvoice = async (order: DbOrder) => {
    if (order.status !== "delivered" || invoiceDownloadId) return;
    setInvoiceDownloadId(order.id);
    setNotice("");
    try {
      const { data: billingProfile, error: billingError } = await supabase
        .from("billing_profiles")
        .select(
          "user_id,recipient_name,company_name,tax_id,invoice_email,address_line,barangay,city,province,postal_code,same_as_delivery",
        )
        .eq("user_id", order.user_id)
        .maybeSingle();
      if (billingError) {
        throw new Error(
          "The customer's invoice details could not be loaded. Please try again.",
        );
      }

      const shipping = order.shipping_address;
      const fallbackBilling: DbBillingProfile = {
        user_id: order.user_id,
        recipient_name: shipping.name ?? order.profiles?.full_name ?? "",
        company_name: "",
        tax_id: "",
        invoice_email: shipping.email ?? order.profiles?.email ?? "",
        address_line: "",
        barangay: "",
        city: "",
        province: "",
        postal_code: "",
        same_as_delivery: true,
      };
      const { downloadOrderInvoicePdf } = await import(
        "@/lib/commerce/order-invoice"
      );
      await downloadOrderInvoicePdf({
        order,
        billing: (billingProfile as DbBillingProfile | null) ?? fallbackBilling,
        customer: {
          name: shipping.name ?? order.profiles?.full_name ?? "CozyCraft customer",
          email: shipping.email ?? order.profiles?.email ?? "",
          phone: shipping.mobile ?? order.profiles?.phone ?? "",
        },
        store: storeSettings,
      });
      setNotice(
        `Invoice receipt for #${order.order_number} downloaded successfully.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The invoice receipt could not be prepared. Please try again.",
      );
    } finally {
      setInvoiceDownloadId(null);
    }
  };
  const updateReturn = async (status:string) => {
    if (!selectedReturn) return;
    if (status === "refunded") {
      if (!canManageFinancials) {
        setNotice("An administrator must process financial refunds.");
        return;
      }
      if (!['item_received', 'refund_processing'].includes(selectedReturn.status)) {
        setNotice("Mark the returned item as received before processing its refund.");
        return;
      }
      setProcessingReturnRefund(true);
      const { data, error } = await supabase.functions.invoke("process-return-refund", {
        body: { returnId: selectedReturn.id },
      });
      setProcessingReturnRefund(false);
      setNotice(
        data?.error ?? error?.message ??
          (data?.demo
            ? `Return ${selectedReturn.return_number} was refunded in demo mode and inventory was restored.`
            : `Return ${selectedReturn.return_number} was refunded successfully and inventory was restored.`),
      );
      return;
    }
    const { error } = await supabase.from("return_requests").update({status,admin_note:returnNote.trim()||null,reviewed_at:new Date().toISOString()}).eq("id",selectedReturn.id);
    setNotice(error?.message ?? `Return ${selectedReturn.return_number} updated to ${status.replace(/_/g," ")}.`);
  };
  const openReturnEvidence = async (path:string) => {
    const { data, error } = await supabase.storage.from("return-evidence").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) { setNotice(error?.message ?? "Evidence could not be opened."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };
  const update = async (status: DbOrder["status"]) => {
    if (!selected) return;
    if (status === "cancelled") {
      if (!canManageFinancials) {
        setNotice("An administrator must approve order cancellations and refunds.");
        return;
      }
      setCancellationReason("");
      setShowCancellation(true);
      return;
    }
    const issue = await updateOrderStatus(selected.id, status);
    setNotice(
      issue ??
        `Order ${selected.order_number} is now ${status.replace(/_/g, " ")} across the customer and admin views.`,
    );
  };
  const confirmCancellation = async () => {
    if (!selected || cancellationReason.trim().length < 5) {
      setNotice("Please provide a clear cancellation reason.");
      return;
    }
    setCancelling(true);
    const issue = await cancelOrder(selected.id, cancellationReason);
    setCancelling(false);
    if (issue) {
      setNotice(issue);
      return;
    }
    setShowCancellation(false);
    setNotice(
      selected.payment_status === "paid" && selected.payment_method !== "cod"
        ? `Order ${selected.order_number} was safely cancelled and its ${selected.payment_method.toUpperCase()} refund was recorded.`
        : `Order ${selected.order_number} was cancelled and its inventory was restored.`,
    );
  };
  const rejectCancellationRequest = async () => {
    if (!selected || selected.cancellation_status !== "pending") return;
    if (!canManageFinancials) {
      setNotice("An administrator must review cancellation requests.");
      return;
    }
    setCancelling(true);
    const { data, error } = await supabase.functions.invoke("cancel-order", {
      body: {
        orderId: selected.id,
        action: "reject",
        reason: selected.cancellation_reason,
        note: cancellationReason.trim() || "The order is continuing through fulfillment.",
      },
    });
    setCancelling(false);
    if (error || data?.error) {
      setNotice(data?.error ?? error?.message ?? "The request could not be reviewed.");
      return;
    }
    setCancellationReason("");
    await refreshOrders();
    setNotice(`Cancellation request for ${selected.order_number} was not approved. The customer was notified.`);
  };
  const sendRefundEmail = async () => {
    if (!selected) return;
    if (!canManageFinancials) {
      setNotice("An administrator must send financial notifications.");
      return;
    }
    setSendingRefundEmail(true);
    const { data, error } = await supabase.functions.invoke("send-refund-email", {
      body: { orderId: selected.id },
    });
    setSendingRefundEmail(false);
    setNotice(
      data?.error ?? error?.message ??
        `Refund confirmation sent to ${data?.recipient ?? "the customer"}.`,
    );
    if (!error && !data?.error) await refreshOrders();
  };
  const nextStatus = selected
    ? fulfillmentSteps[
        Math.min(
          fulfillmentSteps.indexOf(selected.status) + 1,
          fulfillmentSteps.length - 1,
        )
      ]
    : "pending";
  const printPackingList = () => {
    if (!selected) return;
    setPackingListPrintedAt(new Date());
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.print());
    });
  };

  return (
    <AdminShell title="Orders">
      <section className="overflow-hidden rounded-[1.75rem] border border-border bg-[#f3eee6] shadow-sm">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="text-[10px] font-bold tracking-[.18em] text-muted-foreground">
              ORDER OPERATIONS
            </p>
            <h2 className="mt-2 font-serif text-4xl leading-none sm:text-5xl">
              Today’s order queue.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {manilaDateLabel}. Work from the first order placed to the latest so every customer is handled in sequence.
            </p>
          </div>
          <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${ordersRealtimeConnected ? "border-[#b9c9b4] bg-[#e5eee1] text-[#45603f]" : "border-[#d9c5a6] bg-[#f2e8d7] text-[#765d3c]"}`} aria-live="polite">
            <span className={`h-2 w-2 rounded-full ${ordersRealtimeConnected ? "bg-[#5f7d57]" : "animate-pulse bg-[#a87943]"}`} />
            {ordersRealtimeConnected ? "Live order updates" : "Reconnecting…"}
          </span>
        </div>
        <div className="grid border-t border-border bg-card sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["TODAY", todayOrders.length, "Oldest first"],
            ["READY TO FULFILL", readyToFulfillCount, "Paid or cash on delivery"],
            ["AWAITING PAYMENT", awaitingPaymentCount, "Online checkout pending"],
            ["NEEDS ATTENTION", attentionCount, "Cancellation or refund"],
          ].map(([label, value, note], index) => (
            <div key={label} className={`p-4 sm:p-5 ${index === 1 ? "border-t border-border sm:border-l sm:border-t-0" : ""} ${index === 2 ? "border-t border-border xl:border-l xl:border-t-0" : ""} ${index === 3 ? "border-t border-border sm:border-l xl:border-t-0" : ""}`}>
              <p className="text-[9px] font-bold tracking-[.15em] text-muted-foreground">{label}</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <b className="font-serif text-3xl font-normal">{value}</b>
                <span className="text-right text-[10px] text-muted-foreground">{note}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[.15em] text-muted-foreground">QUICK VIEWS</p>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Order quick views">
              <button
                type="button"
                onClick={() => setSearchParams({}, { replace: true })}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-semibold transition ${todayQueueActive ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:bg-secondary"}`}
              >
                Today
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${todayQueueActive ? "bg-background/15" : "bg-secondary"}`}>{todayOrders.length}</span>
              </button>
              {ADMIN_ORDER_VIEW_OPTIONS.filter(
                (option) =>
                  canManageFinancials ||
                  !["cancellation_requests", "refund_attention"].includes(option.id),
              ).map((option) => {
                const count = countAdminOrderView(orders, option.id, returnOrderIds);
                const active = option.id === "all" ? allOrdersActive : filters.view === option.id;
                return (
                  <button
                    type="button"
                    key={option.id}
                    onClick={() => {
                      const next = new URLSearchParams({ range: "all" });
                      if (option.id !== "all") next.set("view", option.id);
                      setSearchParams(next, { replace: true });
                    }}
                    className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-semibold transition ${active ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:bg-secondary"}`}
                  >
                    {option.label}
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${active ? "bg-background/15" : "bg-secondary"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <span className="w-fit shrink-0 rounded-full bg-secondary px-3 py-1.5 text-[11px] font-semibold">
            {filteredOrders.length} shown · {orders.length} total
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Search orders</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16}/>
            <input
              value={filters.query}
              onChange={(event) => updateDeskParams({ q: event.target.value || null, order: null })}
              placeholder="Search order, customer, email, phone, or product"
              className="h-12 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-xs outline-none transition focus:border-foreground"
            />
          </label>
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            className={`inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-semibold transition ${filtersOpen ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:bg-secondary"}`}
          >
            <SlidersHorizontal size={15}/>
            Filters
            {activeFilterCount > 0 && <span className={`rounded-full px-2 py-0.5 text-[9px] ${filtersOpen ? "bg-background/15" : "bg-secondary"}`}>{activeFilterCount}</span>}
            <ChevronDown size={14} className={`transition ${filtersOpen ? "rotate-180" : ""}`}/>
          </button>
        </div>

        {filtersOpen && (
          <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-5">
            <label className="grid gap-1.5 text-[10px] font-bold tracking-[.08em] text-muted-foreground">
              FULFILLMENT
              <select value={filters.status} onChange={(event) => updateDeskParams({ status: event.target.value === "all" ? null : event.target.value, order: null })} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-xs font-semibold tracking-normal text-foreground">
                <option value="all">All statuses</option>
                {adminOrderStatuses.map((status) => <option key={status} value={status}>{status.replace(/^./, (letter) => letter.toUpperCase())}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-[10px] font-bold tracking-[.08em] text-muted-foreground">
              PAYMENT
              <select value={filters.paymentStatus} onChange={(event) => updateDeskParams({ payment: event.target.value === "all" ? null : event.target.value, order: null })} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-xs font-semibold tracking-normal text-foreground">
                <option value="all">All payments</option>
                {adminPaymentStatuses.map((status) => <option key={status} value={status}>{status.replace(/^./, (letter) => letter.toUpperCase())}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-[10px] font-bold tracking-[.08em] text-muted-foreground">
              METHOD
              <select value={filters.paymentMethod} onChange={(event) => updateDeskParams({ method: event.target.value === "all" ? null : event.target.value, order: null })} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-xs font-semibold uppercase tracking-normal text-foreground">
                <option value="all">All methods</option>
                {availablePaymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-[10px] font-bold tracking-[.08em] text-muted-foreground">
              DATE
              <select value={filters.dateRange} onChange={(event) => updateDeskParams({ range: event.target.value === "today" ? null : event.target.value, order: null })} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-xs font-semibold tracking-normal text-foreground">
                <option value="today">Today</option>
                <option value="all">Any date</option>
                <option value="last_7_days">Last 7 days</option>
                <option value="last_30_days">Last 30 days</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-[10px] font-bold tracking-[.08em] text-muted-foreground sm:col-span-2 xl:col-span-1">
              ORDER
              <select value={filters.sort} onChange={(event) => updateDeskParams({ sort: event.target.value === "oldest" ? null : event.target.value, order: null })} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-xs font-semibold tracking-normal text-foreground">
                <option value="oldest">First placed first</option>
                <option value="newest">Most recent first</option>
                <option value="longest_waiting">Longest waiting</option>
                <option value="highest_total">Highest total</option>
              </select>
            </label>
          </div>
        )}
        {hasActiveAdminOrderFilters(filters) && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-[11px] text-muted-foreground">Filters affect the loaded orders only and do not make another database request.</p>
            <button type="button" onClick={() => setSearchParams({}, { replace: true })} className="text-xs font-semibold underline underline-offset-4">
              Reset to today’s queue
            </button>
          </div>
        )}
      </section>
      {ordersLoadError && orders.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#d9c5a6] bg-[#f5ecdc] p-3 text-xs text-[#725a36] sm:flex-row sm:items-center sm:justify-between">
          <span>Showing the last loaded orders. Live refresh reported: {ordersLoadError}</span>
          <button type="button" onClick={() => setOrdersReloadKey((current) => current + 1)} className="shrink-0 font-semibold underline underline-offset-4">Try refresh again</button>
        </div>
      )}

      {ordersLoading && !orders.length ? (
        <div className="mt-7 overflow-hidden rounded-2xl border border-border bg-card p-6" role="status" aria-live="polite">
          <div className="h-4 w-40 animate-pulse rounded-full bg-secondary" />
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[0, 1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-secondary/70" />)}
          </div>
          <p className="mt-5 text-center text-xs text-muted-foreground">Loading live customer orders…</p>
        </div>
      ) : !orders.length ? (
        <div className="mt-7 rounded-2xl border border-dashed border-border bg-card p-8 text-center sm:p-12">
          {ordersLoadError ? (
            <>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f2e8d7] text-[#765d3c]"><Clock size={20}/></span>
              <p className="mt-4 text-sm font-semibold text-foreground">We couldn’t finish loading the order desk.</p>
              <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted-foreground">{ordersLoadError}</p>
              <button type="button" onClick={() => setOrdersReloadKey((current) => current + 1)} className="mt-5 rounded-xl bg-foreground px-5 py-2.5 text-xs font-semibold text-background">Retry orders</button>
            </>
          ) : (
            <>
              <Package className="mx-auto text-muted-foreground" size={24}/>
              <p className="mt-4 text-sm font-semibold text-foreground">No customer orders yet.</p>
              <p className="mt-2 text-xs text-muted-foreground">New storefront and mobile orders will appear here automatically.</p>
            </>
          )}
        </div>
      ) : !selected ? (
        <div className="mt-7 rounded-2xl border border-dashed border-border bg-card p-8 text-center sm:p-12">
          <Search className="mx-auto text-muted-foreground" size={24}/>
          <p className="mt-4 text-sm font-semibold text-foreground">No orders match this view.</p>
          <p className="mt-2 text-xs text-muted-foreground">Adjust the search, saved view, or filters to widen the results.</p>
          <div className="mt-5 flex flex-col justify-center gap-2 min-[390px]:flex-row">
            <button type="button" onClick={() => setSearchParams({}, { replace: true })} className="rounded-xl bg-foreground px-5 py-2.5 text-xs font-semibold text-background">Return to today</button>
            <button type="button" onClick={() => setSearchParams({ range: "all" }, { replace: true })} className="rounded-xl border border-border bg-card px-5 py-2.5 text-xs font-semibold">Show all orders</button>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] xl:items-start">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm xl:col-start-1 xl:row-start-1">
            <div className="border-b border-border bg-[#f8f5ef] px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <b className="text-sm">{queueTitle}</b>
                  <span className="mt-1 block text-[10px] text-muted-foreground">{queueSortLabel}</span>
                </div>
                <span className="rounded-full bg-card px-2.5 py-1 text-[10px] font-semibold shadow-sm">
                  {filteredOrders.length}
                </span>
              </div>
            </div>
            <div className="max-h-[620px] divide-y divide-border overflow-y-auto overscroll-contain">
              {visibleOrders.map((order, index) => {
                const address = order.shipping_address;
                const queuePosition = (orderPage - 1) * ordersPerPage + index + 1;
                return (
                  <button
                    key={order.id}
                    onClick={() => selectOrder(order.id)}
                    className={`group w-full p-4 text-left transition ${
                      selected.id === order.id ? "bg-[#e8e0d4]" : "hover:bg-secondary/70"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[10px] font-bold ${selected.id === order.id ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground"}`} aria-label={`Queue position ${queuePosition}`}>
                        {queuePosition}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <b className="text-sm">#{order.order_number}</b>
                          <Status>
                            {order.status.replace(/_/g, " ").replace(/^./, (character) => character.toUpperCase())}
                          </Status>
                        </div>
                        <p className="mt-2 truncate text-sm font-medium">
                          {address.name || order.profiles?.full_name || "Customer"}
                        </p>
                        <div className="mt-1.5 flex items-end justify-between gap-3 text-[11px] text-muted-foreground">
                          <span>
                            <b className="block font-semibold text-foreground">{adminOrderTimeFormatter.format(new Date(order.created_at))}</b>
                            {!todayQueueActive && <span>{adminOrderDateFormatter.format(new Date(order.created_at))} · </span>}
                            {order.order_items.length} {order.order_items.length === 1 ? "item" : "items"}
                          </span>
                          <b className="shrink-0 text-xs text-foreground">{money(Number(order.total))}</b>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border bg-secondary/35 px-4 py-3">
              <button
                type="button"
                onClick={() => changeOrderPage(orderPage - 1)}
                disabled={orderPage === 1}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-2 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={13} /> Previous
              </button>
              <span className="text-center text-[11px] text-muted-foreground">
                Page <b className="text-foreground">{orderPage}</b> of {orderPageCount}
                <span className="block text-[9px]">
                  {ordersPerPage} per page · {filteredOrders.length} matching orders
                </span>
              </span>
              <button
                type="button"
                onClick={() => changeOrderPage(orderPage + 1)}
                disabled={orderPage === orderPageCount}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-2 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          </section>

          <section className="min-w-0 rounded-2xl border border-border bg-card shadow-sm xl:col-start-2 xl:row-span-2 xl:row-start-1">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-semibold">#{selected.order_number}</h3>
                  <Status>
                    {selected.status.replace(/_/g, " ").replace(/^./, (character) => character.toUpperCase())}
                  </Status>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Placed {new Date(selected.created_at).toLocaleString("en-PH")} ·{" "}
                  {money(Number(selected.total))}
                </p>
              </div>
              <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:w-auto">
                <button
                  type="button"
                  onClick={printPackingList}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold transition hover:bg-secondary"
                  aria-label={`Print packing list for order ${selected.order_number}`}
                >
                  <Printer size={14}/>
                  Print packing list
                </button>
                <button
                  onClick={() => void update(nextStatus)}
                  disabled={
                    selected.status === "delivered" || selected.status === "cancelled" || selected.cancellation_status === "pending"
                  }
                  className="min-h-10 rounded-xl bg-foreground px-3.5 py-2 text-xs font-semibold text-background disabled:opacity-40"
                >
                  {selected.status === "pending"
                    ? "Begin fulfillment"
                    : selected.status === "processing"
                      ? "Mark as packed"
                      : selected.status === "packed"
                        ? "Mark as shipped"
                        : selected.status === "shipped"
                          ? "Mark as delivered"
                          : selected.status === "cancelled"
                            ? "Cancelled"
                            : "Delivered"}
                </button>
              </div>
            </div>

            <div className="p-5">
              {selected.cancellation_status && (
                <section className={`mb-5 rounded-2xl border p-4 ${selected.cancellation_status === "pending" ? "border-[#d6c09a] bg-[#f5ecdc] text-[#725a36]" : selected.cancellation_status === "approved" ? "border-[#aec0a7] bg-[#e6eee2] text-[#45603f]" : "border-border bg-secondary text-muted-foreground"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold tracking-[.16em]">CANCELLATION {selected.cancellation_status.toUpperCase()}</p>
                      <p className="mt-2 text-sm font-semibold">{selected.cancellation_reason || "No reason provided"}</p>
                      {selected.cancellation_requested_at && <time className="mt-1 block text-[10px]" dateTime={selected.cancellation_requested_at}>Requested {new Date(selected.cancellation_requested_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}</time>}
                      {selected.cancellation_decision_note && <p className="mt-2 text-xs">Decision note: {selected.cancellation_decision_note}</p>}
                    </div>
                    <span className="rounded-full border border-current px-3 py-1 text-[10px] font-bold uppercase">{selected.cancellation_status}</span>
                  </div>
                  {selected.cancellation_status === "pending" && canManageFinancials && <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"><label className="grid gap-1.5 text-xs font-semibold">Decision note <input value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} maxLength={500} placeholder="Optional note for the customer" className="h-10 rounded-xl border border-current/25 bg-white/70 px-3 text-foreground outline-none"/></label><button type="button" disabled={cancelling} onClick={() => void rejectCancellationRequest()} className="h-10 rounded-xl border border-current px-4 text-xs font-semibold disabled:opacity-50">Reject request</button><button type="button" disabled={cancelling} onClick={() => { setCancellationReason(selected.cancellation_reason || ""); setShowCancellation(true); }} className="h-10 rounded-xl bg-[#8f4f38] px-4 text-xs font-semibold text-white disabled:opacity-50">Approve &amp; cancel</button></div>}
                </section>
              )}
              <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                ORDERED ITEMS
              </p>
              <div className="mt-3 grid gap-2">
                {selected.order_items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-secondary/70 px-3 py-3"
                  >
                    <span className="text-sm font-medium">
                      {item.product_name} × {item.quantity}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {money(Number(item.unit_price) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <dl className="mt-4 grid gap-2 rounded-xl border border-border bg-secondary/35 p-4 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Merchandise subtotal</dt>
                  <dd className="font-semibold">{money(Number(selected.subtotal))}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">
                    Delivery{selected.shipping_address.delivery_area_name ? ` · ${selected.shipping_address.delivery_area_name}` : ""}
                  </dt>
                  <dd className="font-semibold">{Number(selected.delivery_fee) > 0 ? money(Number(selected.delivery_fee)) : "Free"}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-border pt-2 text-sm">
                  <dt className="font-semibold">Order total</dt>
                  <dd className="font-bold">{money(Number(selected.total))}</dd>
                </div>
              </dl>

              {selected.status === "delivered" && (
                <section
                  className="mt-5 rounded-2xl border border-[#d8cdbd] bg-[#f7f2e9] p-4"
                  aria-labelledby="admin-digital-invoice-title"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-foreground text-background">
                        <FileText size={17}/>
                      </span>
                      <div>
                        <p className="text-[9px] font-bold tracking-[.15em] text-muted-foreground">
                          DELIVERED ORDER
                        </p>
                        <h4 id="admin-digital-invoice-title" className="mt-1 text-sm font-semibold">
                          Digital invoice receipt
                        </h4>
                        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                          Download the same customer receipt with the exact items, fees, discounts, payment record, and delivery details.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void downloadInvoice(selected)}
                      disabled={invoiceDownloadId === selected.id}
                      className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3 text-xs font-semibold text-background transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-wait disabled:translate-y-0 disabled:opacity-60"
                    >
                      {invoiceDownloadId === selected.id ? (
                        <><span className="h-4 w-4 animate-spin rounded-full border-2 border-background/35 border-t-background"/> Preparing PDF…</>
                      ) : (
                        <><Download size={14}/> Download PDF</>
                      )}
                    </button>
                  </div>
                </section>
              )}

              <div className="mt-6 border-t border-border pt-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                      DELIVERY PROGRESS
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {selected.payment_method.toUpperCase()}{" "}
                      <span className="font-normal text-muted-foreground">
                        · Payment {selected.payment_status}
                      </span>
                    </p>
                  </div>
                  <select
                    value={selected.status}
                    disabled={selected.cancellation_status === "pending"}
                    onChange={(event) =>
                      void update(event.target.value as DbOrder["status"])
                    }
                    className="h-9 rounded-xl border border-border bg-card px-3 text-xs font-semibold"
                  >
                    {allowedFulfillmentStatuses(selected.status).filter(status => canManageFinancials || status !== "cancelled").map(status=><option key={status} value={status}>{status === "cancelled" ? "Cancel order…" : status[0].toUpperCase()+status.slice(1)}</option>)}
                  </select>
                </div>
                <div className="mt-4 grid gap-2 rounded-xl border border-border bg-secondary/45 p-3 text-xs sm:grid-cols-2">
                  <div>
                    <span className="block text-[10px] font-bold tracking-[.12em] text-muted-foreground">PAYMENT STATE</span>
                    <b className="mt-1 block capitalize">{selected.payment_status}</b>
                    {selectedPayment?.paid_at && <time className="mt-1 block text-[10px] text-muted-foreground" dateTime={selectedPayment.paid_at}>Paid {new Date(selectedPayment.paid_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}</time>}
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold tracking-[.12em] text-muted-foreground">PROVIDER RECORD</span>
                    <b className="mt-1 block capitalize">{selected.payment_method === "cod" ? "Cash on delivery" : (selectedPayment?.status ?? "Awaiting provider")}</b>
                    {selectedPayment?.updated_at && <time className="mt-1 block text-[10px] text-muted-foreground" dateTime={selectedPayment.updated_at}>Synced {new Date(selectedPayment.updated_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}</time>}
                    {selectedPayment?.failure_reason && <span className="mt-1 block text-[10px] text-[#8f4f38]">{selectedPayment.failure_reason}</span>}
                  </div>
                  {selected.refunded_at && <div className="sm:col-span-2"><span className="font-semibold">Refund completed</span><time className="ml-1 text-muted-foreground" dateTime={selected.refunded_at}>{new Date(selected.refunded_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}</time></div>}
                </div>
                {selected.refund_status && (
                  <div className={`mt-4 rounded-xl border p-3 text-xs ${selected.refund_status === "failed" ? "border-[#bd8068] bg-[#f4e3dc] text-[#854b36]" : "border-[#afbea8] bg-[#e8efe5] text-[#486242]"}`}>
                    <b className="block">Refund {selected.refund_status.replace(/_/g, " ")}</b>
                    {selected.order_status_history?.find((entry) => entry.status === "cancelled") && (
                      <time className="mt-1 block" dateTime={selected.order_status_history.find((entry) => entry.status === "cancelled")!.changed_at}>
                        Cancelled {new Date(selected.order_status_history.find((entry) => entry.status === "cancelled")!.changed_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}
                      </time>
                    )}
                    {selected.cancellation_reason && <span className="mt-1 block">Reason: {selected.cancellation_reason}</span>}
                    {canManageFinancials && selected.payment_status === "refunded" && (
                      <button type="button" onClick={() => void sendRefundEmail()} disabled={sendingRefundEmail} className="mt-3 rounded-lg border border-current px-3 py-1.5 font-semibold disabled:opacity-50">
                        {sendingRefundEmail ? "Sending…" : selected.refund_email_sent_at ? "Resend refund email" : "Send refund email"}
                      </button>
                    )}
                  </div>
                )}
                <ol className="mt-5 grid gap-4">
                  {fulfillmentSteps.map((step, index) => {
                    const currentIndex = fulfillmentSteps.indexOf(selected.status);
                    const complete = selected.status !== "cancelled" && index <= currentIndex;
                    const history = selected.order_status_history?.find((entry) => entry.status === step);
                    return (
                      <li key={step} className="relative flex gap-3">
                        <span
                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                            complete
                              ? "bg-foreground text-background"
                              : "bg-[#d9ccba] text-foreground"
                          }`}
                        >
                          {complete && <Check size={11} />}
                        </span>
                        <span className="text-xs capitalize leading-5 text-muted-foreground">
                          <b className={complete ? "text-foreground" : ""}>{step}</b>
                          {history && (
                            <time className="block text-[10px] normal-case text-muted-foreground" dateTime={history.changed_at}>
                              {new Date(history.changed_at).toLocaleString("en-PH", {
                                timeZone: "Asia/Manila",
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </time>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </section>

          <aside className="min-w-0 rounded-2xl border border-border bg-[#252723] p-5 text-[#f7f3ec] shadow-sm xl:col-start-1 xl:row-start-2">
            <p className="text-[10px] font-bold tracking-[.16em] text-[#c9c0b3]">
              CUSTOMER RECORD
            </p>
            <div className="mt-5 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-[#b8a58d] text-sm font-bold text-[#252723]">
                {(selected.shipping_address.name ||
                  selected.profiles?.full_name ||
                  "Customer")
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()}
              </div>
              <div>
                <b className="block text-sm">
                  {selected.shipping_address.name ||
                    selected.profiles?.full_name ||
                    "Customer"}
                </b>
                <span className="text-xs text-[#c9c0b3]">Storefront buyer</span>
              </div>
            </div>
            <dl className="mt-6 grid gap-4 border-t border-white/10 pt-5 text-xs">
              <div>
                <dt className="text-[#c9c0b3]">Customer account</dt>
                <dd className="mt-1 break-words font-medium">
                  {selected.profiles?.email ||
                    selected.shipping_address.email ||
                    "Not provided"}
                </dd>
                <dd className="mt-1 break-all text-[10px] text-[#9e9589]">
                  User ID: {selected.user_id}
                </dd>
              </div>
              <div>
                <dt className="text-[#c9c0b3]">Mobile</dt>
                <dd className="mt-1 font-medium">
                  {selected.shipping_address.mobile ||
                    selected.profiles?.phone ||
                    "Not provided"}
                </dd>
              </div>
              <div>
                <dt className="text-[#c9c0b3]">Delivery address</dt>
                <dd className="mt-1 font-medium leading-5">
                  {[
                    selected.shipping_address.line,
                    selected.shipping_address.barangay,
                    selected.shipping_address.city,
                    selected.shipping_address.province,
                    selected.shipping_address.postal,
                  ]
                    .filter(Boolean)
                    .join(", ") || "Not provided"}
                </dd>
              </div>
            </dl>
            <Link
              to="/admin/customers"
              className="mt-6 block w-full rounded-xl bg-[#f7f3ec] px-3 py-2.5 text-center text-xs font-bold text-[#252723]"
            >
              Open customer profiles
            </Link>
            {selectedReturn && (
              <div className="mt-5 rounded-xl border border-white/15 bg-white/5 p-4 text-xs">
                <p className="font-bold tracking-[.12em] text-[#d7c9b8]">RETURN {selectedReturn.return_number}</p>
                <p className="mt-2 font-semibold">{selectedReturn.reason}</p><p className="mt-1 leading-5 text-[#c9c0b3]">{selectedReturn.details}</p>
                {selectedReturn.evidence_paths?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{selectedReturn.evidence_paths.map((path,index)=><button key={path} type="button" onClick={()=>void openReturnEvidence(path)} className="rounded-lg border border-white/20 px-2.5 py-1.5 font-semibold text-[#f7f3ec]">View evidence {index+1}</button>)}</div>}
                <select value={selectedReturn.status} disabled={processingReturnRefund || selectedReturn.status === "closed"} onChange={(event)=>void updateReturn(event.target.value)} className="mt-3 h-10 w-full rounded-lg bg-[#f7f3ec] px-2 text-xs font-semibold text-[#252723] disabled:opacity-60">{selectedReturn.status==="refund_processing"&&<option value="refund_processing">Refund processing</option>}{allowedReturnStatuses(selectedReturn.status as ReturnStatus).filter(status=>status!=="refund_processing"&&status!=="refunded").map(status=><option key={status} value={status}>{status.replace(/_/g," ").replace(/^./,letter=>letter.toUpperCase())}</option>)}{canManageFinancials&&["item_received","refund_processing"].includes(selectedReturn.status)&&<option value="refunded">Process protected refund…</option>}</select>
                <textarea value={returnNote} onChange={(event)=>setReturnNote(event.target.value)} placeholder="Admin note for customer…" rows={3} className="mt-2 w-full resize-none rounded-lg bg-[#f7f3ec] p-2 text-[#252723]"/>
              </div>
            )}
          </aside>
        </div>
      )}
      {canManageFinancials && showCancellation && selected && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-order-title">
          <section className="w-full max-w-lg rounded-[1.75rem] border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold tracking-[.16em] text-[#a05f46]">PROTECTED ACTION</p>
                <h3 id="cancel-order-title" className="mt-2 font-serif text-3xl">Cancel order #{selected.order_number}?</h3>
              </div>
              <button onClick={() => setShowCancellation(false)} disabled={cancelling} className="rounded-full border border-border p-2" aria-label="Close cancellation"><X size={16} /></button>
            </div>
            <div className="mt-5 rounded-xl bg-secondary p-4 text-sm leading-6">
              {selected.payment_status === "paid" && selected.payment_method !== "cod" ? (
                <><b>Paid {selected.payment_method.toUpperCase()} order.</b> A full {selected.payment_method.toUpperCase()} refund of {money(Number(selected.total))} will be {selected.refund_status === "demo_succeeded" ? "recorded" : "initiated"} before inventory is restored.</>
              ) : (
                <><b>No settled online payment.</b> The order will be cancelled and reserved inventory will be restored.</>
              )}
            </div>
            <label className="mt-5 grid gap-2 text-sm font-semibold">
              Cancellation reason
              <textarea value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} maxLength={500} rows={4} placeholder="Explain why this order must be cancelled…" className="resize-none rounded-xl border border-border bg-background p-3 font-normal outline-none focus:border-foreground" />
            </label>
            <p className="mt-3 text-xs text-muted-foreground">Shipped and delivered orders cannot be cancelled here; they require a return workflow.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowCancellation(false)} disabled={cancelling} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">Keep order</button>
              <button onClick={() => void confirmCancellation()} disabled={cancelling || cancellationReason.trim().length < 5} className="rounded-xl bg-[#8f4f38] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{cancelling ? "Processing safely…" : selected.payment_status === "paid" && selected.payment_method !== "cod" ? "Cancel and refund" : "Confirm cancellation"}</button>
            </div>
          </section>
        </div>
      )}
      {selected && (
        <AdminPackingList order={selected} printedAt={packingListPrintedAt} />
      )}
      {notice && <Toast message={notice} close={() => setNotice("")} />}
    </AdminShell>
  );
}

export function PaymentsPage() {
  const { orders, refreshOrders } = useStore();
  const [notice, setNotice] = useState("");
  useEffect(() => {
    void refreshOrders();
  }, [refreshOrders]);
  const collected = orders
    .filter((order) => order.payment_status === "paid")
    .reduce((sum, order) => sum + Number(order.total), 0);
  const markReceived = async (id: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ payment_status: "paid" })
      .eq("id", id);
    setNotice(error?.message ?? "Payment marked as received.");
    if (!error) await refreshOrders();
  };
  const exportPayments = () => {
    const rows = [
      ["Order", "Customer", "Method", "Status", "Total", "Created"],
      ...orders.map((order) => [
        order.order_number,
        order.shipping_address.name || "Customer",
        order.payment_method.toUpperCase(),
        order.payment_status,
        String(order.total),
        order.created_at,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `cozycraft-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Payment report downloaded.");
  };
  return (
    <AdminShell title="Payments">
      <div className="rounded-3xl bg-[#e6d7c4] p-7">
        <p className="text-[10px] font-bold tracking-[.18em] text-[#735c48]">
          PAYMENT RECONCILIATION
        </p>
        <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="break-words font-[Playfair_Display] text-4xl sm:text-5xl">{money(collected)}</h2>
            <p className="mt-2 text-sm text-[#735c48]">
              Collected across {orders.filter((order) => order.payment_status === "paid").length} recorded transactions.
            </p>
          </div>
          <button
            onClick={exportPayments}
            className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
          >
            Generate settlement report
          </button>
        </div>
      </div>
      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-[1fr_auto] border-b border-border px-5 py-4 text-xs font-semibold">
          <span>Recorded transactions</span>
          <span>Action</span>
        </div>
        {orders.map((order) => (
          <div
            key={order.id}
            className="grid grid-cols-[1fr_auto] items-center border-b border-border px-5 py-4"
          >
            <div>
              <b className="text-sm">#{order.order_number}</b>
              <p className="mt-1 text-xs text-muted-foreground">
                {order.shipping_address.name || "Customer"} · {order.payment_method.toUpperCase()} · {money(Number(order.total))}
              </p>
            </div>
            {order.payment_status === "paid" ? (
              <Status>{order.payment_status}</Status>
            ) : order.payment_method === "cod" ? (
              <button
                onClick={() => void markReceived(order.id)}
                className="rounded-xl bg-foreground px-3 py-2 text-xs font-semibold text-background"
              >
                Mark received
              </button>
            ) : (
              <div className="text-right">
                <Status>{order.payment_status}</Status>
                <p className="mt-1 text-[9px] text-muted-foreground">Managed by PayMongo</p>
              </div>
            )}
          </div>
        ))}
        {!orders.length && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No customer payments or orders yet.
          </p>
        )}
      </div>
      {notice && <Toast message={notice} close={() => setNotice("")} />}
    </AdminShell>
  );
}

export function CustomersPage() {
  const { customerProfiles, refreshCustomers } = useStore();
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ fullName: "", username: "", phone: "", gender: "", dateOfBirth: "" });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void refreshCustomers();
  }, [refreshCustomers]);
  useEffect(() => {
    if (!selectedId && customerProfiles[0]) {
      setSelectedId(customerProfiles[0].id);
    }
  }, [customerProfiles, selectedId]);
  const customer =
    customerProfiles.find((item) => item.id === selectedId) ??
    customerProfiles[0];
  const lifetimeValue = (profile: DbCustomerProfile) =>
    customerLifetimeValue(profile.orders);
  const primaryAddress = customer?.addresses.find(
    (address) => address.is_primary,
  ) ?? customer?.addresses[0];
  useEffect(() => {
    if (!customer) return;
    setDraft({ fullName: customer.full_name, username: customer.username, phone: customer.phone ?? "", gender: customer.gender, dateOfBirth: customer.date_of_birth ?? "" });
    setEditing(false);
  }, [customer?.id]);
  const manageCustomer = async (body: Record<string, unknown>) => {
    setBusy(true); setNotice("");
    const { data, error } = await supabase.functions.invoke("manage-customer", { body });
    setBusy(false);
    setNotice(data?.error ?? error?.message ?? data?.message ?? "Customer account updated.");
    if (!error && !data?.error) { setEditing(false); await refreshCustomers(); }
  };

  return (
    <AdminShell title="Customers">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
            CUSTOMER RELATIONSHIPS
          </p>
          <h2 className="mt-2 text-3xl font-semibold">Customer records</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Live Supabase profiles appear here even before a customer places an
            order.
          </p>
        </div>
        <span className="rounded-xl bg-card px-4 py-3 text-sm shadow-sm">
          <b>{customerProfiles.length}</b> registered customers
        </span>
      </div>
      {!customer ? (
        <div className="mt-7 rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
          No registered customer profiles yet.
        </div>
      ) : (
        <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(300px,.75fr)_minmax(520px,1.25fr)]">
          <section className="h-fit rounded-2xl border border-border bg-card p-3 shadow-sm">
            {customerProfiles.map((profile) => (
              <button
                onClick={() => setSelectedId(profile.id)}
                key={profile.id}
                className={`flex w-full items-center justify-between gap-3 rounded-xl p-3 text-left ${
                  customer.id === profile.id
                    ? "bg-secondary"
                    : "hover:bg-secondary"
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#b8a58d] text-sm font-bold">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (profile.full_name || profile.email || "C")[0].toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0">
                    <b className="block truncate text-sm">
                      {profile.full_name || "Customer"}
                    </b>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {profile.email || "No email"}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs">
                  <b>{money(lifetimeValue(profile))}</b>
                  <span className="mt-1 block text-muted-foreground">
                    {profile.orders.length} orders
                  </span>
                </span>
              </button>
            ))}
          </section>
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="bg-[#292622] p-6 text-[#f4f2ee]">
              <div className="flex flex-wrap items-center gap-4">
                <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-[#b8a58d] text-xl font-bold text-foreground">
                  {customer.avatar_url ? (
                    <img
                      src={customer.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (customer.full_name || customer.email || "C")[0].toUpperCase()
                  )}
                </span>
                <div>
                  <p className="text-[10px] font-bold tracking-[.16em] text-white/50">
                    VERIFIED CUSTOMER ACCOUNT
                  </p>
                  <h3 className="mt-2 font-serif text-4xl">
                    {customer.full_name || "Customer"}
                  </h3>
                  <p className="mt-1 text-sm text-white/65">
                    @{customer.username || "username-not-set"}
                  </p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Lifetime value", money(lifetimeValue(customer))],
                  ["Orders", customer.orders.length],
                  ["Addresses", customer.addresses.length],
                  ["Support tickets", customer.support_tickets.length],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-white/8 p-3">
                    <p className="text-[10px] text-white/50">{label}</p>
                    <b className="mt-2 block text-sm">{value}</b>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => setEditing((value) => !value)} className="rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-foreground">{editing ? "Cancel editing" : "Edit customer"}</button><button type="button" disabled={busy} onClick={() => { const active = customer.customer_active !== false; if (window.confirm(`${active ? "Suspend" : "Reactivate"} this customer account?`)) void manageCustomer({ action: "set-status", userId: customer.id, active: !active }); }} className={`rounded-xl border px-4 py-2.5 text-xs font-semibold ${customer.customer_active !== false ? "border-[#d7a28d] text-[#f2c7b5]" : "border-[#9fbd92] text-[#cde6c3]"}`}>{customer.customer_active !== false ? "Suspend account" : "Reactivate account"}</button><span className={`rounded-full px-3 py-2 text-[10px] font-bold ${customer.customer_active !== false ? "bg-[#dce9d7] text-[#45613f]" : "bg-[#f0d7cc] text-[#814d3c]"}`}>{customer.customer_active !== false ? "ACTIVE" : "SUSPENDED"}</span></div>
            </div>
            <div className="grid gap-5 p-6 lg:grid-cols-2">
              {editing && <div className="rounded-2xl border border-border bg-[#faf8f4] p-5 lg:col-span-2"><p className="text-[10px] font-bold tracking-[.14em] text-muted-foreground">EDIT CUSTOMER PROFILE</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{([['Full name','fullName'],['Username','username'],['Phone','phone'],['Gender','gender'],['Date of birth','dateOfBirth']] as const).map(([label,key]) => <label key={key} className="grid gap-2 text-xs font-semibold">{label}<input type={key === "dateOfBirth" ? "date" : "text"} value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} className="h-11 rounded-xl border border-border bg-white px-3 font-normal"/></label>)}</div><button type="button" disabled={busy} onClick={() => void manageCustomer({ action: "update", userId: customer.id, ...draft })} className="mt-4 rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background disabled:opacity-50">{busy ? "Saving…" : "Save customer changes"}</button></div>}
              <div className="rounded-2xl bg-secondary p-5">
                <p className="text-[10px] font-bold tracking-[.14em] text-muted-foreground">
                  ACCOUNT DETAILS
                </p>
                <dl className="mt-4 grid gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Email</dt>
                    <dd className="mt-1 break-words font-semibold">
                      {customer.email || "Not provided"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Phone</dt>
                    <dd className="mt-1 font-semibold">
                      {customer.phone || "Not provided"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Gender · Birthday
                    </dt>
                    <dd className="mt-1 font-semibold">
                      {customer.gender || "Not provided"} ·{" "}
                      {customer.date_of_birth
                        ? new Date(
                            `${customer.date_of_birth}T00:00:00`,
                          ).toLocaleDateString("en-PH")
                        : "Not provided"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Payment preference
                    </dt>
                    <dd className="mt-1 font-semibold uppercase">
                      {customer.preferred_payment_method}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="rounded-2xl border border-border p-5">
                <p className="text-[10px] font-bold tracking-[.14em] text-muted-foreground">
                  DEFAULT DELIVERY ADDRESS
                </p>
                {primaryAddress ? (
                  <div className="mt-4 text-sm">
                    <b>
                      {primaryAddress.label} · {primaryAddress.recipient_name}
                    </b>
                    <p className="mt-2 leading-6 text-muted-foreground">
                      {primaryAddress.address_line},{" "}
                      {primaryAddress.barangay}
                      <br />
                      {primaryAddress.city}, {primaryAddress.province}{" "}
                      {primaryAddress.postal_code}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {primaryAddress.mobile} · {primaryAddress.email}
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    No saved address.
                  </p>
                )}
              </div>
              <div className="rounded-2xl border border-border p-5 lg:col-span-2">
                <p className="text-[10px] font-bold tracking-[.14em] text-muted-foreground">
                  ACCOUNT ID
                </p>
                <p className="mt-2 break-all font-mono text-xs">
                  {customer.id}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Registered{" "}
                  {new Date(customer.created_at).toLocaleString("en-PH")}
                </p>
              </div>
            </div>
            {notice && <p role="status" className="border-t border-border bg-secondary p-4 text-sm">{notice}</p>}
          </section>
        </div>
      )}
    </AdminShell>
  );
}

export function ReviewsPage() {
  type ReviewRow = {
    id: string; rating: number; title: string; body: string; approved: boolean;
    image_urls: string[]; created_at: string;
    profiles: { full_name: string | null; email: string | null; avatar_url: string | null } | null;
    products: { name: string } | null;
  };
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<"all" | "visible" | "hidden" | "photos">("all");
  const [gallery, setGallery] = useState<{ reviewId: string; index: number } | null>(null);
  const loadReviews = useCallback(async () => {
    const { data, error } = await supabase.from("reviews").select(
      "id,rating,title,body,approved,image_urls,created_at,profiles!reviews_user_id_fkey(full_name,email,avatar_url),products!reviews_product_id_fkey(name)",
    ).order("created_at", { ascending: false });
    if (error) setNotice(error.message);
    else {
      const normalizedReviews = (data ?? []).map((row) => ({
        ...row,
        image_urls: Array.isArray(row.image_urls) ? row.image_urls.filter(Boolean) : [],
        profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles,
        products: Array.isArray(row.products) ? row.products[0] ?? null : row.products,
      })) as ReviewRow[];
      const signedAvatars = await privateAvatarUrls(
        normalizedReviews.map((review) => review.profiles?.avatar_url),
        supabase,
      );
      setReviews(normalizedReviews.map((review, index) => ({
        ...review,
        profiles: review.profiles
          ? { ...review.profiles, avatar_url: signedAvatars[index] }
          : null,
      })));
    }
  }, []);
  useEffect(() => {
    void loadReviews();
    const channel = supabase.channel("admin-reviews").on(
      "postgres_changes", { event: "*", schema: "public", table: "reviews" }, () => void loadReviews(),
    ).subscribe();
    const refreshOnFocus = () => void loadReviews();
    window.addEventListener("focus", refreshOnFocus);
    return () => { window.removeEventListener("focus", refreshOnFocus); void supabase.removeChannel(channel); };
  }, [loadReviews]);
  const setReviewVisibility = async (id: string, visible: boolean) => {
    const { error } = await supabase.from("reviews").update({ approved: visible }).eq("id", id);
    setNotice(error?.message ?? (visible ? "Review restored to the customer storefront." : "Review hidden from the customer storefront."));
    if (!error) await loadReviews();
  };
  const publicReviews = reviews.filter((review) => review.approved);
  const average = publicReviews.length ? publicReviews.reduce((sum, review) => sum + review.rating, 0) / publicReviews.length : 0;
  const hiddenCount = reviews.length - publicReviews.length;
  const photoCount = reviews.filter((review) => review.image_urls.length > 0).length;
  const visibleReviews = reviews.filter((review) => filter === "all" || (filter === "visible" && review.approved) || (filter === "hidden" && !review.approved) || (filter === "photos" && review.image_urls.length > 0));
  const galleryReview = gallery ? reviews.find((review) => review.id === gallery.reviewId) ?? null : null;
  useEffect(() => {
    if (!gallery) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGallery(null);
      const count = galleryReview?.image_urls.length ?? 0;
      if (!count) return;
      if (event.key === "ArrowLeft") setGallery((current) => current && ({ ...current, index: (current.index - 1 + count) % count }));
      if (event.key === "ArrowRight") setGallery((current) => current && ({ ...current, index: (current.index + 1) % count }));
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", handleKey); };
  }, [gallery, galleryReview]);
  return (
    <AdminShell title="Reviews">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">CUSTOMER VOICE</p><h2 className="mt-2 text-3xl font-semibold">Reviews</h2><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Customer reviews publish immediately. Monitor feedback here and hide content only when it violates CozyCraft content standards.</p></div>
        <div className="self-start rounded-xl bg-secondary px-3 py-2 text-xs sm:self-auto">Average rating <b className="ml-2">{average.toFixed(1)} / 5</b></div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[["All reviews", reviews.length, "all"], ["Visible", publicReviews.length, "visible"], ["Hidden", hiddenCount, "hidden"], ["With customer photos", photoCount, "photos"]].map(([label, value, key]) => (
          <button key={String(key)} onClick={() => setFilter(key as typeof filter)} className={`rounded-2xl border p-4 text-left transition ${filter === key ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-secondary"}`}><span className={`text-[10px] font-bold uppercase tracking-[.14em] ${filter === key ? "text-background/65" : "text-muted-foreground"}`}>{label}</span><strong className="mt-2 block text-2xl">{value}</strong></button>
        ))}
      </div>
      <div className="mt-7 grid gap-4">
        {visibleReviews.map((review) => (
          <article key={review.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_12px_30px_rgba(45,39,32,.04)]">
            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-[#e8dcc8] text-xs font-bold uppercase text-[#40382f]" aria-hidden="true">
                    {(review.profiles?.full_name || review.profiles?.email || "Customer")
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")}
                    {review.profiles?.avatar_url && (
                      <img
                        src={review.profiles.avatar_url}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={(event) => { event.currentTarget.style.display = "none"; }}
                      />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><b className="truncate">{review.profiles?.full_name || review.profiles?.email || "Customer"}</b><span className="flex gap-0.5 text-[#a37b57]" aria-label={`${review.rating} out of 5 stars`}>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={14} fill={index < review.rating ? "currentColor" : "none"}/>)}</span>{review.approved ? <Status>Visible</Status> : <span className="rounded-full bg-[#eeeae3] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Hidden</span>}</div>
                    <p className="mt-1 text-[11px] text-muted-foreground">Verified customer profile</p>
                  </div>
                </div>
                <h3 className="mt-4 font-serif text-2xl">{review.title || "Customer feedback"}</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">“{review.body || "No written feedback provided."}”</p>
                <p className="mt-3 text-xs text-muted-foreground"><b className="text-foreground">{review.products?.name || "Product"}</b> · {new Date(review.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</p>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end"><button onClick={() => void setReviewVisibility(review.id, !review.approved)} className={`rounded-xl px-4 py-2.5 text-xs font-semibold ${review.approved ? "border border-border" : "bg-foreground text-background"}`}>{review.approved ? "Hide review" : "Restore review"}</button></div>
            </div>
            {review.image_urls.length > 0 && <div className="border-t border-border bg-[#f5f1ea] p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold tracking-[.15em] text-muted-foreground">CUSTOMER PHOTOS</p><p className="mt-1 text-xs text-muted-foreground">Select an image to inspect the customer upload at full size.</p></div><span className="rounded-full bg-card px-3 py-1 text-[10px] font-semibold">{review.image_urls.length} photo{review.image_urls.length === 1 ? "" : "s"}</span></div><div className="mt-4 grid grid-cols-2 gap-3 sm:flex">{review.image_urls.map((url, index) => <button key={`${review.id}-${index}`} onClick={() => setGallery({ reviewId: review.id, index })} className="group relative aspect-square min-w-0 overflow-hidden rounded-2xl border border-border bg-card sm:h-32 sm:w-32" aria-label={`Open review photo ${index + 1}`}><ResilientImage src={url} alt={`${review.products?.name || "Product"} customer review photo ${index + 1}`} className="h-full w-full object-cover transition duration-300 group-hover:scale-105"/><span className="absolute inset-x-2 bottom-2 rounded-lg bg-black/70 px-2 py-1 text-[9px] font-semibold text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"><Eye size={11} className="mr-1 inline"/>View full size</span></button>)}</div></div>}
          </article>
        ))}
        {!visibleReviews.length && <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">{reviews.length ? "No reviews match this view." : "No customer reviews have been submitted yet. New reviews and photos will appear here in realtime."}</p>}
      </div>
      {notice && <Toast message={notice} close={() => setNotice("")} />}
      {gallery && galleryReview?.image_urls[gallery.index] && createPortal(
        <div className="fixed inset-0 z-[300] grid place-items-center bg-black/85 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="Customer review photo viewer" onMouseDown={(event) => { if (event.target === event.currentTarget) setGallery(null); }}>
          <section className="relative flex max-h-[95dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.5rem] bg-[#171614] text-white shadow-2xl sm:rounded-[2rem]">
            <header className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-5"><div className="min-w-0"><p className="truncate text-sm font-semibold">{galleryReview.products?.name || "Product review"}</p><p className="mt-0.5 text-[10px] text-white/60">Photo {gallery.index + 1} of {galleryReview.image_urls.length} · {galleryReview.profiles?.full_name || "Customer"}</p></div><button onClick={() => setGallery(null)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close photo viewer"><X size={18}/></button></header>
            <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black p-3 sm:p-5"><ResilientImage src={galleryReview.image_urls[gallery.index]} alt={`${galleryReview.products?.name || "Product"} review photo ${gallery.index + 1}`} className="max-h-[70dvh] w-auto max-w-full object-contain"/>{galleryReview.image_urls.length > 1 && <><button onClick={() => setGallery((current) => current && ({ ...current, index: (current.index - 1 + galleryReview.image_urls.length) % galleryReview.image_urls.length }))} className="absolute left-3 grid h-11 w-11 place-items-center rounded-full bg-black/60 hover:bg-black/80" aria-label="Previous photo"><ChevronLeft/></button><button onClick={() => setGallery((current) => current && ({ ...current, index: (current.index + 1) % galleryReview.image_urls.length }))} className="absolute right-3 grid h-11 w-11 place-items-center rounded-full bg-black/60 hover:bg-black/80" aria-label="Next photo"><ChevronRight/></button></>}</div>
            <footer className="flex flex-col justify-between gap-3 border-t border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:px-5"><p className="line-clamp-2 text-xs leading-5 text-white/70">{galleryReview.body}</p><button onClick={() => { void setReviewVisibility(galleryReview.id, !galleryReview.approved); setGallery(null); }} className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black">{galleryReview.approved ? "Hide review" : "Restore review"}</button></footer>
          </section>
        </div>, document.body,
      )}
    </AdminShell>
  );
}

export function SupportPage() {
  const {
    supportTickets,
    refreshTickets,
    replyToTicket,
    updateTicketStatus,
  } = useStore();
  const [activeId, setActiveId] = useState("");
  const [reply, setReply] = useState("");
  const [ticketStatus, setTicketStatus] =
    useState<DbSupportTicket["status"]>("open");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [notice, setNotice] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [ticketPriority, setTicketPriority] = useState<DbSupportTicket["priority"]>("normal");
  const [teamMembers, setTeamMembers] = useState<Array<{id:string;full_name:string;role:string}>>([]);
  useEffect(() => {
    void refreshTickets();
  }, [refreshTickets]);
  useEffect(() => {
    if (!activeId && supportTickets[0]) setActiveId(supportTickets[0].id);
  }, [activeId, supportTickets]);
  const active =
    supportTickets.find((item) => item.id === activeId) ?? supportTickets[0];
  useEffect(() => {
    if (active) setTicketStatus(active.status);
    if (active) {setAssignedTo(active.assigned_to??"");setTicketPriority(active.priority??"normal");}
  }, [active?.id, active?.status]);
  useEffect(()=>{void supabase.from("profiles").select("id,full_name,role").in("role",["staff","admin","superadmin"]).eq("staff_active",true).then(({data})=>setTeamMembers((data??[]) as typeof teamMembers));},[]);
  const sendReply = async () => {
    if (!active || !reply.trim()) return;
    const nextStatus =
      ticketStatus === "open" ? "in_progress" : ticketStatus;
    const error = await replyToTicket(active.id, reply.trim(), nextStatus);
    setNotice(error ?? `Reply sent for ${active.ticket_number}.`);
    if (!error) {
      setReply("");
      setTicketStatus(nextStatus);
    }
  };
  const saveStatus = async () => {
    if (!active || ticketStatus === active.status || updatingStatus) return;
    setUpdatingStatus(true);
    const error = await updateTicketStatus(active.id, ticketStatus);
    setUpdatingStatus(false);
    setNotice(
      error ??
        `Ticket ${active.ticket_number} marked ${ticketStatus.replace(/_/g, " ")}.`,
    );
  };
  const saveWorkflow = async () => {
    if(!active)return;
    setUpdatingStatus(true);
    const {error}=await supabase.from("support_tickets").update({assigned_to:assignedTo||null,priority:ticketPriority}).eq("id",active.id);
    setUpdatingStatus(false);
    setNotice(error?.message??`Ticket ${active.ticket_number} ownership and priority updated.`);
    if(!error)await refreshTickets();
  };
  const openSupportAttachment=async(path:string)=>{const {data,error}=await supabase.storage.from("support-attachments").createSignedUrl(path,300);if(error||!data?.signedUrl){setNotice(error?.message??"Attachment could not be opened.");return;}window.open(data.signedUrl,"_blank","noopener,noreferrer");};
  return (
    <AdminShell title="Support">
      <div>
        <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
          CUSTOMER CARE
        </p>
        <h2 className="mt-2 text-3xl font-semibold">Support inbox</h2>
      </div>
      {!active ? (
        <div className="mt-7 rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
          No customer support tickets yet.
        </div>
      ) : (
        <div className="mt-7 grid overflow-hidden rounded-2xl border border-border bg-card lg:min-h-[580px] lg:grid-cols-[340px_1fr]">
          <aside className="max-h-[320px] overflow-y-auto border-b border-border lg:max-h-none lg:border-b-0 lg:border-r">
          {supportTickets.map((item) => (
            <button
              onClick={() => {
                setActiveId(item.id);
                setReply("");
              }}
              className={`w-full border-b border-border p-4 text-left ${active.id === item.id ? "bg-secondary" : "hover:bg-secondary"}`}
              key={item.id}
            >
              <div className="flex justify-between">
                <b className="text-sm">{item.subject}</b>
                <Status>{item.status.replace(/_/g, " ")}</Status>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.profiles?.full_name || item.profiles?.email || "Customer"}
              </p>
              <p className="mt-2 truncate text-xs">{item.message}</p>
            </button>
          ))}
          </aside>
          <section className="flex min-h-[520px] flex-col p-4 sm:p-6 lg:min-h-0">
            <div className="border-b border-border pb-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Ticket #{active.ticket_number} ·{" "}
                    {new Date(active.created_at).toLocaleString("en-PH")}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">
                    {active.subject}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    From{" "}
                    {active.profiles?.full_name ||
                      active.profiles?.email ||
                      "Customer"}
                  </p>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">{active.category} · {active.priority} priority</p>
                </div>
                <Status>{active.status.replace(/_/g, " ")}</Status>
              </div>
            </div>
            <div className="flex-1 py-6">
              <div className="max-w-md rounded-2xl bg-secondary p-4 text-sm">
                {active.message}
              </div>
              {active.attachment_paths?.length>0&&<div className="mt-3 flex flex-wrap gap-2">{active.attachment_paths.map((path,index)=><button key={path} type="button" onClick={()=>void openSupportAttachment(path)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Open attachment {index+1}</button>)}</div>}
              {active.admin_reply && (
              <div className="ml-auto mt-5 max-w-md rounded-2xl bg-[#292622] p-4 text-sm text-white">
                  {active.admin_reply}
              </div>
            )}
            </div>
            <div className="border-t border-border pt-4">
              <div className="mb-3 flex flex-wrap items-end gap-3 rounded-xl bg-secondary p-3">
                <label className="grid min-w-[190px] flex-1 gap-1.5 text-xs font-semibold">
                  Concern status
                  <select
                    value={ticketStatus}
                    onChange={(event) =>
                      setTicketStatus(
                        event.target.value as DbSupportTicket["status"],
                      )
                    }
                    className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-normal"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </label>
                <button
                  onClick={() => void saveStatus()}
                  disabled={
                    updatingStatus || ticketStatus === active.status
                  }
                  className="h-10 rounded-lg border border-border bg-card px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {updatingStatus ? "Saving..." : "Update status"}
                </button>
              </div>
              <div className="mb-3 grid gap-3 rounded-xl bg-secondary p-3 sm:grid-cols-[1fr_1fr_auto]"><label className="grid gap-1.5 text-xs font-semibold">Assigned owner<select value={assignedTo} onChange={(event)=>setAssignedTo(event.target.value)} className="h-10 rounded-lg border border-border bg-card px-3 font-normal"><option value="">Unassigned</option>{teamMembers.map((member)=><option key={member.id} value={member.id}>{member.full_name||member.role} · {member.role}</option>)}</select></label><label className="grid gap-1.5 text-xs font-semibold">Priority<select value={ticketPriority} onChange={(event)=>setTicketPriority(event.target.value as DbSupportTicket["priority"])} className="h-10 rounded-lg border border-border bg-card px-3 font-normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><button type="button" onClick={()=>void saveWorkflow()} disabled={updatingStatus||(assignedTo===(active.assigned_to??"")&&ticketPriority===active.priority)} className="h-10 self-end rounded-lg border border-border bg-card px-4 text-xs font-semibold disabled:opacity-45">Save ownership</button></div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  className="h-11 flex-1 rounded-xl border border-border px-3 text-sm"
                  placeholder="Write a helpful reply…"
                />
                <button
                  onClick={() => void sendReply()}
                  disabled={!reply.trim()}
                  className="rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Send
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
      {notice && <Toast message={notice} close={() => setNotice("")} />}
    </AdminShell>
  );
}

export function ActivityLogsPage() {
  const [scope, setScope] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
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
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const loadActivity = useCallback(async () => {
    setError("");
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const [activityResult, errorResult] = await Promise.all([
      supabase.from("activity_logs").select("id,action,entity_type,entity_id,details,created_at,platform,actor_role,profiles!activity_logs_actor_id_fkey(full_name,email,role)").gte("created_at", since.toISOString()).order("created_at", { ascending: false }).limit(1000),
      supabase.from("client_error_events").select("id,message,stack,path,context,user_agent,created_at,profiles!client_error_events_user_id_fkey(full_name,email,role)").gte("created_at", since.toISOString()).order("created_at", { ascending: false }).limit(300),
    ]);
    if (activityResult.error || errorResult.error) {
      setError(activityResult.error?.message ?? errorResult.error?.message ?? "Unable to load activity.");
      setLoading(false);
      return;
    }
    const clientErrors: ActivityRow[] = (errorResult.data ?? []).map((event:any)=>({
      id:`error-${event.id}`,
      action:"client_error",
      entity_type:"errors",
      entity_id:null,
      details:{message:event.message,path:event.path,context:event.context,stack:event.stack},
      created_at:event.created_at,
      platform:/(android|iphone|ipad|mobile|capacitor|cordova)/i.test(String(event.user_agent??""))?"mobile":"web",
      actor_role:event.profiles?.role??null,
      profiles:event.profiles,
    }));
    const activityRows: ActivityRow[] = (activityResult.data ?? []).map((event) => ({
      ...event,
      profiles: Array.isArray(event.profiles) ? event.profiles[0] ?? null : event.profiles,
    })) as ActivityRow[];
    setRows([...activityRows,...clientErrors].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()));
    setLastUpdated(new Date());
    setLoading(false);
  }, []);
  useEffect(() => {
    void loadActivity();
    const channel = supabase
      .channel("admin-activity")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_logs" },
        () => void loadActivity(),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "client_error_events" }, () => void loadActivity())
      .subscribe();
    const refreshOnFocus = () => void loadActivity();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      void supabase.removeChannel(channel);
    };
  }, [loadActivity]);
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
  const belongsToScope = (row: ActivityRow) => {
    const entity = row.entity_type.toLowerCase();
    const action = row.action.toLowerCase();
    if (scope === "all") return true;
    if (scope === "orders") return ["order", "orders"].includes(entity);
    if (scope === "customers")
      return entity === "profiles" || action.startsWith("team_member_");
    if (scope === "support") return ["support_ticket", "support_tickets"].includes(entity);
    if (scope === "cart") return ["cart_item", "cart_items"].includes(entity);
    if (scope === "wishlist") return ["wishlist_item", "wishlist_items"].includes(entity);
    if (scope === "addresses") return ["address", "addresses"].includes(entity);
    return entity === scope || entity === scope.replace(/s$/, "");
  };
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    if (!belongsToScope(row)) return false;
    if (!normalizedQuery) return true;
    return [
      row.action,
      row.entity_type,
      row.entity_id,
      row.profiles?.full_name,
      row.profiles?.email,
      row.profiles?.role,
      row.actor_role,
      row.platform,
      JSON.stringify(row.details),
    ].some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery));
  });
  useEffect(() => setPage(1), [scope, query, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  useEffect(() => setPage((current) => Math.min(current, totalPages)), [totalPages]);
  const pageStart = (page - 1) * pageSize;
  const paginatedRows = filteredRows.slice(pageStart, pageStart + pageSize);
  const humanizeAction = (action: string) =>
    ({
      customer_account_created: "created a customer account",
      admin_account_created: "received an administrator account",
      customer_sign_in: "signed in to the storefront",
      customer_sign_out: "signed out of the storefront",
      admin_sign_in: "signed in to operations",
      admin_sign_out: "signed out of operations",
      admin_idle_logout: "was automatically signed out after inactivity",
    } as Record<string, string>)[action] ?? action
      .replace(/^insert_/, "created ")
      .replace(/^update_/, "updated ")
      .replace(/^delete_/, "deleted ")
      .replace(/_/g, " ");
  const scopeLabel = scopes.find(([value]) => value === scope)?.[1] ?? "All actions";
  return (
    <AdminShell title="Activity logs">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
            AUDIT TRAIL
          </p>
          <h2 className="mt-2 text-3xl font-semibold">Activity logs</h2>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-[#68805f]" />
            Live database audit trail
            {lastUpdated && ` · Updated ${lastUpdated.toLocaleTimeString("en-PH", {
              timeZone: "Asia/Manila",
              hour: "numeric",
              minute: "2-digit",
            })}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3">
            <Search size={15} className="text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search activity"
              className="w-36 bg-transparent text-xs outline-none"
            />
          </label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="h-10 rounded-xl border border-border bg-card px-3 text-xs"
          >
            {scopes.map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>
          <select
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
            aria-label="Activity rows per page"
            className="h-10 rounded-xl border border-border bg-card px-3 text-xs"
          >
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
          <button
            type="button"
            onClick={() => void loadActivity()}
            className="h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold transition hover:bg-secondary"
          >
            Refresh
          </button>
        </div>
      </div>
      <section className="mt-7 rounded-2xl border border-border bg-card p-6">
        <div className="border-l-2 border-[#b8a58d] pl-4">
          <p className="text-xs text-muted-foreground">
            Showing {scopeLabel.toLowerCase()} · {filteredRows.length} events · Last 7 days
          </p>
        </div>
        {error && (
          <div className="mt-5 rounded-xl bg-[#f3e5d4] p-3 text-xs font-semibold text-[#8b5c46]">
            Activity could not be refreshed: {error}
          </div>
        )}
        <div className="mt-7 space-y-6">
          {loading && (
            <p className="text-center text-sm text-muted-foreground">
              Loading live activity…
            </p>
          )}
          {paginatedRows.map((row, i) => (
            <div className="relative flex gap-4" key={row.id}>
              <span className="mt-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold">
                {pageStart + i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <b>{row.profiles?.full_name || row.profiles?.email || "System"}</b>{" "}
                  {humanizeAction(row.action)}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-secondary px-2 py-1 text-[9px] font-bold uppercase tracking-wide">{row.platform}</span>
                  {(row.actor_role || row.profiles?.role) && <span className="rounded-full border border-border px-2 py-1 text-[9px] font-bold uppercase tracking-wide">{row.actor_role || row.profiles?.role}</span>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {String(
                    row.details?.name ||
                      row.details?.order_number ||
                      row.entity_id ||
                      row.entity_type,
                  )} ·{" "}
                  {new Date(row.created_at).toLocaleString("en-PH", {
                    timeZone: "Asia/Manila",
                  })}
                </p>
              </div>
            </div>
          ))}
          {!loading && !filteredRows.length && (
            <p className="text-center text-sm text-muted-foreground">
              No recorded activity for this filter yet.
            </p>
          )}
        </div>
        {!loading && filteredRows.length > 0 && (
          <div className="mt-7 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {pageStart + 1}–{Math.min(pageStart + pageSize, filteredRows.length)} of {filteredRows.length}
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="inline-flex h-9 items-center gap-1 rounded-xl border border-border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={14} /> Previous</button>
              <span className="px-2 text-xs font-semibold">Page {page} of {totalPages}</span>
              <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="inline-flex h-9 items-center gap-1 rounded-xl border border-border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40">Next <ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </section>
    </AdminShell>
  );
}

export function ReportsPage() {
  const { orders, adminProducts, customerProfiles, refreshOrders, refreshCustomers } = useStore();
  const [range, setRange] = useState<AdminReportRange>("This month");
  const [reportSchedule, setReportSchedule] = useState({ frequency: "weekly", timezone: "Asia/Manila" });
  const [format, setFormat] = useState("CSV");
  const [notice, setNotice] = useState("");
  const [scheduled, setScheduled] = useState(false);
  useEffect(() => {
    void refreshOrders();
    void refreshCustomers();
    const loadReportSettings = () => void supabase
      .from("store_settings")
      .select("weekly_report_enabled,report_settings")
      .eq("id", true)
      .single()
      .then(({ data }) => {
        setScheduled(Boolean(data?.weekly_report_enabled));
        const configured = data?.report_settings?.default_range;
        if (["This week", "This month", "Quarter"].includes(configured)) setRange(configured as AdminReportRange);
        setReportSchedule({ frequency: data?.report_settings?.frequency ?? "weekly", timezone: data?.report_settings?.timezone ?? "Asia/Manila" });
      });
    loadReportSettings();
    const channel = supabase.channel("admin-reports-settings").on("postgres_changes", { event: "UPDATE", schema: "public", table: "store_settings" }, loadReportSettings).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refreshCustomers, refreshOrders]);
  const reportNow = new Date();
  const rangeStart = reportRangeStart(range, reportNow);
  const rangeDuration = Math.max(1, reportNow.getTime() - rangeStart.getTime());
  const rangeOrders = orders.filter(
    (order) => new Date(order.created_at) >= rangeStart,
  );
  const paidOrders = rangeOrders.filter(isSettledSale);
  const refundedOrders = rangeOrders.filter((order) => order.payment_status === "refunded");
  const grossSales = settledRevenue(paidOrders);
  const refundedValue = refundedOrders.reduce((sum,order)=>sum+Number(order.total),0);
  const fulfilled = rangeOrders.filter(
    (order) => order.status === "delivered",
  ).length;
  const averageOrderValue = paidOrders.length
    ? grossSales / paidOrders.length
    : 0;
  const paidOrdersByCustomer = orders.filter(order=>order.payment_status === "paid").reduce<Record<string,number>>((counts,order)=>{counts[order.user_id]=(counts[order.user_id]??0)+1;return counts;},{});
  const repeatCustomers = Object.values(paidOrdersByCustomer).filter(count=>count>1).length;
  const trendData = Array.from({ length: 12 }, (_, index) => {
    const bucketStart = new Date(
      rangeStart.getTime() + (index * rangeDuration) / 12,
    );
    const bucketEnd = new Date(
      rangeStart.getTime() + ((index + 1) * rangeDuration) / 12,
    );
    const bucketOrders = paidOrders.filter((order) => {
        const created = new Date(order.created_at);
        return created >= bucketStart && (index === 11 ? created <= bucketEnd : created < bucketEnd);
      });
    return {
      label: bucketStart.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
      revenue: settledRevenue(bucketOrders),
      orders: bucketOrders.length,
    };
  });
  const categoryRevenue = paidOrders
    .flatMap((order) => order.order_items)
    .reduce<Record<string, number>>((totals, item) => {
      const category =
        adminProducts.find((product) => product.id === item.product_id)
          ?.category ?? "Uncategorized";
      totals[category] =
        (totals[category] ?? 0) + Number(item.unit_price) * item.quantity;
      return totals;
    }, {});
  const leadingCategory =
    Object.entries(categoryRevenue).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "No sales yet";
  const downloadCsv = (name:string, rows:Array<Array<string|number>>) => {
    const csv = rows.map((row)=>row.map((value)=>`"${String(value).replace(/"/g,'""')}"`).join(",")).join("\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    const link=document.createElement("a"); link.href=url; link.download=name; link.click(); URL.revokeObjectURL(url);
  };
  const exportReport = (reportName = "Sales performance") => {
    const rows:Array<Array<string|number>> = reportName === "Inventory velocity" ? [
      ["Product","Category","Stock","Status","Units sold in range"],
      ...adminProducts.map(product=>[product.name,product.category,product.stockQuantity??0,product.status??"unknown",rangeOrders.flatMap(order=>order.order_items).filter(item=>item.product_id===product.id).reduce((sum,item)=>sum+item.quantity,0)]),
    ] : reportName === "Customer retention" ? [
      ["Customer","Email","Paid orders","Repeat customer"],
      ...customerProfiles.map(profile=>[profile.full_name||profile.username||"Customer",profile.email??"",paidOrdersByCustomer[profile.id]??0,(paidOrdersByCustomer[profile.id]??0)>1?"Yes":"No"]),
    ] : [
      ["Order", "Status", "Payment", "Total", "Created"],
      ...rangeOrders.map((order) => [
        order.order_number,
        order.status,
        order.payment_status,
        String(order.total),
        order.created_at,
      ]),
    ];
    downloadCsv(`cozycraft-${reportName.toLowerCase().replace(/\s/g,"-")}-${range.toLowerCase().replace(/\s/g,"-")}.csv`,rows);
    setNotice(`${reportName} downloaded from live data.`);
  };
  const exportActionReport = () => {
    const soldByProduct = rangeOrders
      .flatMap((order) => order.order_items)
      .reduce<Record<string, number>>((totals, item) => {
        if (!item.product_id) return totals;
        totals[item.product_id] = (totals[item.product_id] ?? 0) + item.quantity;
        return totals;
      }, {});
    const priorityProducts = adminProducts
      .filter((product) => (product.stockQuantity ?? 0) <= 8)
      .sort((a, b) => (a.stockQuantity ?? 0) - (b.stockQuantity ?? 0));
    downloadCsv(
      `cozycraft-inventory-action-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ["Product", "Category", "Current stock", "Units sold in range", "Recommended action"],
        ...priorityProducts.map((product) => [
          product.name,
          product.category,
          product.stockQuantity ?? 0,
          soldByProduct[product.id] ?? 0,
          (product.stockQuantity ?? 0) === 0 ? "Restock immediately" : "Review and reorder",
        ]),
      ],
    );
    setNotice(
      priorityProducts.length
        ? `Action report downloaded with ${priorityProducts.length} priority products.`
        : "Action report downloaded. No products currently require restocking.",
    );
  };
  const reports = [
    {
      name: "Sales performance",
      meta: "Revenue, order volume & AOV",
      accent: "bg-[#b99a76]",
    },
    {
      name: "Inventory velocity",
      meta: "Sell-through & stock aging",
      accent: "bg-[#879b7d]",
    },
    {
      name: "Customer retention",
      meta: "Repeat buyers & cohorts",
      accent: "bg-[#7d8a9f]",
    },
  ];
  return (
    <AdminShell title="Reports">
      <div className="rounded-2xl bg-[#252724] px-6 py-7 text-[#f7f3ec] shadow-sm lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="font-mono text-[10px] font-bold tracking-[.18em] text-[#c8bcae]">
              EXECUTIVE INTELLIGENCE
            </p>
            <h2 className="mt-3 font-serif text-4xl">Reports studio</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#d2c9bf]">
              A clear read on how the collection is selling, moving, and
              returning to customers.
            </p>
          </div>
          <div className="flex rounded-xl bg-white/10 p-1">
            {(["This week", "This month", "Quarter"] as AdminReportRange[]).map((item) => (
              <button
                key={item}
                onClick={() => setRange(item)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${range === item ? "bg-[#f7f3ec] text-[#252724]" : "text-[#d2c9bf] hover:text-white"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="border-l border-[#b99a76] pl-4">
            <p className="text-xs text-[#c8bcae]">Gross sales</p>
            <p className="mt-1 font-serif text-3xl">{money(grossSales)}</p>
            <p className="mt-1 text-xs text-[#acc59f]">{paidOrders.length} settled orders</p>
          </div>
          <div className="border-l border-white/20 pl-4">
            <p className="text-xs text-[#c8bcae]">Orders fulfilled</p>
            <p className="mt-1 font-serif text-3xl">{fulfilled}</p>
            <p className="mt-1 text-xs text-[#acc59f]">
              {rangeOrders.length} total orders this period
            </p>
          </div>
          <div className="border-l border-white/20 pl-4">
            <p className="text-xs text-[#c8bcae]">Average order value</p>
            <p className="mt-1 font-serif text-3xl">{money(averageOrderValue)}</p>
            <p className="mt-1 text-xs text-[#c8bcae]">
              {leadingCategory} leads demand
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 border-t border-white/10 pt-5 text-xs sm:grid-cols-3"><p><span className="text-[#c8bcae]">Refunded</span><b className="ml-2">{money(refundedValue)}</b></p><p><span className="text-[#c8bcae]">Repeat customers</span><b className="ml-2">{repeatCustomers}</b></p><p><span className="text-[#c8bcae]">Cancellation rate</span><b className="ml-2">{rangeOrders.length?((rangeOrders.filter(order=>order.status==="cancelled").length/rangeOrders.length)*100).toFixed(1):"0.0"}%</b></p></div>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_.75fr]">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                REVENUE PULSE
              </p>
              <h3 className="mt-1 text-lg font-semibold">
                Sales trend · {range}
              </h3>
            </div>
            <span className="rounded-full bg-[#e3ecdf] px-3 py-1.5 text-xs font-semibold text-[#56714f]">
              Live Supabase data
            </span>
          </div>
          <div className="mt-7 h-60 min-w-0" aria-label={`Paid sales trend for ${range.toLowerCase()}`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="reportRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#b99a76" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#b99a76" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#ded9d0" }} interval="preserveStartEnd" tick={{ fontSize: 10, fill: "#706d67" }} />
                <Tooltip formatter={(value: number) => [money(Number(value)), "Paid sales"]} labelFormatter={(label) => `Period starting ${label}`} contentStyle={{ border: "1px solid #ded9d0", borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="#7f674e" strokeWidth={3} fill="url(#reportRevenue)" dot={{ r: 3, fill: "#7f674e" }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>{rangeStart.toLocaleDateString("en-PH",{month:"short",day:"numeric"})}</span>
            <span>{new Date(rangeStart.getTime()+rangeDuration/2).toLocaleDateString("en-PH",{month:"short",day:"numeric"})}</span>
            <span>{reportNow.toLocaleDateString("en-PH",{month:"short",day:"numeric"})}</span>
          </div>
          <div className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold">Best-selling category</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {leadingCategory} · {money(categoryRevenue[leadingCategory] ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold">Strongest channel</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Direct storefront · {money(grossSales)}
              </p>
            </div>
          </div>
        </section>
        <aside className="rounded-2xl border border-border bg-[#ede6dc] p-5 shadow-sm">
          <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
            ANALYST NOTE
          </p>
          <h3 className="mt-4 font-serif text-2xl leading-tight">
            {leadingCategory} currently leads recorded demand.
          </h3>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {adminProducts.filter((product) => (product.stockQuantity ?? 0) <= 8).length} products are at or below the reorder point, across {customerProfiles.length} registered customers.
          </p>
          <button
            onClick={exportActionReport}
            className="mt-6 flex items-center gap-2 text-xs font-bold underline underline-offset-4"
          >
            Create action report <ArrowRight size={14} />
          </button>
        </aside>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                REPORT LIBRARY
              </p>
              <h3 className="mt-1 text-lg font-semibold">
                Ready-made analysis
              </h3>
            </div>
            <button
              onClick={() => {
                void Promise.all([refreshOrders(), refreshCustomers()]).then(() =>
                  setNotice("Report library refreshed from Supabase."),
                );
              }}
              className="text-xs font-semibold underline underline-offset-4"
            >
              Refresh
            </button>
          </div>
          <div className="divide-y divide-border">
            {reports.map((report) => (
              <div key={report.name} className="flex items-center gap-4 p-4">
                <span className={`h-10 w-1 rounded-full ${report.accent}`} />
                <div className="min-w-0 flex-1">
                  <b className="block text-sm">{report.name}</b>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {report.meta}
                  </span>
                </div>
                <button
                  onClick={() => exportReport(report.name)}
                  className="rounded-lg border border-border px-3 py-2 text-xs font-semibold"
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
            DELIVERY DESK
          </p>
          <h3 className="mt-1 text-lg font-semibold">Export or schedule</h3>
          <div className="mt-5 flex gap-2">
            {["CSV"].map((type) => (
              <button
                key={type}
                onClick={() => setFormat(type)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${format === type ? "bg-foreground text-background" : "border border-border"}`}
              >
                {type}
              </button>
            ))}
          </div>
          <button
            onClick={() =>
              exportReport()
            }
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-xs font-semibold text-background"
          >
            <Download size={15} />
            Export {format}
          </button>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-secondary p-3">
            <div>
              <p className="text-xs font-semibold capitalize">{reportSchedule.frequency} briefing</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Realtime workspace notification · {reportSchedule.timezone}
              </p>
            </div>
            <button
              onClick={() => {
                const next = !scheduled;
                void supabase
                  .from("store_settings")
                  .update({ weekly_report_enabled: next })
                  .eq("id", true)
                  .then(({ error }) => {
                    if (!error) setScheduled(next);
                    setNotice(
                      error?.message ??
                        (next
                          ? "Weekly briefing scheduled."
                          : "Weekly delivery paused."),
                    );
                  });
              }}
              className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${scheduled ? "bg-[#e3ecdf] text-[#56714f]" : "bg-card text-muted-foreground"}`}
            >
              {scheduled ? "SCHEDULED" : "ENABLE"}
            </button>
          </div>
        </section>
      </div>
      {notice && <Toast message={notice} close={() => setNotice("")} />}
    </AdminShell>
  );
}

export function AdminModule({ module }: { module: keyof typeof moduleContent }) {
  const config = moduleContent[module];
  const Icon = config.icon;
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("Overview");
  const rows = config.rows.filter((row) =>
    row.join(" ").toLowerCase().includes(query.toLowerCase()),
  );
  const isSettings = module === "settings";
  const isReports = module === "reports";
  const isReviews = module === "reviews";
  return (
    <AdminShell title={config.title}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
            {config.eyebrow}
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-.045em]">
            {config.title}
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {config.description}
          </p>
        </div>
        <button
          onClick={() => setNotice(`${config.title} action prepared.`)}
          className="inline-flex w-fit items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
        >
          <Icon size={16} />
          {config.action}
        </button>
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {config.stats.map(([value, label]) => (
          <section
            key={label}
            className="rounded-2xl border border-border bg-card p-5 shadow-[0_8px_25px_rgba(33,31,29,.035)]"
          >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-3 text-2xl font-semibold tracking-[-.04em]">
              {value}
            </p>
          </section>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_.75fr]">
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_8px_25px_rgba(33,31,29,.035)]">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex rounded-xl bg-secondary p-1">
              {[
                "Overview",
                isSettings
                  ? "Preferences"
                  : isReports
                    ? "Exports"
                    : isReviews
                      ? "Visibility"
                      : "Activity",
              ].map((item) => (
                <button
                  onClick={() => setTab(item)}
                  key={item}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${tab === item ? "bg-card shadow-sm" : "text-muted-foreground"}`}
                >
                  {item}
                </button>
              ))}
            </div>
            <label className="flex h-9 items-center gap-2 rounded-xl border border-border bg-[#fcfbf8] px-3">
              <Search size={14} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${config.title.toLowerCase()}`}
                className="w-40 bg-transparent text-xs outline-none"
              />
            </label>
          </div>
          {isSettings ? (
            <SettingsPanel notice={notice} setNotice={setNotice} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px] text-left">
                <thead className="bg-[#faf9f6] text-[10px] tracking-[.12em] text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">RECORD</th>
                    <th>DETAIL</th>
                    <th>STATUS</th>
                    <th className="px-5" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row[0]} className="border-t border-border">
                      <td className="px-5 py-4 text-sm font-semibold">
                        {row[0]}
                      </td>
                      <td className="py-4 text-xs text-muted-foreground">
                        {row[1]}
                      </td>
                      <td className="py-4">
                        <Status>{row[2]}</Status>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() =>
                            setNotice(`${row[0]} opened for review.`)
                          }
                          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-secondary"
                        >
                          <MoreHorizontal size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <span>{rows.length} records shown</span>
            <button
              onClick={() => setNotice("Data refreshed.")}
              className="font-semibold text-foreground"
            >
              Refresh data
            </button>
          </div>
        </section>
        <aside className="rounded-2xl border border-border bg-[#eee8df] p-5 shadow-[0_8px_25px_rgba(33,31,29,.035)]">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#d8c7b0]">
            <Icon size={19} />
          </span>
          <p className="mt-5 text-sm font-semibold">
            {isReports ? "Report delivery" : "Next best action"}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {isReports
              ? "Schedule recurring exports or create a report-ready view for your next review."
              : "Review the items that need attention, then record a clear operational decision."}
          </p>
          <button
            onClick={() => setNotice(`${config.title} update saved.`)}
            className="mt-6 rounded-xl border border-foreground px-3 py-2 text-xs font-semibold"
          >
            {isReviews ? "Approve selected" : "View priority items"}
          </button>
          <div className="mt-6 border-t border-border pt-5">
            <p className="text-[10px] font-bold tracking-[.14em] text-muted-foreground">
              RECENT NOTE
            </p>
            <p className="mt-2 text-xs leading-5">
              Mara Mendoza updated this workspace 18 minutes ago.
            </p>
          </div>
        </aside>
      </div>
      {notice && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-[#201f1d] px-4 py-3 text-sm text-white shadow-xl">
          <Check size={16} />
          {notice}
          <button onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </AdminShell>
  );
}

export function SettingsPanel({
  notice,
  setNotice,
}: {
  notice: string;
  setNotice: (value: string) => void;
}) {
  const [alerts, setAlerts] = useState(true);
  const [threshold, setThreshold] = useState("8");
  return (
    <div className="p-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold">
          Store name
          <input
            defaultValue="CozyCraft Furnitures"
            className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-3 font-normal"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Contact email
          <input
            defaultValue="hello@cozycraft.com"
            className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-3 font-normal"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Low-stock threshold
          <input
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-3 font-normal"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Delivery area
          <select className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-3 font-normal">
            <option>Metro Manila</option>
            <option>Luzon</option>
            <option>Nationwide</option>
          </select>
        </label>
      </div>
      <label className="mt-6 flex items-center justify-between rounded-xl bg-secondary p-4 text-sm">
        <span>
          <b>Inventory alerts</b>
          <br />
          <span className="text-xs text-muted-foreground">
            Notify the operations team at reorder point.
          </span>
        </span>
        <input
          checked={alerts}
          onChange={(e) => setAlerts(e.target.checked)}
          type="checkbox"
          className="h-4 w-4 accent-foreground"
        />
      </label>
      <button
        onClick={() => setNotice("Store settings saved.")}
        className="mt-6 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
      >
        Save preferences
      </button>
    </div>
  );
}

export function Admin() {
  return <AdminOverview />;
}
