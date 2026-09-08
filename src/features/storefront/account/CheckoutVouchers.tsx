import { useEffect, useState } from "react";
import { supabase } from "@/services/supabase/client";
import type { CircleReward } from "@/services/content/home-circle.service";
import { VoucherWallet } from "./VoucherWallet";
export function CheckoutVouchers({userId,requestedId,subtotal,selected,onSelect,disabled,revision}:{userId:string;requestedId:string|null;subtotal:number;selected:CircleReward|null;onSelect:(value:CircleReward|null)=>void;disabled:boolean;revision:number}){
  const [error,setError]=useState('');
  useEffect(()=>{
    if(!requestedId)return;
    const controller=new AbortController();let live=true;const timer=setTimeout(()=>controller.abort(),12000);
    void Promise.resolve(supabase.from('mobile_loyalty_redemptions').select('id,discount_amount,minimum_order_amount,reward_source,status,expires_at')
      .eq('id',requestedId).eq('user_id',userId).eq('status','available').gt('expires_at',new Date().toISOString()).abortSignal(controller.signal).maybeSingle())
      .then(({data,error})=>{if(live){if(error||!data)setError('That voucher is unavailable. You can choose another below.');else onSelect(data as CircleReward)}})
      .catch(()=>{if(live)setError('Your selected voucher could not be loaded. Please choose it below.')})
      .finally(()=>clearTimeout(timer));
    return()=>{live=false;controller.abort();clearTimeout(timer)};
  },[userId,requestedId,onSelect]);
  return <section className="checkout-vouchers"><p className="account-eyebrow">HOME CIRCLE</p><h3>Your vouchers</h3><p className="circle-small">One voucher per order. Eligibility and the final amount are verified before your order is placed.</p>{error&&<p role="alert" className="circle-error">{error}</p>}{selected&&<p className="voucher-success">Chosen voucher: ₱{selected.discount_amount} off</p>}<VoucherWallet userId={userId} subtotal={subtotal} selectedId={selected?.id} onSelect={onSelect} disabled={disabled} revision={revision}/></section>;
}
