import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Gift,
  RefreshCw,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { AdminShell } from "@/features/admin/shell/AdminShell";
import { useAdminSession } from "@/app/core";
import { useAdminQuery } from "@/services/admin/use-admin-query";
import { useAdminTableInvalidation } from "@/services/admin/use-table-invalidation";
import { DataPagination } from "@/components/DataPagination";
import {
  getLoyaltyTierProgress,
  loyaltyTierOrder,
  type LoyaltyTier,
} from "@/lib/loyalty/member-tiers";
import { privateAvatarUrls } from "@/lib/shared/avatar-url";
import { adminSupabase as supabase } from "@/services/supabase/client";

type CustomerProfile = {
  id: string;
  full_name: string;
  username: string;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
};

type LoyaltyAccount = {
  user_id: string;
  points_balance: number;
  lifetime_eligible_spend: number;
  tier: LoyaltyTier;
  tier_valid_until: string | null;
  last_activity_at: string | null;
  updated_at: string;
};

type LoyaltyMember = CustomerProfile & LoyaltyAccount;

type LoyaltyTransaction = {
  id: string;
  kind: string;
  points: number;
  description: string;
  created_at: string;
  expires_at: string | null;
};

type LoyaltyRedemption = {
  id: string;
  points_cost: number;
  discount_amount: number;
  status: string;
  code: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
};

const tierStyles: Record<LoyaltyTier, string> = {
  member: "border-[#d8d1c7] bg-[#efebe5] text-[#665f56]",
  plus: "border-[#c8d7c1] bg-[#e5eee1] text-[#50664b]",
  premium: "border-[#d7c49f] bg-[#f2e7d0] text-[#785d2d]",
  elite: "border-[#3a3631] bg-[#24211e] text-white",
};

const money = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);

const compact = (value: number) =>
  new Intl.NumberFormat("en-PH", { notation: "compact", maximumFractionDigits: 1 }).format(value);

const dateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "No activity yet";

function initials(member: CustomerProfile) {
  const label = member.full_name || member.username || member.email || "Member";
  return label
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function MemberAvatar({ member }: { member: CustomerProfile }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [member.avatar_url]);

  return member.avatar_url && !imageFailed ? (
    <img
      src={member.avatar_url}
      alt={`${member.full_name || member.username || "Member"} profile`}
      referrerPolicy="no-referrer"
      onError={() => setImageFailed(true)}
      className="h-11 w-11 shrink-0 rounded-2xl border border-border object-cover"
    />
  ) : (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#dfd2c0] text-xs font-bold">
      {initials(member)}
    </span>
  );
}

function TierBadge({ tier }: { tier: LoyaltyTier }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] ${tierStyles[tier]}`}
    >
      <Award size={12} />
      {tier}
    </span>
  );
}

export function MemberTierMonitoringPage() {
  const [members, setMembers] = useState<LoyaltyMember[]>([]);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [redemptions, setRedemptions] = useState<LoyaltyRedemption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | LoyaltyTier>("all");
  const [sort, setSort] = useState<"points" | "spend" | "recent">("points");
  const [page, setPage] = useState(1);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");


  const { userId, workspaceReady } = useAdminSession();
  const result = useAdminQuery<{rows:LoyaltyMember[];total:number;members:number;points:number;spend:number;elite:number;tiers:Record<string,number>}>(
    "admin_member_page", {p_query:query.slice(0,200),p_tier:tierFilter,p_sort:sort,p_page:page}, workspaceReady, userId,
  );
  const loading = result.loading;
  const total = result.data?.total ?? 0;
  const loadMembers = result.reload;
  const selectedRef = useRef(selectedId); selectedRef.current = selectedId;
  const detailGeneration = useRef(0);
  useEffect(() => setPage(1), [query,tierFilter,sort]);
  useEffect(() => {
    if (result.error) setError(result.error);
    if (result.data && !result.loading) setPage(p => Math.min(p,Math.max(1,Math.ceil(result.data!.total/20))));
  }, [result.data,result.loading,result.error]);
  useEffect(() => {
    let live = true;
    setMembers([]);
    if (!result.data) return;
    const rows = result.data.rows;
    void privateAvatarUrls(rows.map(row => row.avatar_url),supabase).then(avatars => {
      if (!live) return;
      setError("");
      setMembers(rows.map((row,index) => ({...row,avatar_url:avatars[index]})));
      setSelectedId(current => rows.some(row => row.id===current) ? current : rows[0]?.id ?? "");
    }).catch(() => { if (live) setError("Member avatars could not be refreshed. Please try again."); });
    return () => { live = false; };
  }, [result.data]);

  const loadMemberDetails = useCallback(async (userId: string, silent = false) => {
    const generation = ++detailGeneration.current;
    if (!userId) {
      setTransactions([]);
      setRedemptions([]);
      return;
    }
    if (!silent) setDetailsLoading(true);
    const [transactionResult, redemptionResult] = await Promise.all([
      supabase
        .from("mobile_loyalty_transactions")
        .select("id,kind,points,description,created_at,expires_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("mobile_loyalty_redemptions")
        .select("id,points_cost,discount_amount,status,code,created_at,expires_at,used_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);
    if (selectedRef.current !== userId || detailGeneration.current !== generation) return;
    if (transactionResult.error || redemptionResult.error) {
      setError(
        transactionResult.error?.message ||
          redemptionResult.error?.message ||
          "Member point history could not be loaded.",
      );
    } else {
      setTransactions((transactionResult.data ?? []) as LoyaltyTransaction[]);
      setRedemptions((redemptionResult.data ?? []) as LoyaltyRedemption[]);
    }
    setDetailsLoading(false);
  }, []);

  useEffect(() => { void loadMemberDetails(selectedId); }, [loadMemberDetails,selectedId]);
  useAdminTableInvalidation(["profiles","mobile_loyalty_accounts","mobile_loyalty_transactions","mobile_loyalty_redemptions"], async () => {
    loadMembers();
    if (selectedId) await loadMemberDetails(selectedId,true);
  },workspaceReady);
  const filteredMembers = members;
  const selectedMember = members.find((member) => member.id === selectedId) ?? null;
  const totalPoints = result.data?.points ?? 0;
  const totalSpend = result.data?.spend ?? 0;
  const topTierMembers = result.data?.elite ?? 0;
  const progress = selectedMember
    ? getLoyaltyTierProgress(selectedMember.tier, selectedMember.lifetime_eligible_spend)
    : null;

  return (
    <AdminShell title="Member tiers">
      <section className="rounded-[1.75rem] bg-[#24211e] p-5 text-white shadow-sm sm:p-7 lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold tracking-[.2em] text-[#d9c7af]">HOME CIRCLE / LIVE MONITORING</p>
            <h2 className="mt-3 font-serif text-4xl tracking-[-.04em] sm:text-5xl">Points and member tiers.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">
              Follow every customer’s earned balance, lifetime eligible spend, tier progress, and reward activity from one secure workspace.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-2 text-[11px] font-semibold">
              <span className={`h-2 w-2 rounded-full ${!result.error ? "bg-[#9fc595]" : "bg-[#d7b876]"}`} />
              {!result.error ? "Automatic updates enabled" : "Refresh needed"}
            </span>
            <button
              type="button"
              onClick={() => {
                void loadMembers();
                if (selectedId) void loadMemberDetails(selectedId);
              }}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[11px] font-bold text-[#24211e]"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#dfc7aa] bg-[#f3e5d4] p-4 text-sm font-semibold text-[#80563f] sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => void loadMembers()} className="text-left underline underline-offset-4">
            Try again
          </button>
        </div>
      )}

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Enrolled members", value: compact(result.data?.members ?? 0), note: "Customer loyalty accounts", Icon: Users },
          { label: "Available points", value: compact(totalPoints), note: "Across all members", Icon: Sparkles },
          { label: "Eligible spend", value: compact(totalSpend), note: "Delivered and paid orders", Icon: CircleDollarSign },
          { label: "Elite members", value: compact(topTierMembers), note: "₱120,000+ eligible spend", Icon: Award },
        ].map(({ label, value, note, Icon }) => (
          <article key={label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">{label}</p>
                <p className="mt-3 text-3xl font-semibold tracking-[-.04em]">{loading ? "—" : value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{note}</p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary"><Icon size={17} /></span>
            </div>
          </article>
        ))}
      </section>

      <DataPagination page={page} total={total} size={20} onChange={setPage} busy={loading} label="Member directory pages"/>
      <section className="mt-4 overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-sm">
        <header className="border-b border-border p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">MEMBER DIRECTORY</p>
              <h3 className="mt-1 text-xl font-semibold">{total} matching member{total === 1 ? "" : "s"}</h3>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_auto_auto]">
              <label className="flex h-11 items-center gap-2 rounded-xl border border-border bg-background px-3">
                <Search size={16} className="text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, username, or email"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </label>
              <select
                value={tierFilter}
                onChange={(event) => setTierFilter(event.target.value as "all" | LoyaltyTier)}
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm font-semibold"
                aria-label="Filter by member tier"
              >
                <option value="all">All tiers</option>
                {loyaltyTierOrder.map((tier) => <option key={tier} value={tier}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</option>)}
              </select>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as typeof sort)}
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm font-semibold"
                aria-label="Sort members"
              >
                <option value="points">Highest points</option>
                <option value="spend">Highest spend</option>
                <option value="recent">Recent activity</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {loyaltyTierOrder.map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => setTierFilter((current) => current === tier ? "all" : tier)}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold capitalize ${tierFilter === tier ? tierStyles[tier] : "border-border bg-background text-muted-foreground"}`}
              >
                {tier} · {result.data?.tiers[tier] ?? 0}
              </button>
            ))}
          </div>
        </header>

        {loading ? (
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((item) => <div key={item} className="h-32 animate-pulse rounded-2xl bg-secondary" />)}
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <Users className="mx-auto text-muted-foreground" size={24} />
            <p className="mt-3 text-sm font-semibold">No members match these filters.</p>
            <button type="button" onClick={() => { setQuery(""); setTierFilter("all"); }} className="mt-2 text-xs font-semibold underline underline-offset-4">Clear filters</button>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[920px] text-left">
                <thead className="bg-secondary/55 text-[10px] uppercase tracking-[.14em] text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-bold">Member</th>
                    <th className="px-4 py-3 font-bold">Tier</th>
                    <th className="px-4 py-3 text-right font-bold">Points</th>
                    <th className="px-4 py-3 text-right font-bold">Eligible spend</th>
                    <th className="px-4 py-3 font-bold">Last activity</th>
                    <th className="px-5 py-3"><span className="sr-only">Open member</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredMembers.map((member) => (
                    <tr
                      key={member.id}
                      onClick={() => setSelectedId(member.id)}
                      className={`cursor-pointer transition hover:bg-secondary/40 ${selectedId === member.id ? "bg-[#eee8df]" : ""}`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3"><MemberAvatar member={member} /><div className="min-w-0"><b className="block truncate text-sm">{member.full_name || member.username || "CozyCraft member"}</b><span className="mt-0.5 block truncate text-xs text-muted-foreground">@{member.username || "member"} · {member.email || "No email"}</span></div></div>
                      </td>
                      <td className="px-4 py-4"><TierBadge tier={member.tier} /></td>
                      <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums">{member.points_balance.toLocaleString("en-PH")}</td>
                      <td className="px-4 py-4 text-right text-sm tabular-nums">{money(member.lifetime_eligible_spend)}</td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">{dateTime(member.last_activity_at)}</td>
                      <td className="px-5 py-4 text-right"><ChevronRight size={17} className="ml-auto text-muted-foreground" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 p-4 lg:hidden">
              {filteredMembers.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setSelectedId(member.id)}
                  className={`rounded-2xl border p-4 text-left transition ${selectedId === member.id ? "border-[#a8957d] bg-[#eee8df]" : "border-border bg-background"}`}
                >
                  <div className="flex items-start gap-3"><MemberAvatar member={member} /><div className="min-w-0 flex-1"><b className="block truncate text-sm">{member.full_name || member.username || "CozyCraft member"}</b><span className="mt-1 block truncate text-xs text-muted-foreground">{member.email || "No email"}</span></div><ChevronRight size={16} /></div>
                  <div className="mt-4 flex items-center justify-between gap-3"><TierBadge tier={member.tier} /><span className="text-sm font-semibold tabular-nums">{member.points_balance.toLocaleString("en-PH")} pts</span></div>
                  <p className="mt-3 text-xs text-muted-foreground">{money(member.lifetime_eligible_spend)} eligible spend · {dateTime(member.last_activity_at)}</p>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {selectedMember && progress && (
        <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,.9fr)]">
          <article className="rounded-[1.75rem] border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-3"><MemberAvatar member={selectedMember} /><div className="min-w-0"><p className="text-[10px] font-bold tracking-[.15em] text-muted-foreground">SELECTED MEMBER</p><h3 className="mt-1 truncate text-xl font-semibold">{selectedMember.full_name || selectedMember.username}</h3><p className="truncate text-xs text-muted-foreground">@{selectedMember.username || "member"} · {selectedMember.email}</p></div></div>
              <TierBadge tier={selectedMember.tier} />
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-secondary p-4"><p className="text-[10px] font-bold tracking-[.12em] text-muted-foreground">POINT BALANCE</p><p className="mt-2 text-2xl font-semibold tabular-nums">{selectedMember.points_balance.toLocaleString("en-PH")}</p></div>
              <div className="rounded-2xl bg-secondary p-4"><p className="text-[10px] font-bold tracking-[.12em] text-muted-foreground">ELIGIBLE SPEND</p><p className="mt-2 text-2xl font-semibold tabular-nums">{money(selectedMember.lifetime_eligible_spend)}</p></div>
              <div className="rounded-2xl bg-secondary p-4"><p className="text-[10px] font-bold tracking-[.12em] text-muted-foreground">MEMBER SINCE</p><p className="mt-2 text-sm font-semibold">{dateTime(selectedMember.created_at)}</p></div>
            </div>
            <div className="mt-6 rounded-2xl border border-border p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold capitalize">{selectedMember.tier} tier progress</p><p className="mt-1 text-xs text-muted-foreground">{progress.nextTier ? `${money(progress.remaining)} more eligible spend to reach ${progress.nextTier}.` : "This member has reached the highest Home Circle tier."}</p></div><span className="text-sm font-semibold tabular-nums">{Math.round(progress.percent)}%</span></div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-[#2c2925] transition-[width]" style={{ width: `${progress.percent}%` }} /></div>
              <div className="mt-3 flex justify-between text-[10px] font-semibold uppercase tracking-[.1em] text-muted-foreground"><span>{selectedMember.tier}</span><span>{progress.nextTier ?? "Top tier"}</span></div>
            </div>
          </article>

          <article className="rounded-[1.75rem] border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold tracking-[.15em] text-muted-foreground">POINT HISTORY</p><h3 className="mt-1 text-xl font-semibold">Recent activity</h3></div><Activity size={19} className="text-muted-foreground" /></div>
            {detailsLoading ? <div className="mt-5 h-40 animate-pulse rounded-2xl bg-secondary" /> : transactions.length ? (
              <div className="mt-4 max-h-[360px] space-y-1 overflow-y-auto pr-1">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-start gap-3 rounded-2xl p-3 transition hover:bg-secondary/60">
                    <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${transaction.points > 0 ? "bg-[#e5eee1] text-[#50664b]" : "bg-[#f1e4dc] text-[#8b5c46]"}`}>{transaction.points > 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}</span>
                    <div className="min-w-0 flex-1"><p className="text-xs font-semibold leading-5">{transaction.description}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{dateTime(transaction.created_at)}</p></div>
                    <b className={`text-xs tabular-nums ${transaction.points > 0 ? "text-[#50664b]" : "text-[#8b5c46]"}`}>{transaction.points > 0 ? "+" : ""}{transaction.points}</b>
                  </div>
                ))}
              </div>
            ) : <div className="mt-5 rounded-2xl bg-secondary p-6 text-center text-xs text-muted-foreground">This member has no point activity yet.</div>}
          </article>
        </section>
      )}

      {selectedMember && (
        <section className="mt-4 rounded-[1.75rem] border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-bold tracking-[.15em] text-muted-foreground">REWARD REDEMPTIONS</p><h3 className="mt-1 text-xl font-semibold">Codes and redemption status</h3></div><p className="text-xs text-muted-foreground">Tier valid until {dateTime(selectedMember.tier_valid_until)}</p></div>
          {detailsLoading ? <div className="mt-5 h-24 animate-pulse rounded-2xl bg-secondary" /> : redemptions.length ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {redemptions.map((redemption) => (
                <article key={redemption.id} className="rounded-2xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary"><Gift size={16} /></span><span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em]">{redemption.status}</span></div>
                  <p className="mt-4 font-mono text-sm font-semibold">{redemption.code}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{redemption.points_cost} points · {money(redemption.discount_amount)} reward</p>
                  <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-[10px] text-muted-foreground"><CalendarDays size={13} />Created {dateTime(redemption.created_at)}</div>
                </article>
              ))}
            </div>
          ) : <div className="mt-5 rounded-2xl bg-secondary p-6 text-center text-xs text-muted-foreground">No rewards have been redeemed by this member.</div>}
        </section>
      )}
    </AdminShell>
  );
}
