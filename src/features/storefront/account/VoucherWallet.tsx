import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadCircleRewards, type CircleReward } from "@/services/content/home-circle.service";
import { voucherEligible } from "@/lib/loyalty/vouchers";
import "./profile-refresh.css";
const money=(n:number)=>`₱${Number(n).toLocaleString('en-PH')}`;
export function VoucherWallet({userId,initial,subtotal,onSelect,selectedId,disabled=false,revision=0}: {
  userId:string; initial?:{rows:CircleReward[];hasMore:boolean};subtotal?:number;onSelect?:(v:CircleReward|null)=>void;selectedId?:string;disabled?:boolean;revision?:number;
}) {
  const [page,setPage]=useState(0);
  const [data,setData]=useState(initial);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id)},[]);
  useEffect(()=>{
    if(page===0 && initial && !retry) {setData(initial);setBusy(false);return;}
    const controller=new AbortController();let live=true;
    const timer=setTimeout(()=>controller.abort(),12000);setBusy(true);setError('');
    loadCircleRewards(userId,page,controller.signal).then(value=>{if(live)setData(value)}).catch(()=>{if(live)setError('Your vouchers could not be loaded. Please refresh.')}).finally(()=>{clearTimeout(timer);if(live)setBusy(false)});
    return()=>{live=false;controller.abort();clearTimeout(timer)};
  },[userId,page,initial,retry,revision]);
  return <div className="voucher-wallet" aria-busy={busy}>
    {onSelect && <button type="button" className="circle-refresh" disabled={disabled} onClick={()=>onSelect(null)}>No voucher{!selectedId ? ' · selected':''}</button>}
    {error && <p className="circle-error" role="alert">{error}</p>}
    {busy && <p className="circle-small" role="status">Loading vouchers…</p>}
    <div className="circle-wallet">{data?.rows.map(r=>{
      const available=voucherEligible(r,subtotal ?? Infinity,now);
      const expired=Date.parse(r.expires_at)<=now || r.status!=='available';
      return <article key={r.id} className={!available?'voucher-unavailable':''}><span className="account-eyebrow">{r.reward_source==='welcome'?'WELCOME VOUCHER':'POINTS VOUCHER'}</span><h4>{money(r.discount_amount)} off</h4><p>{r.minimum_order_amount>0?`Orders from ${money(r.minimum_order_amount)}`:'No minimum order'}</p><p>Use by {new Date(r.expires_at).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'})}</p>
        {onSelect ? <button type="button" className="voucher-use" disabled={!available||disabled||busy||!!error} onClick={()=>onSelect(r)}>{expired?'Expired / unavailable':!available?'Minimum not met':selectedId===r.id?'Selected':'Use voucher'}</button> : available ? <Link className="voucher-use" to={`/checkout?voucher=${encodeURIComponent(r.id)}`}>Use at checkout →</Link> : <button className="voucher-use" disabled>Expired / unavailable</button>}
      </article>;
    })}</div>
    {!busy && !data?.rows.length && !error && <p className="circle-empty">No available vouchers on this page.</p>}
    <nav className="circle-pagination" aria-label="Voucher pages"><button type="button" disabled={page===0||busy||disabled} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page+1}</span><button type="button" disabled={!data?.hasMore||busy||disabled} onClick={()=>setPage(p=>p+1)}>Next</button></nav>
    <button type="button" className="voucher-text-button" disabled={busy||disabled} onClick={()=>{setPage(0);setRetry(n=>n+1)}}>Refresh vouchers</button>
  </div>;
}
