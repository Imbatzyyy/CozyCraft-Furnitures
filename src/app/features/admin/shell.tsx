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
} from "react-router";
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
import { signInForPortal } from "@/lib/auth";

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


export function AdminLogin() {
  const nav = useNavigate();
  const { role, authReady, user, signOut } = useStore();
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
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
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signInForPortal(email, password, "admin");
    setLoading(false);
    if (!result.ok) {
      setError(
        result.error ??
          "Administrator sign in failed. Check your credentials and try again.",
      );
      return;
    }
    nav("/admin");
  };
  return <main className="h-dvh overflow-hidden bg-[#e9e5de] p-3 sm:p-5"><div className="mx-auto grid h-full max-w-[1500px] overflow-hidden rounded-[2rem] bg-card shadow-[0_24px_80px_rgba(50,42,34,.14)] lg:grid-cols-[1.1fr_.9fr]">
    <section className="relative hidden overflow-hidden bg-[#201e1b] p-10 text-[#f4f2ee] lg:flex lg:flex-col lg:justify-between"><ImageWithFallback src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1400&q=80" alt="CozyCraft operations environment" className="absolute inset-0 h-full w-full object-cover opacity-25"/><div className="absolute inset-0 bg-[#171614]/75"/><div className="relative flex items-center justify-between"><Logo light/><span className="rounded-full border border-white/20 px-3 py-1.5 text-[10px] font-bold tracking-[.16em] text-white/70">SECURE WORKSPACE</span></div><div className="relative max-w-lg"><p className="text-[10px] font-bold tracking-[.22em] text-[#d8c7b0]">COZYCRAFT / OPERATIONS</p><h1 className="mt-6 font-[Playfair_Display] text-6xl leading-[.98] tracking-[-.04em]">Care for every detail behind the scenes.</h1><p className="mt-7 max-w-sm text-sm leading-7 text-white/70">One live workspace for catalog, inventory, customers, and every storefront order.</p></div><p className="relative text-xs text-white/60">Protected by Supabase Auth and role-based database policies.</p></section>
    <section className="flex min-h-0 items-center justify-center overflow-hidden px-5 py-5 sm:px-10"><form onSubmit={submit} className="auth-fixed-form w-full max-w-sm"><div className="mb-5 lg:hidden"><Logo/></div><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-secondary"><LockKeyhole size={15}/></span><p className="text-[10px] font-bold tracking-[.18em] text-muted-foreground">RESTRICTED ACCESS</p></div><h2 className="mt-4 font-[Playfair_Display] text-4xl tracking-[-.04em] sm:text-5xl">Administrator sign in.</h2><p className="mt-2 text-sm leading-5 text-muted-foreground">Use an approved staff or administrator account.</p><div className="mt-6 grid gap-3"><label className="grid gap-2 text-sm font-semibold">Work email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-4 font-normal outline-none" placeholder="you@cozycraft.com"/></label><label className="grid gap-2 text-sm font-semibold">Password<div className="relative"><input required type={show?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-[#fcfbf8] px-4 pr-14 font-normal outline-none" placeholder="••••••••"/><button type="button" onClick={()=>setShow(!show)} className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">{show?"Hide":"Show"}</button></div></label></div>{error&&<p className="mt-3 rounded-xl bg-[#f3e5d4] p-3 text-xs font-semibold text-[#8b5c46]">{error}</p>}<button disabled={loading} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background disabled:opacity-60">{loading?"Checking access…":"Enter operations"}<ArrowRight size={16}/></button><div className="mt-4 flex items-start gap-3 rounded-2xl bg-secondary p-3 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 shrink-0 text-[#6d8065]" size={16}/>Only accounts marked as staff or admin in Supabase can enter.</div><p className="mt-4 text-center text-sm text-muted-foreground">Looking for the storefront? <Link to="/login" className="font-semibold text-foreground underline underline-offset-4">Customer sign in</Link></p></form></section>
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
  [Star, "Reviews", "/admin/reviews"],
  [ChartNoAxesCombined, "Reports", "/admin/reports"],
  [Activity, "Activity logs", "/admin/activity-logs"],
  [MessageCircle, "Support", "/admin/support"],
  [Settings, "Settings", "/admin/settings"],
] as const;

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
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { role } = useAdminSession();
  const { role: databaseRole, authReady, signOut, user } = useStore();
  const accountName = user?.trim() || "Team Member";
  const accountInitials = accountName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
  const allowed: Record<AdminRole, string[]> = {
    "Super Administrator": adminNav.map((x) => x[2]),
    Administrator: [
      "/admin",
      "/admin/products",
      "/admin/categories",
      "/admin/inventory",
      "/admin/orders",
      "/admin/payments",
      "/admin/customers",
      "/admin/reviews",
      "/admin/reports",
      "/admin/activity-logs",
      "/admin/support",
    ],
    Staff: [
      "/admin",
      "/admin/products",
      "/admin/categories",
      "/admin/inventory",
      "/admin/orders",
      "/admin/reviews",
      "/admin/support",
    ],
  };
  const visibleNav = adminNav.filter(([, , path]) =>
    allowed[role].includes(path),
  );
  const canAccess = allowed[role].some(
    (path) =>
      loc.pathname === path ||
      (path !== "/admin" && loc.pathname.startsWith(`${path}/`)),
  );
  if (!authReady || (user && !databaseRole)) return <div className="grid min-h-screen place-items-center bg-[#f3f0ea] text-sm text-muted-foreground">Checking secure access…</div>;
  if (!isStaffRole(databaseRole)) return <main className="grid min-h-screen place-items-center bg-[#e9e5de] p-5"><section className="max-w-md rounded-3xl bg-card p-8 text-center shadow-xl"><LockKeyhole className="mx-auto"/><h1 className="mt-5 font-serif text-4xl">Administrator access required.</h1><p className="mt-3 text-sm text-muted-foreground">Sign in with an approved staff or admin account.</p><Link to="/admin/login" className="mt-6 inline-flex rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background">Go to admin sign in</Link></section></main>;
  if (!canAccess) return <main className="grid min-h-screen place-items-center bg-[#e9e5de] p-5"><section className="max-w-md rounded-3xl bg-card p-8 text-center shadow-xl"><ShieldCheck className="mx-auto"/><h1 className="mt-5 font-serif text-4xl">This feature is restricted.</h1><p className="mt-3 text-sm text-muted-foreground">Your {role.toLowerCase()} role does not have permission to open this page.</p><Link to="/admin" className="mt-6 inline-flex rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background">Return to overview</Link></section></main>;
  return (
    <div className="min-h-screen bg-[#f3f0ea]">
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/10 bg-[#201f1d] p-5 text-white transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <button
          className="absolute right-4 top-4 lg:hidden"
          onClick={() => setOpen(false)}
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
          {visibleNav.map(([Icon, label, path]) => (
            <Link
              key={path}
              to={path}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${loc.pathname === path ? "bg-[#d8c7b0] text-[#201f1d] shadow-sm" : "text-white/65 hover:bg-white/8 hover:text-white"}`}
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
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
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label="Close menu"
        />
      )}
      <div className="min-w-0 lg:ml-72">
        <header className="sticky top-0 z-30 flex h-[78px] items-center justify-between border-b border-border/75 bg-[#f3f0ea]/95 px-5 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
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
            <button className="hidden h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-xs text-muted-foreground shadow-sm md:flex">
              <Search size={15} />
              Search workspace{" "}
              <kbd className="ml-4 rounded-md bg-secondary px-1.5 py-0.5 text-[10px]">
                ⌘ K
              </kbd>
            </button>
            <NotificationCenter />
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-2 shadow-sm transition hover:bg-secondary"
              >
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#b8a58d] text-[10px] font-bold text-foreground">
                  {accountInitials}
                </span>
                <span className="hidden text-left sm:block">
                  <b className="block text-[11px] leading-3">{accountName}</b>
                  <span className="block text-[10px] leading-3 text-muted-foreground">
                    {role}
                  </span>
                </span>
                <ChevronDown size={14} className="text-muted-foreground" />
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-border bg-card p-2 shadow-xl">
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
        <main className="mx-auto max-w-[1500px] p-5 lg:p-8">{children}</main>
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
    </div>
  );
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([
    {
      id: 1,
      title: "Low-stock alert",
      text: "Mara Lounge Chair has reached its reorder point.",
      new: true,
    },
    {
      id: 2,
      title: "Order awaiting review",
      text: "Order #CC-2026-0814 is ready for fulfillment.",
      new: true,
    },
    {
      id: 3,
      title: "New customer review",
      text: "Luna Reyes left a 5-star review for Noma Dining Chair.",
      new: false,
    },
  ]);
  const unread = items.filter((i) => i.new).length;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-border bg-card shadow-sm"
      >
        <Bell size={18} />
        {unread > 0 && (
          <i className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-[#9a6047]" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[330px] overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <b className="text-sm">Notifications</b>
              <p className="text-[10px] text-muted-foreground">
                {unread} unread
              </p>
            </div>
            <button
              onClick={() =>
                setItems((current) =>
                  current.map((i) => ({ ...i, new: false })),
                )
              }
              className="text-xs font-semibold underline underline-offset-4"
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.map((item) => (
              <button
                onClick={() =>
                  setItems((current) =>
                    current.map((i) =>
                      i.id === item.id ? { ...i, new: false } : i,
                    ),
                  )
                }
                className="flex w-full gap-3 border-b border-border px-4 py-3 text-left hover:bg-secondary"
                key={item.id}
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.new ? "bg-[#b8875c]" : "bg-border"}`}
                />
                <span>
                  <b className="block text-xs">{item.title}</b>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {item.text}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setItems([])}
            className="w-full py-3 text-xs font-semibold text-muted-foreground hover:bg-secondary"
          >
            Clear notifications
          </button>
        </div>
      )}
    </div>
  );
}

export function AdminSetupAccount() {
  const navigate = useNavigate();
  const { authReady, role, userEmail } = useStore();
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
