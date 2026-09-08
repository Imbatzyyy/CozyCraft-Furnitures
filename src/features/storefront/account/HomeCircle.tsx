import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, RefreshCw, Sparkles } from "lucide-react";
import { getLoyaltyTierProgress, loyaltyTierMinimums, loyaltyTierOrder } from "@/lib/loyalty/member-tiers";
import { loadHomeCircle, type CircleSnapshot } from "@/services/content/home-circle.service";
import "./profile-refresh.css";

export const circleNames = { member: "Cozy Nest", plus: "Cozy Plus", premium: "Cozy Premium", elite: "Cozy Elite" };
const rates = { member: "1 point per ₱100", plus: "1 point per ₱100", premium: "1.5× order points", elite: "2× order points" };
const money = (n: number) => `₱${Number(n).toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
const date = (s: string) => new Date(s).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });

export function HomeCircle({ userId, active }: { userId: string; active: boolean }) {
  const [snapshot, setSnapshot] = useState<CircleSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const updatedAt = useRef(0);
  const loadedRevision = useRef(0);
  useEffect(() => {
    if (!active || (revision === loadedRevision.current && Date.now() - updatedAt.current < 60_000)) return;
    const controller = new AbortController();
    let live = true;
    const timeout = setTimeout(() => controller.abort(), 12_000);
    setBusy(true); setError("");
    loadHomeCircle(userId, controller.signal).then(data => {
      if (live) { setSnapshot(data); updatedAt.current = Date.now(); loadedRevision.current = revision; }
    }).catch(() => {
      if (live) setError("We couldn’t refresh Home Circle. Your points are safe. Please try again.");
    }).finally(() => { clearTimeout(timeout); if (live) setBusy(false); });
    return () => { live = false; clearTimeout(timeout); controller.abort(); };
  }, [userId, active, revision]);
  return active ? <HomeCircleView snapshot={snapshot} busy={busy} error={error} refresh={() => setRevision(n => n + 1)} /> : null;
}

export function HomeCircleView({ snapshot, busy, error, refresh }: { snapshot: CircleSnapshot | null; busy: boolean; error: string; refresh: () => void }) {
  const [page, setPage] = useState(0);
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  const account = snapshot?.account;
  const tier = account && loyaltyTierOrder.includes(account.tier) ? account.tier : "member";
  const progress = getLoyaltyTierProgress(tier, Number(account?.lifetime_eligible_spend || 0));
  const activity = snapshot?.activity || [];
  const pages = Math.max(1, Math.ceil(activity.length / 5));
  const currentPage = Math.min(page, pages - 1);
  const rewards = (snapshot?.rewards || []).filter(r => r.status === "available" && Date.parse(r.expires_at) > now);
  return <section className="web-circle" aria-labelledby="circle-title">
    <header className="circle-heading"><div><p className="account-eyebrow">COZYCRAFT · HOME CIRCLE</p><h2 id="circle-title">A little more,<br/><em>for your home.</em></h2><p>Your membership, thoughtfully brought together.</p></div><button className="circle-refresh" onClick={refresh} disabled={busy} aria-label="Refresh Home Circle"><RefreshCw size={16} className={busy ? "animate-spin" : ""} />{busy ? "Updating" : "Refresh"}</button></header>
    {error && <p role="alert" className="circle-error">{error}{snapshot && " Showing your last loaded balance."}</p>}
    <section className="circle-balance" aria-label="Membership balance" aria-busy={busy}>
      <div className="circle-balance-top"><span className="account-eyebrow">YOUR AVAILABLE POINTS</span><span className="circle-badge"><Sparkles size={14}/>{account ? circleNames[tier] : "Membership"}</span></div>
      <strong className="circle-points">{account ? Number(account.points_balance).toLocaleString("en-PH") : "—"}</strong><p>{account ? rates[tier] + " on eligible deliveries" : busy ? "Loading your membership…" : "Refresh to load your membership"}</p>
      <div className="circle-progress-label"><span>{progress.nextTier ? `Next chapter · ${circleNames[progress.nextTier]}` : "The highest Home Circle tier"}</span><span>{account ? `${Math.round(progress.percent)}%` : "—"}</span></div>
      <div className="circle-progress" role="progressbar" aria-label="Tier progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={account ? Math.round(progress.percent) : undefined}><i style={{width: `${account ? progress.percent : 0}%`}}/></div>
      <p className="circle-small">{account ? progress.nextTier ? `${money(progress.remaining)} in eligible deliveries to ${circleNames[progress.nextTier]}.` : "Welcome to the full Home Circle experience." : "Your balance follows your account across devices."}</p>
      <div className="circle-spend"><span>Lifetime eligible spend</span><strong>{account ? money(account.lifetime_eligible_spend) : "—"}</strong></div>
    </section>
    <section className="circle-section"><p className="account-eyebrow">ROOM TO GROW</p><h3>Your Home Circle journey</h3><ol className="circle-tiers">{loyaltyTierOrder.map((key, i) => <li key={key} className={account && tier === key ? "is-current" : ""}><span className="circle-number">0{i + 1}</span><div><h4>{circleNames[key]}</h4><p>{loyaltyTierMinimums[key] ? `From ${money(loyaltyTierMinimums[key])}` : "From your first day"}</p><strong>{rates[key]}</strong>{account && tier === key && <span className="circle-current">Your level</span>}</div></li>)}</ol><p className="circle-small">Tiers are based on eligible delivered spend. Premium and Elite multipliers apply using your tier before the order is delivered.</p></section>
    <section className="circle-section"><p className="account-eyebrow">YOURS TO ENJOY</p><h3>Available rewards</h3>{rewards.length ? <div className="circle-wallet">{rewards.map(r => <article key={r.id}><span className="account-eyebrow">{r.reward_source === "welcome" ? "WELCOME REWARD" : "POINTS REWARD"}</span><h4>{money(r.discount_amount)} off</h4><p>{r.minimum_order_amount > 0 ? `Orders from ${money(r.minimum_order_amount)}` : "No minimum order"}</p><p>Use by {date(r.expires_at)}</p></article>)}</div> : <p className="circle-empty">{account ? "No available rewards right now. Your rewards from the CozyCraft app will appear here." : "Your rewards will appear once your membership loads."}</p>}<p className="circle-small">View up to 20 available rewards. Exchange points and apply rewards in the CozyCraft app; this page shows the same account wallet.</p></section>
    <section className="circle-section"><p className="account-eyebrow">EVERY LITTLE ADDITION</p><h3>Recent activity</h3>{activity.length ? <><ul className="circle-ledger">{activity.slice(currentPage * 5, currentPage * 5 + 5).map(a => <li key={a.id}><div><p>{a.description}</p><time dateTime={a.created_at}>{date(a.created_at)}</time></div><strong>{a.points > 0 ? "+" : ""}{a.points}<small>points</small></strong></li>)}</ul>{pages > 1 && <nav className="circle-pagination" aria-label="Points activity pages"><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><span>{currentPage + 1} / {pages}</span><button disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}>Next</button></nav>}</> : <p className="circle-empty">{account ? "Your eligible deliveries, reviews and reward exchanges will appear here." : "Activity is not loaded yet."}</p>}<p className="circle-small">Latest 20 entries. Cancelled or refunded orders can reverse earned points.</p></section>
    <footer className="circle-footer"><p>Make room for something lovely.</p><Link to="/new-arrivals">Explore new pieces <ArrowUpRight size={16}/></Link></footer>
  </section>;
}
