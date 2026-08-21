import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  createBrowserRouter,
  Link,
  Navigate,
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
import { ResilientImage } from "@/components/media/ResilientImage";
import cozyCraftLogo from "@/assets/branding/cozycraft-logo.png";
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
} from "@/services/supabase/client";
import {
  isPaymentMethodAvailable,
  validateCheckoutAmount,
} from "@/lib/settings/store-settings";
import { primaryProductImage } from "@/lib/catalog/product-images";
import {
  DEFAULT_DELIVERY_SERVICE_AREAS,
  deliveryAreaForAddress,
  deliveryFeeFor,
  type DeliveryServiceArea,
} from "@/lib/catalog/delivery";
import { getDeliveryServiceAreas } from "@/services/catalog/experience.service";
import {
  isRecoverablePendingPayment,
  paymentHandoffUrl,
  paymentReturnUrl,
  pendingPaymentOrderUrl,
  readPendingPaymentRecovery,
  writePendingPaymentRecovery,
} from "@/lib/commerce/payment-recovery";
import { stagePaymentHandoff } from "@/lib/commerce/payment-handoff";
import { findPendingPaymentRecovery } from "@/services/commerce/payment-recovery.service";

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

import { Account } from "@/app/features/storefront/authentication/CustomerAuth";
import { AddressManager } from "@/app/features/storefront/account/CustomerAccount";

function usePendingPaymentRedirect({
  enabled,
  userId,
  orders,
  refreshOrders,
}: {
  enabled: boolean;
  userId: string | null;
  orders: DbOrder[];
  refreshOrders: () => Promise<string | null>;
}) {
  const nav = useNavigate();
  const inFlightLookup = useRef<{
    key: string;
    token: symbol;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lookupKey = enabled && userId ? `${userId}:${attempt}` : null;
  const [settledLookupKey, setSettledLookupKey] = useState<string | null>(null);
  const checking = Boolean(lookupKey && settledLookupKey !== lookupKey);
  const [error, setError] = useState("");
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!enabled || !userId) return;
    const retryOnPageRestore = () => retry();
    const retryWhenVisible = () => {
      if (document.visibilityState === "visible") retry();
    };
    window.addEventListener("pageshow", retryOnPageRestore);
    window.addEventListener("focus", retryOnPageRestore);
    document.addEventListener("visibilitychange", retryWhenVisible);
    return () => {
      window.removeEventListener("pageshow", retryOnPageRestore);
      window.removeEventListener("focus", retryOnPageRestore);
      document.removeEventListener("visibilitychange", retryWhenVisible);
    };
  }, [enabled, retry, userId]);

  useEffect(() => {
    if (!enabled || !userId) return;
    const localRecovery = readPendingPaymentRecovery(
      window.localStorage,
      userId,
    );
    const loadedRecovery = orders.find((order) =>
      isRecoverablePendingPayment(order),
    );
    const recoveryOrderId = localRecovery?.orderId ?? loadedRecovery?.id;
    if (recoveryOrderId) {
      nav(pendingPaymentOrderUrl(recoveryOrderId), { replace: true });
    }
  }, [enabled, nav, orders, userId]);

  useEffect(() => {
    if (!enabled || !userId) {
      setSettledLookupKey(null);
      setError("");
      inFlightLookup.current = null;
      return;
    }
    const currentLookupKey = `${userId}:${attempt}`;
    if (inFlightLookup.current?.key === currentLookupKey) return;
    const requestToken = Symbol(currentLookupKey);
    inFlightLookup.current = { key: currentLookupKey, token: requestToken };
    setError("");
    let active = true;

    void (async () => {
      try {
        const localRecovery = readPendingPaymentRecovery(
          window.localStorage,
          userId,
        );
        if (localRecovery) {
          if (active) {
            nav(pendingPaymentOrderUrl(localRecovery.orderId), {
              replace: true,
            });
          }
          return;
        }

        const { recovery, error: lookupError } =
          await findPendingPaymentRecovery(userId);
        if (!active) return;
        if (recovery) {
          writePendingPaymentRecovery(window.localStorage, userId, recovery);
          nav(pendingPaymentOrderUrl(recovery.orderId), { replace: true });
          return;
        }
        if (lookupError) {
          setError(
            "We could not check your reserved payment just now. Please try again.",
          );
          setSettledLookupKey(currentLookupKey);
          return;
        }

        // Keep the normal order store current as well, but do not poll. The
        // dedicated lookup above is the authoritative lightweight recovery path.
        const refreshError = await refreshOrders();
        if (!active) return;
        if (refreshError) {
          setError(
            "We could not refresh your orders just now. Your payment reservation is still safe.",
          );
        }
        setSettledLookupKey(currentLookupKey);
      } catch {
        if (!active) return;
        setSettledLookupKey(currentLookupKey);
        setError(
          "We could not check your reserved payment just now. Please try again.",
        );
      } finally {
        if (inFlightLookup.current?.token === requestToken) {
          inFlightLookup.current = null;
        }
      }
    })();

    return () => {
      active = false;
      if (inFlightLookup.current?.token === requestToken) {
        inFlightLookup.current = null;
      }
    };
  }, [attempt, enabled, nav, refreshOrders, userId]);

  return { checking, error, retry };
}

export function Cart() {
  const {
    cart,
    remove,
    qty,
    products,
    addresses,
    setCartSelection,
    setAllCartSelection,
    authReady,
    userId,
    orders,
    refreshOrders,
  } = useStore();
  const [deliveryAreas, setDeliveryAreas] = useState<DeliveryServiceArea[]>(
    DEFAULT_DELIVERY_SERVICE_AREAS,
  );
  useEffect(() => {
    let active = true;
    void getDeliveryServiceAreas()
      .then((areas) => {
        if (active && areas.length) setDeliveryAreas(areas);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
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
  const subtotal = selectedLines.reduce(
    (n, x) => n + x.item.price * x.quantity,
    0,
  );
  const deliveryAddress =
    addresses.find((item) => item.primary) ?? addresses[0];
  const deliveryArea = deliveryAddress
    ? deliveryAreaForAddress(deliveryAreas, deliveryAddress)
    : null;
  const deliveryFee = deliveryArea
    ? deliveryFeeFor(deliveryArea, subtotal)
    : null;
  const total = subtotal + (deliveryFee ?? 0);
  const allSelected =
    lines.length > 0 && selectedLines.length === lines.length;
  const cartCatalogHydrating = cart.length > 0 && lines.length === 0;
  const paymentRecovery = usePendingPaymentRedirect({
    enabled:
      authReady &&
      Boolean(userId) &&
      cart.length === 0 &&
      !cartCatalogHydrating,
    userId,
    orders,
    refreshOrders,
  });
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
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
            <h1 className="mt-3 font-serif text-4xl sm:text-5xl">A few good things.</h1>
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
        {!authReady || cartCatalogHydrating || (!lines.length && paymentRecovery.checking) ? (
          <section
            role="status"
            aria-live="polite"
            className="mt-8 grid min-h-[340px] place-items-center rounded-3xl border border-dashed border-border bg-card px-6 text-center"
          >
            <div>
              <span className="mx-auto block h-9 w-9 animate-spin rounded-full border-[3px] border-border border-t-foreground" />
              <p className="mt-5 text-sm font-semibold">
                {!authReady
                  ? "Restoring your CozyCraft account…"
                  : cartCatalogHydrating
                    ? "Restoring your saved bag…"
                    : "Checking for an unfinished payment…"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Your saved pieces and reserved orders remain safe.
              </p>
            </div>
          </section>
        ) : !lines.length && paymentRecovery.error ? (
          <section className="mt-8 grid min-h-[300px] place-items-center rounded-3xl border border-border bg-card px-6 text-center">
            <div className="max-w-md">
              <p className="text-sm font-semibold">Payment check interrupted</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {paymentRecovery.error}
              </p>
              <button
                type="button"
                onClick={paymentRecovery.retry}
                className="mt-5 rounded-xl bg-foreground px-5 py-3 text-xs font-semibold text-background"
              >
                Check again
              </button>
            </div>
          </section>
        ) : !lines.length ? (
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
                  <ResilientImage
                    src={primaryProductImage(item)}
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
                        onClick={() => setRemoveTarget({ id: item.id, name: item.name })}
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
                  <span>{money(subtotal)}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">
                    Delivery{deliveryArea ? ` · ${deliveryArea.name}` : ""}
                  </span>
                  <span>
                    {deliveryFee === null
                      ? "At checkout"
                      : deliveryFee > 0
                        ? money(deliveryFee)
                        : "Free"}
                  </span>
                </p>
                {deliveryArea?.free_delivery_minimum !== null && deliveryArea && deliveryArea.free_delivery_minimum > subtotal && (
                  <p className="text-[10px] leading-4 text-muted-foreground">
                    Add {money(deliveryArea.free_delivery_minimum - subtotal)} more for free delivery to {deliveryArea.name}.
                  </p>
                )}
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
      {removeTarget && <div role="dialog" aria-modal="true" aria-labelledby="remove-cart-title" className="fixed inset-0 z-[110] grid place-items-center bg-black/45 p-4 backdrop-blur-sm"><section className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary"><Trash2 size={18} /></span><p className="mt-5 text-[10px] font-bold tracking-[.16em] text-muted-foreground">REMOVE FROM BAG</p><h2 id="remove-cart-title" className="mt-2 font-serif text-3xl">Remove {removeTarget.name}?</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">This piece will leave your bag. You can add it again from the collection at any time.</p><div className="mt-7 grid grid-cols-2 gap-3"><button onClick={() => setRemoveTarget(null)} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold">Keep item</button><button onClick={() => { remove(removeTarget.id); setRemoveTarget(null); }} className="rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background">Remove</button></div></section></div>}
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
            <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] items-stretch gap-5">
              {savedItems.map((p) => (
                <article
                  key={p.id}
                  className="group flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-[0_10px_28px_rgba(35,31,27,.05)]"
                >
                <Link
                  to={`/products/${p.id}`}
                    className="relative block aspect-[4/3] overflow-hidden bg-secondary sm:aspect-[5/4]"
                >
                  <ResilientImage
                    src={primaryProductImage(p)}
                    alt={p.name}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/35 to-transparent" />
                    <span className="absolute left-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-bold tracking-[.1em] text-foreground">
                      SAVED
                    </span>
                </Link>
                  <div
                    className="flex flex-1 flex-col p-5"
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
                    <div className="mt-auto flex gap-2 pt-5">
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
                <ResilientImage
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
  const { authReady, cart, user, userId, addresses, products, placeOrder, orders, refreshOrders, storeSettings } = useStore();
  const location = useLocation();
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState("cod");
  const [notice, setNotice] = useState("");
  const [placing, setPlacing] = useState(false);
  const [paymentHandoff, setPaymentHandoff] = useState<
    "preparing" | "redirecting" | null
  >(null);
  const [deliveryAreas, setDeliveryAreas] = useState<DeliveryServiceArea[]>(
    DEFAULT_DELIVERY_SERVICE_AREAS,
  );
  const [completed, setCompleted] = useState<{
    id: string;
    orderNumber: string;
    total: number;
  } | null>(null);
  const searchParams = new URLSearchParams(location.search);
  const legacyPaymentReturn = searchParams.get("payment");
  const legacyReturnOrderId = searchParams.get("order");
  const legacyReturnState =
    legacyPaymentReturn === "success"
      ? "success"
      : legacyPaymentReturn === "cancelled"
        ? "cancelled"
        : null;
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
  const checkoutCatalogHydrating =
    checkoutCart.length > 0 && lines.length === 0;
  const paymentRecovery = usePendingPaymentRedirect({
    enabled:
      authReady &&
      Boolean(userId) &&
      lines.length === 0 &&
      !completed &&
      !checkoutCatalogHydrating &&
      !legacyReturnState,
    userId,
    orders,
    refreshOrders,
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
    let active = true;
    void getDeliveryServiceAreas(true)
      .then((areas) => {
        if (active && areas.length) setDeliveryAreas(areas);
      })
      .catch(() => {
        // Keep the safe seeded values; the order RPC verifies the final fee.
      });
    return () => {
      active = false;
    };
  }, []);
  const subtotal = lines.reduce(
    (sum, line) => sum + line.item.price * line.quantity,
    0,
  );
  const chosen = addresses.find((item) => item.id === address) ?? addresses[0];
  const deliveryArea = chosen
    ? deliveryAreaForAddress(deliveryAreas, chosen)
    : null;
  const deliveryFee = deliveryArea ? deliveryFeeFor(deliveryArea, subtotal) : 0;
  const total = subtotal + deliveryFee;
  const checkoutError = validateCheckoutAmount(subtotal, storeSettings.checkout_settings);
  const methods = [
    {
      id: "cod",
      name: "Cash on delivery",
      detail: storeSettings.checkout_settings.cod_maximum_order > 0
        ? `Available up to ${money(storeSettings.checkout_settings.cod_maximum_order)}`
        : "Pay when your delivery arrives",
      icon: "COD",
      available: isPaymentMethodAvailable("cod", subtotal, storeSettings.checkout_settings),
    },
    {
      id: "card",
      name: "Debit or credit card",
      detail: "Secure PayMongo checkout",
      icon: "••••",
      available: isPaymentMethodAvailable("card", subtotal, storeSettings.checkout_settings),
    },
    {
      id: "gcash",
      name: "GCash",
      detail: "Secure PayMongo checkout",
      icon: "G",
      available: isPaymentMethodAvailable("gcash", subtotal, storeSettings.checkout_settings),
    },
  ];
  useEffect(() => {
    if (methods.some((method) => method.id === payment && method.available)) return;
    setPayment(methods.find((method) => method.available)?.id ?? "");
  }, [payment, subtotal, storeSettings.checkout_settings.card_enabled, storeSettings.checkout_settings.cod_enabled, storeSettings.checkout_settings.cod_maximum_order, storeSettings.checkout_settings.gcash_enabled]);
  const eta = new Date(Date.now() + (deliveryArea?.lead_time_max_days ?? storeSettings.fulfillment_settings.estimated_delivery_days_max) * 86_400_000).toLocaleDateString(
    "en-PH",
    { month: "long", day: "numeric", year: "numeric" },
  );
  // Compatibility bridge for PayMongo sessions created before the dedicated
  // return route was deployed. Never let an old callback render Checkout.
  if (legacyReturnState && legacyReturnOrderId) {
    return (
      <Navigate
        replace
        to={paymentReturnUrl(legacyReturnState, legacyReturnOrderId)}
      />
    );
  }
  if (!authReady) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Restoring your secure checkout…
      </div>
    );
  }
  if (!user) return <Account mode="login" />;
  if (paymentHandoff) {
    const payingWithGcash = payment === "gcash";
    return (
      <main
        className="fixed inset-0 z-[300] grid min-h-[100dvh] place-items-center overflow-y-auto bg-[#f5f2ec] px-5 py-10"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <section className="w-full max-w-[520px] overflow-hidden rounded-[2rem] border border-[#ded7cc] bg-white text-center shadow-[0_28px_80px_rgba(41,38,34,.14)]">
          <div className="bg-[#292622] px-7 py-9 text-[#f7f3eb]">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-white/15 bg-white/10">
              <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/25 border-t-white" />
            </div>
            <p className="mt-6 text-[10px] font-bold tracking-[.2em] text-white/60">
              SECURE PAYMENT HANDOFF
            </p>
            <h1 className="mt-3 font-serif text-3xl sm:text-4xl">
              {paymentHandoff === "redirecting"
                ? "PayMongo is ready."
                : "Connecting securely to PayMongo."}
            </h1>
          </div>
          <div className="px-6 py-7 sm:px-9">
            <p className="mx-auto max-w-[390px] text-sm leading-6 text-muted-foreground">
              Please keep this window open while we reserve your pieces and
              prepare your secure {payingWithGcash ? "GCash" : "card"} checkout.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2" aria-hidden="true">
              {["Validate", "Reserve", "Redirect"].map((label, index) => (
                <div key={label} className="min-w-0">
                  <span
                    className={`mx-auto grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold ${
                      paymentHandoff === "redirecting" || index < 2
                        ? "bg-[#292622] text-white"
                        : "bg-[#ece7df] text-[#777169]"
                    }`}
                  >
                    {paymentHandoff === "redirecting" || index < 2 ? (
                      <Check size={13} />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="mt-2 block truncate text-[9px] font-bold tracking-[.08em] text-muted-foreground">
                    {label.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-7 flex items-center justify-center gap-2 rounded-xl bg-[#e7efe3] px-4 py-3 text-xs font-semibold text-[#56714f]">
              <ShieldCheck size={16} />
              Your payment details are entered only on PayMongo.
            </div>
          </div>
        </section>
      </main>
    );
  }
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
  if (checkoutCatalogHydrating || (!lines.length && paymentRecovery.checking)) {
    return (
      <Layout>
        <main className="mx-auto grid min-h-[calc(100vh-160px)] max-w-[760px] place-items-center px-5 py-14">
          <section className="w-full rounded-[2rem] border border-border bg-card p-8 text-center shadow-sm" role="status" aria-live="polite">
            <span className="mx-auto block h-10 w-10 animate-spin rounded-full border-[3px] border-border border-t-foreground" />
            <p className="mt-5 text-[10px] font-bold tracking-[.18em] text-muted-foreground">RESTORING CHECKOUT</p>
            <h1 className="mt-2 font-serif text-4xl">Finding your reserved order.</h1>
            <p className="mt-3 text-sm text-muted-foreground">You will be taken to the remaining payment time automatically.</p>
          </section>
        </main>
      </Layout>
    );
  }
  if (!lines.length && paymentRecovery.error) {
    return (
      <Layout>
        <main className="mx-auto grid min-h-[calc(100vh-160px)] max-w-[760px] place-items-center px-5 py-14 text-center">
          <section className="w-full rounded-[2rem] border border-border bg-card p-8 shadow-sm">
            <p className="text-sm font-semibold">Payment check interrupted</p>
            <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted-foreground">
              {paymentRecovery.error}
            </p>
            <button
              type="button"
              onClick={paymentRecovery.retry}
              className="mt-5 rounded-xl bg-foreground px-5 py-3 text-xs font-semibold text-background"
            >
              Check again
            </button>
          </section>
        </main>
      </Layout>
    );
  }
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
  return (
    <Layout>
      <main className="mx-auto max-w-[1240px] px-4 py-7 sm:px-5 sm:py-10">
        <nav aria-label="Checkout progress" className="mb-8 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <ol className="grid grid-cols-4 gap-2">
            {["Bag", "Delivery", "Payment", "Review"].map((step, index) => <li className="min-w-0" key={step}><div className="flex items-center gap-2"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold ${index === 0 ? "bg-[#e3ecdf] text-[#56714f]" : index < 3 ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}>{index === 0 ? <Check size={13} /> : index + 1}</span><span className="hidden truncate text-[10px] font-bold tracking-[.08em] text-muted-foreground sm:block">{step.toUpperCase()}</span></div><span className={`mt-2 block h-1 rounded-full ${index < 3 ? "bg-foreground" : "bg-secondary"}`} /></li>)}
          </ol>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-[.18em] text-muted-foreground">
              SECURE CHECKOUT
            </p>
            <h1 className="mt-3 font-serif text-4xl sm:text-5xl">Bring it home.</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Delivery fees, timing, and free-delivery eligibility are calculated from your saved Philippine address.
            </p>
          </div>
          <span className="rounded-full bg-[#e3ecdf] px-3 py-2 text-xs font-semibold text-[#56714f]">
            Supabase-secured checkout
          </span>
        </div>
        <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
          <div className="grid gap-5">
            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-6">
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
            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-6">
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
                  {deliveryArea && (
                    <div className="rounded-xl bg-[#e3ecdf] p-4 sm:col-span-2">
                      <p className="text-[10px] font-bold tracking-[.1em] text-[#56714f]">
                        DELIVERY PROMISE · {deliveryArea.name.toUpperCase()}
                      </p>
                      <p className="mt-2 text-sm font-semibold">
                        {deliveryArea.lead_time_min_days}–{deliveryArea.lead_time_max_days} days · {deliveryArea.assembly_available ? "Assembly available" : "Assembly not included"}
                      </p>
                      <p className="mt-1 text-xs text-[#56714f]">
                        Free delivery from {money(deliveryArea.free_delivery_minimum ?? 0)}; otherwise {money(deliveryArea.delivery_fee)}.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-5 rounded-xl bg-secondary p-4 text-sm text-muted-foreground">
                  Recipient contact details will appear after you save a
                  delivery address.
                </div>
              )}
            </section>
            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-6">
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
                    <ResilientImage
                      src={primaryProductImage(item)}
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
                  <span>{money(subtotal)}</span>
                </p>
                <p className="flex justify-between">
                  <span>Delivery{deliveryArea ? ` · ${deliveryArea.name}` : ""}</span>
                  <span>{deliveryFee > 0 ? money(deliveryFee) : "Free"}</span>
                </p>
                {deliveryArea?.free_delivery_minimum !== null && deliveryArea && deliveryArea.free_delivery_minimum > subtotal && (
                  <p className="text-[10px] text-muted-foreground">
                    Add {money(deliveryArea.free_delivery_minimum - subtotal)} more for free delivery to {deliveryArea.name}.
                  </p>
                )}
                <p className="mt-2 flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>{money(total)}</span>
                </p>
              </div>
              <button
                disabled={placing || !chosen || !payment || Boolean(checkoutError)}
                onClick={async () => {
                  if (!chosen) {
                    setNotice(
                      "Add and save a delivery address before placing your order.",
                    );
                    return;
                  }
                  if (checkoutError) {
                    setNotice(checkoutError);
                    return;
                  }
                  if (!payment) {
                    setNotice("No payment method is currently available for this order.");
                    return;
                  }
                  const usesPayMongo = payment === "card" || payment === "gcash";
                  setNotice("");
                  setPlacing(true);
                  if (usesPayMongo) setPaymentHandoff("preparing");
                  let result;
                  try {
                    result = await placeOrder(
                      chosen.id,
                      payment,
                      requestedIds,
                    );
                  } catch (error) {
                    setPaymentHandoff(null);
                    setPlacing(false);
                    setNotice(
                      error instanceof Error
                        ? error.message
                        : "Unable to start secure payment. Please try again.",
                    );
                    return;
                  }
                  if (result.error) {
                    setPaymentHandoff(null);
                    setPlacing(false);
                    setNotice(result.error);
                    return;
                  }
                  if (result.checkoutUrl) {
                    if (!result.id) {
                      setPaymentHandoff(null);
                      setPlacing(false);
                      setNotice(
                        "The secure payment order was created without a recovery reference. Please open My Account → Orders before trying again.",
                      );
                      return;
                    }
                    setPaymentHandoff("redirecting");
                    const recoveryExpiresAt =
                      result.expiresAt ??
                      new Date(Date.now() + 15 * 60 * 1000).toISOString();
                    if (userId) {
                      writePendingPaymentRecovery(window.localStorage, userId, {
                        orderId: result.id,
                        orderNumber: result.orderNumber,
                        expiresAt: recoveryExpiresAt,
                      });
                    }
                    // Commit a real, cart-independent same-origin document
                    // before leaving CozyCraft. Browser Back/BFCache will then
                    // restore the payment timer route rather than the submitted
                    // Checkout component whose cart rows were already consumed.
                    const handoffStaged = userId
                      ? stagePaymentHandoff(window.sessionStorage, {
                          userId,
                          orderId: result.id,
                          orderNumber: result.orderNumber,
                          checkoutUrl: result.checkoutUrl,
                          expiresAt: recoveryExpiresAt,
                        })
                      : false;
                    window.location.replace(
                      handoffStaged
                        ? paymentHandoffUrl(result.id)
                        : paymentReturnUrl("pending", result.id),
                    );
                    return;
                  }
                  setPlacing(false);
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
                    : checkoutError
                      ? checkoutError
                      : !payment
                        ? "No payment method available"
                    : payment === "cod"
                      ? `Place COD order · ${money(total)}`
                      : `Pay securely · ${money(total)}`}
              </button>
              {notice && (
                <div className="mt-4 rounded-xl bg-[#e3ecdf] p-3 text-xs font-semibold text-[#56714f]">
                  {notice}
                </div>
              )}
              {!notice && checkoutError && <div className="mt-4 rounded-xl bg-[#f3e5d4] p-3 text-xs font-semibold text-[#8b5c46]">{checkoutError}</div>}
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
