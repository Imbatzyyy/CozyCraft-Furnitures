import { useEffect, useRef, useState } from 'react';
import { confirmPaymentEmailVerification, requestPaymentEmailVerification, normalizePaymentEmailCode, type PaymentEmailChallenge, type PaymentEmailAuthorization } from './payment-email-verification';

export function PaymentEmailDialog({ initial, finish }: { initial: PaymentEmailChallenge; finish: (value: PaymentEmailAuthorization | null) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const [challenge,setChallenge] = useState(initial);
  const [code,setCode] = useState('');
  const [busy,setBusy] = useState('');
  const [error,setError] = useState('');
  const [now,setNow] = useState(Date.now());
  useEffect(()=>{dialog.current?.showModal();const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const remaining=Math.max(0,Math.ceil((challenge.expiresAt-now)/1000));
  const resend=Math.max(0,Math.ceil((challenge.resendAvailableAt-now)/1000));
  async function act(resending:boolean){
    if(lock.current)return;lock.current=true;setBusy(resending?'Sending…':'Checking code…');setError('');
    try {
      if(resending){setChallenge(await requestPaymentEmailVerification(challenge.intent));setCode('');}
      else finish(await confirmPaymentEmailVerification(challenge,code));
    }catch(e){setError(e instanceof Error?e.message:'Please try again.');if(e && typeof e==='object' && 'retryAfter' in e)setChallenge(c=>({...c,resendAvailableAt:Date.now()+Number(e.retryAfter)*1000}));}
    finally{lock.current=false;setBusy('');}
  }
  return <dialog ref={dialog} className="checkout-email-dialog" onCancel={e=>{e.preventDefault();if(!lock.current)finish(null);}}>
    <form onSubmit={e=>{e.preventDefault();void act(false);}}>
      <p className="checkout-email-eyebrow">SECURE CHECKOUT</p><h2>Check your email.</h2>
      <p>Enter the six-digit code sent to <strong>{challenge.maskedEmail}</strong> before continuing to {challenge.intent.paymentMethod==='gcash'?'GCash':'card payment'} through PayMongo.</p>
      <label htmlFor="checkout-email-code">Verification code</label>
      <input id="checkout-email-code" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(normalizePaymentEmailCode(e.target.value))} disabled={!!busy || !remaining}/>
      <p role="status">{remaining?`Code expires in ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`:'Code expired. Request a new one.'}</p>
      {error && <p role="alert" className="checkout-email-error">{error}</p>}
      <button type="submit" disabled={!!busy || code.length!==6 || !remaining}>{busy || 'Verify and continue'}</button>
      <div className="checkout-email-actions"><button type="button" disabled={!!busy || resend>0} onClick={()=>void act(true)}>{resend?`Resend in ${resend}s`:'Send new code'}</button><button type="button" disabled={!!busy} onClick={()=>finish(null)}>Cancel</button></div>
      <small>This confirms this checkout only. You are not charged until you complete payment in PayMongo. Never share your code.</small>
    </form>
  </dialog>;
}
