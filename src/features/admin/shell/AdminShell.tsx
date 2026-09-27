import { localStore } from "@/lib/shared/browser-storage";
import { createRefreshScheduler } from "@/lib/admin/refresh-scheduler";
import { watchVisibleRecovery } from "@/lib/shared/visible-recovery";
import { adminMfaGate } from "@/lib/auth/admin-mfa-gate";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Link, Outlet, useLocation, useNavigate, useNavigation } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Award,
  Bell,
  Boxes,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  Clock,
  CreditCard,
  Database,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Keyboard,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  Monitor,
  Moon,
  Package,
  PackagePlus,
  Search,
  ServerCog,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Sun,
  UserRound,
  Users,
  Warehouse,
  X,
  type LucideIcon,
} from "lucide-react";
import { ResilientImage } from "@/components/media/ResilientImage";
import cozyCraftLogo from "@/assets/branding/cozycraft-logo.png";
import { isStaffRole, adminSupabase as supabase } from "@/services/supabase/client";
import { adminPathsForRole, canAccessAdminPath } from "@/lib/admin/access";
import { signInForPortal } from "@/services/auth/auth.service";
import { recordAuthActivity } from "@/services/auth/activity.service";
import { useAdminSession, useStore, ConfirmSignOut } from "@/app/core";
import { usePresence } from "@/components/storefront/motion";
import { ConfirmHost, confirmAction } from "@/components/admin/confirm";
import { Avatar, BusyBar, Dialog, isTypingTarget, Segmented, useMediaQuery } from "@/components/admin/ui";
import { resolveAdminTheme, useAdminTheme, type AdminThemePreference } from "@/lib/admin/admin-theme";
import { adminPageLabel } from "@/lib/admin/admin-titles";
import { relativeTime } from "@/lib/admin/format";
import { useAttentionCounts, type AttentionCounts } from "@/services/admin/use-attention-counts";

type IconType = LucideIcon;

/* ------------------------------------------------------------------ */
/* Sign in                                                             */
/* ------------------------------------------------------------------ */

function AdminWordmark({ light = false, className = "h-12 w-32" }: { light?: boolean; className?: string }) {
  return (
    <span className={`block overflow-hidden ${className}`}>
      <ResilientImage
        src={cozyCraftLogo}
        alt="CozyCraft Furniture"
        className={`h-full w-full origin-center scale-[1.34] object-contain ${light ? "brightness-0 invert" : "dark-invert"}`}
      />
    </span>
  );
}

export function AdminLogin() {
  const nav = useNavigate();
  const idleLogout = new URLSearchParams(window.location.search).get("reason") === "idle";
  const { databaseRole: role, authReady, user, signOut } = useAdminSession();
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [awaitingAccess, setAwaitingAccess] = useState(false);
  useEffect(() => {
    if (!authReady || !user || !role) return;
    if (isStaffRole(role)) {
      nav("/admin", { replace: true });
      return;
    }
    void signOut().then(() => {
      setError("Customer accounts cannot use the administrator sign-in.");
    });
  }, [authReady, nav, role, signOut, user]);
  useEffect(() => {
    if (!awaitingAccess) return;
    const timeout = window.setTimeout(() => {
      setAwaitingAccess(false);
      setLoading(false);
      setError("Your credentials were accepted, but the account role could not be loaded. Please try again.");
    }, 8_000);
    return () => window.clearTimeout(timeout);
  }, [awaitingAccess]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signInForPortal(email, password, "admin");
    if (!result.ok) {
      setLoading(false);
      setError(result.error ?? "Administrator sign in failed. Check your credentials and try again.");
      return;
    }
    setAwaitingAccess(true);
  };
  return (
    <main className="min-h-dvh overflow-y-auto bg-canvas p-3 text-foreground sm:p-5 lg:h-dvh lg:overflow-hidden">
      <div className="cc-enter-fade mx-auto grid min-h-[calc(100dvh-1.5rem)] max-w-[1400px] overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-[var(--adm-shadow-pop)] sm:min-h-[calc(100dvh-2.5rem)] sm:rounded-[2rem] lg:h-full lg:min-h-0 lg:grid-cols-[1.1fr_.9fr]">
        <section className="relative hidden overflow-hidden bg-[#1b1917] p-10 text-[#f4f2ee] lg:flex lg:flex-col lg:justify-between">
          <ResilientImage src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1400&q=80" alt="" className="cc-kenburns absolute inset-0 h-full w-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#141210] via-[#171513]/80 to-[#171513]/55" />
          <div className="relative flex items-center justify-between">
            <AdminWordmark light />
            <span className="rounded-full border border-white/20 px-3 py-1.5 text-[10px] font-bold tracking-[.16em] text-white/70">SECURE WORKSPACE</span>
          </div>
          <div className="relative max-w-lg">
            <p className="cc-rise text-[10px] font-bold tracking-[.22em] text-[#d8c7b0]" style={{ ["--i" as string]: 0 }}>COZYCRAFT / OPERATIONS</p>
            <h1 className="cc-rise mt-6 font-serif text-[3.6rem] leading-[1] tracking-[-.03em]" style={{ ["--i" as string]: 1 }}>Care for every detail behind the scenes.</h1>
            <p className="cc-rise mt-7 max-w-sm text-sm leading-7 text-white/70" style={{ ["--i" as string]: 2 }}>One live workspace for catalog, inventory, customers, and every storefront order.</p>
          </div>
          <p className="relative flex items-center gap-2 text-xs text-white/60"><ShieldCheck size={14} /> Protected by two-step verification and role-based access.</p>
        </section>
        <section className="flex min-h-0 items-center justify-center overflow-y-auto px-5 py-8 sm:px-10">
          <form onSubmit={submit} className="cc-enter-up w-full max-w-sm">
            <div className="mb-6 lg:hidden"><AdminWordmark /></div>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-secondary"><LockKeyhole size={15} /></span>
              <p className="adm-eyebrow">Restricted access</p>
            </div>
            <h2 className="mt-4 font-serif text-[2.4rem] leading-[1.05] tracking-[-.02em] sm:text-5xl">Administrator sign in.</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Use an approved staff or administrator account.</p>
            {idleLogout && <p className="mt-4 rounded-xl bg-success-soft p-3 text-xs font-semibold text-success-ink">Your administrator session ended after being inactive. Sign in again to continue securely.</p>}
            <div className="mt-6 grid gap-3.5">
              <label className="adm-label">
                Work email
                <input required type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} className="adm-input h-12 font-normal" placeholder="you@cozycraft.com" />
              </label>
              <label className="adm-label">
                Password
                <span className="relative">
                  <input required type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} className="adm-input h-12 pr-12 font-normal" placeholder="••••••••" />
                  <button type="button" onClick={() => setShow(!show)} disabled={loading} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50">
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </span>
              </label>
            </div>
            {error && <p role="alert" className="cc-enter-fade mt-3 rounded-xl bg-danger-soft p-3 text-xs font-semibold text-danger-ink">{error}</p>}
            <button disabled={loading} className="adm-btn adm-btn-primary mt-5 h-12 w-full text-sm">
              {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              {awaitingAccess ? "Opening secure workspace…" : loading ? "Checking access…" : "Enter operations"}
              {!loading && <ArrowRight size={16} />}
            </button>
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-secondary p-3 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 shrink-0 text-success-ink" size={16} />
              Only approved staff and administrator accounts can enter.
            </div>
            <p className="mt-5 text-center text-sm text-muted-foreground">
              Looking for the storefront? <Link to="/login" className="font-semibold text-foreground underline underline-offset-4">Customer sign in</Link>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Navigation model                                                    */
/* ------------------------------------------------------------------ */

export const adminNav = [
  [LayoutDashboard, "Overview", "/admin"],
  [UserRound, "Team access", "/admin/team"],
  [Package, "Products", "/admin/products"],
  [Boxes, "Categories", "/admin/categories"],
  [Warehouse, "Inventory", "/admin/inventory"],
  [ClipboardList, "Orders", "/admin/orders"],
  [CreditCard, "Payments", "/admin/payments"],
  [Users, "Customers", "/admin/customers"],
  [Award, "Member tiers", "/admin/member-tiers"],
  [Sparkles, "Merchandising", "/admin/experience"],
  [FileText, "Content", "/admin/content"],
  [Star, "Reviews", "/admin/reviews"],
  [ChartNoAxesCombined, "Reports", "/admin/reports"],
  [ServerCog, "Operations health", "/admin/system-health"],
  [Activity, "Activity logs", "/admin/activity-logs"],
  [MessageCircle, "Support", "/admin/support"],
  [Settings, "Settings", "/admin/settings"],
] as const;

export const adminNavGroups = [
  { label: "Overview", description: "Workspace summary", icon: LayoutDashboard, paths: ["/admin"] },
  { label: "Catalog", description: "Products and stock", icon: Package, paths: ["/admin/products", "/admin/categories", "/admin/inventory", "/admin/experience"] },
  { label: "Commerce", description: "Orders and payments", icon: ShoppingBag, paths: ["/admin/orders", "/admin/payments"] },
  { label: "Customer care", description: "People and service", icon: Users, paths: ["/admin/customers", "/admin/member-tiers", "/admin/reviews", "/admin/support"] },
  { label: "Insights", description: "Reports and audit trail", icon: ChartNoAxesCombined, paths: ["/admin/reports", "/admin/system-health", "/admin/activity-logs"] },
  { label: "Administration", description: "Team and configuration", icon: Settings, paths: ["/admin/team", "/admin/settings", "/admin/content"] },
] as const;

type NavItem = (typeof adminNav)[number];

const adminPathIsActive = (pathname: string, path: string) =>
  pathname === path || (path !== "/admin" && pathname.startsWith(`${path}/`));

const goShortcuts: Record<string, string> = {
  h: "/admin",
  o: "/admin/orders",
  p: "/admin/products",
  i: "/admin/inventory",
  c: "/admin/customers",
  s: "/admin/support",
  r: "/admin/reports",
  a: "/admin/activity-logs",
  m: "/admin/member-tiers",
};

function badgeFor(path: string, counts: AttentionCounts | null) {
  if (!counts) return 0;
  if (path === "/admin/orders") return counts.fulfillment + counts.cancellations;
  if (path === "/admin/support") return counts.support;
  if (path === "/admin/inventory") return counts.lowStock;
  return 0;
}

const RECENT_KEY = "cozycraft-admin-recent-pages";
function readRecentPages(): string[] {
  try {
    const value = JSON.parse(localStore.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}
function rememberRecentPage(path: string) {
  const next = [path, ...readRecentPages().filter((item) => item !== path)].slice(0, 5);
  localStore.setItem(RECENT_KEY, JSON.stringify(next));
}

/* ------------------------------------------------------------------ */
/* Command palette                                                     */
/* ------------------------------------------------------------------ */

type PaletteItem = { key: string; group: string; title: string; detail?: string; Icon: IconType; run: () => void; keywords?: string; hint?: string };

function CommandPalette({
  open,
  onClose,
  visibleNav,
  allowed,
  themeResolved,
  onToggleTheme,
  onShowShortcuts,
}: {
  open: boolean;
  onClose: () => void;
  visibleNav: NavItem[];
  allowed: (path: string) => boolean;
  themeResolved: "light" | "dark";
  onToggleTheme: () => void;
  onShowShortcuts: () => void;
}) {
  const nav = useNavigate();
  const { mounted, state } = usePresence(open, 180);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const { adminProducts, orders, customerProfiles, supportTickets } = useStore();

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    const previous = document.activeElement as HTMLElement | null;
    return () => {
      window.clearTimeout(timer);
      previous?.focus?.();
    };
  }, [open]);
  useEffect(() => setActiveIndex(0), [query]);

  const items = useMemo<PaletteItem[]>(() => {
    const term = query.trim().toLocaleLowerCase();
    const matches = (...values: unknown[]) => values.some((value) => String(value ?? "").toLocaleLowerCase().includes(term));
    const go = (route: string) => () => nav(route);
    const labelFor = (path: string) => visibleNav.find(([, , route]) => route === path);

    const actions: PaletteItem[] = [
      ...(allowed("/admin/products") ? [{ key: "a-new-product", group: "Quick actions", title: "Add a product", Icon: PackagePlus, run: go("/admin/products/new"), keywords: "create new catalog" }] : []),
      ...(allowed("/admin/orders") ? [
        { key: "a-fulfill", group: "Quick actions", title: "Orders ready to fulfill", Icon: ClipboardList, run: go("/admin/orders?view=needs_fulfillment&range=all&sort=longest_waiting"), keywords: "ship pack queue" },
        { key: "a-today", group: "Quick actions", title: "Today’s order queue", Icon: Clock, run: go("/admin/orders"), keywords: "orders today" },
      ] : []),
      ...(allowed("/admin/inventory") ? [{ key: "a-stock", group: "Quick actions", title: "Adjust stock", Icon: Warehouse, run: go("/admin/inventory"), keywords: "inventory units restock" }] : []),
      ...(allowed("/admin/support") ? [{ key: "a-support", group: "Quick actions", title: "Open support inbox", Icon: MessageCircle, run: go("/admin/support"), keywords: "tickets help" }] : []),
      { key: "a-theme", group: "Quick actions", title: themeResolved === "dark" ? "Switch to light mode" : "Switch to dark mode", Icon: themeResolved === "dark" ? Sun : Moon, run: onToggleTheme, keywords: "theme appearance dark light" },
      { key: "a-keys", group: "Quick actions", title: "Keyboard shortcuts", Icon: Keyboard, run: onShowShortcuts, keywords: "help keys", hint: "?" },
      { key: "a-store", group: "Quick actions", title: "View the storefront", Icon: ExternalLink, run: () => window.open("/home", "_blank", "noopener"), keywords: "shop site customer" },
    ];

    if (!term) {
      const recent = readRecentPages()
        .map((path) => labelFor(path))
        .filter((item): item is NavItem => Boolean(item))
        .map(([Icon, label, route]) => ({ key: `r-${route}`, group: "Recent", title: label, Icon, run: go(route) }));
      const pages = visibleNav.map(([Icon, label, route]) => ({ key: `p-${route}`, group: "Go to", title: label, Icon, run: go(route) }));
      return [...recent, ...actions.slice(0, 5), ...pages].slice(0, 18);
    }

    const pages = visibleNav
      .filter(([, label]) => matches(label))
      .map(([Icon, label, route]) => ({ key: `p-${route}`, group: "Go to", title: label, Icon, run: go(route) }));
    const matchingActions = actions.filter((action) => matches(action.title, action.keywords));
    const searches: PaletteItem[] = [
      ...(allowed("/admin/orders") ? [{ key: "s-orders", group: "Search everywhere", title: `Search all orders for “${query.trim()}”`, detail: "Order number, customer, email, phone or product", Icon: ClipboardList, run: go(`/admin/orders?range=all&q=${encodeURIComponent(query.trim())}`) }] : []),
      ...(allowed("/admin/customers") ? [{ key: "s-customers", group: "Search everywhere", title: `Search customers for “${query.trim()}”`, detail: "Name, username, email or phone", Icon: Users, run: go(`/admin/customers?q=${encodeURIComponent(query.trim())}`) }] : []),
    ];
    const products = allowed("/admin/products")
      ? adminProducts
          .filter((product) => matches(product.name, product.category, product.subcategory, product.id))
          .slice(0, 5)
          .map((product) => ({ key: `pr-${product.id}`, group: "Products", title: product.name, detail: `${product.category}${product.subcategory ? ` · ${product.subcategory}` : ""} · ${product.stockQuantity ?? 0} in stock`, Icon: Package, run: go(`/admin/products?edit=${encodeURIComponent(product.id)}`) }))
      : [];
    const orderResults = allowed("/admin/orders")
      ? orders
          .filter((order) => matches(order.order_number, order.shipping_address?.name, order.shipping_address?.email))
          .slice(0, 4)
          .map((order) => ({ key: `o-${order.id}`, group: "Orders", title: `Order #${order.order_number}`, detail: `${order.shipping_address?.name || "Customer"} · ${order.status}`, Icon: ClipboardList, run: go(`/admin/orders?order=${encodeURIComponent(order.id)}&q=${encodeURIComponent(order.id)}&range=all`) }))
      : [];
    const customers = allowed("/admin/customers")
      ? customerProfiles
          .filter((customer) => matches(customer.full_name, customer.username, customer.email, customer.phone))
          .slice(0, 4)
          .map((customer) => ({ key: `c-${customer.id}`, group: "Customers", title: customer.full_name || customer.username || "Customer", detail: customer.email || "Customer account", Icon: Users, run: go(`/admin/customers?q=${encodeURIComponent(customer.email || customer.full_name || "")}`) }))
      : [];
    const tickets = allowed("/admin/support")
      ? supportTickets
          .filter((ticket) => matches(ticket.ticket_number, ticket.subject, ticket.profiles?.full_name, ticket.profiles?.email))
          .slice(0, 4)
          .map((ticket) => ({ key: `t-${ticket.id}`, group: "Support", title: `${ticket.subject}`, detail: `Ticket ${ticket.ticket_number} · ${ticket.status.replace(/_/g, " ")}`, Icon: MessageCircle, run: go(`/admin/support?ticket=${encodeURIComponent(ticket.id)}`) }))
      : [];
    return [...searches, ...matchingActions, ...pages, ...products, ...orderResults, ...customers, ...tickets].slice(0, 20);
  }, [adminProducts, allowed, customerProfiles, nav, onShowShortcuts, onToggleTheme, orders, query, supportTickets, themeResolved, visibleNav]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!mounted) return null;
  const choose = (item: PaletteItem) => {
    onClose();
    item.run();
  };
  let lastGroup = "";
  return createPortal(
    <div data-state={state} className="cc-backdrop fixed inset-0 z-[260] flex items-start justify-center bg-[#161412]/45 px-3 pt-[10vh] backdrop-blur-[3px] sm:px-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label="Search and jump" data-state={state} className="cc-popover flex max-h-[76dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-[var(--adm-shadow-pop)]">
        <label className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
          <Search size={18} className="text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            role="combobox"
            aria-expanded="true"
            aria-controls="admin-palette-list"
            aria-activedescendant={items[activeIndex] ? `palette-${items[activeIndex].key}` : undefined}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") { event.preventDefault(); onClose(); }
              if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, items.length - 1)); }
              if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
              if (event.key === "Enter" && items[activeIndex]) { event.preventDefault(); choose(items[activeIndex]); }
            }}
            placeholder="Search products, orders, customers, or jump to a page…"
            className="admin-workspace-search-input h-full min-w-0 flex-1 border-0 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
          <kbd className="adm-kbd hidden sm:inline-grid">Esc</kbd>
          <button type="button" onClick={onClose} className="adm-btn adm-btn-ghost adm-btn-icon adm-btn-sm sm:hidden" aria-label="Close search"><X size={16} /></button>
        </label>
        <div ref={listRef} id="admin-palette-list" role="listbox" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {items.length ? (
            items.map((item, index) => {
              const header = item.group !== lastGroup ? item.group : null;
              lastGroup = item.group;
              return (
                <div key={item.key}>
                  {header && <p className="px-3 pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground first:pt-1">{header}</p>}
                  <button
                    type="button"
                    id={`palette-${item.key}`}
                    role="option"
                    aria-selected={activeIndex === index}
                    data-index={index}
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={() => choose(item)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${activeIndex === index ? "bg-secondary" : ""}`}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-card"><item.Icon size={15} /></span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[13px] font-semibold">{item.title}</b>
                      {item.detail && <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{item.detail}</span>}
                    </span>
                    {item.hint ? <kbd className="adm-kbd">{item.hint}</kbd> : <ArrowRight size={14} className={`text-muted-foreground transition-opacity ${activeIndex === index ? "opacity-100" : "opacity-0"}`} />}
                  </button>
                </div>
              );
            })
          ) : (
            <div className="px-4 py-12 text-center">
              <Search className="mx-auto text-muted-foreground" size={22} />
              <p className="mt-3 text-sm font-semibold">Nothing matches “{query.trim()}”</p>
              <p className="mt-1 text-xs text-muted-foreground">Try an order number, product, customer, or page name.</p>
            </div>
          )}
        </div>
        <footer className="hidden shrink-0 items-center gap-4 border-t border-border bg-subtle px-4 py-2.5 text-[10.5px] text-muted-foreground sm:flex">
          <span className="flex items-center gap-1.5"><kbd className="adm-kbd">↑</kbd><kbd className="adm-kbd">↓</kbd> Move</span>
          <span className="flex items-center gap-1.5"><kbd className="adm-kbd">↵</kbd> Open</span>
          <span className="ml-auto flex items-center gap-1.5"><kbd className="adm-kbd">?</kbd> All shortcuts</span>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Shortcuts help                                                      */
/* ------------------------------------------------------------------ */

const isMac = () => typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);

function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const mod = isMac() ? "⌘" : "Ctrl";
  const sections: Array<[string, Array<[string[], string]>]> = [
    ["Anywhere", [[[mod, "K"], "Search and jump"], [["/"], "Search this page"], [["?"], "Show shortcuts"], [["Esc"], "Close a panel or dialog"]]],
    ["Go to", [[["G", "H"], "Overview"], [["G", "O"], "Orders"], [["G", "P"], "Products"], [["G", "I"], "Inventory"], [["G", "C"], "Customers"], [["G", "S"], "Support"], [["G", "R"], "Reports"], [["G", "M"], "Member tiers"], [["G", "A"], "Activity logs"]]],
    ["Order desk", [[["J"], "Next order"], [["K"], "Previous order"], [["X"], "Select for bulk actions"], [["P"], "Print packing list"]]],
  ];
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" eyebrow="Work faster" size="max-w-2xl">
      <div className="grid gap-5 pt-2 sm:grid-cols-2">
        {sections.map(([title, rows]) => (
          <div key={title} className={title === "Go to" ? "sm:row-span-2" : ""}>
            <p className="adm-eyebrow">{title}</p>
            <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
              {rows.map(([keys, label]) => (
                <li key={label} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                  <span>{label}</span>
                  <span className="flex items-center gap-1">{keys.map((key, index) => <span key={key + index} className="flex items-center gap-1">{index > 0 && keys[0] === "G" && <span className="text-[10px] text-muted-foreground">then</span>}<kbd className="adm-kbd">{key}</kbd></span>)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Profile menu                                                        */
/* ------------------------------------------------------------------ */

function ProfileMenu({
  name,
  role,
  email,
  avatar,
  theme,
  setTheme,
  onShortcuts,
  onSignOut,
}: {
  name: string;
  role: string;
  email: string | null;
  avatar: string | null;
  theme: AdminThemePreference;
  setTheme: (value: AdminThemePreference) => void;
  onShortcuts: () => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { mounted, state } = usePresence(open, 150);
  const rootRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); window.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div ref={rootRef} className="relative">
      <button onClick={() => setOpen(!open)} aria-label="Open account menu" aria-expanded={open} className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-1.5 pr-2 shadow-sm transition hover:bg-secondary">
        <Avatar name={name} src={avatar} size="sm" className="!h-7 !w-7 !rounded-lg" />
        <span className="hidden text-left md:block">
          <b className="block max-w-[9rem] truncate text-[11.5px] leading-4">{name}</b>
          <span className="block text-[10px] leading-3 text-muted-foreground">{role}</span>
        </span>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {mounted && (
        <div data-state={state} className="cc-popover absolute right-0 top-12 z-[70] w-72 origin-top-right rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-[var(--adm-shadow-pop)]">
          <div className="flex items-center gap-3 px-2.5 py-2.5">
            <Avatar name={name} src={avatar} className="!rounded-xl" />
            <div className="min-w-0">
              <b className="block truncate text-sm">{name}</b>
              <span className="block truncate text-[11px] text-muted-foreground">{email || role}</span>
              <span className="mt-1 inline-flex rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold">{role}</span>
            </div>
          </div>
          <div className="mt-1 border-t border-border px-2.5 pb-1 pt-3">
            <p className="adm-eyebrow">Appearance</p>
            <Segmented
              label="Theme"
              className="mt-2 w-full [&>button]:flex-1 [&>button]:justify-center"
              value={theme}
              onChange={setTheme}
              items={[
                { value: "light", label: <><Sun size={13} /> Light</> },
                { value: "dark", label: <><Moon size={13} /> Dark</> },
                { value: "system", label: <><Monitor size={13} /> Auto</> },
              ]}
            />
          </div>
          <div className="mt-2 grid gap-0.5 border-t border-border pt-2">
            <button onClick={() => { setOpen(false); onShortcuts(); }} className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium hover:bg-secondary"><Keyboard size={14} /> Keyboard shortcuts <kbd className="adm-kbd ml-auto">?</kbd></button>
            <a href="/home" target="_blank" rel="noopener" className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium hover:bg-secondary"><ExternalLink size={14} /> View storefront</a>
            <button onClick={() => { setOpen(false); onSignOut(); }} className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-danger-ink hover:bg-secondary"><LogOut size={14} /> Log out</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

type NavGroup = { label: string; description: string; icon: IconType; items: NavItem[] };

function SidebarNav({
  groups,
  pathname,
  collapsed,
  expandedGroup,
  setExpandedGroup,
  counts,
  onNavigate,
}: {
  groups: NavGroup[];
  pathname: string;
  collapsed: boolean;
  expandedGroup: string;
  setExpandedGroup: (value: string) => void;
  counts: AttentionCounts | null;
  onNavigate?: () => void;
}) {
  if (collapsed) {
    return (
      <nav aria-label="Admin navigation" className="mt-4 grid flex-1 content-start gap-1 overflow-y-auto px-2.5 pb-4 [scrollbar-width:none]">
        {groups.map((group, groupIndex) => (
          <div key={group.label} className={`grid gap-1 ${groupIndex > 0 ? "border-t border-white/10 pt-1.5 mt-0.5" : ""}`}>
            {group.items.map(([Icon, label, path]) => {
              const active = adminPathIsActive(pathname, path);
              const badge = badgeFor(path, counts);
              return (
                <Link key={path} to={path} title={badge ? `${label} · ${badge} need attention` : label} aria-label={label} aria-current={active ? "page" : undefined} className={`relative mx-auto grid h-10 w-10 place-items-center rounded-xl transition ${active ? "bg-brand text-brand-foreground shadow-sm" : "text-white/55 hover:bg-white/[.07] hover:text-white"}`}>
                  <Icon size={17} />
                  {badge > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#d08b5b] ring-2 ring-sidebar" />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    );
  }
  return (
    <nav aria-label="Admin navigation" className="mt-4 grid flex-1 content-start gap-0.5 overflow-y-auto px-3 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {groups.map((group) => {
        const GroupIcon = group.icon;
        const groupActive = group.items.some(([, , path]) => adminPathIsActive(pathname, path));
        if (group.label === "Overview") {
          const [, , path] = group.items[0];
          return (
            <Link key={group.label} to={path} onClick={onNavigate} aria-current={groupActive ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition ${groupActive ? "bg-brand font-semibold text-brand-foreground shadow-sm" : "text-white/65 hover:bg-white/[.07] hover:text-white"}`}>
              <GroupIcon size={17} />
              Overview
            </Link>
          );
        }
        const expanded = expandedGroup === group.label;
        const groupBadge = group.items.reduce((sum, [, , path]) => sum + badgeFor(path, counts), 0);
        return (
          <div key={group.label}>
            <button type="button" onClick={() => setExpandedGroup(expanded ? "" : group.label)} aria-expanded={expanded} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition ${groupActive && !expanded ? "bg-white/[.08] text-white" : "text-white/65 hover:bg-white/[.07] hover:text-white"}`}>
              <GroupIcon size={17} className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{group.label}</span>
                <span className="mt-0.5 block truncate text-[10px] font-normal text-white/40">{group.description}</span>
              </span>
              {!expanded && groupBadge > 0 && <span className="adm-num rounded-full bg-[#b8764d] px-1.5 py-0.5 text-[10px] font-bold text-white">{groupBadge > 99 ? "99+" : groupBadge}</span>}
              <ChevronDown size={14} className={`shrink-0 text-white/50 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
            </button>
            <div className="adm-collapse" data-open={expanded} aria-hidden={!expanded}>
              <div>
                <div className="ml-[21px] mt-0.5 grid gap-0.5 border-l border-white/10 py-1 pl-3">
                  {group.items.map(([Icon, label, path]) => {
                    const active = adminPathIsActive(pathname, path);
                    const badge = badgeFor(path, counts);
                    return (
                      <Link key={path} to={path} tabIndex={expanded ? undefined : -1} onClick={onNavigate} aria-current={active ? "page" : undefined} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] transition ${active ? "bg-brand font-semibold text-brand-foreground shadow-sm" : "text-white/60 hover:bg-white/[.07] hover:text-white"}`}>
                        <Icon size={15} />
                        <span className="flex-1 truncate">{label}</span>
                        {badge > 0 && <span className={`adm-num rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-brand-foreground/15" : "bg-[#b8764d] text-white"}`}>{badge > 99 ? "99+" : badge}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Secure states                                                       */
/* ------------------------------------------------------------------ */

function AdminBoot({ label }: { label: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-5 text-foreground" role="status" aria-live="polite">
      <div className="cc-enter-fade flex flex-col items-center text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-card shadow-[var(--adm-shadow-card)]"><ShieldCheck size={20} /></span>
        <div className="mt-6 h-px w-36 overflow-hidden rounded-full bg-border"><span className="adm-busy-bar block h-px" /></div>
        <p className="mt-4 text-xs font-semibold text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function SecureScreen({ icon: Icon = ShieldCheck, eyebrow, title, children }: { icon?: IconType; eyebrow?: string; title: string; children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-4 text-foreground sm:p-6">
      <section className="cc-enter-pop w-full max-w-md rounded-[1.75rem] border border-border bg-card p-7 text-center shadow-[var(--adm-shadow-pop)] sm:p-8">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary"><Icon size={20} /></span>
        {eyebrow && <p className="adm-eyebrow mt-5">{eyebrow}</p>}
        <h1 className={`${eyebrow ? "mt-2" : "mt-5"} font-serif text-[2.1rem] leading-tight`}>{title}</h1>
        {children}
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

const SIDEBAR_KEY = "cozycraft-admin-sidebar";

/**
 * Persistent admin frame for every protected admin route: security gates,
 * navigation, header, command palette and shortcuts. Pages render through
 * <Outlet/>, so moving between pages never re-runs the security checks.
 */
export function AdminLayout() {
  const loc = useLocation();
  const nav = useNavigate();
  const navigation = useNavigation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawer = usePresence(drawerOpen, 200);
  const [collapsed, setCollapsed] = useState(() => localStore.getItem(SIDEBAR_KEY) === "collapsed");
  const [expandedNavGroup, setExpandedNavGroup] = useState("");
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [mfaRequired, setMfaRequired] = useState<boolean | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaEnrollmentNeeded, setMfaEnrollmentNeeded] = useState(false);
  const [mfaEnrollmentQr, setMfaEnrollmentQr] = useState("");
  const [adminSecurity, setAdminSecurity] = useState({ require_admin_mfa: true, session_timeout_minutes: 30 });
  const [idleSecondsLeft, setIdleSecondsLeft] = useState<number | null>(null);
  const [themePreference, setThemePreference] = useAdminTheme();
  const { role, databaseRole, authReady, workspaceReady, workspaceLoading, workspaceError, refreshWorkspace, signOut, user, userId, userEmail, avatar } = useAdminSession();
  const accountName = user?.trim() || "Team member";

  const checkMfa = useCallback(async () => {
    if (!authReady || !isStaffRole(databaseRole)) {
      setMfaRequired(false);
      return;
    }
    setMfaError("");
    const { data: policy, error: policyError } = await supabase.from("admin_security_settings").select("require_admin_mfa,session_timeout_minutes").eq("id", true).single();
    if (!policyError && policy) {
      setAdminSecurity({
        require_admin_mfa: policy.require_admin_mfa !== false,
        session_timeout_minutes: Math.max(5, Number(policy.session_timeout_minutes) || 30),
      });
      // Enrolled accounts still need AAL2 to read commerce records under RLS,
      // even when the store does not require MFA enrollment for every admin.
    }
    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) {
      setMfaRequired(true);
      setMfaError("Secure access could not be verified. Check your connection and retry.");
      return;
    }
    const gate = adminMfaGate(assurance.currentLevel, assurance.nextLevel, policy?.require_admin_mfa !== false);
    if (gate === "ready") {
      setMfaEnrollmentNeeded(false);
      setMfaEnrollmentQr("");
      setMfaRequired(false);
      return;
    }
    if (gate === "enroll") {
      setMfaEnrollmentNeeded(true);
      setMfaRequired(true);
      return;
    }
    const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
    const verified = factors?.totp.find((factor) => factor.status === "verified");
    if (factorError || !verified) {
      setMfaRequired(true);
      setMfaError("Your authenticator factor could not be loaded. Sign in again or contact the super administrator.");
      return;
    }
    setMfaFactorId(verified.id);
    setMfaRequired(true);
  }, [authReady, databaseRole]);
  useEffect(() => {
    void checkMfa();
  }, [checkMfa]);
  useEffect(() => {
    if (!isStaffRole(databaseRole)) return;
    const channel = supabase
      .channel("admin-shell-security-settings")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "admin_security_settings" }, () => void checkMfa())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [checkMfa, databaseRole]);

  const ADMIN_ACTIVITY_KEY = "cozycraft-admin-last-activity";
  const serverActivityAt = useRef(0);
  const continueAdminSession = useCallback(() => {
    const now = Date.now();
    localStore.setItem(ADMIN_ACTIVITY_KEY, String(now));
    setIdleSecondsLeft(null);
    if (mfaRequired === false && now - serverActivityAt.current > 60_000) {
      serverActivityAt.current = now;
      void supabase.rpc("touch_admin_security_session").then(({ data, error }) => {
        if (!error && data === false) {
          void supabase.auth.signOut({ scope: "local" }).then(() => nav("/admin/login?reason=idle", { replace: true }));
        }
      });
    }
  }, [mfaRequired, nav]);
  useEffect(() => {
    if (!authReady || !isStaffRole(databaseRole)) return;
    const timeoutMs = adminSecurity.session_timeout_minutes * 60_000;
    let loggingOut = false;
    if (!Number(localStore.getItem(ADMIN_ACTIVITY_KEY))) continueAdminSession();
    const noteActivity = () => continueAdminSession();
    const check = () => {
      const lastActivity = Number(localStore.getItem(ADMIN_ACTIVITY_KEY)) || Date.now();
      const remainingMs = timeoutMs - (Date.now() - lastActivity);
      if (remainingMs <= 0 && !loggingOut) {
        loggingOut = true;
        setIdleSecondsLeft(0);
        void recordAuthActivity(supabase, "admin_idle_logout", {
          name: `${adminSecurity.session_timeout_minutes}-minute inactivity timeout`,
          reason: "inactivity",
          timeout_minutes: adminSecurity.session_timeout_minutes,
        }).finally(async () => {
          localStore.removeItem(ADMIN_ACTIVITY_KEY);
          await supabase.auth.signOut({ scope: "local" });
          nav("/admin/login?reason=idle", { replace: true });
        });
        return;
      }
      setIdleSecondsLeft(remainingMs <= 120_000 ? Math.max(1, Math.ceil(remainingMs / 1000)) : null);
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((event) => window.addEventListener(event, noteActivity, { passive: true }));
    window.addEventListener("focus", check);
    window.addEventListener("storage", check);
    const interval = window.setInterval(check, 1_000);
    check();
    return () => {
      window.clearInterval(interval);
      events.forEach((event) => window.removeEventListener(event, noteActivity));
      window.removeEventListener("focus", check);
      window.removeEventListener("storage", check);
    };
  }, [adminSecurity.session_timeout_minutes, authReady, continueAdminSession, databaseRole, nav]);

  const verifyMfa = async (event: FormEvent) => {
    event.preventDefault();
    if (!mfaFactorId || mfaCode.length !== 6) return;
    setMfaBusy(true);
    setMfaError("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: mfaFactorId, code: mfaCode });
    setMfaBusy(false);
    if (error) {
      setMfaError("That authenticator code is invalid or expired. Enter the newest code.");
      return;
    }
    setMfaCode("");
    await checkMfa();
    await refreshWorkspace();
  };
  const beginAdminMfa = async () => {
    if (mfaBusy) return;
    setMfaBusy(true);
    setMfaError("");
    try {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;
      for (const factor of factors.data.all.filter((factor) => factor.factor_type === "totp" && factor.status === "unverified" && factor.friendly_name === "CozyCraft admin")) {
        const removed = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (removed.error) throw removed.error;
      }
      const result = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "CozyCraft admin" });
      if (result.error) throw result.error;
      setMfaFactorId(result.data.id);
      setMfaEnrollmentQr(result.data.totp.qr_code);
    } catch {
      setMfaError("Authenticator setup could not start. Please retry or sign in again.");
    } finally {
      setMfaBusy(false);
    }
  };

  const allAdminPaths = useMemo(() => adminNav.map((item) => item[2] as string), []);
  const allowedPaths = useMemo(() => adminPathsForRole(role, allAdminPaths), [role, allAdminPaths]);
  const allowed = useCallback((path: string) => allowedPaths.includes(path), [allowedPaths]);
  const visibleNav = useMemo(() => adminNav.filter(([, , path]) => allowedPaths.includes(path)), [allowedPaths]);
  const visibleNavGroups = useMemo<NavGroup[]>(
    () =>
      adminNavGroups
        .map((group) => ({ label: group.label, description: group.description, icon: group.icon, items: visibleNav.filter(([, , path]) => (group.paths as readonly string[]).includes(path)) }))
        .filter((group) => group.items.length > 0),
    [visibleNav],
  );
  const activeNavGroup = visibleNavGroups.find((group) => group.items.some(([, , path]) => adminPathIsActive(loc.pathname, path)));
  const pageLabel = adminPageLabel(loc.pathname);
  const counts = useAttentionCounts(userId, workspaceReady && mfaRequired === false);
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const resolvedTheme = resolveAdminTheme(themePreference, systemDark);

  useEffect(() => {
    if (activeNavGroup) setExpandedNavGroup(activeNavGroup.label);
  }, [activeNavGroup?.label]);
  useEffect(() => {
    setDrawerOpen(false);
    rememberRecentPage(loc.pathname.replace(/\/new$/, ""));
  }, [loc.pathname]);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setDrawerOpen(false); };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", onKey); };
  }, [drawerOpen]);
  const toggleCollapsed = () => {
    setCollapsed((value) => {
      localStore.setItem(SIDEBAR_KEY, value ? "expanded" : "collapsed");
      return !value;
    });
  };
  const toggleTheme = useCallback(() => setThemePreference(resolvedTheme === "dark" ? "light" : "dark"), [resolvedTheme, setThemePreference]);
  const showShortcuts = useCallback(() => setShortcutsOpen(true), []);

  // Global keyboard shortcuts.
  useEffect(() => {
    let pendingG = 0;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (event.key === "/") {
        event.preventDefault();
        const field = document.querySelector<HTMLInputElement>("#admin-main [data-admin-search]");
        if (field) field.focus();
        else setPaletteOpen(true);
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "g") {
        pendingG = Date.now();
        return;
      }
      if (pendingG && Date.now() - pendingG < 1200) {
        pendingG = 0;
        const route = goShortcuts[key];
        if (route && allowedPaths.includes(route)) {
          event.preventDefault();
          nav(route);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [allowedPaths, nav]);

  const canAccess = canAccessAdminPath(role, loc.pathname, allAdminPaths);
  if (!authReady || (user && !databaseRole)) return <AdminBoot label="Checking secure access…" />;
  if (!isStaffRole(databaseRole)) {
    return (
      <SecureScreen icon={LockKeyhole} title="Administrator access required.">
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Sign in with an approved staff or admin account.</p>
        <Link to="/admin/login" className="adm-btn adm-btn-primary mt-6 h-11 w-full">Go to admin sign in</Link>
      </SecureScreen>
    );
  }
  if (mfaRequired === null) return <AdminBoot label="Verifying secure session…" />;
  if (mfaEnrollmentNeeded) {
    return (
      <SecureScreen eyebrow="Two-step verification" title="Protect your admin account.">
        <form onSubmit={verifyMfa}>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Set up an authenticator before accessing customer records and store operations.</p>
          {mfaEnrollmentQr ? (
            <>
              <img src={mfaEnrollmentQr} alt="Scan this code with your authenticator app" className="mx-auto my-5 h-48 w-48 rounded-xl bg-white p-2" />
              <label className="adm-label text-left">
                Authenticator code
                <input value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" className="adm-input h-12 text-center text-lg tracking-[.35em]" />
              </label>
              <button type="submit" disabled={mfaBusy || mfaCode.length !== 6} className="adm-btn adm-btn-primary mt-5 h-11 w-full">{mfaBusy ? "Verifying…" : "Verify and enter"}</button>
            </>
          ) : (
            <button type="button" onClick={() => void beginAdminMfa()} disabled={mfaBusy} className="adm-btn adm-btn-primary mt-6 h-11 w-full">{mfaBusy ? "Preparing…" : "Set up authenticator"}</button>
          )}
          {mfaError && <p role="alert" className="mt-4 rounded-xl bg-danger-soft p-3 text-left text-xs font-semibold text-danger-ink">{mfaError}</p>}
          <button type="button" onClick={() => void signOut()} className="mt-5 text-sm font-semibold underline underline-offset-4">Sign out</button>
        </form>
      </SecureScreen>
    );
  }
  if (mfaRequired) {
    return (
      <SecureScreen eyebrow="Two-step verification" title="Confirm it’s you.">
        <form onSubmit={verifyMfa}>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Enter the current six-digit code from your authenticator app to open operations.</p>
          {mfaFactorId && (
            <label className="adm-label mt-6 text-left">
              Authenticator code
              <input autoFocus value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" className="adm-input h-12 text-center text-lg tracking-[.35em]" />
            </label>
          )}
          {mfaError && <p role="alert" className="mt-4 rounded-xl bg-danger-soft p-3 text-left text-xs font-semibold text-danger-ink">{mfaError}</p>}
          <button type={mfaFactorId ? "submit" : "button"} onClick={mfaFactorId ? undefined : () => void checkMfa()} disabled={mfaBusy || Boolean(mfaFactorId && mfaCode.length !== 6)} className="adm-btn adm-btn-primary mt-5 h-11 w-full">
            {mfaBusy ? "Verifying…" : mfaFactorId ? "Verify and enter" : "Retry secure check"}
          </button>
          <button type="button" onClick={() => void signOut()} className="mt-4 text-sm font-semibold underline underline-offset-4">Sign out</button>
        </form>
      </SecureScreen>
    );
  }
  if (!workspaceReady) {
    return workspaceError ? (
      <SecureScreen icon={Database} eyebrow="Live admin workspace" title="Data needs another try.">
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{workspaceError}</p>
        <button type="button" onClick={() => void refreshWorkspace()} disabled={workspaceLoading} className="adm-btn adm-btn-primary mt-6 h-11 w-full">{workspaceLoading ? "Retrying…" : "Retry workspace load"}</button>
      </SecureScreen>
    ) : (
      <AdminBoot label="Preparing your workspace…" />
    );
  }

  const sidebar = (mode: "rail" | "full", onNavigate?: () => void) => (
    <>
      <div className={`flex items-center ${mode === "rail" ? "justify-center px-2 pt-4" : "justify-between px-4 pt-4"}`}>
        {mode === "rail" ? (
          <Link to="/admin" aria-label="Operations overview" className="grid h-11 w-11 place-items-center rounded-xl bg-white/[.07] font-serif text-lg text-white">C</Link>
        ) : (
          <Link to="/admin" aria-label="Operations overview" onClick={onNavigate} className="rounded-xl px-1.5 py-1 transition hover:bg-white/[.05]">
            <AdminWordmark light className="h-11 w-28" />
          </Link>
        )}
        {mode === "full" && onNavigate && (
          <button onClick={onNavigate} className="grid h-9 w-9 place-items-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white" aria-label="Close navigation"><X size={18} /></button>
        )}
      </div>
      {mode === "full" && (
        <div className="mt-5 flex items-center gap-2 px-6">
          <span className="h-1.5 w-1.5 rounded-full bg-[#9fc595]" />
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/45">{role}</p>
        </div>
      )}
      <SidebarNav groups={visibleNavGroups} pathname={loc.pathname} collapsed={mode === "rail"} expandedGroup={expandedNavGroup} setExpandedGroup={setExpandedNavGroup} counts={counts} onNavigate={onNavigate} />
      <div className={`grid gap-1 border-t border-white/10 p-3 ${mode === "rail" ? "justify-items-center" : ""}`}>
        {!onNavigate && (
          <button onClick={toggleCollapsed} className={`flex items-center gap-3 rounded-xl text-[12.5px] text-white/60 transition hover:bg-white/[.07] hover:text-white ${mode === "rail" ? "h-10 w-10 justify-center" : "w-full px-3 py-2"}`} aria-label={mode === "rail" ? "Expand sidebar" : "Collapse sidebar"} title={mode === "rail" ? "Expand sidebar" : "Collapse sidebar"}>
            {mode === "rail" ? <ChevronsRight size={17} /> : <><ChevronsLeft size={17} /> Collapse sidebar</>}
          </button>
        )}
        <button onClick={() => setConfirmSignOut(true)} className={`flex items-center gap-3 rounded-xl text-[12.5px] text-white/75 transition hover:bg-white/[.07] hover:text-white ${mode === "rail" ? "h-10 w-10 justify-center" : "w-full px-3 py-2"}`} aria-label="Log out" title="Log out">
          <LogOut size={17} />
          {mode === "full" && "Log out"}
        </button>
      </div>
    </>
  );

  const groupItems = activeNavGroup && activeNavGroup.items.length > 1 ? activeNavGroup.items : null;

  return (
    <div data-admin-shell className="min-h-dvh overflow-x-clip bg-canvas text-foreground">
      <a href="#admin-main" className="skip-link">Skip to admin content</a>
      <ConfirmHost />
      <aside className={`fixed inset-y-0 left-0 z-[70] hidden flex-col bg-sidebar text-white transition-[width] duration-300 [transition-timing-function:var(--ease-out)] lg:flex ${collapsed ? "w-[76px]" : "w-[264px]"}`}>
        {sidebar(collapsed ? "rail" : "full")}
      </aside>
      {drawer.mounted && createPortal(
        <div className="fixed inset-0 z-[120] lg:hidden">
          <button data-state={drawer.state} onClick={() => setDrawerOpen(false)} className="cc-backdrop absolute inset-0 bg-[#161412]/55 backdrop-blur-[2px]" aria-label="Close navigation" tabIndex={-1} />
          <aside data-state={drawer.state} role="dialog" aria-modal="true" aria-label="Admin navigation" className="adm-drawer-left absolute inset-y-0 left-0 flex w-[86vw] max-w-[300px] flex-col bg-sidebar text-white shadow-2xl">
            {sidebar("full", () => setDrawerOpen(false))}
          </aside>
        </div>,
        document.body,
      )}
      <div className={`min-w-0 transition-[padding] duration-300 [transition-timing-function:var(--ease-out)] ${collapsed ? "lg:pl-[76px]" : "lg:pl-[264px]"}`}>
        <header className="sticky top-0 z-50 border-b border-border/70 bg-canvas/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-[1480px] items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-5 lg:px-8">
            <button onClick={() => setDrawerOpen(true)} aria-label="Open admin navigation" className="adm-btn adm-btn-icon shadow-sm lg:hidden"><Menu size={18} /></button>
            <div className="min-w-0 flex-1">
              <p className="hidden truncate text-[11px] text-muted-foreground sm:block">{activeNavGroup && activeNavGroup.label !== "Overview" ? activeNavGroup.label : "Operations"}</p>
              <p className="truncate text-sm font-semibold sm:text-[15px]">{pageLabel}</p>
            </div>
            <button type="button" onClick={() => setPaletteOpen(true)} className="hidden h-10 w-64 items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 text-xs text-muted-foreground shadow-sm transition hover:bg-secondary md:flex xl:w-80" aria-label="Search and jump">
              <Search size={15} />
              <span className="flex-1 text-left">Search or jump to…</span>
              <kbd className="adm-kbd">{isMac() ? "⌘" : "Ctrl"} K</kbd>
            </button>
            <button type="button" onClick={() => setPaletteOpen(true)} className="adm-btn adm-btn-icon shadow-sm md:hidden" aria-label="Search and jump"><Search size={17} /></button>
            <NotificationCenter />
            <ProfileMenu name={accountName} role={role} email={userEmail} avatar={avatar} theme={themePreference} setTheme={setThemePreference} onShortcuts={showShortcuts} onSignOut={() => setConfirmSignOut(true)} />
          </div>
          <BusyBar active={navigation.state === "loading"} className="absolute inset-x-0 bottom-[-1px]" />
        </header>
        <main id="admin-main" tabIndex={-1} className="relative mx-auto max-w-[1480px] px-3 pb-10 pt-4 outline-none sm:px-5 sm:pt-6 lg:px-8 lg:pt-7">
          {groupItems && (
            <nav aria-label={`${activeNavGroup?.label} pages`} className="adm-scroll-x -mx-3 mb-4 flex gap-1.5 px-3 sm:-mx-5 sm:px-5 lg:hidden">
              {groupItems.map(([Icon, label, path]) => {
                const active = adminPathIsActive(loc.pathname, path);
                const badge = badgeFor(path, counts);
                return (
                  <Link key={path} to={path} data-active={active} aria-current={active ? "page" : undefined} className="adm-chip">
                    <Icon size={14} />
                    {label}
                    {badge > 0 && <span className="adm-chip-count">{badge}</span>}
                  </Link>
                );
              })}
            </nav>
          )}
          {canAccess ? (
            <div key={loc.pathname} className="adm-page">
              <Outlet />
            </div>
          ) : (
            <div className="adm-page grid min-h-[60vh] place-items-center">
              <div className="max-w-md text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary"><ShieldCheck size={20} /></span>
                <h1 className="mt-5 font-serif text-[2rem]">This feature is restricted.</h1>
                <p className="mt-3 text-sm text-muted-foreground">Your {role.toLowerCase()} role does not have permission to open this page.</p>
                <Link to="/admin" className="adm-btn adm-btn-primary mt-6">Return to overview</Link>
              </div>
            </div>
          )}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} visibleNav={visibleNav} allowed={allowed} themeResolved={resolvedTheme} onToggleTheme={toggleTheme} onShowShortcuts={showShortcuts} />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      {confirmSignOut && (
        <ConfirmSignOut
          kind="admin"
          onCancel={() => setConfirmSignOut(false)}
          onConfirm={() => {
            void signOut();
            nav("/home");
          }}
        />
      )}
      {idleSecondsLeft !== null && idleSecondsLeft > 0 && createPortal(
        <div data-state="open" className="cc-backdrop fixed inset-0 z-[280] grid place-items-center bg-[#161412]/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="idle-warning-title">
          <section data-state="open" className="cc-dialog w-full max-w-md rounded-[1.75rem] border border-border bg-card p-7 text-center shadow-[var(--adm-shadow-pop)]">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-warning-soft text-warning-ink"><LockKeyhole size={20} /></span>
            <p className="adm-eyebrow mt-5">Session security</p>
            <h2 id="idle-warning-title" className="mt-2 font-serif text-[2.1rem]">Still working?</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">For your protection, this administrator session will sign out after {adminSecurity.session_timeout_minutes} minutes without activity.</p>
            <p className="adm-num mt-5 text-3xl font-semibold">{Math.floor(idleSecondsLeft / 60)}:{String(idleSecondsLeft % 60).padStart(2, "0")}</p>
            <button onClick={continueAdminSession} className="adm-btn adm-btn-primary mt-5 h-11 w-full">Continue session</button>
            <button onClick={() => { setIdleSecondsLeft(null); void signOut().then(() => nav("/admin/login", { replace: true })); }} className="mt-3 text-sm font-semibold underline underline-offset-4">Sign out now</button>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}

/**
 * Page wrapper kept for every admin page. The persistent AdminLayout owns the
 * frame, so this simply renders the page content.
 */
export function AdminShell({ children }: { children: ReactNode; title?: string }) {
  return <>{children}</>;
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

const notificationIcons: Record<string, IconType> = { order: ClipboardList, review: Star, support: MessageCircle, inventory: Warehouse };

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const { mounted, state } = usePresence(open, 160);
  const nav = useNavigate();
  const location = useLocation();
  const { userId } = useAdminSession();
  const rootRef = useRef<HTMLDivElement>(null);
  type NotificationItem = {
    id: number;
    kind: "order" | "review" | "support" | "inventory";
    title: string;
    message: string;
    route: string;
    created_at: string;
    unread: boolean;
  };
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !(event.target as HTMLElement)?.closest?.("[data-notification-panel]")) setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", onPointer);
    const mobile = window.matchMedia?.("(max-width: 639px)").matches;
    const previousOverflow = document.body.style.overflow;
    if (mobile) document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", onPointer);
      if (mobile) document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    let active = true;
    setItems([]);
    setError("");
    if (!userId) return;
    const scheduler = createRefreshScheduler(async () => {
      const notificationResult = await supabase.from("admin_notifications")
        .select("id,kind,title,message,route,created_at")
        .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100);
      if (!active) return;
      if (notificationResult.error) { setError("Notifications could not be refreshed."); return; }
      const rows = notificationResult.data ?? [];
      const readResult = rows.length ? await supabase.from("admin_notification_reads")
        .select("notification_id,read_at,dismissed_at").eq("user_id", userId)
        .in("notification_id", rows.map(row => row.id)) : { data: [], error: null };
      if (!active) return;
      if (readResult.error) { setError("Notification read state could not be refreshed."); return; }
      const reads = new Map((readResult.data ?? []).map(row => [row.notification_id, row]));
      setItems(rows.filter(row => !reads.get(row.id)?.dismissed_at)
        .map(row => ({ ...row, unread: !reads.get(row.id)?.read_at })) as NotificationItem[]);
      setError("");
    }, 250, 1500, () => { if (active) setError("Notifications could not be refreshed."); });
    const recovery = watchVisibleRecovery(scheduler.request);
    scheduler.request();
    const channel = supabase.channel(`admin-notifications-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_notifications" }, recovery.invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_notification_reads", filter: `user_id=eq.${userId}` }, recovery.invalidate)
      .subscribe(status => { if (status === "SUBSCRIBED") recovery.invalidate(); });
    return () => { active = false; scheduler.dispose(); recovery.dispose(); void supabase.removeChannel(channel); };
  }, [userId]);

  const saveReadState = async (notificationIds: number[], dismissed = false) => {
    if (!userId || !notificationIds.length) return;
    const now = new Date().toISOString();
    const { error: updateError } = await supabase.from("admin_notification_reads").upsert(
      notificationIds.map((notificationId) => ({ notification_id: notificationId, user_id: userId, read_at: now, dismissed_at: dismissed ? now : null })),
      { onConflict: "notification_id,user_id" },
    );
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setItems((current) =>
      dismissed ? current.filter((item) => !notificationIds.includes(item.id)) : current.map((item) => (notificationIds.includes(item.id) ? { ...item, unread: false } : item)),
    );
  };

  const openNotification = async (item: NotificationItem) => {
    if (item.unread) await saveReadState([item.id]);
    setOpen(false);
    nav(item.route);
  };

  const clearAll = async () => {
    const confirmed = await confirmAction({
      title: "Clear all notifications?",
      description: "They will be removed from your list. New activity will still appear here.",
      confirmLabel: "Clear notifications",
    });
    if (confirmed) await saveReadState(items.map((item) => item.id), true);
  };

  const unread = items.filter((item) => item.unread).length;
  return (
    <div ref={rootRef} className="relative">
      <button onClick={() => setOpen(!open)} aria-label={`Notifications, ${unread} unread`} aria-expanded={open} className="adm-btn adm-btn-icon relative shadow-sm">
        <Bell size={17} />
        {unread > 0 && (
          <span key={unread} className="cc-pop adm-num absolute -right-1 -top-1 grid min-h-[1.15rem] min-w-[1.15rem] place-items-center rounded-full bg-[#b8764d] px-1 text-[9.5px] font-bold text-white ring-2 ring-canvas">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {mounted &&
        createPortal(
          <>
            <div data-state={state} className="cc-backdrop fixed inset-0 z-[80] bg-[#161412]/35 sm:hidden" aria-hidden="true" />
            <div
              data-notification-panel=""
              role="dialog"
              aria-label="Administrator notifications"
              data-state={state}
              className="cc-popover fixed inset-x-3 bottom-3 top-[64px] z-[90] flex min-h-0 origin-top-right flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-[var(--adm-shadow-pop)] sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-[72px] sm:max-h-[min(34rem,calc(100dvh-6rem))] sm:w-[380px] lg:right-8"
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <b className="text-sm">Notifications</b>
                  <p className="text-[11px] text-muted-foreground">{unread ? `${unread} unread` : "All caught up"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button disabled={unread === 0} onClick={() => void saveReadState(items.filter((item) => item.unread).map((item) => item.id))} className="adm-btn adm-btn-ghost adm-btn-sm">Mark all read</button>
                  <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} className="adm-btn adm-btn-ghost adm-btn-icon adm-btn-sm"><X size={16} /></button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {error && <p className="bg-danger-soft px-4 py-3 text-xs font-semibold text-danger-ink">{error}</p>}
                {items.map((item) => {
                  const Icon = notificationIcons[item.kind] ?? Bell;
                  return (
                    <button onClick={() => void openNotification(item)} className="flex w-full gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-secondary" key={item.id}>
                      <span className={`relative mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${item.unread ? "bg-brand text-brand-foreground" : "bg-secondary text-muted-foreground"}`}>
                        <Icon size={14} />
                        {item.unread && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#b8764d] ring-2 ring-popover" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className={`block break-words text-xs ${item.unread ? "" : "font-medium text-muted-foreground"}`}>{item.title}</b>
                        <span className="mt-0.5 block break-words text-xs leading-5 text-muted-foreground">{item.message}</span>
                        <span className="mt-1 block text-[10px] font-semibold text-muted-foreground">{relativeTime(item.created_at)}</span>
                      </span>
                    </button>
                  );
                })}
                {!items.length && !error && (
                  <div className="px-5 py-12 text-center">
                    <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-secondary text-muted-foreground"><Bell size={18} /></span>
                    <p className="mt-3 text-sm font-semibold">You’re all caught up.</p>
                    <p className="mt-1 text-xs text-muted-foreground">New customer activity will appear here.</p>
                  </div>
                )}
              </div>
              <button disabled={items.length === 0} onClick={() => void clearAll()} className="w-full shrink-0 border-t border-border py-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40">
                Clear notifications
              </button>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Invitation setup                                                    */
/* ------------------------------------------------------------------ */

export function AdminSetupAccount() {
  const navigate = useNavigate();
  const { authReady, databaseRole: role, userEmail } = useAdminSession();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    navigate("/admin");
  };

  if (!authReady) return <AdminBoot label="Verifying your invitation…" />;
  if (!isStaffRole(role)) {
    return (
      <SecureScreen icon={LockKeyhole} title="Invitation required.">
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Open the newest invitation link sent to your work email.</p>
      </SecureScreen>
    );
  }

  return (
    <SecureScreen eyebrow="Secure team setup" title="Create your password.">
      <form onSubmit={submit} className="text-left">
        <p className="mt-2 text-center text-sm text-muted-foreground">{userEmail}</p>
        <div className="mt-7 grid gap-4">
          <label className="adm-label">
            New password
            <input required type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="adm-input h-12 font-normal" />
          </label>
          <label className="adm-label">
            Confirm password
            <input required type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="adm-input h-12 font-normal" />
          </label>
        </div>
        {error && <p role="alert" className="mt-4 rounded-xl bg-danger-soft p-3 text-xs font-semibold text-danger-ink">{error}</p>}
        <button disabled={loading} className="adm-btn adm-btn-primary mt-6 h-12 w-full text-sm">{loading ? "Saving…" : "Finish account setup"}</button>
      </form>
    </SecureScreen>
  );
}
