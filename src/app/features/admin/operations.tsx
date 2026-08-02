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
import {
  createBrowserRouter,
  Link,
  RouterProvider,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  Activity,
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
  Search,
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
  X,
} from "lucide-react";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
import cozyCraftLogo from "@/imports/COZy.png";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  isStaffRole,
  safeFileName,
  supabase,
  type DbCustomerProfile,
  type DbOrder,
  type DbProduct,
  type DbRole,
  type DbSupportTicket,
} from "@/lib/supabase";

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
} from "../../core";

import { AdminShell } from "./shell";

export function AdminOverview() {
  const { orders, adminProducts, user, refreshOrders } = useStore();
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
  const sales = orders.filter(order=>order.status!=="cancelled").reduce((sum,order)=>sum+Number(order.total),0);
  const pending = orders.filter(order=>order.status==="pending").length;
  const lowStock = adminProducts.filter(product=>(product.stockQuantity??0)<=8).length;
  const salesData = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (6 - index), 1);
    const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return {
      m: date.toLocaleDateString("en-PH", { month: "short" }),
      v: orders
        .filter(
          (order) =>
            order.status !== "cancelled" &&
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
          note="All non-cancelled orders"
        />
        <Metric
          label="Orders this month"
          value={String(monthOrders.length)}
          note="Live storefront orders"
        />
        <Metric label="Pending orders" value={String(pending)} note="Requires attention" />
        <Metric label="Low-stock products" value={String(lowStock)} note="Review inventory" />
      </div>
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
          image: p.images[0],
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
                        <ImageWithFallback
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
      "Moderate feedback while protecting the quality of the CozyCraft catalog.",
    action: "Review queue",
    stats: [
      ["184", "Published reviews"],
      ["6", "Awaiting approval"],
      ["4.8", "Average rating"],
    ],
    rows: [
      ["Mara Lounge Chair", "Luna Reyes · 5 stars", "Pending"],
      ["Arco Dining Table", "Jerome Lim · 5 stars", "Pending"],
      ["Santo Bed Frame", "Elena Cruz · 4 stars", "Active"],
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
      ["Jules Santos", "Approved a customer review", "Today · 08:15"],
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
  return <AdminShell title="Orders"><div className="flex flex-wrap justify-between gap-4"><div><p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">LIVE FULFILLMENT</p><h2 className="mt-2 text-3xl font-semibold">Customer orders</h2><p className="mt-2 text-sm text-muted-foreground">Orders placed at checkout appear here immediately.</p></div><div className="rounded-xl bg-card px-4 py-3 text-sm shadow-sm"><b>{orders.length}</b> total orders</div></div>{!selected?<div className="mt-7 rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">No customer orders yet.</div>:<div className="mt-7 grid gap-5 xl:grid-cols-[.8fr_1.2fr]"><section className="overflow-hidden rounded-2xl border border-border bg-card">{orders.map(order=>{const addr=order.shipping_address;return <button key={order.id} onClick={()=>setSelectedId(order.id)} className={"flex w-full items-center justify-between border-b border-border p-4 text-left "+(selected.id===order.id?"bg-secondary":"hover:bg-secondary")}><span><b className="text-sm">#{order.order_number}</b><span className="mt-1 block text-xs text-muted-foreground">{addr.name||"Customer"} · {new Date(order.created_at).toLocaleDateString("en-PH")}</span></span><span className="text-right"><Status>{order.status}</Status><b className="mt-2 block text-xs">{money(Number(order.total))}</b></span></button>})}</section><section className="rounded-2xl border border-border bg-card p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs text-muted-foreground">ORDER #{selected.order_number}</p><h3 className="mt-2 font-serif text-3xl">{selected.shipping_address.name||"Customer"}</h3><p className="mt-2 text-sm text-muted-foreground">{selected.shipping_address.email} · {selected.shipping_address.mobile}</p></div><Status>{selected.status}</Status></div><div className="mt-6 rounded-xl bg-secondary p-4 text-sm"><b>Deliver to</b><p className="mt-2 text-muted-foreground">{[selected.shipping_address.line,selected.shipping_address.barangay,selected.shipping_address.city,selected.shipping_address.province,selected.shipping_address.postal].filter(Boolean).join(", ")}</p></div><div className="mt-6 divide-y divide-border border-y border-border">{selected.order_items.map(item=><div key={item.id} className="flex justify-between py-3 text-sm"><span>{item.product_name} × {item.quantity}</span><b>{money(Number(item.unit_price)*item.quantity)}</b></div>)}</div><div className="mt-5 flex justify-between text-lg font-semibold"><span>Total</span><span>{money(Number(selected.total))}</span></div><label className="mt-6 grid gap-2 text-sm font-semibold">Update fulfillment status<select value={selected.status} onChange={e=>void update(e.target.value as DbOrder["status"])} className="h-11 rounded-xl border border-border bg-card px-3 font-normal"><option value="pending">Pending</option><option value="processing">Processing</option><option value="packed">Packed</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select></label></section></div>}{notice&&<Toast message={notice} close={()=>setNotice("")}/>}</AdminShell>;
}

export function OrdersWorkspacePage() {
  const { orders, updateOrderStatus, cancelOrder, refreshOrders } = useStore();
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState("");
  const [showCancellation, setShowCancellation] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [sendingRefundEmail, setSendingRefundEmail] = useState(false);
  const [orderPage, setOrderPage] = useState(1);
  const [returnRequests, setReturnRequests] = useState<Array<{id:string;order_id:string;return_number:string;reason:string;details:string;status:string;admin_note:string|null;evidence_paths:string[];created_at:string}>>([]);
  const [returnNote, setReturnNote] = useState("");
  const [processingReturnRefund, setProcessingReturnRefund] = useState(false);
  const ordersPerPage = 8;
  const fulfillmentSteps: DbOrder["status"][] = [
    "pending",
    "processing",
    "packed",
    "shipped",
    "delivered",
  ];

  useEffect(() => {
    void refreshOrders();
  }, [refreshOrders]);
  useEffect(() => {
    const refresh = async () => { const { data } = await supabase.from("return_requests").select("*").order("created_at", { ascending:false }); setReturnRequests((data ?? []) as typeof returnRequests); };
    void refresh();
    const channel = supabase.channel("admin-return-requests").on("postgres_changes", {event:"*",schema:"public",table:"return_requests"}, refresh).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);
  useEffect(() => {
    if (!orders.length) {
      if (selectedId) setSelectedId("");
      return;
    }
    if (!orders.some((order) => order.id === selectedId)) {
      setSelectedId(orders[0].id);
    }
  }, [orders, selectedId]);

  const orderPageCount = Math.max(1, Math.ceil(orders.length / ordersPerPage));
  const visibleOrders = orders.slice(
    (orderPage - 1) * ordersPerPage,
    orderPage * ordersPerPage,
  );
  useEffect(() => {
    if (orderPage > orderPageCount) setOrderPage(orderPageCount);
  }, [orderPage, orderPageCount]);
  const changeOrderPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), orderPageCount);
    setOrderPage(nextPage);
    const firstOrder = orders[(nextPage - 1) * ordersPerPage];
    if (firstOrder) setSelectedId(firstOrder.id);
  };

  const selected = orders.find((order) => order.id === selectedId) ?? orders[0];
  const selectedReturn = selected ? returnRequests.find((request) => request.order_id === selected.id) : undefined;
  const updateReturn = async (status:string) => {
    if (!selectedReturn) return;
    if (status === "refunded") {
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
  const sendRefundEmail = async () => {
    if (!selected) return;
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

  return (
    <AdminShell title="Orders">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
            LIVE FULFILLMENT CONTROL
          </p>
          <h2 className="mt-2 text-3xl font-semibold">Order desk</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Select an order to review its customer, products, and live delivery status.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold shadow-sm"
        >
          <Download size={15} />
          Print packing list
        </button>
      </div>

      {!selected ? (
        <div className="mt-7 rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
          No customer orders yet. New storefront orders will appear here automatically.
        </div>
      ) : (
        <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(280px,.78fr)_minmax(400px,1.2fr)_minmax(260px,.7fr)]">
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-5 py-4">
              <b className="text-sm">Customer orders</b>
              <span className="ml-2 rounded-full bg-secondary px-2 py-1 text-[10px]">
                {orders.length}
              </span>
            </div>
            <div className="max-h-[640px] divide-y divide-border overflow-y-auto">
              {visibleOrders.map((order) => {
                const address = order.shipping_address;
                return (
                  <button
                    key={order.id}
                    onClick={() => setSelectedId(order.id)}
                    className={`w-full p-4 text-left transition ${
                      selected.id === order.id ? "bg-[#eee8de]" : "hover:bg-secondary/70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <b className="text-sm">#{order.order_number}</b>
                      <Status>
                        {order.status.replace(/_/g, " ").replace(/^./, (character) => character.toUpperCase())}
                      </Status>
                    </div>
                    <p className="mt-2 text-sm font-medium">
                      {address.name || order.profiles?.full_name || "Customer"}
                    </p>
                    <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                      <span>
                        {order.order_items.length} {order.order_items.length === 1 ? "item" : "items"} ·{" "}
                        {new Date(order.created_at).toLocaleDateString("en-PH")}
                      </span>
                      <span>{money(Number(order.total))}</span>
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
                <span className="block text-[9px]">{orders.length} total orders</span>
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

          <section className="rounded-2xl border border-border bg-card shadow-sm">
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
              <button
                onClick={() => void update(nextStatus)}
                disabled={
                  selected.status === "delivered" || selected.status === "cancelled"
                }
                className="rounded-xl bg-foreground px-3.5 py-2 text-xs font-semibold text-background disabled:opacity-40"
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

            <div className="p-5">
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
                    onChange={(event) =>
                      void update(event.target.value as DbOrder["status"])
                    }
                    className="h-9 rounded-xl border border-border bg-card px-3 text-xs font-semibold"
                  >
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="packed">Packed</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled" disabled={selected.status === "shipped" || selected.status === "delivered"}>
                      Cancel order…
                    </option>
                  </select>
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
                    {selected.payment_status === "refunded" && (
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

          <aside className="rounded-2xl border border-border bg-[#252723] p-5 text-[#f7f3ec] shadow-sm">
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
                <select value={selectedReturn.status === "refund_processing" ? "refund_processing" : selectedReturn.status} disabled={processingReturnRefund || selectedReturn.status === "refunded" || selectedReturn.status === "closed"} onChange={(event)=>void updateReturn(event.target.value)} className="mt-3 h-10 w-full rounded-lg bg-[#f7f3ec] px-2 text-xs font-semibold text-[#252723] disabled:opacity-60"><option value="requested">Requested</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="item_received">Item received</option>{selectedReturn.status === "refund_processing" && <option value="refund_processing">Refund processing</option>}<option value="refunded" disabled={!['item_received','refund_processing'].includes(selectedReturn.status)}>{processingReturnRefund ? "Processing refund…" : "Process protected refund…"}</option><option value="closed">Closed</option></select>
                <textarea value={returnNote} onChange={(event)=>setReturnNote(event.target.value)} placeholder="Admin note for customer…" rows={3} className="mt-2 w-full resize-none rounded-lg bg-[#f7f3ec] p-2 text-[#252723]"/>
              </div>
            )}
          </aside>
        </div>
      )}
      {showCancellation && selected && (
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
            <h2 className="font-[Playfair_Display] text-5xl">{money(collected)}</h2>
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
    profile.orders.reduce((sum, order) => sum + Number(order.total), 0);
  const primaryAddress = customer?.addresses.find(
    (address) => address.is_primary,
  ) ?? customer?.addresses[0];

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
            </div>
            <div className="grid gap-5 p-6 lg:grid-cols-2">
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
          </section>
        </div>
      )}
    </AdminShell>
  );
}

export function ReviewsPage() {
  type ReviewRow = {
    id: string;
    rating: number;
    title: string;
    body: string;
    approved: boolean;
    created_at: string;
    profiles: { full_name: string | null; email: string | null } | null;
    products: { name: string } | null;
  };
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [notice, setNotice] = useState("");
  const loadReviews = useCallback(async () => {
    const { data, error } = await supabase
      .from("reviews")
      .select(
        "id,rating,title,body,approved,created_at,profiles!reviews_user_id_fkey(full_name,email),products!reviews_product_id_fkey(name)",
      )
      .order("created_at", { ascending: false });
    if (error) setNotice(error.message);
    else setReviews((data ?? []) as ReviewRow[]);
  }, []);
  useEffect(() => {
    void loadReviews();
    const channel = supabase
      .channel("admin-reviews")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reviews" },
        () => void loadReviews(),
      )
      .subscribe();
    const interval = window.setInterval(() => void loadReviews(), 10_000);
    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [loadReviews]);
  const update = async (id: string, approved: boolean) => {
    const { error } = await supabase
      .from("reviews")
      .update({ approved })
      .eq("id", id);
    setNotice(
      error?.message ??
        (approved
          ? "Review published to the product page."
          : "Review hidden from the customer storefront."),
    );
    if (!error) await loadReviews();
  };
  const average = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;
  return (
    <AdminShell title="Reviews">
      <div className="flex justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
            MODERATION QUEUE
          </p>
          <h2 className="mt-2 text-3xl font-semibold">Reviews</h2>
        </div>
        <div className="rounded-xl bg-secondary px-3 py-2 text-xs">
          Average rating <b className="ml-2">{average.toFixed(1)} / 5</b>
        </div>
      </div>
      <div className="mt-7 grid gap-4">
        {reviews.map((review) => (
          <article
            key={review.id}
            className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center"
          >
            <div>
              <div className="flex items-center gap-2">
                <b>{review.profiles?.full_name || review.profiles?.email || "Customer"}</b>
                <span className="text-[#b8875c]">
                  {"★".repeat(review.rating)}
                </span>
              </div>
              <p className="mt-2 text-sm">
                {review.title && <b>{review.title}: </b>}
                “{review.body || "No written feedback provided."}”
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {review.products?.name || "Product"} · customer review
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!review.approved ? (
                <>
                  <button
                    onClick={() => void update(review.id, true)}
                    className="rounded-xl bg-foreground px-3 py-2 text-xs font-semibold text-background"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => void update(review.id, false)}
                    className="rounded-xl border border-border px-3 py-2 text-xs font-semibold"
                  >
                    Hide
                  </button>
                </>
              ) : (
                <>
                  <Status>Published</Status>
                  <button
                    onClick={() => void update(review.id, false)}
                    className="rounded-xl border border-border px-3 py-2 text-xs font-semibold"
                  >
                    Hide
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
        {!reviews.length && (
          <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No customer reviews have been submitted yet.
          </p>
        )}
      </div>
      {notice && <Toast message={notice} close={() => setNotice("")} />}
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
        <div className="mt-7 grid min-h-[580px] overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[340px_1fr]">
          <aside className="border-r border-border">
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
          <section className="flex flex-col p-6">
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
              <div className="flex gap-3">
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  type ActivityRow = {
    id: number;
    action: string;
    entity_type: string;
    entity_id: string | null;
    details: Record<string, unknown>;
    created_at: string;
    profiles: { full_name: string | null; email: string | null } | null;
  };
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const loadActivity = useCallback(async () => {
    setError("");
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const { data, error: loadError } = await supabase
      .from("activity_logs")
      .select(
        "id,action,entity_type,entity_id,details,created_at,profiles!activity_logs_actor_id_fkey(full_name,email)",
      )
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(500);
    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as ActivityRow[]);
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
      .subscribe();
    const interval = window.setInterval(() => void loadActivity(), 30_000);
    return () => {
      window.clearInterval(interval);
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
      JSON.stringify(row.details),
    ].some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery));
  });
  const humanizeAction = (action: string) =>
    action
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
          {filteredRows.map((row, i) => (
            <div className="relative flex gap-4" key={row.id}>
              <span className="mt-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold">
                {i + 1}
              </span>
              <div>
                <p className="text-sm">
                  <b>{row.profiles?.full_name || row.profiles?.email || "System"}</b>{" "}
                  {humanizeAction(row.action)}
                </p>
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
      </section>
    </AdminShell>
  );
}

export function ReportsPage() {
  const { orders, adminProducts, customerProfiles, refreshOrders, refreshCustomers } = useStore();
  const [range, setRange] = useState("This month");
  const [format, setFormat] = useState("CSV");
  const [notice, setNotice] = useState("");
  const [scheduled, setScheduled] = useState(false);
  useEffect(() => {
    void refreshOrders();
    void refreshCustomers();
    void supabase
      .from("store_settings")
      .select("weekly_report_enabled")
      .eq("id", true)
      .single()
      .then(({ data }) =>
        setScheduled(Boolean(data?.weekly_report_enabled)),
      );
  }, [refreshCustomers, refreshOrders]);
  const rangeDays = range === "This week" ? 7 : range === "Quarter" ? 90 : 31;
  const rangeStart = new Date(Date.now() - rangeDays * 86_400_000);
  const rangeOrders = orders.filter(
    (order) => new Date(order.created_at) >= rangeStart,
  );
  const validOrders = rangeOrders.filter((order) => order.status !== "cancelled");
  const grossSales = validOrders.reduce(
    (sum, order) => sum + Number(order.total),
    0,
  );
  const fulfilled = validOrders.filter(
    (order) => order.status === "delivered",
  ).length;
  const averageOrderValue = validOrders.length
    ? grossSales / validOrders.length
    : 0;
  const bars = Array.from({ length: 12 }, (_, index) => {
    const bucketStart = new Date(
      rangeStart.getTime() + (index * rangeDays * 86_400_000) / 12,
    );
    const bucketEnd = new Date(
      rangeStart.getTime() + ((index + 1) * rangeDays * 86_400_000) / 12,
    );
    return validOrders
      .filter((order) => {
        const created = new Date(order.created_at);
        return created >= bucketStart && created < bucketEnd;
      })
      .reduce((sum, order) => sum + Number(order.total), 0);
  });
  const maxBar = Math.max(1, ...bars);
  const categoryRevenue = validOrders
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
  const exportReport = () => {
    const rows = [
      ["Order", "Status", "Payment", "Total", "Created"],
      ...rangeOrders.map((order) => [
        order.order_number,
        order.status,
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
    link.download = `cozycraft-${range.toLowerCase().replace(/\s/g, "-")}-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Live report downloaded as CSV.");
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
            {["This week", "This month", "Quarter"].map((item) => (
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
            <p className="mt-1 text-xs text-[#acc59f]">{validOrders.length} valid orders</p>
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
          <div className="mt-7 flex h-52 items-end gap-2 border-b border-border pb-1">
            {bars.map((height, index) => (
              <div
                key={index}
                className="group relative flex flex-1 justify-center"
              >
                <span className="absolute -top-7 hidden rounded bg-foreground px-2 py-1 text-[10px] text-background group-hover:block">
                  {money(height)}
                </span>
                <div
                  className={`w-full rounded-t-md transition-all ${index === bars.length - 1 ? "bg-[#b99a76]" : "bg-[#ded7cd] group-hover:bg-[#c5b19a]"}`}
                  style={{ height: `${Math.max(3, (height / maxBar) * 100)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>01 AUG</span>
            <span>08 AUG</span>
            <span>16 AUG</span>
            <span>24 AUG</span>
            <span>31 AUG</span>
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
            onClick={() => setNotice("Priority inventory report created.")}
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
              onClick={() => setNotice("Report library refreshed.")}
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
                  onClick={() => setNotice(`${report.name} opened.`)}
                  className="rounded-lg border border-border px-3 py-2 text-xs font-semibold"
                >
                  Open
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
              <p className="text-xs font-semibold">Monday briefing</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Email sales digest every Monday, 8:00 AM
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
                      ? "Moderation"
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
