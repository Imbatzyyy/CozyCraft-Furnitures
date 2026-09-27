import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useBlocker } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  Boxes,
  CreditCard,
  Crown,
  FileBarChart,
  Globe,
  KeyRound,
  Mail,
  Palette,
  Plug,
  Send,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Star,
  Trash2,
  Truck,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { adminSupabase as supabase, type DbRole } from "@/services/supabase/client";
import { useAdminSession, Toast } from "@/app/core";
import { AdminShell } from "@/features/admin/shell/AdminShell";
import { defaultAdminSecuritySettings, defaultStoreSettings, normalizeStoreSettings, type AdminSecuritySettings, type PublicStoreSettings } from "@/lib/settings/store-settings";
import { functionErrorMessage } from "@/lib/shared/function-error";
import { clearAdminDraft, readAdminDraft, writeAdminDraft } from "@/lib/admin/admin-drafts";
import { describeSettingValue, diffSettings } from "@/lib/admin/settings-diff";
import { formatDate, formatDateTime, plural } from "@/lib/admin/format";
import { confirmAction } from "@/components/admin/confirm";
import { ActionMenu, Avatar, Card, CardHeader, CopyButton, Dialog, EmptyState, PageHeader, Pill, Skeleton, Switch, useNotice } from "@/components/admin/ui";

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

const roleIcons: Record<TeamMember["role"], LucideIcon> = { superadmin: Crown, admin: ShieldCheck, staff: Users };
const roleAccess: Record<TeamMember["role"], string[]> = {
  superadmin: ["Everything administrators can do", "Invite, suspend, and remove team members", "Store settings and security policy"],
  admin: ["Orders, payments, cancellations and refunds", "Customers, member tiers, and reports", "Content, merchandising, and activity logs"],
  staff: ["Products, categories, and inventory", "Order fulfillment and packing lists", "Reviews and the support inbox"],
};

const teamInvitationDraftKey = "cozycraft:admin:team-invitation:v1";
type TeamInvitationDraft = { fullName: string; email: string; role: TeamMember["role"] };
const isTeamInvitationDraft = (value: unknown): value is TeamInvitationDraft => {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<TeamInvitationDraft>;
  return typeof draft.fullName === "string" && typeof draft.email === "string" && ["staff", "admin", "superadmin"].includes(draft.role ?? "");
};

export function TeamAccessPage() {
  const { userId: currentUserId } = useAdminSession();
  const recoveredInvitation = useMemo(() => readAdminDraft(teamInvitationDraftKey, isTeamInvitationDraft), []);
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [fullName, setFullName] = useState(recoveredInvitation?.fullName ?? "");
  const [email, setEmail] = useState(recoveredInvitation?.email ?? "");
  const [inviteRole, setInviteRole] = useState<TeamMember["role"]>(recoveredInvitation?.role ?? "staff");
  const [loading, setLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const { notice, notify, clear } = useNotice();
  useEffect(() => {
    if (fullName || email) writeAdminDraft(teamInvitationDraftKey, { fullName, email, role: inviteRole } satisfies TeamInvitationDraft);
  }, [email, fullName, inviteRole]);

  const loadMembers = useCallback(async () => {
    const { data, error: queryError } = await supabase.from("profiles").select("id, full_name, email, role, staff_active, created_at").in("role", ["staff", "admin", "superadmin"]).order("created_at");
    if (queryError) {
      notify(queryError.message, "error");
      setMembers((current) => current ?? []);
      return;
    }
    setMembers((data ?? []) as TeamMember[]);
  }, [notify]);

  useEffect(() => {
    void loadMembers();
    const channel = supabase.channel("team-access-live").on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => void loadMembers()).subscribe();
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

  const invoke = async (body: Record<string, unknown>, fallback: string) => {
    const { data, error: invokeError } = await supabase.functions.invoke("manage-team-member", { body });
    if (invokeError || data?.error) return { error: data?.error ?? (await functionErrorMessage(invokeError, fallback)), message: null as string | null };
    return { error: null, message: data?.message as string | null };
  };
  const invite = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setInviteError("");
    const result = await invoke({ action: "invite", email, fullName, role: inviteRole }, "Unable to send the invitation. Please try again.");
    setLoading(false);
    if (result.error) {
      setInviteError(result.error);
      return;
    }
    notify(result.message ?? `Invitation sent to ${email}.`);
    clearAdminDraft(teamInvitationDraftKey);
    setFullName("");
    setEmail("");
    setInviteRole("staff");
    await loadMembers();
  };
  const updateRole = async (member: TeamMember, nextRole: TeamMember["role"]) => {
    if (nextRole === member.role) return;
    const confirmed = await confirmAction({
      title: `Make ${member.full_name || member.email} ${teamRoleLabels[nextRole] === "Administrator" ? "an" : "a"} ${teamRoleLabels[nextRole]}?`,
      description: teamRoleDescriptions[nextRole],
      details: <ul className="grid gap-1">{roleAccess[nextRole].map((item) => <li key={item}>• {item}</li>)}</ul>,
      confirmLabel: "Change role",
      tone: nextRole === "superadmin" ? "danger" : "default",
    });
    if (!confirmed) return;
    setPendingId(member.id);
    const result = await invoke({ action: "update-role", userId: member.id, role: nextRole }, "Unable to update the team member's role.");
    setPendingId(null);
    if (result.error) notify(result.error, "error");
    else notify(result.message ?? "Role updated.");
    await loadMembers();
  };
  const setMemberStatus = async (member: TeamMember) => {
    const nextActive = !member.staff_active;
    const confirmed = await confirmAction({
      title: nextActive ? `Restore access for ${member.full_name || member.email}?` : `Suspend ${member.full_name || member.email}?`,
      description: nextActive ? "They will be able to sign in to operations again with their current role." : "Their active admin sessions lose access immediately. You can restore access later.",
      confirmLabel: nextActive ? "Restore access" : "Suspend access",
      tone: nextActive ? "default" : "danger",
    });
    if (!confirmed) return;
    setPendingId(member.id);
    const result = await invoke({ action: "set-status", userId: member.id, active: nextActive }, "Unable to update the team member's access.");
    setPendingId(null);
    if (result.error) notify(result.error, "error");
    else notify(result.message ?? "Access updated.");
    await loadMembers();
  };
  const deleteMember = async (member: TeamMember) => {
    if (member.id === currentUserId) {
      notify("You cannot delete your own account.", "error");
      return;
    }
    const confirmText = `DELETE ${member.email ?? member.full_name}`;
    const confirmed = await confirmAction({
      title: `Permanently delete ${member.full_name || member.email}?`,
      eyebrow: "Permanent action",
      description: "Their team account is removed and cannot be recovered. Their past activity stays in the audit log.",
      confirmLabel: "Delete account",
      tone: "danger",
      requireText: confirmText,
    });
    if (!confirmed) return;
    setPendingId(member.id);
    const result = await invoke({ action: "delete", userId: member.id }, "Unable to delete this team account.");
    setPendingId(null);
    if (result.error) notify(result.error, "error");
    else notify(result.message ?? "Team account deleted.");
    await loadMembers();
  };
  const activeCount = members?.filter((member) => member.staff_active).length ?? 0;

  return (
    <AdminShell title="Team access">
      <PageHeader
        eyebrow="Security & access"
        title="Team access"
        description="Invite each person with their own work email. Passwords stay private and every account gets only the tools its role allows."
        meta={members && <Pill tone="neutral"><Users size={12} /> {plural(activeCount, "active member")}{members.length > activeCount ? ` · ${members.length - activeCount} suspended` : ""}</Pill>}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(300px,.8fr)_minmax(0,1.2fr)] xl:items-start">
        <Card as="form" onSubmit={invite} className="overflow-hidden xl:sticky xl:top-[5.25rem]">
          <CardHeader eyebrow="Invite" title="Add a team member" description="They finish setup from a secure email link." />
          <div className="grid gap-4 p-5">
            <label className="adm-label">
              Full name
              <input required value={fullName} onChange={(event) => setFullName(event.target.value)} className="adm-input font-normal" placeholder="Team member name" autoComplete="off" />
            </label>
            <label className="adm-label">
              Work email
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="adm-input font-normal" placeholder="name@company.com" autoComplete="off" />
            </label>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-[0.78rem] font-semibold">Role</legend>
              {(["staff", "admin", "superadmin"] as TeamMember["role"][]).map((role) => {
                const Icon = roleIcons[role];
                return (
                  <label key={role} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${inviteRole === role ? "border-foreground bg-subtle" : "border-border hover:bg-subtle"}`}>
                    <input type="radio" name="invite-role" value={role} checked={inviteRole === role} onChange={() => setInviteRole(role)} className="mt-1 accent-[var(--foreground)]" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-[13px] font-semibold"><Icon size={14} /> {teamRoleLabels[role]}</span>
                      <span className="mt-0.5 block text-[11.5px] leading-5 text-muted-foreground">{teamRoleDescriptions[role]}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
            {inviteError && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-xs font-semibold text-danger-ink">{inviteError}</p>}
            <button disabled={loading} className="adm-btn adm-btn-primary h-11 w-full">
              {loading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Send size={14} />}
              {loading ? "Sending invitation…" : "Send secure invitation"}
            </button>
          </div>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader eyebrow="Team" title={members ? plural(members.length, "account") : "Loading…"} description="Changes take effect immediately and are recorded in the activity log." />
          {members === null ? (
            <div className="grid gap-3 p-5">{[0, 1, 2].map((row) => <Skeleton key={row} className="h-16 w-full" />)}</div>
          ) : members.length === 0 ? (
            <EmptyState icon={UserPlus} title="No team accounts yet." description="Invite your first team member." />
          ) : (
            <ul className="divide-y divide-border">
              {members.map((member) => {
                const self = member.id === currentUserId;
                return (
                  <li key={member.id} className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5 ${member.staff_active ? "" : "bg-subtle/70"} ${pendingId === member.id ? "opacity-60" : ""}`}>
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar name={member.full_name || member.email || "Team"} className={member.staff_active ? "" : "grayscale"} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-[13px] font-semibold">{member.full_name || "Invited team member"}</p>
                          {self && <Pill tone="info">You</Pill>}
                          <Pill tone={member.staff_active ? "success" : "danger"} dot>{member.staff_active ? "Active" : "Suspended"}</Pill>
                        </div>
                        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">{member.email || "Email unavailable"}{member.email && <CopyButton value={member.email} label="email" />}</p>
                        <p className="text-[11px] text-muted-foreground">Joined {formatDate(member.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:justify-end">
                      <select value={member.role} disabled={!member.staff_active || self || pendingId === member.id} onChange={(event) => void updateRole(member, event.target.value as TeamMember["role"])} className="adm-select h-10 w-auto text-xs font-semibold" aria-label={`Role for ${member.full_name || member.email}`}>
                        {(["staff", "admin", "superadmin"] as TeamMember["role"][]).map((role) => <option key={role} value={role}>{teamRoleLabels[role]}</option>)}
                      </select>
                      <ActionMenu
                        label={`More actions for ${member.full_name || member.email}`}
                        items={[
                          { label: member.staff_active ? "Suspend access" : "Restore access", icon: member.staff_active ? UserMinus : UserCheck, onSelect: () => void setMemberStatus(member), disabled: self },
                          ...(member.email ? [{ label: "Email", icon: Mail, onSelect: () => { window.location.href = `mailto:${member.email}`; } }] : []),
                          { label: "Delete permanently…", icon: Trash2, onSelect: () => void deleteMember(member), tone: "danger" as const, disabled: self },
                        ]}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
      <Card className="mt-5 overflow-hidden">
        <CardHeader eyebrow="Permissions" title="What each role can do" />
        <div className="grid gap-px bg-border md:grid-cols-3">
          {(["superadmin", "admin", "staff"] as TeamMember["role"][]).map((role) => {
            const Icon = roleIcons[role];
            return (
              <section key={role} className="bg-card p-5">
                <p className="flex items-center gap-2 text-sm font-semibold"><span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary"><Icon size={15} /></span>{teamRoleLabels[role]}</p>
                <ul className="mt-3 grid gap-1.5 text-xs leading-5 text-muted-foreground">{roleAccess[role].map((item) => <li key={item} className="flex gap-2"><span className="text-success-ink">✓</span>{item}</li>)}</ul>
              </section>
            );
          })}
        </div>
      </Card>
      {notice && <Toast message={notice.message} tone={notice.tone} close={clear} action={notice.action} />}
    </AdminShell>
  );
}

/* ------------------------------------------------------------------ */
/* Store settings                                                      */
/* ------------------------------------------------------------------ */

const sections = [
  ["General", Settings],
  ["Branding", Palette],
  ["Checkout", ShoppingCart],
  ["Delivery & orders", Truck],
  ["Inventory", Boxes],
  ["Payments", CreditCard],
  ["Notifications", Bell],
  ["Reviews", Star],
  ["Customer accounts", Users],
  ["Security", KeyRound],
  ["Integrations", Plug],
  ["Reports & privacy", FileBarChart],
] as const;
type Section = (typeof sections)[number][0];
const sectionPaths: Record<Section, string[]> = {
  General: ["store_name", "contact_email", "support_phone", "business_address", "currency_code", "store_description"],
  Branding: ["announcement_", "maintenance_mode", "social_links"],
  Checkout: ["checkout_settings.standard_delivery_fee", "checkout_settings.free_delivery_minimum", "checkout_settings.minimum_order_amount", "checkout_settings.maximum_order_amount"],
  "Delivery & orders": ["delivery_area", "fulfillment_settings.order_number_prefix", "fulfillment_settings.estimated", "fulfillment_settings.cancellation", "fulfillment_settings.return"],
  Inventory: ["low_stock_threshold", "inventory_alerts", "fulfillment_settings.out_of_stock"],
  Payments: ["checkout_settings.cod", "checkout_settings.card", "checkout_settings.gcash"],
  Notifications: ["email_event_settings"],
  Reviews: ["review_settings"],
  "Customer accounts": ["account_settings"],
  Security: ["require_admin_mfa", "security_alerts_enabled", "session_timeout_minutes"],
  Integrations: ["integration_status"],
  "Reports & privacy": ["weekly_report_enabled", "report_settings"],
};

export function StoreSettingsPage() {
  const [section, setSection] = useState<Section>("General");
  const { notice, notify, clear } = useNotice();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [settings, setSettings] = useState<PublicStoreSettings>(defaultStoreSettings);
  const [security, setSecurity] = useState<AdminSecuritySettings>(defaultAdminSecuritySettings);
  const [saved, setSaved] = useState<{ store: PublicStoreSettings; security: AdminSecuritySettings } | null>(null);
  const changes = useMemo(() => (saved ? [...diffSettings(saved.store, settings), ...diffSettings(saved.security, security)] : []), [saved, settings, security]);
  const dirty = changes.length > 0;
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  const changedSections = useMemo(() => new Set(sections.map(([name]) => name).filter((name) => changes.some((change) => sectionPaths[name].some((prefix) => change.path.startsWith(prefix))))), [changes]);

  const loadSettings = useCallback(async () => {
    const [storeResult, securityResult, recipientResult] = await Promise.all([
      supabase.from("store_settings").select("*").eq("id", true).single(),
      supabase.from("admin_security_settings").select("*").eq("id", true).single(),
      supabase.from("admin_report_recipients").select("recipients").eq("id", true).maybeSingle(),
    ]);
    if (storeResult.error || securityResult.error) {
      notify((storeResult.error ?? securityResult.error)!.message, "error");
      setLoading(false);
      return;
    }
    const nextStore = normalizeStoreSettings({
      ...storeResult.data,
      report_settings: { ...((storeResult.data?.report_settings as Record<string, unknown> | null) ?? {}), recipients: recipientResult.data?.recipients ?? [] },
    });
    const nextSecurity = {
      ...defaultAdminSecuritySettings,
      ...(securityResult.data ?? {}),
      integration_status: { ...defaultAdminSecuritySettings.integration_status, ...((securityResult.data?.integration_status as Record<string, boolean> | null) ?? {}) },
    };
    setSettings(nextStore);
    setSecurity(nextSecurity);
    setSaved({ store: nextStore, security: nextSecurity });
    setLoading(false);
  }, [notify]);
  useEffect(() => {
    void loadSettings();
    const channel = supabase
      .channel("admin-store-settings")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "store_settings" }, () => { if (!dirtyRef.current) void loadSettings(); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "admin_security_settings" }, () => { if (!dirtyRef.current) void loadSettings(); })
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
  // Guard in-app navigation while there are unsaved changes.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    void confirmAction({ title: "Leave without saving?", description: `You have ${plural(changes.length, "unsaved change")} in store settings.`, confirmLabel: "Discard and leave", cancelLabel: "Stay here", tone: "danger" }).then((leave) => (leave ? blocker.proceed?.() : blocker.reset?.()));
  }, [blocker, changes.length]);

  const updateNested = <K extends keyof PublicStoreSettings>(key: K, property: string, value: unknown) =>
    setSettings((current) => ({ ...current, [key]: { ...(current[key] as Record<string, unknown>), [property]: value } }));
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
  const review = () => {
    const issue = validate();
    setValidationError(issue);
    if (issue) {
      notify(issue, "error");
      return;
    }
    setReviewOpen(true);
  };
  const apply = async () => {
    setSaving(true);
    const { id: _storeId, updated_at: _storeUpdated, ...storeUpdate } = settings;
    const { id: _securityId, updated_at: _securityUpdated, updated_by: _updatedBy, ...securityUpdate } = security;
    const { error } = await supabase.rpc("save_admin_workspace_settings", { p_store: storeUpdate, p_security: securityUpdate });
    setSaving(false);
    if (error) {
      notify(error.message, "error");
      return;
    }
    setReviewOpen(false);
    notify(`${plural(changes.length, "change")} applied across CozyCraft.`);
    await loadSettings();
  };
  const discard = async () => {
    const confirmed = await confirmAction({ title: "Discard every unsaved change?", description: `${plural(changes.length, "change")} will be reverted to the saved settings.`, confirmLabel: "Discard changes", tone: "danger" });
    if (!confirmed || !saved) return;
    setSettings(saved.store);
    setSecurity(saved.security);
    setValidationError("");
  };
  const testConnections = async () => {
    setChecking(true);
    const { error } = await supabase.from("store_settings").select("id").eq("id", true).single();
    setChecking(false);
    if (error) notify(`Connection check failed: ${error.message}`, "error");
    else notify("The database and live updates are reachable. Provider keys stay protected on the server.");
  };
  const field = (label: string, input: ReactNode, hint?: ReactNode, wide = false) => (
    <label className={`adm-label ${wide ? "md:col-span-2" : ""}`}>
      {label}
      {input}
      {hint && <span className="adm-hint">{hint}</span>}
    </label>
  );
  const numberInput = (label: string, value: number, onChange: (value: number) => void, suffix = "", hint?: ReactNode) =>
    field(
      label,
      <span className="relative block">
        <input type="number" min="0" value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value)))} className="adm-input adm-num pr-16 font-normal" />
        {suffix && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
      </span>,
      hint,
    );
  const textInput = (label: string, value: string, onChange: (value: string) => void, placeholder = "", hint?: ReactNode, wide = false) => field(label, <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="adm-input font-normal" />, hint, wide);
  const toggle = (label: string, detail: string, checked: boolean, onChange: (checked: boolean) => void) => <Switch label={label} description={detail} checked={checked} onChange={onChange} />;
  const SectionIcon = sections.find(([name]) => name === section)?.[1] ?? Settings;

  return (
    <AdminShell title="Settings">
      <PageHeader
        eyebrow="Store configuration"
        title="Settings"
        description="Validated, role-protected controls that apply across the storefront and workspace in realtime."
        meta={<Pill tone={dirty ? "warning" : "success"} dot>{loading ? "Loading…" : dirty ? `${plural(changes.length, "unsaved change")}` : "All changes saved"}</Pill>}
      />
      <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <div className="lg:hidden">
          <label className="adm-label">
            <span className="sr-only">Settings section</span>
            <select value={section} onChange={(event) => setSection(event.target.value as Section)} className="adm-select h-12 bg-card font-semibold">
              {sections.map(([name]) => <option key={name} value={name}>{name}{changedSections.has(name) ? " •" : ""}</option>)}
            </select>
          </label>
        </div>
        <nav aria-label="Settings sections" className="adm-card hidden h-fit p-2 lg:sticky lg:top-[5.25rem] lg:block">
          {sections.map(([name, Icon]) => (
            <button key={name} onClick={() => setSection(name)} aria-current={section === name ? "page" : undefined} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors ${section === name ? "bg-secondary font-semibold" : "text-muted-foreground hover:bg-subtle hover:text-foreground"}`}>
              <Icon size={15} />
              <span className="flex-1">{name}</span>
              {changedSections.has(name) && <span className="h-2 w-2 rounded-full bg-[#b8764d]" aria-label="Unsaved changes" />}
            </button>
          ))}
        </nav>
        <div className="min-w-0">
          <Card key={section} className="adm-swap overflow-hidden">
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary"><SectionIcon size={16} /></span>
              <div>
                <p className="adm-eyebrow">Settings</p>
                <h2 className="text-lg font-semibold leading-tight">{section}</h2>
              </div>
            </div>
            {loading ? (
              <div className="grid gap-4 p-5 md:grid-cols-2">{[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-16 w-full" />)}</div>
            ) : (
              <div className="grid gap-4 p-5 md:grid-cols-2">
                {section === "General" && (
                  <>
                    {textInput("Store name", settings.store_name, (value) => setSettings((current) => ({ ...current, store_name: value })))}
                    {textInput("Customer contact email", settings.contact_email, (value) => setSettings((current) => ({ ...current, contact_email: value })))}
                    {textInput("Support phone", settings.support_phone, (value) => setSettings((current) => ({ ...current, support_phone: value })), "+63 …")}
                    {textInput("Business address", settings.business_address, (value) => setSettings((current) => ({ ...current, business_address: value })))}
                    {field(
                      "Store currency",
                      <select value={settings.currency_code} onChange={(event) => setSettings((current) => ({ ...current, currency_code: event.target.value as PublicStoreSettings["currency_code"] }))} className="adm-select font-normal">
                        <option value="PHP">PHP — Philippine peso</option>
                        <option value="USD">USD — US dollar</option>
                        <option value="EUR">EUR — Euro</option>
                        <option value="SGD">SGD — Singapore dollar</option>
                        <option value="JPY">JPY — Japanese yen</option>
                      </select>,
                      "Card and GCash checkout are available only while PHP is selected.",
                    )}
                    {field("Store description", <textarea value={settings.store_description} onChange={(event) => setSettings((current) => ({ ...current, store_description: event.target.value }))} className="adm-textarea min-h-24 font-normal" />, undefined, true)}
                  </>
                )}
                {section === "Branding" && (
                  <>
                    {toggle("Announcement banner", "Show a store-wide message above the customer navigation.", settings.announcement_enabled, (value) => setSettings((current) => ({ ...current, announcement_enabled: value })))}
                    {toggle("Maintenance mode", "Pause customer shopping while keeping staff access available.", settings.maintenance_mode, (value) => setSettings((current) => ({ ...current, maintenance_mode: value })))}
                    {textInput("Announcement text", settings.announcement_text, (value) => setSettings((current) => ({ ...current, announcement_text: value })), "e.g. Free delivery over ₱50,000")}
                    {textInput("Announcement link", settings.announcement_link, (value) => setSettings((current) => ({ ...current, announcement_link: value })), "/new-arrivals or https://…")}
                    {(["facebook", "instagram", "tiktok"] as const).map((network) => <div key={network}>{textInput(`${network === "tiktok" ? "TikTok" : network[0].toUpperCase() + network.slice(1)} URL`, settings.social_links[network] ?? "", (value) => updateNested("social_links", network, value), "https://")}</div>)}
                  </>
                )}
                {section === "Checkout" && (
                  <>
                    {numberInput("Standard delivery fee", settings.checkout_settings.standard_delivery_fee, (value) => updateNested("checkout_settings", "standard_delivery_fee", value), "PHP")}
                    {numberInput("Free delivery minimum", settings.checkout_settings.free_delivery_minimum, (value) => updateNested("checkout_settings", "free_delivery_minimum", value), "PHP")}
                    {numberInput("Minimum order", settings.checkout_settings.minimum_order_amount, (value) => updateNested("checkout_settings", "minimum_order_amount", value), "PHP")}
                    {numberInput("Maximum order", settings.checkout_settings.maximum_order_amount, (value) => updateNested("checkout_settings", "maximum_order_amount", value), "PHP", "0 means unlimited.")}
                  </>
                )}
                {section === "Delivery & orders" && (
                  <>
                    {textInput("Default delivery area", settings.delivery_area, (value) => setSettings((current) => ({ ...current, delivery_area: value })))}
                    {textInput("Order number prefix", settings.fulfillment_settings.order_number_prefix, (value) => updateNested("fulfillment_settings", "order_number_prefix", value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 10)), "CC", "1–10 uppercase letters, numbers, or hyphens.")}
                    {numberInput("Estimated delivery minimum", settings.fulfillment_settings.estimated_delivery_days_min, (value) => updateNested("fulfillment_settings", "estimated_delivery_days_min", Math.max(1, value)), "days")}
                    {numberInput("Estimated delivery maximum", settings.fulfillment_settings.estimated_delivery_days_max, (value) => updateNested("fulfillment_settings", "estimated_delivery_days_max", Math.max(1, value)), "days")}
                    {numberInput("Customer cancellation window", settings.fulfillment_settings.cancellation_window_hours, (value) => updateNested("fulfillment_settings", "cancellation_window_hours", value), "hours")}
                    {numberInput("Return window", settings.fulfillment_settings.return_window_days, (value) => updateNested("fulfillment_settings", "return_window_days", value), "days")}
                  </>
                )}
                {section === "Inventory" && (
                  <>
                    {numberInput("Low-stock threshold", settings.low_stock_threshold, (value) => setSettings((current) => ({ ...current, low_stock_threshold: value })), "units", "Used for badges in the storefront and across this workspace.")}
                    <div className="hidden md:block" />
                    {toggle("Inventory alerts", "Notify the workspace when stock reaches the threshold.", settings.inventory_alerts, (value) => setSettings((current) => ({ ...current, inventory_alerts: value })))}
                    {toggle("Hide sold-out products", "Remove unavailable products from customer category listings.", settings.fulfillment_settings.out_of_stock_behavior === "hide", (value) => updateNested("fulfillment_settings", "out_of_stock_behavior", value ? "hide" : "show_unavailable"))}
                  </>
                )}
                {section === "Payments" && (
                  <>
                    {toggle("Cash on delivery", "Let eligible customers pay when furniture arrives.", settings.checkout_settings.cod_enabled, (value) => updateNested("checkout_settings", "cod_enabled", value))}
                    {toggle("Cards via PayMongo", "Offer the secure hosted PayMongo card checkout.", settings.checkout_settings.card_enabled, (value) => updateNested("checkout_settings", "card_enabled", value))}
                    {toggle("GCash via PayMongo", "Offer the secure hosted PayMongo GCash checkout.", settings.checkout_settings.gcash_enabled, (value) => updateNested("checkout_settings", "gcash_enabled", value))}
                    {numberInput("COD maximum order", settings.checkout_settings.cod_maximum_order, (value) => updateNested("checkout_settings", "cod_maximum_order", value), "PHP", "0 means unlimited.")}
                    {settings.currency_code !== "PHP" && <p className="rounded-xl bg-warning-soft p-4 text-xs leading-5 text-warning-ink md:col-span-2">PayMongo accepts Philippine peso amounts for this store. Switch the currency back to PHP before enabling card or GCash checkout.</p>}
                  </>
                )}
                {section === "Notifications" && (
                  <>
                    {toggle("Account confirmation email", "Confirmation messages for newly registered customers.", settings.email_event_settings.account_confirmation, (value) => updateNested("email_event_settings", "account_confirmation", value))}
                    {toggle("Order confirmation email", "Email the customer after an order is recorded.", settings.email_event_settings.order_confirmation, (value) => updateNested("email_event_settings", "order_confirmation", value))}
                    {toggle("Payment received email", "Email the customer after PayMongo confirms a settled payment.", settings.email_event_settings.payment_received, (value) => updateNested("email_event_settings", "payment_received", value))}
                    {toggle("Fulfillment update email", "Email customers as orders move through processing, packed, or shipped.", settings.email_event_settings.fulfillment_updates, (value) => updateNested("email_event_settings", "fulfillment_updates", value))}
                    {toggle("Delivered email", "Delivery confirmation with a review reminder.", settings.email_event_settings.delivered, (value) => updateNested("email_event_settings", "delivered", value))}
                    {toggle("Cancellation and refund email", "Let administrators send or resend cancellation and refund confirmations.", settings.email_event_settings.cancelled_refunded, (value) => updateNested("email_event_settings", "cancelled_refunded", value))}
                    {toggle("Support reply email", "Email customers when CozyCraft Care posts a new reply.", settings.email_event_settings.support_replies, (value) => updateNested("email_event_settings", "support_replies", value))}
                    <p className="flex items-start gap-2 rounded-2xl border border-border bg-subtle p-4 text-xs leading-5 text-muted-foreground md:col-span-2"><Mail size={14} className="mt-0.5 shrink-0" /> Messages are sent from the server with editable templates, and every delivery attempt is logged. <Link to="/admin/content" className="ml-auto inline-flex shrink-0 items-center gap-1 font-semibold text-foreground hover:underline">Templates &amp; logs <ArrowRight size={12} /></Link></p>
                  </>
                )}
                {section === "Reviews" && (
                  <>
                    <p className="rounded-2xl bg-success-soft p-4 text-xs leading-5 text-success-ink md:col-span-2"><b className="block text-sm">Immediate review publishing is on</b>Eligible reviews appear on product pages as soon as they’re submitted. You can still hide content that breaks CozyCraft standards.</p>
                    {toggle("Verified purchases only", "Only customers with delivered order items can review.", settings.review_settings.verified_purchases_only, (value) => updateNested("review_settings", "verified_purchases_only", value))}
                    <div className="hidden md:block" />
                    {numberInput("Minimum review length", settings.review_settings.minimum_length, (value) => updateNested("review_settings", "minimum_length", value), "chars")}
                    {numberInput("Maximum review length", settings.review_settings.maximum_length, (value) => updateNested("review_settings", "maximum_length", value), "chars")}
                  </>
                )}
                {section === "Customer accounts" && (
                  <>
                    {toggle("Require username", "Ask new members for a unique public account name.", settings.account_settings.username_required, (value) => updateNested("account_settings", "username_required", value))}
                    {toggle("Google sign-in", "Show Google sign-in on customer authentication pages.", settings.account_settings.google_auth_enabled, (value) => updateNested("account_settings", "google_auth_enabled", value))}
                    {toggle("Customer two-step verification", "Allow customers to add an authenticator in Account Security.", settings.account_settings.customer_mfa_available, (value) => updateNested("account_settings", "customer_mfa_available", value))}
                    {numberInput("Password minimum length", settings.account_settings.password_minimum_length, (value) => updateNested("account_settings", "password_minimum_length", value), "chars", "At least 8 characters.")}
                  </>
                )}
                {section === "Security" && (
                  <>
                    {toggle("Require administrator MFA", "Require an authenticator-verified session for staff accounts.", security.require_admin_mfa, (value) => setSecurity((current) => ({ ...current, require_admin_mfa: value })))}
                    {toggle("Security alerts", "Alert the workspace about important administrator security events.", security.security_alerts_enabled, (value) => setSecurity((current) => ({ ...current, security_alerts_enabled: value })))}
                    {numberInput("Inactive admin session timeout", security.session_timeout_minutes, (value) => setSecurity((current) => ({ ...current, session_timeout_minutes: Math.max(15, value) })), "minutes", "Minimum 15 minutes. A two-minute warning appears before sign-out.")}
                  </>
                )}
                {section === "Integrations" && (
                  <>
                    {Object.keys(security.integration_status).map((name) => (
                      <div key={name} className="flex items-center justify-between gap-3 rounded-2xl border border-border p-4">
                        <span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary"><Globe size={15} /></span><span><b className="block text-sm capitalize">{name.replace(/_/g, " ")}</b><span className="block text-xs text-muted-foreground">Credentials stay in protected server secrets.</span></span></span>
                        <Pill tone="neutral">Server-managed</Pill>
                      </div>
                    ))}
                    <button type="button" onClick={() => void testConnections()} disabled={checking} className="adm-btn h-12 md:col-span-2">{checking ? "Checking connection…" : "Run safe connection check"}</button>
                  </>
                )}
                {section === "Reports & privacy" && (
                  <>
                    {toggle("Scheduled report briefing", "Create a workspace notification when the performance briefing is ready.", settings.weekly_report_enabled, (value) => setSettings((current) => ({ ...current, weekly_report_enabled: value })))}
                    <div className="hidden md:block" />
                    {field("Report frequency", <select value={settings.report_settings.frequency} onChange={(event) => updateNested("report_settings", "frequency", event.target.value)} className="adm-select font-normal"><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select>)}
                    {field("Default analytics range", <select value={settings.report_settings.default_range} onChange={(event) => updateNested("report_settings", "default_range", event.target.value)} className="adm-select font-normal"><option>This week</option><option>This month</option><option>Quarter</option></select>)}
                    {textInput("Reporting timezone", settings.report_settings.timezone, (value) => updateNested("report_settings", "timezone", value))}
                    {numberInput("Operational telemetry retention", settings.report_settings.data_retention_days, (value) => updateNested("report_settings", "data_retention_days", Math.min(3650, Math.max(7, value))), "days")}
                  </>
                )}
              </div>
            )}
          </Card>
          <p className="mt-3 px-1 text-[11px] leading-5 text-muted-foreground">Last saved {settings.updated_at ? formatDateTime(settings.updated_at) : "—"}. Secrets and service credentials are never loaded into this page.</p>
          {(dirty || validationError) && (
            <div className="adm-savebar cc-enter-up mt-4">
              <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#201f1d] p-2.5 pl-4 text-white shadow-[var(--adm-shadow-pop)] ring-1 ring-white/10">
                <span className="mr-auto min-w-0 text-sm">
                  <b className="adm-num">{plural(changes.length, "unsaved change")}</b>
                  {validationError && <span className="block truncate text-xs text-[#f2c7b5]">{validationError}</span>}
                </span>
                <button type="button" onClick={() => void discard()} disabled={saving || !dirty} className="inline-flex h-9 items-center rounded-xl px-3 text-xs font-semibold hover:bg-white/10 disabled:opacity-50">Discard</button>
                <button type="button" onClick={review} disabled={saving || !dirty} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-4 text-xs font-semibold text-[#201f1d] disabled:opacity-50">Review &amp; apply <ArrowRight size={13} /></button>
              </div>
            </div>
          )}
        </div>
      </div>
      <Dialog
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        busy={saving}
        eyebrow="Review changes"
        title={`Apply ${plural(changes.length, "change")}?`}
        size="max-w-xl"
        footer={
          <>
            <button type="button" onClick={() => setReviewOpen(false)} disabled={saving} className="adm-btn">Keep editing</button>
            <button type="button" onClick={() => void apply()} disabled={saving} className="adm-btn adm-btn-primary">{saving ? "Applying…" : "Apply to the live store"}</button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">These updates reach the storefront and every admin session right away.</p>
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
          {changes.map((change) => (
            <li key={change.path} className="grid gap-1 px-3.5 py-2.5 text-xs sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4">
              <b className="text-[13px]">{change.label}</b>
              <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <span className="max-w-[10rem] truncate line-through decoration-muted-foreground/50">{describeSettingValue(change.before)}</span>
                <ArrowRight size={12} className="shrink-0" />
                <span className="max-w-[12rem] truncate font-semibold text-foreground">{describeSettingValue(change.after)}</span>
              </span>
            </li>
          ))}
        </ul>
      </Dialog>
      {notice && <Toast message={notice.message} tone={notice.tone} close={clear} action={notice.action} />}
    </AdminShell>
  );
}
