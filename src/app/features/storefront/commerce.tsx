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
  useRouteError,
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

import { Account } from "./auth";
import { AddressManager } from "./profile";

export function Cart() {
  const {
    cart,
    remove,
    qty,
    products,
    setCartSelection,
    setAllCartSelection,
  } = useStore();
  const lines = cart.flatMap((line) => {
    const item = products.find((product) => product.id === line.id);
    return item
      ? [{
          item,
          quantity: line.quantity,
          selectedForCheckout: line.selectedForCheckout,
        }]
      : [];
  });
  const selectedLines = lines.filter((line) => line.selectedForCheckout);
  const selected = selectedLines.map((line) => line.item.id);
  const total = selectedLines.reduce(
    (n, x) => n + x.item.price * x.quantity,
    0,
  );
  const allSelected =
    lines.length > 0 && selectedLines.length === lines.length;
  const toggleSelected = (id: string) => {
    const line = cart.find((item) => item.id === id);
    if (line) setCartSelection(id, !line.selectedForCheckout);
  };
  return (
    <Layout>
      <main className="mx-auto max-w-[1160px] px-5 py-10 lg:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-[.18em] text-muted-foreground">
              YOUR BAG
            </p>
            <h1 className="mt-3 font-serif text-5xl">A few good things.</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Choose the pieces you would like to bring home today.
            </p>
          </div>
          {lines.length > 0 && (
            <label className="flex cursor-pointer items-center gap-3 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) => setAllCartSelection(event.target.checked)}
                className="h-4 w-4 accent-[#292622]"
              />
              {allSelected ? "Unselect all orders" : "Select all orders"}
            </label>
          )}
        </div>
        {!lines.length ? (
          <Empty
            title="Your bag is waiting."
            text="Find a piece that feels like home."
            cta="Shop collection"
            to="/home#shop"
          />
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_350px]">
            <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <p className="text-sm font-semibold">
                  {selectedLines.length} of {lines.length} pieces selected
                </p>
                <span className="text-xs text-muted-foreground">
                  Selection updates your total
                </span>
              </div>
              <div className="divide-y divide-border">
              {lines.map(({ item, quantity, selectedForCheckout }) => {
                const isSelected = selectedForCheckout;
                const stockLimit =
                  typeof item.stockQuantity === "number"
                    ? Math.max(0, item.stockQuantity)
                    : null;
                const atStockLimit =
                  stockLimit !== null && quantity >= stockLimit;
                return (
                <article
                  className={`flex gap-4 p-4 transition sm:p-5 ${
                    isSelected ? "bg-[#fcfbf8]" : "bg-card opacity-65"
                  }`}
                  key={item.id}
                >
                  <button
                    onClick={() => toggleSelected(item.id)}
                    aria-label={`${isSelected ? "Remove" : "Add"} ${item.name} from checkout`}
                    className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition ${
                      isSelected
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card"
                    }`}
                  >
                    {isSelected && <Check size={12} />}
                  </button>
                  <ImageWithFallback
                    src={item.images[0]}
                    alt={item.name}
                    className="h-28 w-24 rounded-2xl object-cover"
                  />
                  <div className="flex flex-1 flex-col">
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.color}
                        </p>
                      </div>
                      <p className="text-sm">{money(item.price * quantity)}</p>
                    </div>
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex h-9 items-center rounded-xl border border-border bg-card">
                        <button
                          onClick={() => qty(item.id, quantity - 1)}
                          className="grid h-full w-8 place-items-center"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-7 text-center text-xs">
                          {quantity}
                        </span>
                        <button
                          onClick={() => qty(item.id, quantity + 1)}
                          disabled={atStockLimit}
                          className="grid h-full w-8 place-items-center disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label={
                            atStockLimit
                              ? `Maximum available stock is ${stockLimit}`
                              : `Increase ${item.name} quantity`
                          }
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          remove(item.id);
                        }}
                        className="flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4"
                      >
                        <Trash2 size={13} />
                        Remove
                      </button>
                    </div>
                    <p
                      className={`mt-2 text-[10px] ${
                        atStockLimit
                          ? "font-semibold text-[#9a6047]"
                          : "text-muted-foreground"
                      }`}
                    >
                      {atStockLimit
                        ? `Maximum stock reached · ${stockLimit} available`
                        : stockLimit === null
                          ? "Checking live availability"
                          : `${stockLimit} available`}
                    </p>
                  </div>
                </article>
                );
              })}
              </div>
            </section>
            <aside className="h-fit overflow-hidden rounded-3xl border border-border bg-card shadow-sm lg:sticky lg:top-24">
              <div className="bg-[#292622] p-6 text-[#f5f1e9]">
                <p className="text-[10px] font-bold tracking-[.16em] text-white/60">
                  ORDER SUMMARY
                </p>
                <h2 className="mt-2 font-serif text-3xl">Selected pieces.</h2>
              </div>
              <div className="p-6">
              <p className="flex justify-between text-sm">
                <span className="text-muted-foreground">Selected items</span>
                <span>{selectedLines.length}</span>
              </p>
              <div className="mt-5 space-y-3 border-y border-border py-4 text-sm">
                <p className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{money(total)}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">White-glove delivery</span>
                  <span>Free</span>
                </p>
              </div>
              <p className="mt-5 flex justify-between font-semibold">
                <span>Total</span>
                <span>{money(total)}</span>
              </p>
              <Link
                to={
                  selectedLines.length
                    ? `/checkout?items=${selected.join(",")}`
                    : "/cart"
                }
                className={`mt-6 flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold ${
                  selectedLines.length
                    ? "bg-foreground text-background"
                    : "pointer-events-none bg-secondary text-muted-foreground"
                }`}
              >
                {selectedLines.length
                  ? "Proceed to checkout"
                  : "Select a piece to continue"}
              </Link>
              <p className="mt-4 flex items-start gap-2 text-[10px] leading-4 text-muted-foreground">
                <ShieldCheck size={14} className="shrink-0" />
                Only selected pieces will move to secure checkout.
              </p>
              </div>
            </aside>
          </div>
        )}
      </main>
    </Layout>
  );
}

export function Wishlist() {
  const { saved, toggle, add, products } = useStore();
  const [notice, setNotice] = useState("");
  const savedItems = products.filter((p) => saved.includes(p.id));
  return (
    <Layout>
      <main className="mx-auto max-w-[1440px] px-5 py-8 lg:px-10 lg:py-12">
        <section className="relative overflow-hidden rounded-[2rem] bg-[#292a26] px-7 py-10 text-[#f7f3eb] sm:px-10 lg:py-14">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_72%_50%,rgba(194,162,123,.35),transparent_48%)]" />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-[10px] font-bold tracking-[.2em] text-[#cfc3b4]">
                YOUR PERSONAL EDIT
              </p>
              <h1 className="mt-4 font-serif text-5xl leading-none sm:text-6xl">
                Keep close.
              </h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-[#d5cdc2]">
                A considered collection of pieces you are returning to—ready
                whenever the room feels right.
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 px-5 py-4">
              <p className="font-serif text-3xl">{savedItems.length}</p>
              <p className="mt-1 text-[10px] font-bold tracking-[.14em] text-[#cfc3b4]">
                SAVED PIECES
              </p>
            </div>
          </div>
        </section>
        {!savedItems.length ? (
          <section className="mt-6 grid min-h-[390px] place-items-center rounded-[2rem] border border-border bg-[#f2ede5] p-8 text-center">
            <div>
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-card text-[#9a765a]">
                <Heart size={22} />
              </span>
              <p className="mt-6 text-[10px] font-bold tracking-[.18em] text-muted-foreground">
                YOUR EDIT IS OPEN
              </p>
              <h2 className="mt-3 font-serif text-4xl">
                Nothing saved just yet.
              </h2>
              <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
                Save the furniture that feels like home, then return to your
                collection whenever inspiration strikes.
              </p>
              <Link
                to="/home#shop"
                className="mt-7 inline-flex rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background"
              >
                Explore collection
              </Link>
            </div>
          </section>
        ) : (
          <>
            <div className="mt-10 flex items-end justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                  SAVED COLLECTION
                </p>
                <h2 className="mt-2 font-serif text-3xl">
                  Pieces with promise.
                </h2>
              </div>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Move a piece to your bag when the time is right.
              </p>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {savedItems.map((p, index) => (
                <article
                  key={p.id}
                  className={`group overflow-hidden rounded-3xl border border-border bg-card shadow-[0_10px_28px_rgba(35,31,27,.05)] ${index === 0 ? "sm:col-span-2 sm:grid sm:grid-cols-[1.08fr_.92fr]" : ""}`}
                >
                <Link
                  to={`/products/${p.id}`}
                    className={`relative block overflow-hidden bg-secondary ${index === 0 ? "aspect-auto min-h-[340px]" : "aspect-[.82]"}`}
                >
                  <ImageWithFallback
                    src={p.images[0]}
                    alt={p.name}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/35 to-transparent" />
                    <span className="absolute left-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-bold tracking-[.1em] text-foreground">
                      SAVED
                    </span>
                </Link>
                  <div
                    className={`p-5 ${index === 0 ? "flex flex-col justify-between" : ""}`}
                  >
                  <div>
                      <p className="text-[10px] font-bold tracking-[.13em] text-muted-foreground">
                        {p.category.toUpperCase()}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold">{p.name}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {p.color}
                      </p>
                      <p className="mt-4 font-serif text-xl">
                        {money(p.price)}
                      </p>
                  </div>
                    <div className="mt-5 flex gap-2">
                    <button
                        onClick={() => {
                          add(p.id);
                          setNotice(`${p.name} added to your bag.`);
                        }}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-foreground px-3 py-3 text-xs font-semibold text-background"
                      >
                        <ShoppingBag size={15} />
                        Add to bag
                    </button>
                    <button
                        onClick={() => {
                          toggle(p.id);
                          setNotice(`${p.name} removed from your wishlist.`);
                        }}
                        aria-label={`Remove ${p.name} from wishlist`}
                        className="grid h-10 w-10 place-items-center rounded-xl border border-border transition hover:bg-secondary"
                    >
                        <Heart size={16} fill="currentColor" />
                    </button>
                  </div>
                </div>
                </article>
              ))}
            </div>
          </>
        )}
        {notice && <Toast message={notice} close={() => setNotice("")} />}
      </main>
    </Layout>
  );
}

export function CustomerOrders() {
  const { user, orders, products } = useStore();
  const [active, setActive] = useState("");
  useEffect(() => {
    if (!active && orders[0]) setActive(orders[0].id);
  }, [active, orders]);
  if (!user) return <Account mode="login" />;
  if (!orders.length)
    return (
      <Layout>
        <main className="mx-auto max-w-[1120px] px-5 py-16">
          <Empty
            title="No orders yet."
            text="Your confirmed purchases will appear here and in the admin workspace instantly."
            cta="Browse collection"
            to="/home#shop"
          />
        </main>
      </Layout>
    );
  const order = orders.find((item) => item.id === active) ?? orders[0];
  const statusLabel = order.status
    .replace(/_/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
  const progress = ["pending", "processing", "packed", "shipped", "delivered"];
  return (
    <Layout>
      <main className="mx-auto max-w-[1120px] px-5 py-12">
        <Link
          to="/profile"
          className="text-xs font-semibold underline underline-offset-4"
        >
          ← Back to account
        </Link>
        <div className="mt-5 flex justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
              LIVE ORDER TRACKING
            </p>
            <h1 className="mt-2 font-serif text-4xl">
              Follow your delivery.
            </h1>
          </div>
          <Status>{statusLabel}</Status>
        </div>
        <div className="mt-7 grid gap-5 lg:grid-cols-[.65fr_1.35fr]">
          <aside className="overflow-hidden rounded-3xl border border-border bg-card">
            {orders.map((item) => (
              <button
                onClick={() => setActive(item.id)}
                key={item.id}
                className={`w-full border-b border-border p-5 text-left ${
                  active === item.id ? "bg-secondary" : ""
                }`}
              >
                <b className="text-sm">#{item.order_number}</b>
                <p className="mt-2 text-xs text-muted-foreground">
                  {item.status.replace(/_/g, " ")} · {money(Number(item.total))}
                </p>
              </button>
            ))}
          </aside>
          <section className="overflow-hidden rounded-3xl border border-border bg-card">
            <div className="flex gap-5 p-6">
              {order.order_items[0]?.image_url && (
                <ImageWithFallback
                  src={order.order_items[0].image_url}
                  alt="Order item"
                  className="h-32 w-28 rounded-2xl object-cover"
                />
              )}
              <div>
                <h2 className="font-serif text-3xl">
                  Order #{order.order_number}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {order.order_items
                    .map(
                      (item) =>
                        item.product_name +
                        (item.quantity > 1 ? ` × ${item.quantity}` : ""),
                    )
                    .join(" · ")}
                </p>
                <p className="mt-3 font-semibold">
                  {money(Number(order.total))}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Placed{" "}
                  {new Date(order.created_at).toLocaleString("en-PH")}
                </p>
              </div>
            </div>
            <ol className="grid gap-5 border-t border-border p-6">
              {progress.map((step, index) => {
                const current = progress.indexOf(order.status);
                return (
                  <li key={step} className="flex gap-3">
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                        index <= current
                          ? "bg-foreground text-background"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {index <= current && <Check size={13} />}
                    </span>
                    <span className="pt-1 text-sm capitalize text-muted-foreground">
                      {step}
                    </span>
                  </li>
                );
              })}
            </ol>
            {order.status === "delivered" && (
              <div className="border-t border-border bg-[#f4f0e9] p-6">
                <p className="text-sm font-semibold">
                  How did your furniture feel at home?
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Rate each delivered product. Your verified review will appear
                  on its product page.
                </p>
                <div className="mt-4 grid gap-2">
                  {order.order_items.map((item) => {
                    const reviewProductId =
                      item.product_id ??
                      products.find(
                        (product) =>
                          product.name.trim().toLowerCase() ===
                          item.product_name.trim().toLowerCase(),
                      )?.id;
                    return reviewProductId ? (
                      <Link
                        key={item.id}
                        to={`/products/${reviewProductId}#reviews`}
                        className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold transition hover:bg-secondary"
                      >
                        <span>{item.product_name}</span>
                        <span className="flex items-center gap-2 text-xs">
                          <Star size={14} />
                          Review product
                        </span>
                      </Link>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </Layout>
  );
}

export function Checkout() {
  const { authReady, cart, user, addresses, products, placeOrder, orders, refreshOrders } = useStore();
  const location = useLocation();
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState("cod");
  const [notice, setNotice] = useState("");
  const [placing, setPlacing] = useState(false);
  const [completed, setCompleted] = useState<{
    id: string;
    orderNumber: string;
    total: number;
  } | null>(null);
  const searchParams = new URLSearchParams(location.search);
  const paymentReturn = searchParams.get("payment");
  const returnOrderId = searchParams.get("order");
  const requestedIds = searchParams
    .get("items")
    ?.split(",")
    .filter(Boolean);
  const checkoutCart = requestedIds?.length
    ? cart.filter((line) => requestedIds.includes(line.id))
    : cart;
  const lines = checkoutCart.flatMap((line) => {
    const item = products.find((product) => product.id === line.id);
    return item ? [{ item, quantity: line.quantity }] : [];
  });
  useEffect(() => {
    if (!addresses.length) {
      setAddress("");
      return;
    }
    if (!addresses.some((item) => item.id === address)) {
      setAddress(
        addresses.find((item) => item.primary)?.id ?? addresses[0].id,
      );
    }
  }, [address, addresses]);
  useEffect(() => {
    if (!returnOrderId || !paymentReturn) return;
    if (paymentReturn === "cancelled") {
      void supabase.functions
        .invoke("cancel-paymongo-checkout", { body: { orderId: returnOrderId } })
        .then(() => refreshOrders());
      setNotice("Payment was cancelled. No charge was made.");
      return;
    }
    void refreshOrders();
  }, [paymentReturn, refreshOrders, returnOrderId]);
  useEffect(() => {
    if (paymentReturn !== "success" || !returnOrderId) return;
    const returnedOrder = orders.find((order) => order.id === returnOrderId);
    if (!returnedOrder) return;
    setCompleted({
      id: returnedOrder.id,
      orderNumber: returnedOrder.order_number,
      total: Number(returnedOrder.total),
    });
  }, [orders, paymentReturn, returnOrderId]);
  const total = lines.reduce(
    (sum, line) => sum + line.item.price * line.quantity,
    0,
  );
  const eta = new Date(Date.now() + 5 * 86_400_000).toLocaleDateString(
    "en-PH",
    { month: "long", day: "numeric", year: "numeric" },
  );
  if (!authReady) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Restoring your secure checkout…
      </div>
    );
  }
  if (!user) return <Account mode="login" />;
  if (completed)
    return (
      <Layout>
        <main className="mx-auto flex min-h-[calc(100vh-160px)] max-w-[760px] items-center px-5 py-14">
          <section className="w-full overflow-hidden rounded-[2rem] border border-border bg-card text-center shadow-[0_18px_55px_rgba(35,31,27,.08)]">
            <div className="bg-[#292622] px-7 py-9 text-[#f5f1e9]">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#e3ecdf] text-[#56714f]">
                <Check size={27} />
              </span>
              <p className="mt-5 text-[10px] font-bold tracking-[.18em] text-white/60">
                ORDER RECEIVED
              </p>
              <h1 className="mt-2 font-serif text-4xl">
                Your order is pending.
              </h1>
            </div>
            <div className="p-7">
              <p className="text-sm leading-6 text-muted-foreground">
                Thank you. Your order is now pending confirmation while we
                securely review your delivery details and chosen payment
                method.
              </p>
              <div className="mt-6 grid gap-3 rounded-2xl bg-secondary p-4 text-left sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-bold tracking-[.14em] text-muted-foreground">
                    ORDER STATUS
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    Pending confirmation
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-[.14em] text-muted-foreground">
                    ESTIMATED DELIVERY
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    On or before {eta}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-[.14em] text-muted-foreground">
                    ORDER REFERENCE
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    #{completed.orderNumber}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-[.14em] text-muted-foreground">
                    ORDER TOTAL
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    {money(completed.total)}
                  </p>
                </div>
              </div>
              <p className="mt-5 text-xs leading-5 text-muted-foreground">
                We will send updates as your pieces are confirmed, prepared,
                shipped, out for delivery, and delivered.
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  to="/orders"
                  className="rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background"
                >
                  Track order
                </Link>
                <Link
                  to="/home"
                  className="rounded-xl border border-border px-5 py-3 text-sm font-semibold"
                >
                  Continue browsing
                </Link>
              </div>
            </div>
          </section>
        </main>
      </Layout>
    );
  if (!lines.length)
    return (
      <Layout>
        <main className="mx-auto max-w-[1100px] px-5 py-16">
          <Empty
            title="Your bag is ready when you are."
            text="Add a piece before checking out."
            cta="Browse collection"
            to="/home#shop"
          />
        </main>
      </Layout>
    );
  const chosen = addresses.find((item) => item.id === address) ?? addresses[0];
  const methods = [
    {
      id: "cod",
      name: "Cash on delivery",
      detail: "Pay when your delivery arrives",
      icon: "COD",
      available: true,
    },
    {
      id: "card",
      name: "Debit or credit card",
      detail: "Secure PayMongo test checkout",
      icon: "••••",
      available: true,
    },
    {
      id: "gcash",
      name: "GCash",
      detail: "Secure PayMongo test checkout",
      icon: "G",
      available: true,
    },
  ];
  return (
    <Layout>
      <main className="mx-auto max-w-[1240px] px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-[.18em] text-muted-foreground">
              SECURE CHECKOUT
            </p>
            <h1 className="mt-3 font-serif text-5xl">Bring it home.</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              A few final details, then we will take care of the rest.
            </p>
          </div>
          <span className="rounded-full bg-[#e3ecdf] px-3 py-2 text-xs font-semibold text-[#56714f]">
            Supabase-secured checkout
          </span>
        </div>
        <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
          <div className="grid gap-5">
            <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="flex justify-between">
                <div>
                  <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                    01 · SAVED ADDRESS
                  </p>
                  <h2 className="mt-2 text-xl font-semibold">
                    Where should we deliver?
                  </h2>
                </div>
                <Link
                  to="/profile"
                  className="text-xs font-semibold underline underline-offset-4"
                >
                  Manage
                </Link>
              </div>
              <div className="mt-5 grid gap-3">
                {addresses.length ? (
                  addresses.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setAddress(item.id)}
                      className={`relative rounded-2xl border p-4 text-left ${address === item.id ? "border-foreground bg-[#f4f0e9] ring-1 ring-foreground" : "border-border"}`}
                    >
                      <span
                        className={`absolute right-4 top-4 grid h-5 w-5 place-items-center rounded-full border ${address === item.id ? "bg-foreground text-background" : ""}`}
                      >
                        {address === item.id && <Check size={12} />}
                      </span>
                      <div className="flex gap-2">
                        <b className="text-sm">{item.label}</b>
                        {item.primary && (
                          <span className="rounded-full bg-[#e3ecdf] px-2 py-1 text-[9px] font-bold text-[#56714f]">
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <p className="mt-3 text-sm font-semibold">
                        {item.name} · {item.mobile}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.line}, {item.barangay}, {item.city},{" "}
                        {item.province} {item.postal}
                      </p>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-5">
                    <p className="mb-5 text-sm leading-6 text-muted-foreground">
                      Add a delivery address to continue. It will be stored
                      securely in your Supabase profile and available for
                      future orders.
                    </p>
                    <AddressManager
                      notify={(message) => {
                        setNotice(message);
                      }}
                    />
                  </div>
                )}
              </div>
            </section>
            <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                02 · RECIPIENT DETAILS
              </p>
              <h2 className="mt-2 text-xl font-semibold">
                We will keep you updated.
              </h2>
              {chosen ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-secondary p-4">
                    <p className="text-[10px] font-bold tracking-[.1em] text-muted-foreground">
                      MOBILE
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      {chosen.mobile}
                    </p>
                  </div>
                  <div className="rounded-xl bg-secondary p-4">
                    <p className="text-[10px] font-bold tracking-[.1em] text-muted-foreground">
                      EMAIL RECEIPT
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      {chosen.email}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-xl bg-secondary p-4 text-sm text-muted-foreground">
                  Recipient contact details will appear after you save a
                  delivery address.
                </div>
              )}
            </section>
            <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
                03 · PAYMENT METHOD
              </p>
              <h2 className="mt-2 text-xl font-semibold">Choose how to pay.</h2>
              <div className="mt-5 grid gap-3">
                {methods.map((method) => (
                  <button
                    key={method.id}
                    disabled={!method.available}
                    onClick={() => method.available && setPayment(method.id)}
                    className={`flex items-center gap-3 rounded-2xl border p-4 text-left disabled:cursor-not-allowed disabled:opacity-45 ${payment === method.id ? "border-foreground bg-[#f4f0e9] ring-1 ring-foreground" : "border-border"}`}
                  >
                    <span
                      className={`grid h-10 w-10 place-items-center rounded-xl text-xs font-bold ${payment === method.id ? "bg-foreground text-background" : "bg-secondary"}`}
                    >
                      {method.icon}
                    </span>
                    <span className="flex-1">
                      <b className="block text-sm">{method.name}</b>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {method.detail}
                      </span>
                    </span>
                    <span
                      className={`grid h-5 w-5 place-items-center rounded-full border ${payment === method.id ? "bg-foreground text-background" : ""}`}
                    >
                      {payment === method.id && <Check size={12} />}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>
          <aside className="h-fit overflow-hidden rounded-3xl border border-border bg-card shadow-sm xl:sticky xl:top-24">
            <div className="bg-[#292622] p-6 text-[#f5f1e9]">
              <p className="text-[10px] font-bold tracking-[.16em] text-white/60">
                ORDER SUMMARY
              </p>
              <h2 className="mt-2 font-serif text-3xl">Your selection.</h2>
            </div>
            <div className="p-6">
              <div className="divide-y divide-border">
                {lines.map(({ item, quantity }) => (
                  <div className="flex gap-3 py-3 first:pt-0" key={item.id}>
                    <ImageWithFallback
                      src={item.images[0]}
                      alt={item.name}
                      className="h-14 w-12 rounded-lg object-cover"
                    />
                    <div className="flex-1 text-xs">
                      <b>{item.name}</b>
                      <p className="mt-1 text-muted-foreground">
                        Qty {quantity}
                      </p>
                    </div>
                    <span className="text-xs">
                      {money(item.price * quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-2 border-t border-border pt-4 text-sm">
                <p className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{money(total)}</span>
                </p>
                <p className="flex justify-between">
                  <span>White-glove delivery</span>
                  <span>Free</span>
                </p>
                <p className="mt-2 flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>{money(total)}</span>
                </p>
              </div>
              <button
                disabled={placing || !chosen}
                onClick={async () => {
                  if (!chosen) {
                    setNotice(
                      "Add and save a delivery address before placing your order.",
                    );
                    return;
                  }
                  setPlacing(true);
                  const result = await placeOrder(
                    chosen.id,
                    payment,
                    requestedIds,
                  );
                  setPlacing(false);
                  if (result.error) {
                    setNotice(result.error);
                    return;
                  }
                  if (result.checkoutUrl) {
                    window.location.assign(result.checkoutUrl);
                    return;
                  }
                  setCompleted({
                    id: result.id ?? crypto.randomUUID(),
                    orderNumber:
                      result.orderNumber ??
                      (result.id ?? crypto.randomUUID())
                        .slice(0, 8)
                        .toUpperCase(),
                    total,
                  });
                }}
                className="mt-6 h-12 w-full rounded-xl bg-foreground text-sm font-semibold text-background disabled:opacity-60"
              >
                {placing
                  ? payment === "cod" ? "Placing COD order…" : "Opening secure PayMongo checkout…"
                  : !chosen
                    ? "Save a delivery address to continue"
                    : payment === "cod"
                      ? `Place COD order · ${money(total)}`
                      : `Pay securely · ${money(total)}`}
              </button>
              {notice && (
                <div className="mt-4 rounded-xl bg-[#e3ecdf] p-3 text-xs font-semibold text-[#56714f]">
                  {notice}
                </div>
              )}
              <p className="mt-4 flex gap-2 text-[10px] leading-4 text-muted-foreground">
                <ShieldCheck size={14} />
                Your order is securely recorded in Supabase. Online payments
                are completed on PayMongo and synchronized to the admin workspace.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </Layout>
  );
}

export function CheckoutErrorBoundary() {
  const error = useRouteError();
  useEffect(() => {
    console.error("Checkout route error", error);
    void supabase.rpc("report_client_error", {
      p_message: error instanceof Error ? error.message : String(error ?? "Unknown checkout error"),
      p_stack: error instanceof Error ? error.stack ?? "" : "",
      p_path: window.location.pathname + window.location.search,
      p_context: "checkout_boundary",
      p_user_agent: window.navigator.userAgent,
    });
  }, [error]);
  return (
    <Layout>
      <main className="mx-auto flex min-h-[calc(100vh-160px)] max-w-[680px] items-center px-5 py-14">
        <section className="w-full rounded-[2rem] border border-border bg-card p-8 text-center shadow-sm">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-secondary">
            <ShoppingBag size={21} />
          </span>
          <p className="mt-5 text-[10px] font-bold tracking-[.18em] text-muted-foreground">
            CHECKOUT PAUSED
          </p>
          <h1 className="mt-2 font-serif text-4xl">
            Let&apos;s try that again.
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Your bag is safe. Reload checkout, or return to your bag and review
            your delivery details.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background"
            >
              Reload checkout
            </button>
            <Link
              to="/cart"
              className="rounded-xl border border-border px-5 py-3 text-sm font-semibold"
            >
              Return to bag
            </Link>
          </div>
        </section>
      </main>
    </Layout>
  );
}
