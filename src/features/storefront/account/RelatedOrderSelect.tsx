import { useEffect, useState } from "react";
import { supabase } from "@/services/supabase/client";
import { DataPagination } from "@/components/DataPagination";

/** Compact support selector independent of the currently loaded order page. */
export function RelatedOrderSelect({userId,value,onChange}:{userId:string;value:string;onChange:(id:string)=>void}) {
  const [open,setOpen]=useState(false);
  const [page,setPage]=useState(1);
  const [query,setQuery]=useState("");
  const [label,setLabel]=useState("");
  const [rows,setRows]=useState<Array<{id:string;order_number:string;status:string}>>([]);
  const [total,setTotal]=useState(0);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{if(!value)setLabel("");},[value]);
  useEffect(()=>{
    if(!open||!userId)return;
    let active=true; const controller=new AbortController();
    setBusy(true);setError("");
    const timer=window.setTimeout(()=>{
      let request=supabase.from("orders").select("id,order_number,status",{count:"exact"}).eq("user_id",userId);
      const term=query.trim().replace(/[%_\\]/g,'').slice(0,60);
      if(term)request=request.ilike("order_number",`%${term}%`);
      void request.order("created_at",{ascending:false}).order("id",{ascending:false}).range((page-1)*5,page*5-1).abortSignal(controller.signal)
        .then(({data,error,count})=>{if(!active)return;setBusy(false);if(error){setError("Orders could not be loaded. Close and try again.");return;}setRows(data??[]);setTotal(count??0);});
    },200);
    return()=>{active=false;clearTimeout(timer);controller.abort();};
  },[open,userId,page,query]);
  return <div className="grid gap-2 text-xs font-semibold">
    <span>Related order</span>
    <button type="button" aria-expanded={open} onClick={()=>setOpen(v=>!v)} className="min-h-11 rounded-xl border border-border bg-[#fcfbf8] px-3 text-left font-normal">{value ? label || 'Selected order' : 'Choose an order (optional)'} · {open?'Close':'Browse'}</button>
    {open&&<section className="rounded-xl border border-border bg-card p-3">
      <input aria-label="Find an order number" value={query} maxLength={60} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="Search order number" className="min-h-11 w-full rounded-lg border border-border px-3 font-normal"/>
      <button type="button" onClick={()=>{onChange('');setOpen(false);}} className="min-h-11 underline">No related order</button>
      {error&&<p role="alert">{error}</p>}
      {rows.map(order=><button type="button" key={order.id} disabled={busy} onClick={()=>{onChange(order.id);setLabel('#'+order.order_number);setOpen(false);}} className="min-h-11 w-full rounded-lg p-2 text-left hover:bg-secondary disabled:opacity-40">#{order.order_number} · {order.status}</button>)}
      <DataPagination page={page} total={total} size={5} busy={busy} onChange={setPage} label="Related order pages"/>
    </section>}
  </div>;
}
