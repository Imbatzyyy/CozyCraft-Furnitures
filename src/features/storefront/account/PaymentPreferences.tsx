import {useState,useRef} from 'react';
type Method='cod'|'card'|'gcash';
export function PaymentPreferences({value,save,enabled}:{value:Method;save:(method:Method)=>Promise<string|null>;enabled:Record<Method,boolean>}){
  const [choice,setChoice]=useState<Method|null>(null);
  const [busy,setBusy]=useState(false);
  const lock=useRef(false);
  const [notice,setNotice]=useState('');
  const selected=choice??value;
  return <div className="mt-6 grid gap-3"><div role="radiogroup" aria-label="Default payment method" className="grid gap-3">{([
    ['cod','Cash on delivery','Pay when your delivery arrives'],['card','Debit or credit card','Secure hosted PayMongo checkout'],['gcash','GCash','Secure hosted PayMongo checkout']
  ] as const).map(([id,label,detail])=><label key={id} className={`flex cursor-pointer items-center gap-4 rounded-2xl border p-5 ${selected===id?'border-foreground bg-secondary':'border-border'} ${!enabled[id]?'opacity-50':''}`}><input type="radio" name="default-payment" value={id} checked={selected===id} disabled={busy||!enabled[id]} onChange={()=>{setChoice(id);setNotice('');}}/><span className="min-w-0 flex-1"><b className="text-sm">{label}</b><span className="mt-2 block text-xs text-muted-foreground">{detail}</span><span className="mt-2 block text-xs">{value===id?'Saved default':enabled[id]?'Available':'Currently unavailable'}</span></span></label>)}</div>
  <button type="button" disabled={busy||selected===value||!enabled[selected]} className="min-h-11 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:opacity-50 sm:justify-self-start" onClick={async()=>{if(lock.current)return;lock.current=true;setBusy(true);setNotice('');try{const error=await save(selected);setNotice(error||'Default payment method saved. It will be selected at checkout when available.');if(!error)setChoice(null);}catch{setNotice('Unable to save your preference. Please try again.');}finally{lock.current=false;setBusy(false);}}}>{busy?'Saving…':'Set default payment'}</button><p role="status" className="text-sm">{notice}</p></div>;
}
