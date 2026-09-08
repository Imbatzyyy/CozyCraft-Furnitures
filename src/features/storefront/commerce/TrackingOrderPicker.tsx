import { useEffect, useRef, useState } from 'react';
import type { DbOrder } from '@/services/supabase/client';

export const TRACKING_ORDER_PAGE_SIZE = 5;
export function TrackingOrderPicker({orders,selected,onSelect}:{orders:DbOrder[];selected:DbOrder;onSelect:(id:string)=>void}) {
  const root=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const [open,setOpen]=useState(false);
  const [page,setPage]=useState(0);
  const pages=Math.max(1,Math.ceil(orders.length/TRACKING_ORDER_PAGE_SIZE));
  const current=Math.min(page,pages-1);
  useEffect(()=>{
    if(!open)return;
    const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};
    document.addEventListener('pointerdown',outside);
    return()=>document.removeEventListener('pointerdown',outside);
  },[open]);
  return <div className="tracking-picker" ref={root} onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus();}}}>
    <span>Switch order</span>
    <button ref={trigger} type="button" className="tracking-picker-trigger" aria-expanded={open} aria-controls="tracking-order-options" onClick={()=>{if(!open)setPage(Math.floor(Math.max(0,orders.findIndex(o=>o.id===selected.id))/TRACKING_ORDER_PAGE_SIZE));setOpen(!open);}}>#{selected.order_number} · {selected.status} <span aria-hidden="true">⌄</span></button>
    {open && <section id="tracking-order-options" className="tracking-picker-panel" aria-label="Choose order to track">
      <p className="tracking-picker-heading">Your orders <span>{orders.length} total</span></p>
      <ul>{orders.slice(current*TRACKING_ORDER_PAGE_SIZE,(current+1)*TRACKING_ORDER_PAGE_SIZE).map(o=><li key={o.id}><button type="button" aria-current={o.id===selected.id?'true':undefined} onClick={()=>{onSelect(o.id);setOpen(false);trigger.current?.focus();}}><strong>#{o.order_number}</strong><span>{o.status.replace(/_/g,' ')}{o.id===selected.id?' · Selected':''}</span></button></li>)}</ul>
      <nav aria-label="Order picker pages"><button type="button" disabled={current===0} onClick={()=>setPage(current-1)}>Previous</button><span aria-live="polite">Page {current+1} of {pages}</span><button type="button" disabled={current>=pages-1} onClick={()=>setPage(current+1)}>Next</button></nav>
    </section>}
  </div>;
}
