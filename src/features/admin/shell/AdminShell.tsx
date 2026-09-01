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
import { createPortal } from "react-dom";
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
  Award,
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
  Sparkles,
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
  adminSupabase as supabase,
  type DbCustomerProfile,
  type DbOrder,
  type DbProduct,
  type DbRole,
  type DbSupportTicket,
} from "@/services/supabase/client";
import { adminPathsForRole, canAccessAdminPath } from "@/lib/admin/access";
import { signInForPortal } from "@/services/auth/auth.service";
import { recordAuthActivity } from "@/services/auth/activity.service";

import {
  Product,
  fallbackProducts,
  CartLine,
  Address,
  Store,
  StoreContext,
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


export function AdminLogin() {
  const nav = useNavigate();
  const idleLogout = new URLSearchParams(window.location.search).get("reason") === "idle";
  const {
    databaseRole: role,
    authReady,
    user,
    signOut,
  } = useAdminSession();
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
      setError(
        "Your credentials were accepted, but the account role could not be loaded. Please try again.",
      );
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
      setError(
        result.error ??
          "Administrator sign in failed. Check your credentials and try again.",
      );
      return;
    }
    setAwaitingAccess(true);
  };
  return <main className="min-h-dvh overflow-y-auto bg-[#e9e5de] p-3 sm:p-5 lg:h-dvh lg:overflow-hidden"><div className="mx-auto grid min-h-[calc(100dvh-1.5rem)] max-w-[1500px] overflow-hidden rounded-[1.5rem] bg-card shadow-[0_24px_80px_rgba(50,42,34,.14)] sm:min-h-[calc(100dvh-2.5rem)] sm:rounded-[2rem] lg:h-full lg:min-h-0 lg:grid-cols-[1.1fr_.9fr]">
    <section className="relative hidden overflow-hidden bg-[#201e1b] p-10 text-[#f4f2ee] lg:flex lg:flex-col lg:justify-between"><ResilientImage src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1400&q=80" alt="CozyCraft operations environment" className="absolute inset-0 h-full w-full object-cover opacity-25"/><div className="absolute inset-0 bg-[#171614]/75"/><div className="relative flex items-center justify-between"><Logo light/><span className="rounded-full border border-white/20 px-3 py-1.5 text-[10px] font-bold tracking-[.16em] text-white/70">SECURE WORKSPACE</span></div><div className="relative max-w-lg"><p className="text-[10px] font-bold tracking-[.22em] text-[#d8c7b0]">COZYCRAFT / OPERATIONS</p><h1 className="mt-6 font-[Playfair_Display] text-6xl leading-[.98] tracking-[-.04em]">Care for every detail behind the scenes.</h1><p className="mt-7 max-w-sm text-sm leading-7 text-white/70">One live workspace for catalog, inventory, customers, and every storefront order.</p></div><p className="relative text-xs text-white/60">Protected by Supabase Auth and role-based database policies.</p></section>
    <section className="flex min-h-0 items-center justify-center overflow-hidden px-5 py-5 sm:px-10"><form onSubmit={submit} className="auth-fixed-form w-full max-w-sm"><div className="mb-5 lg:hidden"><Logo/></div><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-secondary"><LockKeyhole size={15}/></span><p className="text-[10px] font-bold tracking-[.18em] text-muted-foreground">RESTRICTED ACCESS</p></div><h2 className="mt-4 font-[Playfair_Display] text-4xl tracking-[-.04em] sm:text-5xl">Administrator sign in.</h2><p className="mt-2 text-sm leading-5 text-muted-foreground">Use an approved staff or administrator account.</p>{idleLogout&&<p className="mt-4 rounded-xl bg-[#e7eee3] p-3 text-xs font-semibold text-[#50664b]">Your administrator session ended after being inactive. Sign in again to continue securely.</p>}<div className="mt-6 grid gap-3"><label className="grid gap-2 text-sm font-semibold">Work email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} disabled={loading} className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-4 font-normal outline-none disabled:opacity-60" placeholder="you@cozycraft.com"/></label><label className="grid gap-2 text-sm font-semibold">Password<div className="relative"><input required type={show?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} disabled={loading} className="h-11 w-full rounded-xl border border-border bg-[#fcfbf8] px-4 pr-14 font-normal outline-none disabled:opacity-60" placeholder="••••••••"/><button type="button" onClick={()=>setShow(!show)} disabled={loading} className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground disabled:opacity-50">{show?"Hide":"Show"}</button></div></label></div>{error&&<p className="mt-3 rounded-xl bg-[#f3e5d4] p-3 text-xs font-semibold text-[#8b5c46]">{error}</p>}<button disabled={loading} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background disabled:opacity-60">{awaitingAccess?"Opening secure workspace…":loading?"Checking access…":"Enter operations"}<ArrowRight size={16}/></button><div className="mt-4 flex items-start gap-3 rounded-2xl bg-secondary p-3 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 shrink-0 text-[#6d8065]" size={16}/>Only accounts marked as staff or admin in Supabase can enter.</div><p className="mt-4 text-center text-sm text-muted-foreground">Looking for the storefront? <Link to="/login" className="font-semibold text-foreground underline underline-offset-4">Customer sign in</Link></p></form></section>
  </div></main>;
}

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
  [Activity, "Activity logs", "/admin/activity-logs"],
  [MessageCircle, "Support", "/admin/support"],
  [Settings, "Settings", "/admin/settings"],
] as const;

export const adminNavGroups = [
  {
    label: "Overview",
    description: "Workspace summary",
    icon: LayoutDashboard,
    paths: ["/admin"],
  },
  {
    label: "Catalog",
    description: "Products and stock",
    icon: Package,
    paths: [
      "/admin/products",
      "/admin/categories",
      "/admin/inventory",
      "/admin/experience",
    ],
  },
  {
    label: "Commerce",
    description: "Orders and payments",
    icon: ShoppingBag,
    paths: ["/admin/orders", "/admin/payments"],
  },
  {
    label: "Customer care",
    description: "People and service",
    icon: Users,
    paths: [
      "/admin/customers",
      "/admin/member-tiers",
      "/admin/reviews",
      "/admin/support",
    ],
  },
  {
    label: "Insights",
    description: "Reports and audit trail",
    icon: ChartNoAxesCombined,
    paths: ["/admin/reports", "/admin/activity-logs"],
  },
  {
    label: "Administration",
    description: "Team and configuration",
    icon: Settings,
    paths: ["/admin/team", "/admin/settings", "/admin/content"],
  },
] as const;

const adminPathIsActive = (pathname: string, path: string) =>
  pathname === path ||
  (path !== "/admin" && pathname.startsWith(`${path}/`));

function WorkspaceSearch({
  visibleNav,
}: {
  visibleNav: typeof adminNav[number][];
}) {
  const nav = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const {
    adminProducts,
    orders,
    customerProfiles,
    supportTickets,
  } = useStore();

  const results = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    const matches = (value: unknown) =>
      String(value ?? "").toLocaleLowerCase().includes(term);

    const sections = visibleNav.map(([Icon, label, route]) => ({
      key: `section-${route}`,
      title: label,
      detail: "Admin section",
      route,
      Icon,
    }));
    const records = term
      ? [
          ...adminProducts
            .filter((product) =>
              [product.name, product.category, product.subcategory, product.id].some(matches),
            )
            .map((product) => ({
              key: `product-${product.id}`,
              title: product.name,
              detail: `${product.category} product`,
              route: "/admin/products",
              Icon: Package,
            })),
          ...orders
            .filter((order) =>
              [
                order.order_number,
                order.status,
                order.shipping_address.name,
                order.shipping_address.email,
              ].some(matches),
            )
            .map((order) => ({
              key: `order-${order.id}`,
              title: `Order #${order.order_number}`,
              detail: `${order.shipping_address.name || "Customer"} · ${order.status}`,
              route: "/admin/orders",
              Icon: ClipboardList,
            })),
          ...customerProfiles
            .filter((customer) =>
              [customer.full_name, customer.username, customer.email, customer.phone].some(matches),
            )
            .map((customer) => ({
              key: `customer-${customer.id}`,
              title: customer.full_name || customer.username || "Customer",
              detail: customer.email || "Customer account",
              route: "/admin/customers",
              Icon: Users,
            })),
          ...supportTickets
            .filter((ticket) =>
              [
                ticket.ticket_number,
                ticket.subject,
                ticket.message,
                ticket.status,
                ticket.profiles?.full_name,
                ticket.profiles?.email,
              ].some(matches),
            )
            .map((ticket) => ({
              key: `ticket-${ticket.id}`,
              title: `Ticket ${ticket.ticket_number}`,
              detail: `${ticket.subject} · ${ticket.status.replace("_", " ")}`,
              route: "/admin/support",
              Icon: MessageCircle,
            })),
        ]
      : [];

    return [
      ...sections.filter((item) => !term || [item.title, item.detail].some(matches)),
      ...records,
    ].slice(0, 12);
  }, [adminProducts, customerProfiles, orders, query, supportTickets, visibleNav]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);
  const choose = useCallback(
    (route: string) => {
      close();
      nav(route);
    },
    [close, nav],
  );

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);
  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-xs text-muted-foreground shadow-sm transition hover:bg-secondary md:flex"
        aria-label="Search workspace"
      >
        <Search size={15} />
        Search workspace
        <kbd className="ml-4 rounded-md bg-secondary px-1.5 py-0.5 text-[10px]">
          {navigator.platform.toLowerCase().includes("mac") ? "⌘ K" : "Ctrl K"}
        </kbd>
      </button>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-start justify-center bg-transparent px-4 pt-[12vh]"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) close();
            }}
          >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Search workspace"
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <label className="flex h-16 items-center gap-3 border-b border-border px-5">
              <Search size={20} className="text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") close();
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveIndex((index) => Math.min(index + 1, results.length - 1));
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveIndex((index) => Math.max(index - 1, 0));
                  }
                  if (event.key === "Enter" && results[activeIndex]) {
                    choose(results[activeIndex].route);
                  }
                }}
                placeholder="Search products, orders, customers, tickets…"
                className="admin-workspace-search-input h-full min-w-0 flex-1 border-0 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={close}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                aria-label="Close search"
              >
                <X size={17} />
              </button>
            </label>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {results.length ? (
                results.map((result, index) => (
                  <button
                    type="button"
                    key={result.key}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(result.route)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                      activeIndex === index ? "bg-secondary" : "hover:bg-secondary/60"
                    }`}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-card">
                      <result.Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-sm">{result.title}</b>
                      <span className="mt-0.5 block truncate text-xs capitalize text-muted-foreground">
                        {result.detail}
                      </span>
                    </span>
                    <ArrowRight size={15} className="text-muted-foreground" />
                  </button>
                ))
              ) : (
                <div className="px-4 py-12 text-center">
                  <Search className="mx-auto text-muted-foreground" size={22} />
                  <p className="mt-3 text-sm font-semibold">No workspace results</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try a product, order number, customer, or ticket.
                  </p>
                </div>
              )}
            </div>
            <footer className="flex items-center gap-4 border-t border-border bg-secondary/45 px-4 py-2.5 text-[10px] text-muted-foreground">
              <span>↑↓ Navigate</span>
              <span>Enter Open</span>
              <span>Esc Close</span>
            </footer>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}

function AdminAccountAvatar({
  src,
  name,
  initials,
  className,
}: {
  src: string | null;
  name: string;
  initials: string;
  className: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  if (src && !imageFailed) {
    return (
      <img
        src={src}
        alt={`${name} profile`}
        loading="eager"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
        className={`shrink-0 bg-[#b8a58d] object-cover ${className}`}
      />
    );
  }

  return (
    <span
      aria-label={`${name} profile initials`}
      className={`grid shrink-0 place-items-center bg-[#b8a58d] text-[10px] font-bold text-foreground ${className}`}
    >
      {initials || "TM"}
    </span>
  );
}

export function AdminShell({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const loc = useLocation();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [expandedNavGroup, setExpandedNavGroup] = useState("Overview");
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mfaRequired, setMfaRequired] = useState<boolean | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [adminSecurity, setAdminSecurity] = useState({ require_admin_mfa: true, session_timeout_minutes: 30 });
  const [idleSecondsLeft, setIdleSecondsLeft] = useState<number | null>(null);
  const { role } = useAdminSession();
  const {
    databaseRole,
    authReady,
    signOut,
    user,
    avatar,
  } = useAdminSession();
  const accountName = user?.trim() || "Team Member";
  const accountInitials = accountName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
  const checkMfa = useCallback(async () => {
    if (!authReady || !isStaffRole(databaseRole)) {
      setMfaRequired(false);
      return;
    }
    setMfaError("");
    const { data: policy, error: policyError } = await supabase
      .from("admin_security_settings")
      .select("require_admin_mfa,session_timeout_minutes")
      .eq("id", true)
      .single();
    if (!policyError && policy) {
      setAdminSecurity({
        require_admin_mfa: policy.require_admin_mfa !== false,
        session_timeout_minutes: Math.max(5, Number(policy.session_timeout_minutes) || 30),
      });
      if (policy.require_admin_mfa === false) {
        setMfaRequired(false);
        return;
      }
    }
    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) {
      setMfaRequired(true);
      setMfaError("Secure access could not be verified. Check your connection and retry.");
      return;
    }
    if (assurance.nextLevel !== "aal2" || assurance.currentLevel === "aal2") {
      setMfaRequired(false);
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
  useEffect(() => { void checkMfa(); }, [checkMfa]);
  useEffect(() => {
    if (!isStaffRole(databaseRole)) return;
    const channel = supabase.channel("admin-shell-security-settings").on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "admin_security_settings" },
      () => void checkMfa(),
    ).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [checkMfa, databaseRole]);
  const ADMIN_ACTIVITY_KEY = "cozycraft-admin-last-activity";
  const continueAdminSession = useCallback(() => {
    const now = Date.now();
    window.localStorage.setItem(ADMIN_ACTIVITY_KEY, String(now));
    setIdleSecondsLeft(null);
  }, []);
  useEffect(() => {
    if (!authReady || !isStaffRole(databaseRole)) return;
    const timeoutMs = adminSecurity.session_timeout_minutes * 60_000;
    let loggingOut = false;
    if (!Number(window.localStorage.getItem(ADMIN_ACTIVITY_KEY))) continueAdminSession();
    const noteActivity = () => continueAdminSession();
    const check = () => {
      const lastActivity = Number(window.localStorage.getItem(ADMIN_ACTIVITY_KEY)) || Date.now();
      const remainingMs = timeoutMs - (Date.now() - lastActivity);
      if (remainingMs <= 0 && !loggingOut) {
        loggingOut = true;
        setIdleSecondsLeft(0);
        void recordAuthActivity(supabase, "admin_idle_logout", {
          name: `${adminSecurity.session_timeout_minutes}-minute inactivity timeout`,
          reason: "inactivity",
          timeout_minutes: adminSecurity.session_timeout_minutes,
        }).finally(async () => {
          window.localStorage.removeItem(ADMIN_ACTIVITY_KEY);
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
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId:mfaFactorId, code:mfaCode });
    setMfaBusy(false);
    if (error) { setMfaError("That authenticator code is invalid or expired. Enter the newest code."); return; }
    setMfaCode("");
    await checkMfa();
  };
  const allAdminPaths = adminNav.map((item) => item[2]);
  const allowedPaths = adminPathsForRole(role, allAdminPaths);
  const visibleNav = adminNav.filter(([, , path]) =>
    allowedPaths.includes(path),
  );
  const visibleNavGroups = adminNavGroups
    .map((group) => ({
      ...group,
      items: visibleNav.filter(([, , path]) =>
        (group.paths as readonly string[]).includes(path),
      ),
    }))
    .filter((group) => group.items.length > 0);
  const activeNavGroup = visibleNavGroups.find((group) =>
    group.items.some(([, , path]) => adminPathIsActive(loc.pathname, path)),
  );
  useEffect(() => {
    if (activeNavGroup) setExpandedNavGroup(activeNavGroup.label);
  }, [activeNavGroup?.label]);
  useEffect(() => {
    setOpen(false);
    setProfileOpen(false);
  }, [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);
  const canAccess = canAccessAdminPath(role, loc.pathname, allAdminPaths);
  if (!authReady || (user && !databaseRole)) return <div className="grid min-h-screen place-items-center bg-[#f3f0ea] text-sm text-muted-foreground">Checking secure access…</div>;
  if (!isStaffRole(databaseRole)) return <main className="grid min-h-screen place-items-center bg-[#e9e5de] p-5"><section className="max-w-md rounded-3xl bg-card p-8 text-center shadow-xl"><LockKeyhole className="mx-auto"/><h1 className="mt-5 font-serif text-4xl">Administrator access required.</h1><p className="mt-3 text-sm text-muted-foreground">Sign in with an approved staff or admin account.</p><Link to="/admin/login" className="mt-6 inline-flex rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background">Go to admin sign in</Link></section></main>;
  if (mfaRequired === null) return <div className="grid min-h-screen place-items-center bg-[#f3f0ea] text-sm text-muted-foreground">Verifying secure session…</div>;
  if (mfaRequired) return <main className="grid min-h-screen place-items-center bg-[#e9e5de] p-5"><form onSubmit={verifyMfa} className="w-full max-w-md rounded-3xl bg-card p-8 text-center shadow-xl"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-secondary"><ShieldCheck size={20}/></span><p className="mt-5 text-[10px] font-bold tracking-[.18em] text-muted-foreground">TWO-STEP VERIFICATION</p><h1 className="mt-2 font-serif text-4xl">Confirm it’s you.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Enter the current six-digit code from your authenticator app to open operations.</p>{mfaFactorId&&<label className="mt-6 grid gap-2 text-left text-sm font-semibold">Authenticator code<input autoFocus value={mfaCode} onChange={event=>setMfaCode(event.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" className="h-12 rounded-xl border border-border bg-background px-4 text-center text-lg tracking-[.35em]"/></label>}{mfaError&&<p className="mt-4 rounded-xl bg-[#f3e5d4] p-3 text-left text-xs font-semibold text-[#8b5c46]">{mfaError}</p>}<button type={mfaFactorId?"submit":"button"} onClick={mfaFactorId?undefined:()=>void checkMfa()} disabled={mfaBusy||Boolean(mfaFactorId&&mfaCode.length!==6)} className="mt-5 w-full rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:opacity-50">{mfaBusy?"Verifying…":mfaFactorId?"Verify and enter":"Retry secure check"}</button><button type="button" onClick={()=>void signOut()} className="mt-3 text-sm font-semibold underline underline-offset-4">Sign out</button></form></main>;
  if (!canAccess) return <main className="grid min-h-screen place-items-center bg-[#e9e5de] p-5"><section className="max-w-md rounded-3xl bg-card p-8 text-center shadow-xl"><ShieldCheck className="mx-auto"/><h1 className="mt-5 font-serif text-4xl">This feature is restricted.</h1><p className="mt-3 text-sm text-muted-foreground">Your {role.toLowerCase()} role does not have permission to open this page.</p><Link to="/admin" className="mt-6 inline-flex rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background">Return to overview</Link></section></main>;
  return (
    <div data-admin-shell className="min-h-screen overflow-x-clip bg-[#f3f0ea]">
      <a href="#admin-main" className="skip-link">Skip to admin content</a>
      <aside
        className={`fixed inset-y-0 left-0 z-[70] w-72 flex-col border-r border-white/10 bg-[#201f1d] p-5 text-white lg:flex ${open ? "flex" : "hidden"}`}
      >
        <button
          className="absolute right-4 top-4 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close admin navigation"
        >
          <X />
        </button>
        <div className="rounded-2xl bg-white/5 px-3 py-2">
          <Logo light />
        </div>
        <div className="mt-8 px-3">
          <p className="text-[10px] font-bold tracking-[.18em] text-white/40">
            OPERATIONS
          </p>
          <p className="mt-2 text-xs text-white/65">{role}</p>
        </div>
        <nav className="mt-4 grid gap-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleNavGroups.map((group) => {
            const GroupIcon = group.icon;
            const expanded = expandedNavGroup === group.label;
            const groupActive = activeNavGroup?.label === group.label;
            if (group.label === "Overview") {
              const overviewPath = group.items[0][2];
              return (
                <Link
                  key={group.label}
                  to={overviewPath}
                  aria-current={groupActive ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    groupActive
                      ? "bg-[#d8c7b0] font-semibold text-[#201f1d] shadow-sm"
                      : "text-white/65 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <GroupIcon size={17} />
                  Overview
                </Link>
              );
            }
            return (
              <div key={group.label} className="rounded-xl">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedNavGroup(expanded ? "" : group.label)
                  }
                  aria-expanded={expanded}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    groupActive
                      ? "bg-white/10 text-white"
                      : "text-white/65 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <GroupIcon size={17} className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{group.label}</span>
                    <span className="mt-0.5 block truncate text-[9px] font-normal text-white/40">
                      {group.description}
                    </span>
                  </span>
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white/8 px-1 text-[9px] text-white/55">
                    {group.items.length}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                  />
                </button>
                {expanded && (
                  <div className="ml-5 mt-1 grid gap-1 border-l border-white/12 pl-3">
                    {group.items.map(([Icon, label, path]) => {
                      const active = adminPathIsActive(loc.pathname, path);
                      return (
                        <Link
                          key={path}
                          to={path}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setOpen(false)}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs transition ${
                            active
                              ? "bg-[#d8c7b0] font-semibold text-[#201f1d] shadow-sm"
                              : "text-white/58 hover:bg-white/8 hover:text-white"
                          }`}
                        >
                          <Icon size={15} />
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-white/12 pt-4">
          <button
            onClick={() => setConfirmSignOut(true)}
            className="flex w-full items-center justify-between rounded-xl bg-white/6 px-3 py-3 text-sm text-white/85 transition hover:bg-white/12"
          >
            <span className="flex items-center gap-3">
              <LogOut size={17} />
              Log out
            </span>
            <ArrowRight size={15} />
          </button>
        </div>
      </aside>
      {open && (
        <button
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[60] bg-black/40 lg:hidden"
          aria-label="Close menu"
        />
      )}
      <div className="min-w-0 lg:ml-72">
        <header className="sticky top-0 z-50 isolate flex h-[70px] items-center justify-between border-b border-border/75 bg-[#f3f0ea]/95 px-3 backdrop-blur sm:h-[78px] sm:px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              aria-label="Open admin navigation"
              className="grid h-10 w-10 place-items-center rounded-xl bg-card shadow-sm lg:hidden"
            >
              <Menu size={19} />
            </button>
            <div>
              <p className="hidden text-[10px] font-bold tracking-[.16em] text-muted-foreground lg:block">
                COZYCRAFT / OPERATIONS
              </p>
              <h1 className="text-sm font-semibold lg:mt-0.5">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <WorkspaceSearch visibleNav={visibleNav} />
            <NotificationCenter />
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                aria-label="Open administrator account menu"
                aria-expanded={profileOpen}
                className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-2 shadow-sm transition hover:bg-secondary"
              >
                <AdminAccountAvatar
                  src={avatar}
                  name={accountName}
                  initials={accountInitials}
                  className="h-7 w-7 rounded-lg"
                />
                <span className="hidden text-left sm:block">
                  <b className="block text-[11px] leading-3">{accountName}</b>
                  <span className="block text-[10px] leading-3 text-muted-foreground">
                    {role}
                  </span>
                </span>
                <ChevronDown size={14} className="text-muted-foreground" />
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-12 z-[70] w-56 rounded-2xl border border-border bg-card p-2 shadow-xl">
                  <div className="flex items-center gap-3 border-b border-border px-3 py-3">
                    <AdminAccountAvatar
                      src={avatar}
                      name={accountName}
                      initials={accountInitials}
                      className="h-10 w-10 rounded-xl"
                    />
                    <div className="min-w-0">
                      <b className="block truncate text-xs">{accountName}</b>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {role}
                      </span>
                    </div>
                  </div>
                  <p className="px-3 py-2 text-[10px] font-bold tracking-[.15em] text-muted-foreground">SIGNED IN ROLE</p>
                  <div className="rounded-xl bg-secondary px-3 py-2.5 text-xs font-semibold">{role}</div>
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      setConfirmSignOut(true);
                    }}
                    className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs hover:bg-secondary"
                  >
                    <LogOut size={14}/>
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <nav aria-label="Quick admin navigation" className="sticky top-[70px] z-40 isolate border-b border-border bg-[#f3f0ea]/95 px-3 py-2 backdrop-blur sm:top-[78px] sm:px-5 lg:hidden">
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visibleNavGroups.map((group) => {
              const GroupIcon = group.icon;
              const expanded = expandedNavGroup === group.label;
              if (group.label === "Overview") {
                const overviewPath = group.items[0][2];
                return (
                  <Link
                    key={group.label}
                    to={overviewPath}
                    aria-current={activeNavGroup?.label === group.label ? "page" : undefined}
                    className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-[11px] font-semibold ${
                      activeNavGroup?.label === group.label
                        ? "bg-foreground text-background"
                        : "border border-border bg-card"
                    }`}
                  >
                    <GroupIcon size={14} />
                    Overview
                  </Link>
                );
              }
              return (
                <button
                  type="button"
                  key={group.label}
                  onClick={() => setExpandedNavGroup(expanded ? "" : group.label)}
                  aria-expanded={expanded}
                  className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-[11px] font-semibold ${
                    activeNavGroup?.label === group.label
                      ? "bg-foreground text-background"
                      : "border border-border bg-card"
                  }`}
                >
                  <GroupIcon size={14} />
                  {group.label}
                  <ChevronDown size={12} className={expanded ? "rotate-180" : ""} />
                </button>
              );
            })}
          </div>
          {expandedNavGroup && expandedNavGroup !== "Overview" && (
            <div className="mt-2 flex gap-2 overflow-x-auto border-t border-border/70 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {visibleNavGroups
                .find((group) => group.label === expandedNavGroup)
                ?.items.map(([Icon, label, path]) => {
                  const active = adminPathIsActive(loc.pathname, path);
                  return (
                    <Link
                      key={path}
                      to={path}
                      aria-current={active ? "page" : undefined}
                      className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-semibold ${
                        active
                          ? "bg-[#d8c7b0] text-foreground"
                          : "bg-card text-muted-foreground"
                      }`}
                    >
                      <Icon size={13} />
                      {label}
                    </Link>
                  );
                })}
            </div>
          )}
        </nav>
        <main id="admin-main" tabIndex={-1} className="relative z-0 isolate mx-auto max-w-[1500px] p-3 sm:p-5 lg:p-8">{children}</main>
      </div>
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
        <div className="fixed inset-0 z-[250] grid place-items-center bg-[#211f1c]/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="idle-warning-title">
          <section className="w-full max-w-md rounded-[2rem] border border-border bg-card p-7 text-center shadow-2xl">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-secondary"><LockKeyhole size={20}/></span>
            <p className="mt-5 text-[10px] font-bold tracking-[.18em] text-muted-foreground">SESSION SECURITY</p>
            <h2 id="idle-warning-title" className="mt-2 font-serif text-4xl">Still working?</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">For your protection, this administrator session will sign out after {adminSecurity.session_timeout_minutes} minutes without activity.</p>
            <p className="mt-5 text-2xl font-semibold tabular-nums">{Math.floor(idleSecondsLeft / 60)}:{String(idleSecondsLeft % 60).padStart(2, "0")}</p>
            <button onClick={continueAdminSession} className="mt-5 w-full rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background">Continue session</button>
            <button onClick={() => { setIdleSecondsLeft(null); void signOut().then(() => nav("/admin/login", { replace: true })); }} className="mt-3 text-sm font-semibold underline underline-offset-4">Sign out now</button>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const location = useLocation();
  const { userId } = useAdminSession();
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
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setItems([]);
      return;
    }
    const [notificationResult, readResult] = await Promise.all([
      supabase
        .from("admin_notifications")
        .select("id,kind,title,message,route,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("admin_notification_reads")
        .select("notification_id,read_at,dismissed_at")
        .eq("user_id", userId),
    ]);
    if (notificationResult.error || readResult.error) {
      setError(
        notificationResult.error?.message ??
          readResult.error?.message ??
          "Unable to load notifications.",
      );
      return;
    }
    const reads = new Map(
      (readResult.data ?? []).map((row) => [row.notification_id, row]),
    );
    setItems(
      (notificationResult.data ?? [])
        .filter((row) => !reads.get(row.id)?.dismissed_at)
        .map((row) => ({
          ...row,
          unread: !reads.get(row.id)?.read_at,
        })) as NotificationItem[],
    );
    setError("");
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void loadNotifications();
    const channel = supabase
      .channel(`admin-notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_notifications" },
        () => void loadNotifications(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "admin_notification_reads",
          filter: `user_id=eq.${userId}`,
        },
        () => void loadNotifications(),
      )
      .subscribe();
    const refreshOnFocus = () => void loadNotifications();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      void supabase.removeChannel(channel);
    };
  }, [loadNotifications, userId]);

  const saveReadState = async (
    notificationIds: number[],
    dismissed = false,
  ) => {
    if (!userId || !notificationIds.length) return;
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("admin_notification_reads")
      .upsert(
        notificationIds.map((notificationId) => ({
          notification_id: notificationId,
          user_id: userId,
          read_at: now,
          dismissed_at: dismissed ? now : null,
        })),
        { onConflict: "notification_id,user_id" },
      );
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setItems((current) =>
      dismissed
        ? current.filter((item) => !notificationIds.includes(item.id))
        : current.map((item) =>
            notificationIds.includes(item.id)
              ? { ...item, unread: false }
              : item,
          ),
    );
  };

  const openNotification = async (item: NotificationItem) => {
    if (item.unread) await saveReadState([item.id]);
    setOpen(false);
    nav(item.route);
  };

  const unread = items.filter((item) => item.unread).length;
  const relativeTime = (date: string) => {
    const minutes = Math.max(
      0,
      Math.floor((Date.now() - new Date(date).getTime()) / 60_000),
    );
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label={`Notifications, ${unread} unread`}
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-border bg-card shadow-sm"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#9a6047] px-1 text-[9px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open &&
        createPortal(
          <>
            <button
              type="button"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[80] bg-black/20 sm:bg-transparent"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Administrator notifications"
              className="fixed inset-x-3 bottom-3 top-[76px] z-[90] flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-[82px] sm:h-auto sm:max-h-[min(32rem,calc(100dvh-6rem))] sm:w-[350px]"
            >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <b className="text-sm">Notifications</b>
              <p className="text-[10px] text-muted-foreground">
                {unread} unread
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                disabled={unread === 0}
                onClick={() =>
                  void saveReadState(
                    items.filter((item) => item.unread).map((item) => item.id),
                  )
                }
                className="whitespace-nowrap px-1 text-[11px] font-semibold underline underline-offset-4 disabled:opacity-50 sm:text-xs"
              >
                Mark all read
              </button>
              <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary"><X size={16} /></button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {error && (
              <p className="bg-[#f3e5d4] px-4 py-3 text-xs font-semibold text-[#8b5c46]">
                {error}
              </p>
            )}
            {items.map((item) => (
              <button
                onClick={() => void openNotification(item)}
                className="flex w-full gap-3 border-b border-border px-4 py-3 text-left hover:bg-secondary"
                key={item.id}
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.unread ? "bg-[#b8875c]" : "bg-border"}`}
                />
                <span className="min-w-0 flex-1">
                  <b className="block break-words text-xs">{item.title}</b>
                  <span className="mt-1 block break-words text-xs leading-5 text-muted-foreground">
                    {item.message}
                  </span>
                  <span className="mt-1 block text-[10px] font-semibold text-muted-foreground">
                    {relativeTime(item.created_at)}
                  </span>
                </span>
              </button>
            ))}
            {!items.length && !error && (
              <div className="px-5 py-10 text-center">
                <Bell className="mx-auto text-muted-foreground" size={20} />
                <p className="mt-3 text-sm font-semibold">You’re all caught up.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  New customer activity will appear here.
                </p>
              </div>
            )}
          </div>
          <button
            disabled={items.length === 0}
            onClick={() =>
              void saveReadState(
                items.map((item) => item.id),
                true,
              )
            }
            className="w-full shrink-0 py-3 text-xs font-semibold text-muted-foreground hover:bg-secondary"
          >
            Clear notifications
          </button>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

export function AdminSetupAccount() {
  const navigate = useNavigate();
  const {
    authReady,
    databaseRole: role,
    userEmail,
  } = useAdminSession();
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

  if (!authReady) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3f0ea] text-sm text-muted-foreground">
        Verifying your invitation…
      </main>
    );
  }
  if (!isStaffRole(role)) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#e9e5de] p-5">
        <section className="max-w-md rounded-3xl bg-card p-8 text-center shadow-xl">
          <LockKeyhole className="mx-auto" />
          <h1 className="mt-5 font-serif text-4xl">Invitation required.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Open the newest invitation link sent to your work email.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#e9e5de] p-5">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-3xl bg-card p-8 shadow-xl"
      >
        <ShieldCheck />
        <p className="mt-6 text-[10px] font-bold tracking-[.18em] text-muted-foreground">
          SECURE TEAM SETUP
        </p>
        <h1 className="mt-3 font-serif text-4xl">Create your password.</h1>
        <p className="mt-3 text-sm text-muted-foreground">{userEmail}</p>
        <div className="mt-7 grid gap-4">
          <label className="grid gap-2 text-sm font-semibold">
            New password
            <input
              required
              type="password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 rounded-xl border border-border px-4 font-normal outline-none"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Confirm password
            <input
              required
              type="password"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="h-12 rounded-xl border border-border px-4 font-normal outline-none"
            />
          </label>
        </div>
        {error && (
          <p className="mt-4 rounded-xl bg-[#f3e5d4] p-3 text-xs font-semibold text-[#8b5c46]">
            {error}
          </p>
        )}
        <button
          disabled={loading}
          className="mt-6 h-12 w-full rounded-xl bg-foreground text-sm font-semibold text-background disabled:opacity-60"
        >
          {loading ? "Saving…" : "Finish account setup"}
        </button>
      </form>
    </main>
  );
}
