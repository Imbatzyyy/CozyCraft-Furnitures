import { useEffect, useRef, useState } from 'react';
import type { DbOrder } from '@/services/supabase/client';

export const TRACKING_ORDER_PAGE_SIZE = 5;
export type TrackingPagination = {page:number;total:number;onChange:(page:number)=>void;busy:boolean;error:string};
export function TrackingOrderPicker({orders,selected,onSelect,pagination}:{orders:DbOrder[];selected:DbOrder;onSelect:(id:string)=>void;pagination?:TrackingPagination}) {
  const root=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const [open,setOpen]=useState(false);
  const [page,setPage]=useState(0);
  const pages=Math.max(1,Math.ceil((pagination?.total ?? orders.length)/TRACKING_ORDER_PAGE_SIZE));
  const current=pagination ? pagination.page-1 : Math.min(page,pages-1);
  const changePage=(value:number)=>pagination ? pagination.onChange(value+1) : setPage(value);
  const rows=pagination ? orders : orders.slice(current*TRACKING_ORDER_PAGE_SIZE,(current+1)*TRACKING_ORDER_PAGE_SIZE);
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
      <p className="tracking-picker-heading">Your orders <span>{pagination?.total ?? orders.length} total</span></p>
      {pagination?.error && <p role="alert">{pagination.error}</p>}
      <ul aria-busy={pagination?.busy}>{rows.map(o=><li key={o.id}><button type="button" disabled={pagination?.busy} aria-current={o.id===selected.id?'true':undefined} onClick={()=>{onSelect(o.id);setOpen(false);trigger.current?.focus();}}><strong>#{o.order_number}</strong><span>{o.status.replace(/_/g,' ')}{o.id===selected.id?' · Selected':''}</span></button></li>)}</ul>
      <nav aria-label="Order picker pages"><button type="button" disabled={current===0||pagination?.busy} onClick={()=>changePage(current-1)}>Previous</button><span aria-live="polite">Page {current+1} of {pages}</span><button type="button" disabled={current>=pages-1||pagination?.busy} onClick={()=>changePage(current+1)}>Next</button></nav>
    </section>}
  </div>;
}
