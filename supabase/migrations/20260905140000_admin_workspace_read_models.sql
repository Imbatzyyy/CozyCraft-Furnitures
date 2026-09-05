-- Caller permissions and the existing restrictive MFA/session policies apply.
-- No customer data is made public and no SECURITY DEFINER read bypass is used.
create or replace function public.admin_overview_snapshot()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if not private.is_staff() or not private.customer_mfa_satisfied() or not private.admin_mfa_satisfied() then
    raise exception 'Verified administrator session required' using errcode = '42501';
  end if;
  with dates as (
    select date_trunc('month', now() at time zone 'Asia/Manila') as month_start
  ), monthly as (
    select o.* from public.orders o, dates d
    where o.created_at >= d.month_start at time zone 'Asia/Manila'
  )
  select jsonb_build_object(
    'sales', (select coalesce(sum(total),0) from public.orders where payment_status = 'paid' and status <> 'cancelled'),
    'monthCount', (select count(*) from monthly),
    'pending', (select count(*) from public.orders where status = 'pending'),
    'lowStock', (select count(*) from public.products where status = 'active' and stock_quantity <= coalesce((select low_stock_threshold from public.store_settings where id=true),8)),
    'fulfillment', (select count(*) from public.orders where status not in ('delivered','cancelled') and cancellation_status is distinct from 'pending' and (lower(payment_method) = 'cod' or payment_status = 'paid')),
    'cancellations', (select count(*) from public.orders where cancellation_status = 'pending'),
    'refunds', (select count(*) from public.orders where refund_status = 'failed'),
    'support', (select count(*) from public.support_tickets where status not in ('resolved','closed') and priority in ('high','urgent')),
    'statuses', jsonb_build_object(
      'delivered', (select count(*) from monthly where status = 'delivered'),
      'processing', (select count(*) from monthly where status in ('processing','packed','shipped')),
      'pending', (select count(*) from monthly where status = 'pending'),
      'cancelled', (select count(*) from monthly where status = 'cancelled')),
    'salesData', (select jsonb_agg(jsonb_build_object('m',to_char(m,'Mon'),'v',coalesce((select sum(o.total) from public.orders o where o.payment_status='paid' and o.status<>'cancelled' and o.created_at >= m at time zone 'Asia/Manila' and o.created_at < (m+interval '1 month') at time zone 'Asia/Manila'),0)) order by m)
      from dates, lateral generate_series(month_start-interval '6 months',month_start,interval '1 month') m),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'order_number',o.order_number,'status',o.status,'total',o.total,'shipping_address',jsonb_build_object('name',o.shipping_address->>'name')) order by o.created_at desc,o.id),'[]'::jsonb) from (select id,order_number,status,total,shipping_address,created_at from public.orders order by created_at desc,id limit 5) o)
  ) into result;
  return result;
end $$;
revoke all on function public.admin_overview_snapshot() from public, anon;
grant execute on function public.admin_overview_snapshot() to authenticated;

create or replace function public.admin_order_queue(p_filters jsonb default '{}'::jsonb, p_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb; day_start timestamptz := date_trunc('day',now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';
begin
  if not private.is_staff() or not private.customer_mfa_satisfied() or not private.admin_mfa_satisfied() then
    raise exception 'Verified administrator session required' using errcode = '42501';
  end if;
  if p_page < 1 or p_page > 100000 then raise exception 'Invalid page'; end if;
  with filtered as materialized (
    select o.* from public.orders o
    left join public.profiles p on p.id=o.user_id
    where (coalesce(p_filters->>'status','all')='all' or o.status::text=p_filters->>'status')
      and (coalesce(p_filters->>'paymentStatus','all')='all' or o.payment_status::text=p_filters->>'paymentStatus')
      and (coalesce(p_filters->>'paymentMethod','all')='all' or lower(o.payment_method)=lower(p_filters->>'paymentMethod'))
      and (coalesce(p_filters->>'dateRange','today')='all' or (o.created_at < day_start+interval '1 day' and o.created_at >= day_start - case p_filters->>'dateRange' when 'last_7_days' then interval '6 days' when 'last_30_days' then interval '29 days' else interval '0 days' end))
      and case coalesce(p_filters->>'view','all')
        when 'needs_fulfillment' then o.status not in ('delivered','cancelled') and o.cancellation_status is distinct from 'pending' and (lower(o.payment_method)='cod' or o.payment_status='paid')
        when 'awaiting_payment' then o.status='pending' and lower(o.payment_method)<>'cod' and o.payment_status='pending'
        when 'cancellation_requests' then o.cancellation_status='pending'
        when 'refund_attention' then o.refund_status='failed'
        when 'returns' then exists(select 1 from public.return_requests r where r.order_id=o.id)
        when 'delivered' then o.status='delivered'
        else true end
      and (coalesce(trim(p_filters->>'query'),'')='' or strpos(lower(concat_ws(' ',o.order_number,o.id,o.status,o.payment_status,o.payment_method,o.shipping_address->>'name',o.shipping_address->>'email',o.shipping_address->>'mobile',p.full_name,p.email,p.phone,(select string_agg(i.product_name,' ') from public.order_items i where i.order_id=o.id))),lower(trim(p_filters->>'query')))>0)
  ), page as (
    select f.* from filtered f order by
      case when p_filters->>'sort'='highest_total' then f.total end desc,
      case when p_filters->>'sort'='newest' then f.created_at end desc,
      f.created_at asc, f.id asc
    limit 5 offset ((p_page-1)*5)
  ), graphs as (
    select o.created_at, o.id, o.total, to_jsonb(o) || jsonb_build_object(
      'order_items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'product_id',i.product_id,'product_name',i.product_name,'quantity',i.quantity,'unit_price',i.unit_price,'image_url',i.image_url) order by i.id) from public.order_items i where i.order_id=o.id),'[]'::jsonb),
      'order_status_history',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'order_id',h.order_id,'status',h.status,'changed_at',h.changed_at,'changed_by',h.changed_by) order by h.changed_at) from public.order_status_history h where h.order_id=o.id),'[]'::jsonb),
      'payment_transactions',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'order_id',t.order_id,'provider',t.provider,'provider_session_id',t.provider_session_id,'provider_payment_id',t.provider_payment_id,'status',t.status,'amount',t.amount,'currency',t.currency,'livemode',t.livemode,'failure_reason',t.failure_reason,'paid_at',t.paid_at,'expires_at',t.expires_at,'created_at',t.created_at,'updated_at',t.updated_at) order by t.created_at desc) from public.payment_transactions t where t.order_id=o.id),'[]'::jsonb),
      'profiles',(select jsonb_build_object('full_name',p.full_name,'email',p.email,'phone',p.phone) from public.profiles p where p.id=o.user_id)
    ) as item from page o
  )
  select jsonb_build_object(
    'orders',coalesce((select jsonb_agg(item order by case when p_filters->>'sort'='highest_total' then total end desc,case when p_filters->>'sort'='newest' then created_at end desc,created_at asc,id asc) from graphs),'[]'::jsonb),
    'total',(select count(*) from filtered),
    'allCount',(select count(*) from public.orders),
    'today',(select count(*) from public.orders where created_at>=day_start and created_at<day_start+interval '1 day'),
    'fulfillment',(select count(*) from public.orders where status not in ('delivered','cancelled') and cancellation_status is distinct from 'pending' and (lower(payment_method)='cod' or payment_status='paid')),
    'awaiting',(select count(*) from public.orders where status='pending' and lower(payment_method)<>'cod' and payment_status='pending'),
    'attention',(select count(*) filter(where cancellation_status='pending') + count(*) filter(where refund_status='failed') from public.orders),
    'paymentMethods',(select coalesce(jsonb_agg(m order by m),'[]'::jsonb) from (select distinct lower(payment_method) m from public.orders) methods)
  ) into result;
  return result;
end $$;
revoke all on function public.admin_order_queue(jsonb,integer) from public, anon;
grant execute on function public.admin_order_queue(jsonb,integer) to authenticated;
notify pgrst, 'reload schema';
