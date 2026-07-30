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
      .select("id, full_name, email, role, created_at")
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
                  <p className="truncate text-sm font-semibold">
                    {member.full_name || "Invited team member"}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {member.email || "Email unavailable"}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {teamRoleDescriptions[member.role]}
                  </p>
                </div>
                <select
                  value={member.role}
                  onChange={(event) =>
                    void updateRole(
                      member.id,
                      event.target.value as TeamMember["role"],
                    )
                  }
                  className="h-10 rounded-xl border border-border bg-[#fcfbf8] px-3 text-xs font-semibold"
                  aria-label={`Role for ${member.full_name}`}
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Administrator</option>
                  <option value="superadmin">Super Administrator</option>
                </select>
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
  const [saved, setSaved] = useState(false);
  const fields =
    section === "Store"
      ? ["Store name", "Contact email", "Business address"]
      : section === "Delivery"
        ? [
            "Default delivery zone",
            "Processing time",
            "White-glove availability",
          ]
        : ["Low-stock threshold", "Inventory alerts", "Weekly report delivery"];
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
                setSaved(false);
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
            {fields.map((field, i) => (
              <label className="grid gap-2 text-sm font-semibold" key={field}>
                {field}
                {i === 2 && section === "Delivery" ? (
                  <select className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-3 font-normal">
                    <option>Available</option>
                    <option>Unavailable</option>
                  </select>
                ) : (
                  <input
                    className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-3 font-normal"
                    defaultValue={
                      i === 0 && section === "Store"
                        ? "CozyCraft Furnitures"
                        : ""
                    }
                  />
                )}
              </label>
            ))}
          </div>
          <button
            onClick={() => setSaved(true)}
            className="mt-7 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
          >
            Save {section.toLowerCase()} preferences
          </button>
          {saved && (
            <p className="mt-4 flex gap-2 text-sm text-[#5b744f]">
              <Check size={16} />
              Preferences saved.
            </p>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
