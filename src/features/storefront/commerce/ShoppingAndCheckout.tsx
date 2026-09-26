import { localStore, sessionStore } from "@/lib/shared/browser-storage";
import { FullTracking } from './FullTracking';
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
import { CheckoutVouchers } from "../account/CheckoutVouchers";
import type { CircleReward } from "@/services/content/home-circle.service";
import { voucherDiscount, voucherEligible } from "@/lib/loyalty/vouchers";
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
  Banknote,
  Wallet,
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
import { collapseElement, useCountUp, useInView } from "@/components/storefront/motion";
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
import { isCodOrderPlacementInFlight } from "@/lib/commerce/checkout";
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
  ProductGrid,
  Empty,
  ConfirmSignOut,
  Status,
  ManagedProduct,
  Toast,
  Metric,
  Splash,
  ShopSignInPrompt
} from "@/app/core";

import { Account } from "@/features/storefront/authentication/CustomerAuth";
import { AddressManager } from "@/features/storefront/account/CustomerAccount";

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
      localStore,
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
          localStore,
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
          writePendingPaymentRecovery(localStore, userId, recovery);
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
    add,
    products,
    addresses,
    setCartSelection,
    setAllCartSelection,
    authReady,
    userId,
    orders,
    refreshOrders,
    closeMiniCart,
    catalogPending,
  } = useStore();
  const [deliveryAreas, setDeliveryAreas] = useState<DeliveryServiceArea[]>(
    DEFAULT_DELIVERY_SERVICE_AREAS,
  );
  const [undo, setUndo] = useState<{ id: string; name: string; quantity: number; selected: boolean } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
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
  const animatedSubtotal = useCountUp(subtotal);
  const animatedTotal = useCountUp(total);
  const freeMinimum = deliveryArea?.free_delivery_minimum ?? null;
  const freeProgress = freeMinimum ? Math.min(100, (subtotal / freeMinimum) * 100) : 0;
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
  const pairings = useMemo(() => {
    const inBag = new Set(cart.map((line) => line.id));
    const rooms = new Set(lines.map((line) => line.item.category));
    return [...products]
      .filter((product) => !inBag.has(product.id) && (rooms.size === 0 || rooms.has(product.category)) && product.stockQuantity !== 0)
      .sort((a, b) => b.reviews - a.reviews || Number(b.rating) - Number(a.rating))
      .slice(0, 4);
  }, [cart, lines, products]);
  const toggleSelected = (id: string) => {
    const line = cart.find((item) => item.id === id);
    if (line) setCartSelection(id, !line.selectedForCheckout);
  };
  const removeLine = async (id: string, name: string, quantity: number, isSelected: boolean) => {
    if (removing) return;
    setRemoving(id);
    await collapseElement(rowRefs.current.get(id) ?? null);
    remove(id);
    setRemoving(null);
    setUndo({ id, name, quantity, selected: isSelected });
  };
  const restoreLine = () => {
    if (!undo) return;
    add(undo.id, undo.quantity);
    if (!undo.selected) setCartSelection(undo.id, false);
    // Restoring is not a new add; batching keeps the bag drawer closed.
    closeMiniCart?.();
    setUndo(null);
  };
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <Layout>
      <main className="mx-auto max-w-[1240px] px-4 py-8 sm:px-5 lg:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold tracking-[.2em] text-muted-foreground">
              YOUR BAG{itemCount ? ` · ${itemCount} ${itemCount === 1 ? "PIECE" : "PIECES"}` : ""}
            </p>
            <h1 className="cc-enter-up mt-3 font-serif text-5xl leading-none tracking-[-.02em] sm:text-6xl">A few good things.</h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Choose the pieces you would like to bring home today.
            </p>
          </div>
          {lines.length > 0 && (
            <label className="flex h-11 cursor-pointer items-center gap-3 rounded-full border border-border bg-card px-4 text-xs font-semibold shadow-[var(--shadow-soft)]">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) => setAllCartSelection(event.target.checked)}
                className="h-4 w-4 accent-[#292622]"
              />
              {allSelected ? "Unselect all items" : "Select all items"}
            </label>
          )}
        </div>
        {!authReady || cartCatalogHydrating || (!lines.length && paymentRecovery.checking) ? (
          <section
            role="status"
            aria-live="polite"
            className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]"
          >
            <div className="grid gap-3 rounded-[1.75rem] border border-border bg-card p-5">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex gap-4">
                  <div className="cc-skeleton h-28 w-24 rounded-2xl" />
                  <div className="flex-1 space-y-3 pt-2"><div className="cc-skeleton h-4 w-1/2 rounded-full" /><div className="cc-skeleton h-3 w-1/4 rounded-full" /><div className="cc-skeleton mt-6 h-9 w-28 rounded-xl" /></div>
                </div>
              ))}
            </div>
            <div className="cc-skeleton h-72 rounded-[1.75rem]" />
            <p className="sr-only">
              {!authReady
                ? "Restoring your CozyCraft account…"
                : cartCatalogHydrating
                  ? "Restoring your saved bag…"
                  : "Checking for an unfinished payment…"}
            </p>
          </section>
        ) : !lines.length && paymentRecovery.error ? (
          <section className="mt-8 grid min-h-[300px] place-items-center rounded-[1.75rem] border border-border bg-card px-6 text-center">
            <div className="max-w-md">
              <p className="text-sm font-semibold">Payment check interrupted</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {paymentRecovery.error}
              </p>
              <button
                type="button"
                onClick={paymentRecovery.retry}
                className="cc-press mt-5 rounded-xl bg-foreground px-5 py-3 text-xs font-semibold text-background"
              >
                Check again
              </button>
            </div>
          </section>
        ) : !lines.length ? (
          <Empty
            icon={ShoppingBag}
            title="Your bag is waiting."
            text="Find a piece that feels like home — it will gather here until you are ready."
            cta="Shop the collection"
            to="/shop"
            secondary={{ label: "View wishlist", to: "/wishlist" }}
          />
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px] lg:gap-8">
            <section className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                <p className="text-sm font-semibold">
                  {selectedLines.length} of {lines.length} pieces selected
                </p>
                <span className="hidden text-xs text-muted-foreground sm:inline">
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
                  ref={(node) => { if (node) rowRefs.current.set(item.id, node); else rowRefs.current.delete(item.id); }}
                  className={`flex gap-4 p-4 transition-[background-color,opacity] duration-300 sm:gap-5 sm:p-5 ${
                    isSelected ? "bg-card" : "bg-[#faf8f5] opacity-70"
                  }`}
                  key={item.id}
                >
                  <button
                    onClick={() => toggleSelected(item.id)}
                    aria-pressed={isSelected}
                    aria-label={`${isSelected ? "Remove" : "Add"} ${item.name} ${isSelected ? "from" : "to"} checkout`}
                    className={`cc-press mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors ${
                      isSelected
                        ? "border-foreground bg-foreground text-background"
                        : "border-[#bdb4a7] bg-card"
                    }`}
                  >
                    {isSelected && <Check size={13} strokeWidth={3} className="cc-enter-pop" />}
                  </button>
                  <Link to={`/products/${item.id}`} className="cc-media h-32 w-24 shrink-0 overflow-hidden rounded-2xl bg-secondary sm:h-36 sm:w-28">
                    <ResilientImage
                      src={primaryProductImage(item)}
                      alt={item.name}
                      className="h-full w-full object-cover transition duration-700 hover:scale-105"
                    />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-[.12em] text-muted-foreground">{item.subcategory || item.category}</p>
                        <Link to={`/products/${item.id}`} className="mt-1 block font-semibold leading-snug underline-offset-4 hover:underline">{item.name}</Link>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.color}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums">{money(item.price * quantity)}</p>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
                      <div className="flex h-10 items-center rounded-full border border-border bg-background">
                        <button
                          onClick={() => quantity <= 1 ? void removeLine(item.id, item.name, quantity, isSelected) : qty(item.id, quantity - 1)}
                          aria-label={quantity <= 1 ? `Remove ${item.name}` : `Decrease ${item.name} quantity`}
                          className="grid h-full w-10 place-items-center rounded-full hover:bg-secondary"
                        >
                          {quantity <= 1 ? <Trash2 size={14} /> : <Minus size={14} />}
                        </button>
                        <span className="w-7 text-center text-sm font-semibold tabular-nums" aria-live="polite">
                          {quantity}
                        </span>
                        <button
                          onClick={() => qty(item.id, quantity + 1)}
                          disabled={atStockLimit}
                          className="grid h-full w-10 place-items-center rounded-full hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label={
                            atStockLimit
                              ? `Maximum available stock is ${stockLimit}`
                              : `Increase ${item.name} quantity`
                          }
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        onClick={() => void removeLine(item.id, item.name, quantity, isSelected)}
                        disabled={removing === item.id}
                        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Trash2 size={13} />
                        Remove
                      </button>
                    </div>
                    <p
                      className={`mt-2 text-[11px] ${
                        atStockLimit
                          ? "font-semibold text-[#9a6047]"
                          : "text-muted-foreground"
                      }`}
                    >
                      {atStockLimit
                        ? `Maximum stock reached · ${stockLimit} available`
                        : stockLimit === null
                          ? "Checking live availability"
                          : stockLimit <= 8
                            ? `Only ${stockLimit} left`
                            : "In stock, ready to deliver"}
                    </p>
                  </div>
                </article>
                );
              })}
              </div>
            </section>
            <aside className="h-fit overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[var(--shadow-soft)] lg:sticky lg:top-24">
              <div className="relative overflow-hidden bg-[#292622] p-6 text-[#f5f1e9]">
                <div className="absolute inset-y-0 right-0 w-2/3 bg-[radial-gradient(circle_at_80%_30%,rgba(194,162,123,.3),transparent_60%)]" />
                <p className="relative text-[11px] font-bold tracking-[.18em] text-white/60">
                  ORDER SUMMARY
                </p>
                <h2 className="relative mt-2 font-serif text-3xl">Selected pieces.</h2>
              </div>
              <div className="p-6">
              {freeMinimum !== null && freeMinimum > 0 && deliveryArea && (
                <div className="mb-5 rounded-2xl bg-secondary/70 p-4">
                  <p className="text-xs font-semibold">
                    {subtotal >= freeMinimum ? <span className="inline-flex items-center gap-1.5 text-[var(--tone-success-fg)]"><Check size={13} strokeWidth={3} /> Free delivery to {deliveryArea.name} unlocked</span> : <>You’re {money(freeMinimum - subtotal)} away from free delivery</>}
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white" role="progressbar" aria-label="Progress to free delivery" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(freeProgress)}>
                    <span className="block h-full rounded-full bg-[#6c805f] transition-[width] duration-700 ease-[cubic-bezier(.22,1,.36,1)]" style={{ width: `${freeProgress}%` }} />
                  </div>
                </div>
              )}
              <div className="space-y-3 text-sm">
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal · {selectedLines.length} {selectedLines.length === 1 ? "piece" : "pieces"}</span>
                  <span className="tabular-nums">{money(Math.round(animatedSubtotal))}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">
                    Delivery{deliveryArea ? ` · ${deliveryArea.name}` : ""}
                  </span>
                  <span className="tabular-nums">
                    {deliveryFee === null
                      ? "At checkout"
                      : deliveryFee > 0
                        ? money(deliveryFee)
                        : "Free"}
                  </span>
                </p>
              </div>
              <p className="mt-5 flex items-baseline justify-between border-t border-border pt-5 font-semibold">
                <span>Total</span>
                <span className="text-2xl tabular-nums">{money(Math.round(animatedTotal))}</span>
              </p>
              <Link
                to={
                  selectedLines.length
                    ? `/checkout?items=${selected.join(",")}`
                    : "/cart"
                }
                aria-disabled={!selectedLines.length}
                className={`cc-press mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold ${
                  selectedLines.length
                    ? "bg-foreground text-background shadow-[0_10px_24px_rgba(28,27,25,.18)] hover:bg-[#35322e]"
                    : "pointer-events-none bg-secondary text-muted-foreground"
                }`}
              >
                {selectedLines.length
                  ? <>Proceed to checkout <ArrowRight size={16} /></>
                  : "Select a piece to continue"}
              </Link>
              <p className="mt-4 flex items-start gap-2 text-[11px] leading-4 text-muted-foreground">
                <ShieldCheck size={14} className="shrink-0" />
                Only selected pieces move to secure checkout. Payment details are never stored by CozyCraft.
              </p>
              </div>
            </aside>
          </div>
        )}
        {pairings.length > 0 && !(!authReady || cartCatalogHydrating) && (
          <section className="mt-20 border-t border-border pt-12" aria-labelledby="cart-pairings-title">
            <div data-reveal className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold tracking-[.18em] text-muted-foreground">{lines.length ? "PAIRS WELL WITH YOUR BAG" : "CUSTOMER FAVOURITES"}</p>
                <h2 id="cart-pairings-title" className="mt-3 font-serif text-4xl">{lines.length ? "Complete the room." : "A place to begin."}</h2>
              </div>
              <Link to="/shop" className="cc-underline hidden text-sm font-semibold sm:inline-block">Shop all</Link>
            </div>
            <ProductGrid className="mt-9" products={pairings} pending={catalogPending} skeletons={4} />
          </section>
        )}
      </main>
      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-[var(--mobile-store-nav-height)] z-30 flex items-center gap-3 border-t border-border bg-[#fbfaf7]/95 px-4 py-3 shadow-[0_-12px_30px_rgba(35,31,27,.12)] backdrop-blur-xl lg:hidden">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground">{selectedLines.length} selected · Total</p>
            <p className="text-base font-bold tabular-nums">{money(Math.round(animatedTotal))}</p>
          </div>
          <Link
            to={selectedLines.length ? `/checkout?items=${selected.join(",")}` : "/cart"}
            aria-disabled={!selectedLines.length}
            className={`cc-press inline-flex h-12 items-center gap-2 rounded-xl px-5 text-sm font-semibold ${selectedLines.length ? "bg-foreground text-background" : "pointer-events-none bg-secondary text-muted-foreground"}`}
          >
            Checkout <ArrowRight size={15} />
          </Link>
        </div>
      )}
      {undo && (
        <Toast
          message={`${undo.name} was removed from your bag.`}
          tone="info"
          action={{ label: "Undo", onClick: restoreLine }}
          close={() => setUndo(null)}
        />
      )}
    </Layout>
  );
}

export function Wishlist() {
  const { saved, toggle, add, products, catalogPending } = useStore();
  const [undo, setUndo] = useState<{ id: string; name: string } | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const savedItems = products.filter((p) => saved.includes(p.id));
  const savedValue = savedItems.reduce((sum, product) => sum + product.price, 0);
  const removeSaved = async (id: string, name: string) => {
    const card = cardRefs.current.get(id);
    if (card && typeof card.animate === "function" && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      await card.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.94)" }], { duration: 260, easing: "cubic-bezier(.65,0,.35,1)", fill: "forwards" }).finished.catch(() => undefined);
    }
    toggle(id);
    setUndo({ id, name });
  };
  return (
    <Layout>
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-5 lg:px-10 lg:py-10">
        <section className="relative overflow-hidden rounded-[2rem] bg-[#292a26] px-7 py-10 text-[#f7f3eb] sm:px-10 lg:py-16">
          <div className="absolute inset-y-0 right-0 w-2/3 bg-[radial-gradient(circle_at_72%_50%,rgba(194,162,123,.38),transparent_52%)]" />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="cc-rise text-[11px] font-bold tracking-[.22em] text-[#cfc3b4]">
                YOUR PERSONAL EDIT
              </p>
              <h1 className="cc-rise mt-4 font-serif text-5xl leading-none sm:text-7xl" style={{ ["--i" as string]: 1 }}>
                Keep close.
              </h1>
              <p className="cc-rise mt-5 max-w-md text-sm leading-6 text-[#d5cdc2]" style={{ ["--i" as string]: 2 }}>
                A considered collection of pieces you are returning to — ready
                whenever the room feels right.
              </p>
            </div>
            <div className="cc-rise flex gap-3" style={{ ["--i" as string]: 3 }}>
              <div className="rounded-2xl border border-white/15 bg-white/5 px-5 py-4 backdrop-blur-sm">
                <p className="font-serif text-4xl tabular-nums">{savedItems.length}</p>
                <p className="mt-1 text-[11px] font-bold tracking-[.14em] text-[#cfc3b4]">SAVED PIECES</p>
              </div>
              {savedItems.length > 0 && (
                <div className="hidden rounded-2xl border border-white/15 bg-white/5 px-5 py-4 backdrop-blur-sm sm:block">
                  <p className="font-serif text-4xl tabular-nums">{money(savedValue)}</p>
                  <p className="mt-1 text-[11px] font-bold tracking-[.14em] text-[#cfc3b4]">TOTAL VALUE</p>
                </div>
              )}
            </div>
          </div>
        </section>
        {catalogPending ? (
          <ProductGrid className="mt-10" products={[]} pending skeletons={4} />
        ) : !savedItems.length ? (
          <Empty
            icon={Heart}
            title="Nothing saved just yet."
            text="Tap the heart on any piece to keep it here, then return whenever inspiration strikes."
            cta="Explore the collection"
            to="/shop"
            secondary={{ label: "New arrivals", to: "/new-arrivals" }}
          />
        ) : (
          <>
            <div className="mt-12 flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold tracking-[.18em] text-muted-foreground">
                  SAVED COLLECTION
                </p>
                <h2 className="mt-2 font-serif text-4xl">
                  Pieces with promise.
                </h2>
              </div>
              <p className="hidden text-sm text-muted-foreground sm:block">
                Move a piece to your bag when the time is right.
              </p>
            </div>
            <div className="cc-reveal-grid mt-8 grid grid-cols-1 gap-5 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {savedItems.map((p) => {
                const soldOut = p.stockQuantity === 0;
                return (
                <article
                  key={p.id}
                  ref={(node) => { if (node) cardRefs.current.set(p.id, node); else cardRefs.current.delete(p.id); }}
                  data-reveal
                  data-fly-source
                  className="group flex h-full min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[var(--shadow-soft)] transition-shadow duration-500 hover:shadow-[var(--shadow-raised)]"
                >
                  <Link
                    to={`/products/${p.id}`}
                    className="cc-media relative block aspect-[4/5] overflow-hidden bg-secondary"
                  >
                    <ResilientImage
                      src={primaryProductImage(p)}
                      alt={p.name}
                      className="h-full w-full object-cover transition duration-[1100ms] ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-105"
                    />
                    {soldOut && <span className="absolute left-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">Sold out</span>}
                  </Link>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-[11px] font-bold tracking-[.13em] text-muted-foreground">
                      {p.category.toUpperCase()}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold leading-snug"><Link to={`/products/${p.id}`} className="underline-offset-4 hover:underline">{p.name}</Link></h3>
                    <p className="mt-1 text-sm text-muted-foreground">{p.color}</p>
                    <p className="mt-3 font-serif text-2xl tabular-nums">{money(p.price)}</p>
                    <div className="mt-auto flex gap-2 pt-5">
                      <button
                        onClick={() => add(p.id)}
                        disabled={soldOut}
                        className="cc-press flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-foreground px-3 text-sm font-semibold text-background hover:bg-[#35322e] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <ShoppingBag size={15} />
                        {soldOut ? "Sold out" : "Add to bag"}
                      </button>
                      <button
                        onClick={() => void removeSaved(p.id, p.name)}
                        aria-label={`Remove ${p.name} from wishlist`}
                        className="cc-press grid h-12 w-12 place-items-center rounded-xl border border-border text-[#9a4f46] hover:bg-secondary"
                      >
                        <Heart size={17} fill="currentColor" />
                      </button>
                    </div>
                  </div>
                </article>
                );
              })}
            </div>
          </>
        )}
        {undo && <Toast message={`${undo.name} was removed from your wishlist.`} tone="info" action={{ label: "Undo", onClick: () => toggle(undo.id) }} close={() => setUndo(null)} />}
      </main>
    </Layout>
  );
}

export function CustomerOrders() {
  const { user, orders, authReady, refreshOrders, customerOrderPagination: pagination } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const requested = new URLSearchParams(location.search).get('order');
  useEffect(() => { if (authReady && user) void refreshOrders(); }, [authReady,user,refreshOrders,requested]);
  useEffect(() => { if (pagination && pagination.status !== 'all') pagination.setStatus('all'); }, [pagination?.status]);
  // Give the initially displayed order a stable URL too. Browsing the picker
  // must not switch the tracking detail until the customer chooses an order.
  useEffect(() => {
    if (authReady && user && !requested && orders[0]) {
      navigate('/orders?order='+encodeURIComponent(orders[0].id), {replace:true});
    }
  }, [authReady,user,requested,orders,navigate]);
  if (!authReady) return <Layout><main className="full-tracking" role="status">Loading your account…</main></Layout>;
  if (!user) return <Account mode="login" />;
  const order = requested ? orders.find(item=>item.id===requested) : orders[0];
  if (!order && pagination?.busy) return <Layout><main className="full-tracking" role="status">Loading your order…</main></Layout>;
  if (!order) return <Layout><main className="full-tracking"><Empty title={requested?"Order tracking is not available yet.":"No orders to track yet."} text={requested?"This order may still be loading or is not available to your account. Return to your orders to try again.":"Your placed orders will appear in your account."} cta="Back to orders" to="/profile?tab=orders"/></main></Layout>;
  return <Layout><FullTracking order={order} orders={pagination ? orders.filter(item=>pagination.ids.includes(item.id)) : orders} onSelect={id=>navigate('/orders?order='+encodeURIComponent(id))} pagination={pagination ? {page:pagination.page,total:pagination.total,onChange:pagination.setPage,busy:pagination.busy,error:pagination.error} : undefined}/></Layout>;
}

export function Checkout() {
  const { authReady, cart, user, userId, addresses, products, placeOrder, orders, refreshOrders, storeSettings, profilePaymentMethod } = useStore();
  const location = useLocation();
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState("cod");
  const paymentChosenByCustomer=useRef(false);
  useEffect(()=>{paymentChosenByCustomer.current=false;},[userId]);
  useEffect(()=>{if(!paymentChosenByCustomer.current)setPayment(profilePaymentMethod);},[profilePaymentMethod,userId]);
  const [notice, setNotice] = useState("");
  const [placing, setPlacing] = useState(false);
  const [placingPaymentMethod, setPlacingPaymentMethod] = useState("");
  const [selectedVoucher,setSelectedVoucher]=useState<CircleReward|null>(null);
  useEffect(()=>setSelectedVoucher(null),[userId]);
  const [voucherRevision,setVoucherRevision]=useState(0);
  const [voucherNow,setVoucherNow]=useState(Date.now);
  useEffect(()=>{const timer=setInterval(()=>setVoucherNow(Date.now()),1000);return()=>clearInterval(timer)},[]);
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
      !placing &&
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
  const discount = voucherDiscount(selectedVoucher,subtotal,deliveryFee,voucherNow);
  const voucherError = selectedVoucher && !voucherEligible(selectedVoucher,subtotal,voucherNow) ? "Your voucher is expired or its minimum spend is not met. Choose another voucher or select No voucher." : "";
  const total = subtotal + deliveryFee - discount;
  const checkoutError = validateCheckoutAmount(subtotal, storeSettings.checkout_settings);
  const methods = [
    {
      id: "cod",
      name: "Cash on delivery",
      detail: storeSettings.checkout_settings.cod_maximum_order > 0
        ? `Available up to ${money(storeSettings.checkout_settings.cod_maximum_order)}`
        : "Pay when your delivery arrives",
      icon: <Banknote size={18} />,
      available: isPaymentMethodAvailable("cod", subtotal, storeSettings.checkout_settings),
    },
    {
      id: "card",
      name: "Debit or credit card",
      detail: "Secure PayMongo checkout",
      icon: <CreditCard size={18} />,
      available: isPaymentMethodAvailable("card", subtotal, storeSettings.checkout_settings),
    },
    {
      id: "gcash",
      name: "GCash",
      detail: "Secure PayMongo checkout",
      icon: <Wallet size={18} />,
      available: isPaymentMethodAvailable("gcash", subtotal, storeSettings.checkout_settings),
    },
  ];
  useEffect(() => {
    if (methods.some((method) => method.id === payment && method.available)) return;
    setPayment(methods.find((method) => method.available)?.id ?? "");
  }, [payment, subtotal, storeSettings.checkout_settings.card_enabled, storeSettings.checkout_settings.cod_enabled, storeSettings.checkout_settings.cod_maximum_order, storeSettings.checkout_settings.gcash_enabled]);
  const checkoutSteps = ["Bag", "Delivery", "Payment", "Review"];
  const currentStep = !chosen ? 1 : !payment ? 2 : 3;
  const [summaryRef, summaryInView] = useInView<HTMLElement>({ threshold: 0.15 }, false);
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
  if (
    isCodOrderPlacementInFlight(
      placing,
      placingPaymentMethod || payment,
      completed?.id,
    )
  ) {
    return (
      <main
        className="fixed inset-0 z-[300] grid min-h-[100dvh] place-items-center overflow-y-auto bg-[#f5f2ec] px-5 py-10"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <section className="w-full max-w-[520px] overflow-hidden rounded-[2rem] border border-[#ded7cc] bg-white text-center shadow-[0_28px_80px_rgba(41,38,34,.14)]">
          <div className="bg-[#292622] px-7 py-9 text-[#f7f3eb]">
            <span className="mx-auto block h-12 w-12 animate-spin rounded-full border-[3px] border-white/25 border-t-white" />
            <p className="mt-6 text-[11px] font-bold tracking-[.2em] text-white/60">
              CASH ON DELIVERY
            </p>
            <h1 className="mt-3 font-serif text-3xl sm:text-4xl">
              Placing your order.
            </h1>
          </div>
          <div className="px-6 py-7 sm:px-9">
            <p className="mx-auto max-w-[390px] text-sm leading-6 text-muted-foreground">
              Please keep this page open while we confirm your pieces, delivery
              address, and available stock. Your order confirmation will appear
              here automatically.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-[#e7efe3] px-4 py-3 text-xs font-semibold text-[#56714f]">
              <ShieldCheck size={16} />
              Your bag will update only after the order is safely recorded.
            </div>
          </div>
        </section>
      </main>
    );
  }
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
            <p className="mt-6 text-[11px] font-bold tracking-[.2em] text-white/60">
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
                    className={`mx-auto grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold ${
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
                  <span className="mt-2 block truncate text-[10px] font-bold tracking-[.08em] text-muted-foreground">
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
              <span className="cc-ring relative mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e3ecdf] text-[#56714f]">
                <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path className="cc-draw" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              </span>
              <p className="mt-5 text-[11px] font-bold tracking-[.18em] text-white/60">
                ORDER RECEIVED
              </p>
              <h1 className="mt-2 font-serif text-4xl">
                {payment === "cod"
                  ? "Your COD order is placed."
                  : "Your order is pending."}
              </h1>
            </div>
            <div className="p-7">
              <p className="text-sm leading-6 text-muted-foreground">
                {payment === "cod"
                  ? "Thank you. Your Cash on Delivery order has been recorded successfully. You will pay when your furniture arrives."
                  : "Thank you. Your order is now pending confirmation while we securely review your delivery details and chosen payment method."}
              </p>
              <div className="mt-6 grid gap-3 rounded-2xl bg-secondary p-4 text-left sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-bold tracking-[.14em] text-muted-foreground">
                    ORDER STATUS
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    Pending confirmation
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold tracking-[.14em] text-muted-foreground">
                    ESTIMATED DELIVERY
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    On or before {eta}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold tracking-[.14em] text-muted-foreground">
                    ORDER REFERENCE
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    #{completed.orderNumber}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold tracking-[.14em] text-muted-foreground">
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
            <p className="mt-5 text-[11px] font-bold tracking-[.18em] text-muted-foreground">RESTORING CHECKOUT</p>
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
        <nav aria-label="Checkout progress" className="mb-8 rounded-[1.5rem] border border-border bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5">
          <ol className="grid grid-cols-4 gap-2 sm:gap-3">
            {checkoutSteps.map((step, index) => {
              const done = index < currentStep;
              const current = index === currentStep;
              return (
                <li className="min-w-0" key={step} aria-current={current ? "step" : undefined}>
                  <div className="flex items-center gap-2">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold transition-colors duration-500 ${done ? "bg-[var(--tone-success-bg)] text-[var(--tone-success-fg)]" : current ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}>
                      {done ? <Check size={14} strokeWidth={3} className="cc-enter-pop" /> : index + 1}
                    </span>
                    <span className={`hidden truncate text-[11px] font-bold tracking-[.08em] sm:block ${current ? "text-foreground" : "text-muted-foreground"}`}>{step.toUpperCase()}</span>
                  </div>
                  <span className="mt-2.5 block h-1 overflow-hidden rounded-full bg-secondary">
                    <span className={`block h-full rounded-full bg-foreground transition-[width] duration-700 ease-[cubic-bezier(.22,1,.36,1)] ${done ? "w-full" : current ? "w-1/2" : "w-0"}`} />
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="sr-only" aria-live="polite">Step {currentStep + 1} of 4: {checkoutSteps[currentStep]}</p>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold tracking-[.18em] text-muted-foreground">
              SECURE CHECKOUT
            </p>
            <h1 className="mt-3 font-serif text-4xl sm:text-5xl">Bring it home.</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Delivery fees, timing, and free-delivery eligibility are calculated from your saved Philippine address.
            </p>
            <p className="mt-3 text-sm"><Link to="/refunds" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Read returns & refund policy (opens a new tab)</Link></p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#e3ecdf] px-3.5 py-2 text-xs font-semibold text-[#56714f]">
            <LockKeyhole size={13} /> Secure checkout
          </span>
        </div>
        <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
          <div className="grid gap-5">
            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-6">
              <div className="flex justify-between">
                <div>
                  <p className="text-[11px] font-bold tracking-[.16em] text-muted-foreground">
                    01 · SAVED ADDRESS
                  </p>
                  <h2 className="mt-2 text-xl font-semibold">
                    Where should we deliver?
                  </h2>
                </div>
                <Link
                  to="/profile?tab=addresses"
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
                      aria-pressed={address === item.id}
                      className={`cc-press relative rounded-2xl border p-4 pr-12 text-left transition-colors duration-300 ${address === item.id ? "border-foreground bg-[#f4f0e9] ring-1 ring-foreground" : "border-border hover:border-foreground/40 hover:bg-secondary/40"}`}
                    >
                      <span
                        className={`absolute right-4 top-4 grid h-5 w-5 place-items-center rounded-full border ${address === item.id ? "bg-foreground text-background" : ""}`}
                      >
                        {address === item.id && <Check size={12} />}
                      </span>
                      <div className="flex gap-2">
                        <b className="text-sm">{item.label}</b>
                        {item.primary && (
                          <span className="rounded-full bg-[#e3ecdf] px-2 py-1 text-[10px] font-bold text-[#56714f]">
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
                      Add a delivery address to continue. It is saved securely
                      to your CozyCraft account and ready for future orders.
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
              <p className="text-[11px] font-bold tracking-[.16em] text-muted-foreground">
                02 · RECIPIENT DETAILS
              </p>
              <h2 className="mt-2 text-xl font-semibold">
                We will keep you updated.
              </h2>
              {chosen ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-secondary p-4">
                    <p className="text-[11px] font-bold tracking-[.1em] text-muted-foreground">
                      MOBILE
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      {chosen.mobile}
                    </p>
                  </div>
                  <div className="rounded-xl bg-secondary p-4">
                    <p className="text-[11px] font-bold tracking-[.1em] text-muted-foreground">
                      EMAIL RECEIPT
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      {chosen.email}
                    </p>
                  </div>
                  {deliveryArea && (
                    <div className="rounded-xl bg-[#e3ecdf] p-4 sm:col-span-2">
                      <p className="text-[11px] font-bold tracking-[.1em] text-[#56714f]">
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
              <p className="text-[11px] font-bold tracking-[.16em] text-muted-foreground">
                03 · PAYMENT METHOD
              </p>
              <h2 className="mt-2 text-xl font-semibold">Choose how to pay.</h2>
              <div className="mt-5 grid gap-3">
                {methods.map((method) => (
                  <button
                    key={method.id}
                    disabled={!method.available}
                    onClick={() => {if(method.available){paymentChosenByCustomer.current=true;setPayment(method.id);}}}
                    aria-pressed={payment === method.id}
                    className={`cc-press flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-45 ${payment === method.id ? "border-foreground bg-[#f4f0e9] ring-1 ring-foreground" : "border-border hover:border-foreground/40 hover:bg-secondary/40"}`}
                  >
                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors duration-300 ${payment === method.id ? "bg-foreground text-background" : "bg-secondary"}`}
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
            {userId && <div className="rounded-2xl border border-border bg-card p-4 sm:rounded-3xl sm:p-6"><CheckoutVouchers key={userId} userId={userId} requestedId={searchParams.get("voucher")} subtotal={subtotal} selected={selectedVoucher} onSelect={setSelectedVoucher} disabled={placing} revision={voucherRevision}/></div>}
          </div>
          <aside ref={summaryRef} id="checkout-summary" className="h-fit scroll-mt-24 overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[var(--shadow-soft)] xl:sticky xl:top-24">
            <div className="bg-[#292622] p-6 text-[#f5f1e9]">
              <p className="text-[11px] font-bold tracking-[.16em] text-white/60">
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
                  <p className="text-[11px] text-muted-foreground">
                    Add {money(deliveryArea.free_delivery_minimum - subtotal)} more for free delivery to {deliveryArea.name}.
                  </p>
                )}
                {discount>0 && <p className="flex justify-between text-[#56714f]"><span>Home Circle voucher</span><span>−{money(discount)}</span></p>}
                <p className="mt-2 flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>{money(total)}</span>
                </p>
                {voucherError && <p className="circle-error" role="alert">{voucherError}</p>}
              </div>
              <button
                disabled={placing || !chosen || !payment || Boolean(checkoutError) || Boolean(voucherError)}
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
                  if(voucherError){setNotice(voucherError);return;}
                  setNotice("");
                  setPlacingPaymentMethod(payment);
                  setPlacing(true);
                  let result;
                  try {
                    result = await placeOrder(
                      chosen.id,
                      payment,
                      requestedIds,
                      selectedVoucher?.id,
                      usesPayMongo ? () => setPaymentHandoff("preparing") : undefined,
                    );
                  } catch (error) {
                    setPaymentHandoff(null);
                    setPlacingPaymentMethod("");
                    setPlacing(false);
                    setNotice(
                      error instanceof Error
                        ? error.message
                        : "Unable to start secure payment. Please try again.",
                    );
                    return;
                  }
                  if (result.error) {
                    setVoucherRevision(n=>n+1);
                    setPaymentHandoff(null);
                    setPlacingPaymentMethod("");
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
                      writePendingPaymentRecovery(localStore, userId, {
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
                      ? stagePaymentHandoff(sessionStore, {
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
                  setCompleted({
                    id: result.id ?? crypto.randomUUID(),
                    orderNumber:
                      result.orderNumber ??
                      (result.id ?? crypto.randomUUID())
                        .slice(0, 8)
                        .toUpperCase(),
                    total: "total" in result && result.total != null ? Number(result.total) : total,
                  });
                  setPlacingPaymentMethod("");
                  setPlacing(false);
                }}
                className="cc-press mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-foreground text-sm font-semibold text-background shadow-[0_10px_24px_rgba(28,27,25,.18)] hover:bg-[#35322e] disabled:opacity-60 disabled:shadow-none"
              >
                {placing && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" aria-hidden="true" />}
                {placing
                  ? payment === "cod" ? "Placing COD order…" : "Verifying your checkout…"
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
              <p className="mt-4 flex gap-2 text-[11px] leading-4 text-muted-foreground">
                <ShieldCheck size={14} />
                Your order is recorded securely in your CozyCraft account.
                Online payments are completed on PayMongo; CozyCraft never sees
                or stores your card details.
              </p>
            </div>
          </aside>
        </div>
      </main>
      <div
        aria-hidden={summaryInView || undefined}
        className={`fixed inset-x-0 bottom-[var(--mobile-store-nav-height)] z-30 flex items-center gap-3 border-t border-border bg-[#fbfaf7]/95 px-4 py-3 shadow-[0_-12px_30px_rgba(35,31,27,.12)] backdrop-blur-xl transition duration-500 ease-[cubic-bezier(.22,1,.36,1)] xl:hidden ${summaryInView ? "pointer-events-none translate-y-[calc(100%+var(--mobile-store-nav-height))] opacity-0" : "translate-y-0 opacity-100"}`}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground">{lines.length} {lines.length === 1 ? "piece" : "pieces"} · Total</p>
          <p className="text-base font-bold tabular-nums">{money(total)}</p>
        </div>
        <button
          type="button"
          tabIndex={summaryInView ? -1 : undefined}
          onClick={() => document.getElementById("checkout-summary")?.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" })}
          className="cc-press inline-flex h-12 items-center gap-2 rounded-xl bg-foreground px-5 text-sm font-semibold text-background"
        >
          Review & pay <ArrowRight size={15} />
        </button>
      </div>
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
          <p className="mt-5 text-[11px] font-bold tracking-[.18em] text-muted-foreground">
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
