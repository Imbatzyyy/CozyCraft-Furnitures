import { ArrowUpRight, Check, UserRound } from "lucide-react";
import "./profile-refresh.css";

export function ProfileOverview({ name, username, email, phone, verified, gender, birth, openCircle }: { name: string; username: string; email: string; phone: string; verified: boolean; gender: string; birth: string; openCircle: () => void }) {
  const birthday = birth && !Number.isNaN(Date.parse(birth)) ? new Date(`${birth.slice(0,10)}T12:00:00`).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }) : "Not added";
  return <div className="profile-overview">
    <div className="profile-identity"><span className="profile-monogram" aria-hidden="true"><UserRound size={23}/></span><div><p className="account-eyebrow">PERSONAL INFORMATION</p><h3>{name || username || "Your profile"}</h3><p>{username ? `@${username}` : "Add a username to make this space yours."}</p></div></div>
    <dl className="profile-facts">{[["Email address", email || "Not added"], ["Mobile number", phone || "Not added"], ["Gender", gender || "Prefer not to say"], ["Date of birth", birthday]].map(([label, value]) => <div key={label}><dt>{label}{label === "Mobile number" && verified && <span><Check size={11}/> Verified</span>}</dt><dd>{value}</dd></div>)}</dl>
    <button className="profile-circle-link" onClick={openCircle}><span><span className="account-eyebrow">YOUR HOME CIRCLE</span><strong>A home for your rewards.</strong><span>Discover your points, tier and next milestone.</span></span><ArrowUpRight size={22}/></button>
  </div>;
}
