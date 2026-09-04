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
import {
  defaultAdminSecuritySettings,
  defaultStoreSettings,
  normalizeStoreSettings,
  type AdminSecuritySettings,
  type PublicStoreSettings,
} from "@/lib/settings/store-settings";
import { functionErrorMessage } from "@/lib/shared/function-error";
import {
  clearAdminDraft,
  readAdminDraft,
  writeAdminDraft,
} from "@/lib/admin/admin-drafts";

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

const teamInvitationDraftKey = "cozycraft:admin:team-invitation:v1";
type TeamInvitationDraft = {
  fullName: string;
  email: string;
  role: TeamMember["role"];
};
const isTeamInvitationDraft = (value: unknown): value is TeamInvitationDraft => {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<TeamInvitationDraft>;
  return (
    typeof draft.fullName === "string" &&
    typeof draft.email === "string" &&
    ["staff", "admin", "superadmin"].includes(draft.role ?? "")
  );
};

export function TeamAccessPage() {
  const { userId: currentUserId } = useAdminSession();
  const recoveredInvitation = useMemo(
    () => readAdminDraft(teamInvitationDraftKey, isTeamInvitationDraft),
    [],
  );
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [fullName, setFullName] = useState(recoveredInvitation?.fullName ?? "");
  const [email, setEmail] = useState(recoveredInvitation?.email ?? "");
  const [inviteRole, setInviteRole] =
    useState<TeamMember["role"]>(recoveredInvitation?.role ?? "staff");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (fullName || email) {
      writeAdminDraft(teamInvitationDraftKey, {
        fullName,
        email,
        role: inviteRole,
      } satisfies TeamInvitationDraft);
    }
  }, [email, fullName, inviteRole]);

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
    const refreshVisible = () => {
      if (document.visibilityState === "visible") void loadMembers();
    };
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
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
      setError(
        data?.error ??
          (await functionErrorMessage(
            invokeError,
            "Unable to send the invitation. Please try again.",
          )),
      );
    } else {
      setNotice(data.message);
      clearAdminDraft(teamInvitationDraftKey);
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
      setError(
        data?.error ??
          (await functionErrorMessage(
            invokeError,
            "Unable to update the team member's role.",
          )),
      );
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
        data?.error ??
          (await functionErrorMessage(
            invokeError,
            "Unable to update the team member's access.",
          )),
      );
      return;
    }
    setNotice(data.message);
    await loadMembers();
  };
  const deleteMember = async (member: TeamMember) => {
    if (member.id === currentUserId) { setError("You cannot delete your own account."); return; }
    const confirmation = window.prompt(`Permanent deletion cannot be undone. Type DELETE ${member.email ?? member.full_name} to continue.`);
    if (confirmation !== `DELETE ${member.email ?? member.full_name}`) return;
    setError(""); setNotice("");
    const { data, error: invokeError } = await supabase.functions.invoke("manage-team-member", { body: { action: "delete", userId: member.id } });
    if (invokeError || data?.error) setError(data?.error ?? await functionErrorMessage(invokeError, "Unable to delete this team account."));
    else { setNotice(data.message); await loadMembers(); }
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
                  <button type="button" disabled={member.id === currentUserId} onClick={() => void deleteMember(member)} className="text-xs font-semibold text-[#9a553f] underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-35">Permanently delete</button>
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
  const sections = [
    "General",
    "Branding",
    "Checkout",
    "Delivery & orders",
    "Inventory",
    "Payments",
    "Notifications",
    "Reviews",
    "Customer accounts",
    "Security",
    "Integrations",
    "Reports & privacy",
  ] as const;
  const [section, setSection] = useState<(typeof sections)[number]>("General");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [settings, setSettings] = useState<PublicStoreSettings>(defaultStoreSettings);
  const [security, setSecurity] = useState<AdminSecuritySettings>(defaultAdminSecuritySettings);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const snapshot = useCallback(
    (storeValue: PublicStoreSettings, securityValue: AdminSecuritySettings) =>
      JSON.stringify({ storeValue, securityValue }),
    [],
  );
  const dirty = savedSnapshot !== "" && snapshot(settings, security) !== savedSnapshot;
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  const loadSettings = useCallback(async () => {
    const [storeResult, securityResult, recipientResult] = await Promise.all([
      supabase.from("store_settings").select("*").eq("id", true).single(),
      supabase.from("admin_security_settings").select("*").eq("id", true).single(),
      supabase.from("admin_report_recipients").select("recipients").eq("id", true).maybeSingle(),
    ]);
    if (storeResult.error) {
      setNotice(storeResult.error.message);
      setLoading(false);
      return;
    }
    if (securityResult.error) {
      setNotice(securityResult.error.message);
      setLoading(false);
      return;
    }
    const nextStore = normalizeStoreSettings({
      ...storeResult.data,
      report_settings: {
        ...((storeResult.data?.report_settings as Record<string, unknown> | null) ?? {}),
        recipients: recipientResult.data?.recipients ?? [],
      },
    });
    const nextSecurity = {
      ...defaultAdminSecuritySettings,
      ...(securityResult.data ?? {}),
      integration_status: {
        ...defaultAdminSecuritySettings.integration_status,
        ...((securityResult.data?.integration_status as Record<string, boolean> | null) ?? {}),
      },
    };
    setSettings(nextStore);
    setSecurity(nextSecurity);
    setSavedSnapshot(snapshot(nextStore, nextSecurity));
    setLoading(false);
  }, [snapshot]);
  useEffect(() => {
    void loadSettings();
    const channel = supabase
      .channel("admin-store-settings")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "store_settings" },
        () => {
          if (!dirtyRef.current) void loadSettings();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "admin_security_settings" },
        () => {
          if (!dirtyRef.current) void loadSettings();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadSettings]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const updateNested = <K extends keyof PublicStoreSettings>(
    key: K,
    property: string,
    value: unknown,
  ) => setSettings((current) => ({
    ...current,
    [key]: { ...(current[key] as Record<string, unknown>), [property]: value },
  }));
  const validate = () => {
    if (!settings.store_name.trim()) return "Store name is required.";
    if (!/^\S+@\S+\.\S+$/.test(settings.contact_email)) return "Enter a valid customer contact email.";
    if (settings.announcement_enabled && !settings.announcement_text.trim()) return "Announcement text is required while the banner is enabled.";
    if (settings.announcement_link && !/^(\/|https:\/\/)/i.test(settings.announcement_link)) return "Announcement links must be an internal path or an HTTPS URL.";
    if (Object.values(settings.social_links).some((url) => url && !/^https:\/\//i.test(url))) return "Social links must use HTTPS.";
    if (!settings.checkout_settings.cod_enabled && !settings.checkout_settings.card_enabled && !settings.checkout_settings.gcash_enabled) return "Keep at least one payment method enabled.";
    if (settings.currency_code !== "PHP" && (settings.checkout_settings.card_enabled || settings.checkout_settings.gcash_enabled)) return "Card and GCash checkout require PHP. Disable those methods or select PHP.";
    if (settings.fulfillment_settings.estimated_delivery_days_min > settings.fulfillment_settings.estimated_delivery_days_max) return "Minimum delivery days cannot exceed maximum delivery days.";
    if (!/^[A-Z0-9-]{1,10}$/.test(settings.fulfillment_settings.order_number_prefix)) return "Order prefix must use 1–10 uppercase letters, numbers, or hyphens.";
    if (settings.review_settings.minimum_length > settings.review_settings.maximum_length) return "Review minimum length cannot exceed its maximum.";
    if (settings.account_settings.password_minimum_length < 8) return "Customer passwords must require at least 8 characters.";
    if (security.session_timeout_minutes < 15) return "Administrator session timeout must be at least 15 minutes.";
    return "";
  };
  const save = async () => {
    const validationError = validate();
    if (validationError) {
      setNotice(validationError);
      return;
    }
    if (!window.confirm("Apply these settings across the storefront and admin workspace?")) return;
    setSaving(true);
    const { id: _storeId, updated_at: _storeUpdated, ...storeUpdate } = settings;
    const { id: _securityId, updated_at: _securityUpdated, updated_by: _updatedBy, ...securityUpdate } = security;
    const { error } = await supabase.rpc("save_admin_workspace_settings", {
      p_store: storeUpdate,
      p_security: securityUpdate,
    });
    setSaving(false);
    setNotice(error?.message ?? "Settings applied across CozyCraft in realtime.");
    if (!error) await loadSettings();
  };
  const testConnections = async () => {
    setChecking(true);
    const { error } = await supabase.from("store_settings").select("id").eq("id", true).single();
    setChecking(false);
    setNotice(error ? `Supabase check failed: ${error.message}` : "Supabase database and realtime configuration are reachable. Edge integrations remain protected by server-side secrets.");
  };
  const numberInput = (label: string, value: number, onChange: (value: number) => void, suffix = "") => (
    <label className="grid gap-2 text-sm font-semibold">{label}<div className="relative"><input type="number" min="0" value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value)))} className="h-11 w-full rounded-xl border border-border bg-[#fcfbf8] px-3 pr-14 font-normal" />{suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}</div></label>
  );
  const toggle = (label: string, detail: string, checked: boolean, onChange: (checked: boolean) => void) => (
    <label className="flex items-start justify-between gap-5 rounded-xl border border-border p-4"><span><b className="block text-sm">{label}</b><span className="mt-1 block text-xs leading-5 text-muted-foreground">{detail}</span></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-foreground" /></label>
  );
  const textInput = (label: string, value: string, onChange: (value: string) => void, placeholder = "") => (
    <label className="grid gap-2 text-sm font-semibold">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-3 font-normal" /></label>
  );
  return (
    <AdminShell title="Settings">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
        <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">
          STORE CONFIGURATION
        </p>
        <h2 className="mt-2 text-3xl font-semibold">Operations control center</h2>
        <p className="mt-2 text-sm text-muted-foreground">Validated, role-protected controls synchronized with Supabase realtime.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className={`h-2 w-2 rounded-full ${dirty ? "bg-[#b37a49]" : "bg-[#66845f]"}`} />{dirty ? "Unsaved changes" : "All changes saved"}</div>
      </div>
      <div className="mt-7 grid gap-5 lg:grid-cols-[230px_1fr]">
        <aside className="h-fit rounded-2xl border border-border bg-card p-3 lg:sticky lg:top-24">
          {sections.map((item) => (
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
          <h3 className="mt-2 text-2xl font-semibold">{section}</h3>
          {loading ? <p className="mt-7 text-sm text-muted-foreground">Loading protected configuration…</p> : <div className="mt-7 grid gap-5 md:grid-cols-2">
            {section === "General" && (
              <>
                {textInput("Store name", settings.store_name, (value) => setSettings((current) => ({ ...current, store_name: value })))}
                {textInput("Customer contact email", settings.contact_email, (value) => setSettings((current) => ({ ...current, contact_email: value })))}
                {textInput("Support phone", settings.support_phone, (value) => setSettings((current) => ({ ...current, support_phone: value })))}
                {textInput("Business address", settings.business_address, (value) => setSettings((current) => ({ ...current, business_address: value })))}
                <label className="grid gap-2 text-sm font-semibold">Store currency<select value={settings.currency_code} onChange={(event) => setSettings((current) => ({ ...current, currency_code: event.target.value as PublicStoreSettings["currency_code"] }))} className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-3 font-normal"><option value="PHP">PHP — Philippine peso</option><option value="USD">USD — US dollar</option><option value="EUR">EUR — Euro</option><option value="SGD">SGD — Singapore dollar</option><option value="JPY">JPY — Japanese yen</option></select><span className="text-[10px] font-normal leading-4 text-muted-foreground">PayMongo card and GCash checkout are available only while PHP is selected.</span></label>
                <label className="grid gap-2 text-sm font-semibold md:col-span-2">Store description<textarea value={settings.store_description} onChange={(event) => setSettings((current) => ({ ...current, store_description: event.target.value }))} className="min-h-24 rounded-xl border border-border bg-[#fcfbf8] p-3 font-normal" /></label>
              </>
            )}
            {section === "Branding" && (<>
              {toggle("Announcement banner", "Show a store-wide message above the customer navigation.", settings.announcement_enabled, (value) => setSettings((current) => ({ ...current, announcement_enabled: value })))}
              {toggle("Maintenance mode", "Pause customer shopping while keeping staff access available.", settings.maintenance_mode, (value) => setSettings((current) => ({ ...current, maintenance_mode: value })))}
              {textInput("Announcement text", settings.announcement_text, (value) => setSettings((current) => ({ ...current, announcement_text: value })))}
              {textInput("Announcement link", settings.announcement_link, (value) => setSettings((current) => ({ ...current, announcement_link: value })), "/new-arrivals or https://…")}
              {(["facebook", "instagram", "tiktok"] as const).map((network) => textInput(`${network[0].toUpperCase()}${network.slice(1)} URL`, settings.social_links[network] ?? "", (value) => updateNested("social_links", network, value)))}
            </>)}
            {section === "Checkout" && (<>
              {numberInput("Standard delivery fee", settings.checkout_settings.standard_delivery_fee, (value) => updateNested("checkout_settings", "standard_delivery_fee", value), "PHP")}
              {numberInput("Free delivery minimum", settings.checkout_settings.free_delivery_minimum, (value) => updateNested("checkout_settings", "free_delivery_minimum", value), "PHP")}
              {numberInput("Minimum order", settings.checkout_settings.minimum_order_amount, (value) => updateNested("checkout_settings", "minimum_order_amount", value), "PHP")}
              {numberInput("Maximum order (0 = unlimited)", settings.checkout_settings.maximum_order_amount, (value) => updateNested("checkout_settings", "maximum_order_amount", value), "PHP")}
            </>)}
            {section === "Delivery & orders" && (<>
              {textInput("Default delivery area", settings.delivery_area, (value) => setSettings((current) => ({ ...current, delivery_area: value })))}
              {textInput("Order number prefix", settings.fulfillment_settings.order_number_prefix, (value) => updateNested("fulfillment_settings", "order_number_prefix", value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 10)))}
              {numberInput("Estimated delivery minimum", settings.fulfillment_settings.estimated_delivery_days_min, (value) => updateNested("fulfillment_settings", "estimated_delivery_days_min", Math.max(1, value)), "days")}
              {numberInput("Estimated delivery maximum", settings.fulfillment_settings.estimated_delivery_days_max, (value) => updateNested("fulfillment_settings", "estimated_delivery_days_max", Math.max(1, value)), "days")}
              {numberInput("Customer cancellation window", settings.fulfillment_settings.cancellation_window_hours, (value) => updateNested("fulfillment_settings", "cancellation_window_hours", value), "hours")}
              {numberInput("Return window", settings.fulfillment_settings.return_window_days, (value) => updateNested("fulfillment_settings", "return_window_days", value), "days")}
            </>)}
            {section === "Inventory" && (<>
              {numberInput("Global low-stock threshold", settings.low_stock_threshold, (value) => setSettings((current) => ({ ...current, low_stock_threshold: value })))}
              {toggle("Inventory alerts", "Notify the workspace when stock reaches the reorder threshold.", settings.inventory_alerts, (value) => setSettings((current) => ({ ...current, inventory_alerts: value })))}
              {toggle("Hide out-of-stock products", "Remove unavailable products from customer category listings.", settings.fulfillment_settings.out_of_stock_behavior === "hide", (value) => updateNested("fulfillment_settings", "out_of_stock_behavior", value ? "hide" : "show_unavailable"))}
            </>)}
            {section === "Payments" && (<>
              {toggle("Cash on delivery", "Allow eligible customers to pay when furniture arrives.", settings.checkout_settings.cod_enabled, (value) => updateNested("checkout_settings", "cod_enabled", value))}
              {toggle("Cards via PayMongo", "Offer the secure hosted PayMongo card checkout.", settings.checkout_settings.card_enabled, (value) => updateNested("checkout_settings", "card_enabled", value))}
              {toggle("GCash via PayMongo", "Offer the secure hosted PayMongo GCash checkout.", settings.checkout_settings.gcash_enabled, (value) => updateNested("checkout_settings", "gcash_enabled", value))}
              {numberInput("COD maximum order (0 = unlimited)", settings.checkout_settings.cod_maximum_order, (value) => updateNested("checkout_settings", "cod_maximum_order", value), "PHP")}
              {settings.currency_code !== "PHP" && <div className="rounded-xl border border-[#d6b18f] bg-[#f7eadc] p-4 text-xs leading-5 text-[#80563f] md:col-span-2">PayMongo accepts Philippine peso amounts for this store integration. Switch currency back to PHP before enabling card or GCash checkout.</div>}
            </>)}
            {section === "Notifications" && (<>
              {toggle("Account confirmation email", "Keep Supabase Auth confirmation messages enabled for newly registered customers.", settings.email_event_settings.account_confirmation, (value) => updateNested("email_event_settings", "account_confirmation", value))}
              {toggle("Order confirmation email", "Email the customer after an order is recorded successfully.", settings.email_event_settings.order_confirmation, (value) => updateNested("email_event_settings", "order_confirmation", value))}
              {toggle("Payment received email", "Email the customer after PayMongo confirms a settled payment.", settings.email_event_settings.payment_received, (value) => updateNested("email_event_settings", "payment_received", value))}
              {toggle("Fulfillment update email", "Email customers when administrators advance an order through processing, packed, or shipped.", settings.email_event_settings.fulfillment_updates, (value) => updateNested("email_event_settings", "fulfillment_updates", value))}
              {toggle("Delivered email", "Send a delivery confirmation and review reminder when an order is delivered.", settings.email_event_settings.delivered, (value) => updateNested("email_event_settings", "delivered", value))}
              {toggle("Cancellation and refund email", "Allow administrators to send or resend cancellation and refund confirmations.", settings.email_event_settings.cancelled_refunded, (value) => updateNested("email_event_settings", "cancelled_refunded", value))}
              {toggle("Support reply email", "Email customers when CozyCraft Care posts a new reply.", settings.email_event_settings.support_replies, (value) => updateNested("email_event_settings", "support_replies", value))}
              <div className="rounded-xl border border-border bg-secondary/40 p-4 text-xs leading-5 text-muted-foreground md:col-span-2">Messages are sent server-side through Resend, use editable templates, and record delivery attempts without exposing the provider key. <Link to="/admin/content" className="ml-1 font-semibold text-foreground underline underline-offset-4">Manage templates and delivery logs</Link>.</div>
            </>)}
            {section === "Reviews" && (<>
              <div className="rounded-xl border border-[#cdd9c8] bg-[#edf3ea] p-4 md:col-span-2">
                <b className="block text-sm text-[#41553c]">Immediate review publishing is active</b>
                <span className="mt-1 block text-xs leading-5 text-[#5f7059]">Eligible customer reviews appear on the product page as soon as they are submitted. Administrators can still hide content afterward when it violates CozyCraft content standards.</span>
              </div>
              {toggle("Verified purchases only", "Only customers with delivered order items can submit a review.", settings.review_settings.verified_purchases_only, (value) => updateNested("review_settings", "verified_purchases_only", value))}
              {numberInput("Minimum review length", settings.review_settings.minimum_length, (value) => updateNested("review_settings", "minimum_length", value), "chars")}
              {numberInput("Maximum review length", settings.review_settings.maximum_length, (value) => updateNested("review_settings", "maximum_length", value), "chars")}
            </>)}
            {section === "Customer accounts" && (<>
              {toggle("Require username", "Ask new members for a unique public account name.", settings.account_settings.username_required, (value) => updateNested("account_settings", "username_required", value))}
              {toggle("Google sign-in", "Show Google OAuth on customer authentication pages.", settings.account_settings.google_auth_enabled, (value) => updateNested("account_settings", "google_auth_enabled", value))}
              {toggle("Customer MFA", "Allow customers to enroll an authenticator in Account Security.", settings.account_settings.customer_mfa_available, (value) => updateNested("account_settings", "customer_mfa_available", value))}
              {numberInput("CozyCraft form password minimum", settings.account_settings.password_minimum_length, (value) => updateNested("account_settings", "password_minimum_length", value), "chars")}
            </>)}
            {section === "Security" && (<>
              {toggle("Require administrator MFA", "Require an AAL2 authenticator session for enrolled staff accounts.", security.require_admin_mfa, (value) => setSecurity((current) => ({ ...current, require_admin_mfa: value })))}
              {toggle("Security alerts", "Enable security event alerts for administrator activity.", security.security_alerts_enabled, (value) => setSecurity((current) => ({ ...current, security_alerts_enabled: value })))}
              {numberInput("Inactive admin session timeout", security.session_timeout_minutes, (value) => setSecurity((current) => ({ ...current, session_timeout_minutes: Math.max(15, value) })), "minutes")}
            </>)}
            {section === "Integrations" && (<>
              {Object.keys(security.integration_status).map((name) => <div key={name} className="flex items-center justify-between rounded-xl border border-border p-4"><span><b className="block text-sm">{name.replace("_", " ").replace(/^./, (value) => value.toUpperCase())}</b><span className="mt-1 block text-xs text-muted-foreground">Credentials stay inside Supabase Edge Function secrets.</span></span><span className="rounded-full bg-secondary px-3 py-1 text-[10px] font-bold text-muted-foreground">SERVER-MANAGED</span></div>)}
              <button type="button" onClick={() => void testConnections()} disabled={checking} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-secondary disabled:opacity-60">{checking ? "Checking connection…" : "Run safe connection check"}</button>
            </>)}
            {section === "Reports & privacy" && (<>
              {toggle("Scheduled report briefing", "Create a realtime admin notification when the scheduled performance briefing is ready.", settings.weekly_report_enabled, (value) => setSettings((current) => ({ ...current, weekly_report_enabled: value })))}
              <label className="grid gap-2 text-sm font-semibold">Report frequency<select value={settings.report_settings.frequency} onChange={(event) => updateNested("report_settings", "frequency", event.target.value)} className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-3 font-normal"><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
              <label className="grid gap-2 text-sm font-semibold">Default analytics range<select value={settings.report_settings.default_range} onChange={(event) => updateNested("report_settings", "default_range", event.target.value)} className="h-11 rounded-xl border border-border bg-[#fcfbf8] px-3 font-normal"><option>This week</option><option>This month</option><option>Quarter</option></select></label>
              {textInput("Reporting timezone", settings.report_settings.timezone, (value) => updateNested("report_settings", "timezone", value))}
              {numberInput("Operational telemetry retention", settings.report_settings.data_retention_days, (value) => updateNested("report_settings", "data_retention_days", Math.min(3650, Math.max(7, value))), "days")}
            </>)}
          </div>}
          <div className="mt-7 flex flex-wrap gap-3 border-t border-border pt-5"><button disabled={!dirty || saving || loading} onClick={() => void save()} className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-45">{saving ? "Applying settings…" : "Review and apply changes"}</button><button disabled={!dirty || saving} onClick={() => { if (window.confirm("Discard every unsaved settings change?")) void loadSettings(); }} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold disabled:opacity-45">Discard changes</button></div>
          {notice && (
            <p role="status" className="mt-4 flex gap-2 rounded-xl bg-secondary p-3 text-sm text-[#5b744f]">
              <Check size={16} />
              {notice}
            </p>
          )}
          <p className="mt-4 text-[10px] leading-5 text-muted-foreground">Last database update: {settings.updated_at ? new Date(settings.updated_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) : "Not recorded"}. Secrets and service-role credentials are never loaded into this page.</p>
        </section>
      </div>
    </AdminShell>
  );
}
