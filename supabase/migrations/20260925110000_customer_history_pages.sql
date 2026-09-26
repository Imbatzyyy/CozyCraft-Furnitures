-- Owner-bound, bounded history. A direct tracking/payment link may include
-- one extra focused order, never another customer's order.
create or replace function public.customer_order_page(p_status text default 'all', p_page integer default 1, p_focus uuid default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb; owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if p_page is null or p_page<1 or p_page>100000 or p_status not in ('all','pending','processing','packed','shipped','delivered','cancelled') then raise exception 'Invalid page'; end if;
  with owned as materialized (
    select o.id,o.order_number,o.user_id,o.status,o.updated_at,o.payment_method,o.payment_status,o.payment_expires_at,
      o.cancellation_reason,o.cancellation_requested_at,o.cancellation_status,o.cancellation_reviewed_at,o.cancellation_decision_note,
      o.refund_status,o.refunded_at,o.subtotal,o.delivery_fee,o.reward_discount,o.total,o.shipping_address,o.created_at
    from public.orders o where o.user_id=owner_id
  ), page as materialized (
    select * from owned where p_status='all' or status::text=p_status order by created_at desc,id desc limit 5 offset (p_page-1)*5
  ), selected as (
    select * from page union all select * from owned where id=p_focus and id not in (select id from page)
  ), graphs as (
    select o.id,o.created_at,to_jsonb(o)||jsonb_build_object(
      'order_items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'product_id',i.product_id,'product_name',i.product_name,'unit_price',i.unit_price,'quantity',i.quantity,'image_url',i.image_url) order by i.id) from public.order_items i where i.order_id=o.id),'[]'::jsonb),
      'order_status_history',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'order_id',h.order_id,'status',h.status,'changed_at',h.changed_at,'changed_by',h.changed_by) order by h.changed_at,h.id) from public.order_status_history h where h.order_id=o.id),'[]'::jsonb),
      'payment_transactions',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'order_id',t.order_id,'provider',t.provider,'provider_session_id',t.provider_session_id,'provider_payment_id',t.provider_payment_id,'status',t.status,'amount',t.amount,'currency',t.currency,'livemode',t.livemode,'failure_reason',t.failure_reason,'paid_at',t.paid_at,'expires_at',t.expires_at,'created_at',t.created_at,'updated_at',t.updated_at) order by t.created_at desc,t.id) from public.payment_transactions t where t.order_id=o.id),'[]'::jsonb)
    ) item from selected o
  ) select jsonb_build_object(
    'orders',coalesce((select jsonb_agg(item order by created_at desc,id desc) from graphs),'[]'::jsonb),
    'ids',coalesce((select jsonb_agg(id order by created_at desc,id desc) from page),'[]'::jsonb),
    'total',(select count(*) from owned where p_status='all' or status::text=p_status),
    'counts',jsonb_build_object('all',(select count(*) from owned))||coalesce((select jsonb_object_agg(status,n) from (select status,count(*) n from owned group by status) counts),'{}'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.customer_order_page(text,integer,uuid) from public,anon;
grant execute on function public.customer_order_page(text,integer,uuid) to authenticated;
create or replace function public.current_product_review_context(p_product_id text)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'purchased',exists(select 1 from public.order_items i join public.orders o on o.id=i.order_id where o.user_id=auth.uid() and o.status='delivered' and i.product_id=p_product_id),
    'review',(select jsonb_build_object('rating',r.rating,'title',r.title,'body',r.body) from public.reviews r where r.user_id=auth.uid() and r.product_id=p_product_id order by r.created_at desc,r.id desc limit 1))
$$;
revoke all on function public.current_product_review_context(text) from public,anon;
grant execute on function public.current_product_review_context(text) to authenticated;
create index if not exists orders_owner_history_idx on public.orders(user_id,created_at desc,id desc);
create index if not exists support_owner_history_idx on public.support_tickets(user_id,created_at desc,id desc);
notify pgrst,'reload schema';
