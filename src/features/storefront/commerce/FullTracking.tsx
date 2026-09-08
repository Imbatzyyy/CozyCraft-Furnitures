import { Link } from 'react-router-dom';
import { TrackingOrderPicker } from './TrackingOrderPicker';
import { safeTrackingOrder } from './tracking-data';
import { Check, Package, Truck, MapPin, ArrowLeft, MessageCircle } from 'lucide-react';
import type { DbOrder } from '@/services/supabase/client';
import './full-tracking.css';

export const trackingDate=(value?:string|null)=>value && Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Not recorded';
const cash=(value:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(Number(value)||0);
const names=['pending','processing','packed','shipped','delivered'] as const;
const labels={pending:'Order placed',processing:'Preparing your order',packed:'Packed with care',shipped:'On its way',delivered:'Delivered',cancelled:'Order cancelled'};
const details={pending:'Your order has been recorded. Payment and fulfillment updates will appear here.',processing:'Our team is preparing your furniture for dispatch.',packed:'Your furniture has been packed for its delivery journey.',shipped:'Your order has been marked as shipped. Keep your contact number available for delivery coordination.',delivered:'Your order has been marked as delivered. Thank you for making room for CozyCraft.',cancelled:'This order is no longer progressing toward delivery.'};
export function trackingSteps(order:DbOrder){
  order=safeTrackingOrder(order);
  return names.map((status,index)=>{const event=[...(order.order_status_history||[])].filter(e=>e.status===status).sort((a,b)=>Date.parse(b.changed_at)-Date.parse(a.changed_at))[0];const at=event?.changed_at || (status==='pending'?order.created_at:null);return{status,at,complete:!!at || (order.status!=='cancelled' && index<=names.indexOf(order.status)),current:status===order.status};});
}
export function FullTracking({order,orders,onSelect}:{order:DbOrder;orders:DbOrder[];onSelect:(id:string)=>void}){
  order=safeTrackingOrder(order);
  orders=orders.filter(Boolean).map(safeTrackingOrder);
  const events=[...(order.order_status_history||[])].sort((a,b)=>Date.parse(b.changed_at)-Date.parse(a.changed_at));
  const address=order.shipping_address||{};
  const steps=trackingSteps(order);
  const label=labels[order.status] || order.status;
  const transaction=order.payment_transactions?.find(p=>p.status==='paid') || order.payment_transactions?.[0];
  return <main className="full-tracking">
    <nav className="tracking-top"><Link to="/profile?tab=orders"><ArrowLeft size={15}/> Back to orders</Link><TrackingOrderPicker orders={orders} selected={order} onSelect={onSelect}/></nav>
    <header className="tracking-hero"><div><p className="tracking-eyebrow">THE JOURNEY TO YOUR HOME</p><h1>{label}</h1><p>{details[order.status]}</p><div className="tracking-ref"><span>#{order.order_number}</span><span>Placed {trackingDate(order.created_at)}</span></div></div><div className="tracking-hero-icon"><Truck size={42} strokeWidth={1}/></div></header>
    <div className="tracking-grid"><div className="tracking-main">
      <section className="tracking-card"><div className="tracking-heading"><div><p className="tracking-eyebrow">DELIVERY PROGRESS</p><h2>Every step, in view.</h2></div><Package size={23}/></div><p className="tracking-muted">Dates and times are shown in Philippine time (PHT).</p>
        {order.status==='cancelled' && <div className="tracking-cancelled"><strong>Order cancelled</strong><p>{order.cancellation_reason || 'This order has been cancelled.'}</p><time>{trackingDate(events.find(e=>e.status==='cancelled')?.changed_at)}</time></div>}
        <ol className="tracking-timeline">{steps.map(step=><li key={step.status} data-complete={step.complete} aria-current={step.current?'step':undefined}><span className="tracking-dot">{step.complete?<Check size={16}/>:<span/>}</span><div><div className="tracking-step-title"><h3>{labels[step.status]}</h3>{step.current && <span className="tracking-pill">Current stage</span>}</div><p>{step.complete?details[step.status]:order.status==='cancelled'?'Not completed — order cancelled.':'Awaiting this stage.'}</p><time dateTime={step.at||undefined}>{step.at?trackingDate(step.at):step.complete?'Completion time not recorded':'No recorded update yet'}</time></div></li>)}</ol>
        <div className="tracking-note">These are CozyCraft fulfillment updates, not GPS tracking. A precise delivery appointment or carrier tracking number is not available in this record.</div>
      </section>
      <section className="tracking-card"><div className="tracking-heading"><div><p className="tracking-eyebrow">ORDER CONTENTS</p><h2>Your selected pieces.</h2></div><span>{order.order_items.reduce((n,i)=>n+i.quantity,0)} items</span></div><div className="tracking-items">{order.order_items.map(item=><article key={item.id}>{item.image_url?<img src={item.image_url} alt={item.product_name} loading="lazy"/>:<div className="tracking-image-placeholder"><Package/></div>}<div><h3>{item.product_name}</h3><p>Quantity {item.quantity} · {cash(item.unit_price)} each</p>{order.status==='delivered' && item.product_id && <Link to={`/products/${encodeURIComponent(item.product_id)}#reviews`}>Write a review →</Link>}</div><strong>{cash(item.unit_price*item.quantity)}</strong></article>)}</div></section>
      <section className="tracking-card"><p className="tracking-eyebrow">RECORDED ACTIVITY</p><h2>Order history.</h2><p className="tracking-muted">Latest recorded update first.</p>{events.length?<ol className="tracking-history">{events.map(event=><li key={event.id}><strong>{labels[event.status] || event.status}</strong><time dateTime={event.changed_at}>{trackingDate(event.changed_at)}</time></li>)}</ol>:<p className="tracking-muted">No status changes have been recorded yet. Order placed {trackingDate(order.created_at)}.</p>}</section>
    </div><aside className="tracking-side">
      <section className="tracking-card"><MapPin size={23}/><p className="tracking-eyebrow">DELIVERING TO</p><h2>{address.name || 'Delivery address'}</h2><address>{[address.line,address.barangay,address.city,address.province,address.postal].filter(Boolean).join(', ') || 'Address details not recorded.'}</address>{address.mobile && <p className="tracking-contact">{address.mobile}</p>}<p className="tracking-muted">Need to correct delivery details? Contact support before dispatch; changes are subject to fulfillment status.</p></section>
      <section className="tracking-card"><p className="tracking-eyebrow">PAYMENT SUMMARY</p><h2>{order.payment_method==='cod'?'Cash on delivery':order.payment_method==='gcash'?'GCash':'Card'}</h2><span className="tracking-pill">{order.payment_status.replace(/_/g,' ')}</span><dl className="tracking-totals"><div><dt>Furniture subtotal</dt><dd>{cash(order.subtotal)}</dd></div><div><dt>Delivery</dt><dd>{cash(order.delivery_fee)}</dd></div>{Number(order.reward_discount)>0 && <div><dt>Home Circle voucher</dt><dd>−{cash(order.reward_discount!)}</dd></div>}<div className="tracking-total"><dt>Total</dt><dd>{cash(order.total)}</dd></div></dl>{transaction?.paid_at && <p className="tracking-muted">Payment recorded {trackingDate(transaction.paid_at)}</p>}{transaction?.provider_payment_id && <p className="tracking-reference">Payment reference<br/>{transaction.provider_payment_id}</p>}{order.refund_status && <p className="tracking-muted">Refund: {order.refund_status.replace(/_/g,' ')}{order.refunded_at?` · ${trackingDate(order.refunded_at)}`:''}</p>}</section>
      <section className="tracking-help"><MessageCircle size={25}/><h2>A little help, if you need it.</h2><p>Include order #{order.order_number} when contacting CozyCraft Care.</p><Link to="/profile?tab=support">Contact support →</Link><Link to="/profile?tab=orders">Manage order & receipts →</Link></section>
    </aside></div>
  </main>;
}
