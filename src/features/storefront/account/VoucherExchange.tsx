import { useEffect, useRef, useState } from "react";
import { circleExchanges } from "@/lib/loyalty/vouchers";
import { claimCircleReward } from "@/services/content/home-circle.service";
export function VoucherExchange({userId,points,disabled,onClaimed}:{userId:string;points:number;disabled:boolean;onClaimed:()=>void}) {
  const [chosen,setChosen]=useState<typeof circleExchanges[number]|null>(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const dialog=useRef<HTMLDialogElement>(null);
  const pending=useRef(false);
  const requestKeys=useRef<Record<string,string>>({});
  useEffect(()=>{if(chosen)dialog.current?.showModal();else dialog.current?.close()},[chosen]);
  const confirm=async()=>{
    if(!chosen||pending.current||disabled||points<chosen.points)return;
    pending.current=true;setBusy(true);setError('');
    const storageKey=`cozy-voucher-claim:${userId}:${chosen.points}`;
    let key=requestKeys.current[storageKey] || '';try{key=sessionStorage.getItem(storageKey)||key}catch{/* Request still has in-memory idempotency. */}
    if(!key)key=crypto.randomUUID();
    requestKeys.current[storageKey]=key;
    try{sessionStorage.setItem(storageKey,key)}catch{/* Storage may be blocked. */}
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
    try{
      const reward=await claimCircleReward(chosen.points,key,controller.signal);
      try{sessionStorage.removeItem(storageKey)}catch{/* Best effort. */}
      delete requestKeys.current[storageKey];
      setNotice(`Your ₱${reward.discount_amount} voucher is ready. Expires ${new Date(reward.expires_at).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',month:'long',day:'numeric',year:'numeric'})}. A confirmation email has been queued.`);
      setChosen(null);onClaimed();
    }catch(cause){setError(cause && typeof cause==='object' && 'message' in cause ? String(cause.message) : 'We could not confirm your claim. Retry to safely check the same claim.');}
    finally{clearTimeout(timer);pending.current=false;setBusy(false)}
  };
  return <section className="circle-section"><p className="account-eyebrow">A THOUGHTFUL RETURN</p><h3>Turn points into possibilities.</h3><div className="voucher-exchanges">{circleExchanges.map(option=><button key={option.points} disabled={disabled||busy||points<option.points} onClick={()=>{setChosen(option);setError('');setNotice('')}}><strong>₱{option.value}</strong><span>{option.points} points</span><small>{points<option.points?`${option.points-points} more points needed`:'Convert to voucher →'}</small></button>)}</div><p className="circle-small">Vouchers last 30 days. One voucher per order; the eligible discount is shown at checkout.</p>{notice&&<p className="voucher-success" role="status">{notice}</p>}
    <dialog ref={dialog} className="voucher-confirm" aria-labelledby="voucher-confirm-title" onCancel={e=>{if(busy)e.preventDefault();else setChosen(null)}} onClose={()=>{if(!busy)setChosen(null)}}>
      {chosen&&<><p className="account-eyebrow">CONFIRM YOUR EXCHANGE</p><h3 id="voucher-confirm-title">₱{chosen.value} for your home.</h3><p>Convert <strong>{chosen.points} points</strong> into a ₱{chosen.value} voucher? It will be valid for 30 days, with the exact expiry saved in your wallet and confirmation email.</p><p>Your remaining balance: <strong>{Math.max(0,points-chosen.points)} points</strong>.</p>{error&&<p className="circle-error" role="alert">{error}</p>}<div className="voucher-confirm-actions"><button autoFocus disabled={busy} onClick={()=>setChosen(null)}>Not now</button><button disabled={busy||disabled||points<chosen.points} onClick={()=>void confirm()}>{busy?'Converting…':`Confirm · ${chosen.points} points`}</button></div></>}
    </dialog>
  </section>;
}
