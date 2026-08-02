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

export type TeamMember = {
  id: string;
  full_name: string;
  email: string | null;
  role: Exclude<DbRole, "customer">;
  staff_active: boolean;
  created_at: string;
};

export const teamRoleLabels: Record<TeamMember["role"], string> = {
  superadmin: "Super Administrator",
  admin: "Administrator",
  staff: "Staff",
};

export const teamRoleDescriptions: Record<TeamMember["role"], string> = {
  superadmin: "Full access, team accounts, permissions, and store settings.",
  admin: "Operations, customers, payments, reports, and activity logs.",
  staff: "Catalog, inventory, orders, reviews, and customer support.",
};

export function TeamAccessPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] =
    useState<TeamMember["role"]>("staff");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadMembers = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, staff_active, created_at")
      .in("role", ["staff", "admin", "superadmin"])
      .order("created_at");
    if (queryError) {
      setError(queryError.message);
      return;
    }
    setMembers((data ?? []) as TeamMember[]);
  }, []);

  useEffect(() => {
    void loadMembers();
    const channel = supabase
      .channel("team-access-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => void loadMembers(),
      )
      .subscribe();
    const interval = window.setInterval(() => void loadMembers(), 10_000);
    const refreshVisible = () => {
      if (document.visibilityState === "visible") void loadMembers();
    };
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
      void supabase.removeChannel(channel);
    };
  }, [loadMembers]);

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    const { data, error: invokeError } = await supabase.functions.invoke(
      "manage-team-member",
      {
        body: {
          action: "invite",
          email,
          fullName,
          role: inviteRole,
        },
      },
    );
    if (invokeError || data?.error) {
      setError(data?.error ?? invokeError?.message ?? "Unable to invite member.");
    } else {
      setNotice(data.message);
      setFullName("");
      setEmail("");
      setInviteRole("staff");
      await loadMembers();
    }
    setLoading(false);
  };

  const updateRole = async (
    userId: string,
    nextRole: TeamMember["role"],
  ) => {
    setError("");
    setNotice("");
    const { data, error: invokeError } = await supabase.functions.invoke(
      "manage-team-member",
      {
        body: { action: "update-role", userId, role: nextRole },
      },
    );
    if (invokeError || data?.error) {
      setError(data?.error ?? invokeError?.message ?? "Unable to update role.");
      return;
    }
    setNotice(data.message);
    await loadMembers();
  };

  const setMemberStatus = async (member: TeamMember) => {
    const nextActive = !member.staff_active;
    if (
      !window.confirm(
        nextActive
          ? `Restore administrator access for ${member.full_name || member.email}?`
          : `Suspend ${member.full_name || member.email}? Their active admin sessions will lose access.`,
      )
    ) {
      return;
    }
    setError("");
    setNotice("");
    const { data, error: invokeError } = await supabase.functions.invoke(
      "manage-team-member",
      {
        body: {
          action: "set-status",
          userId: member.id,
          active: nextActive,
        },
      },
    );
    if (invokeError || data?.error) {
      setError(
        data?.error ?? invokeError?.message ?? "Unable to update account status.",
      );
      return;
    }
    setNotice(data.message);
    await loadMembers();
  };

  return (
    <AdminShell title="Team access">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
            SECURITY &amp; ACCESS
          </p>
          <h2 className="mt-2 text-3xl font-semibold">Team accounts</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Invite each person using their own work email. Passwords stay private
            and every account receives only the tools assigned to its role.
          </p>
        </div>
      </div>

      {(notice || error) && (
        <div
          className={`mt-6 rounded-xl p-4 text-sm font-semibold ${
            error
              ? "bg-[#f3e5d4] text-[#8b5c46]"
              : "bg-[#e3ecdf] text-[#56714f]"
          }`}
        >
          {error || notice}
        </div>
      )}

      <div className="mt-7 grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <form
          onSubmit={invite}
          className="rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary">
              <Plus size={18} />
            </span>
            <div>
              <h3 className="font-semibold">Invite a team member</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                They will finish setup from a secure email link.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-semibold">
              Full name
              <input
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-3 font-normal outline-none"
                placeholder="Team member name"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Work email
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-3 font-normal outline-none"
                placeholder="name@company.com"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Role
              <select
                value={inviteRole}
                onChange={(event) =>
                  setInviteRole(event.target.value as TeamMember["role"])
                }
                className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-3 font-normal"
              >
                <option value="staff">Staff</option>
                <option value="admin">Administrator</option>
                <option value="superadmin">Super Administrator</option>
              </select>
            </label>
            <p className="rounded-xl bg-secondary p-3 text-xs leading-5 text-muted-foreground">
              {teamRoleDescriptions[inviteRole]}
            </p>
          </div>
          <button
            disabled={loading}
            className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background disabled:opacity-60"
          >
            {loading ? "Sending invitation…" : "Send secure invitation"}
            <ArrowRight size={15} />
          </button>
        </form>

        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
              ACTIVE TEAM
            </p>
            <h3 className="mt-1 text-lg font-semibold">
              {members.length} account{members.length === 1 ? "" : "s"}
            </h3>
          </div>
          <div className="divide-y divide-border">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#d8c7b0] text-sm font-bold">
                  {(member.full_name || member.email || "T")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">
                      {member.full_name || "Invited team member"}
                    </p>
                    <span
                      className={`rounded-full px-2 py-1 text-[9px] font-bold tracking-[.12em] ${
                        member.staff_active
                          ? "bg-[#e3ecdf] text-[#56714f]"
                          : "bg-[#f3e5d4] text-[#8b5c46]"
                      }`}
                    >
                      {member.staff_active ? "ACTIVE" : "SUSPENDED"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {member.email || "Email unavailable"}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {teamRoleDescriptions[member.role]}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  <select
                    value={member.role}
                    disabled={!member.staff_active}
                    onChange={(event) =>
                      void updateRole(
                        member.id,
                        event.target.value as TeamMember["role"],
                      )
                    }
                    className="h-10 rounded-xl border border-border bg-[#fcfbf8] px-3 text-xs font-semibold disabled:opacity-50"
                    aria-label={`Role for ${member.full_name}`}
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Administrator</option>
                    <option value="superadmin">Super Administrator</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void setMemberStatus(member)}
                    className="text-xs font-semibold underline underline-offset-4"
                  >
                    {member.staff_active ? "Suspend access" : "Restore access"}
                  </button>
                </div>
              </div>
            ))}
            {members.length === 0 && !error && (
              <p className="p-8 text-center text-sm text-muted-foreground">
                No team accounts yet.
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {(["superadmin", "admin", "staff"] as TeamMember["role"][]).map(
          (item) => (
            <section
              key={item}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <p className="text-sm font-semibold">{teamRoleLabels[item]}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {teamRoleDescriptions[item]}
              </p>
            </section>
          ),
        )}
      </div>
    </AdminShell>
  );
}

export function StoreSettingsPage() {
  const [section, setSection] = useState("Store");
  const [notice, setNotice] = useState("");
  const [settings, setSettings] = useState({
    store_name: "CozyCraft Furnitures",
    contact_email: "",
    delivery_area: "Metro Manila",
    low_stock_threshold: 8,
    inventory_alerts: true,
    weekly_report_enabled: false,
  });
  const loadSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from("store_settings")
      .select(
        "store_name,contact_email,delivery_area,low_stock_threshold,inventory_alerts,weekly_report_enabled",
      )
      .eq("id", true)
      .single();
    if (error) setNotice(error.message);
    else if (data) setSettings(data);
  }, []);
  useEffect(() => {
    void loadSettings();
    const channel = supabase
      .channel("admin-store-settings")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "store_settings" },
        () => void loadSettings(),
      )
      .subscribe();
    const interval = window.setInterval(() => void loadSettings(), 10_000);
    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [loadSettings]);
  const save = async () => {
    const { error } = await supabase
      .from("store_settings")
      .update(settings)
      .eq("id", true);
    setNotice(error?.message ?? "Store settings saved to Supabase.");
    if (!error) await loadSettings();
  };
  return (
    <AdminShell title="Settings">
      <div>
        <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
          STORE CONFIGURATION
        </p>
        <h2 className="mt-2 text-3xl font-semibold">Settings</h2>
      </div>
      <div className="mt-7 grid gap-5 lg:grid-cols-[230px_1fr]">
        <aside className="rounded-2xl border border-border bg-card p-3">
          {["Store", "Delivery", "Notifications"].map((item) => (
            <button
              onClick={() => {
                setSection(item);
                setNotice("");
              }}
              className={`w-full rounded-xl px-3 py-3 text-left text-sm ${section === item ? "bg-secondary font-semibold" : "hover:bg-secondary"}`}
              key={item}
            >
              {item}
            </button>
          ))}
        </aside>
        <section className="rounded-2xl border border-border bg-card p-6">
          <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
            {section.toUpperCase()}
          </p>
          <h3 className="mt-2 text-2xl font-semibold">{section} preferences</h3>
          <div className="mt-7 grid gap-5">
            {section === "Store" && (
              <>
                <label className="grid gap-2 text-sm font-semibold">
                  Store name
                  <input value={settings.store_name} onChange={(event) => setSettings((value) => ({ ...value, store_name: event.target.value }))} className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-3 font-normal" />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Contact email
                  <input type="email" value={settings.contact_email} onChange={(event) => setSettings((value) => ({ ...value, contact_email: event.target.value }))} className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-3 font-normal" />
                </label>
              </>
            )}
            {section === "Delivery" && (
              <label className="grid gap-2 text-sm font-semibold">
                Default delivery area
                <input value={settings.delivery_area} onChange={(event) => setSettings((value) => ({ ...value, delivery_area: event.target.value }))} className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-3 font-normal" />
              </label>
            )}
            {section === "Notifications" && (
              <>
                <label className="grid gap-2 text-sm font-semibold">
                  Low-stock threshold
                  <input type="number" min="0" value={settings.low_stock_threshold} onChange={(event) => setSettings((value) => ({ ...value, low_stock_threshold: Math.max(0, Number(event.target.value)) }))} className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-3 font-normal" />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-border p-4 text-sm font-semibold">
                  Inventory alerts
                  <input type="checkbox" checked={settings.inventory_alerts} onChange={(event) => setSettings((value) => ({ ...value, inventory_alerts: event.target.checked }))} className="h-5 w-5" />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-border p-4 text-sm font-semibold">
                  Weekly report delivery
                  <input type="checkbox" checked={settings.weekly_report_enabled} onChange={(event) => setSettings((value) => ({ ...value, weekly_report_enabled: event.target.checked }))} className="h-5 w-5" />
                </label>
              </>
            )}
          </div>
          <button
            onClick={() => void save()}
            className="mt-7 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
          >
            Save {section.toLowerCase()} preferences
          </button>
          {notice && (
            <p className="mt-4 flex gap-2 text-sm text-[#5b744f]">
              <Check size={16} />
              {notice}
            </p>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
