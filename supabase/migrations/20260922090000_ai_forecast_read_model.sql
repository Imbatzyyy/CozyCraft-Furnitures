-- No customer identifiers, addresses, or order graphs leave this read model.
create table private.forecast_input_cache (
  id boolean primary key default true check (id),
  expires_at timestamptz not null,
  payload jsonb not null
);
revoke all on private.forecast_input_cache from public, anon, authenticated;

create or replace function public.admin_forecast_inputs()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
  today date := (now() at time zone 'Asia/Manila')::date;
begin
  -- Gate on every request, including cache hits. Revoked, inactive and
  -- insufficiently verified staff sessions never receive cached analytics.
  if not private.is_staff() or not private.customer_mfa_satisfied() or not private.admin_mfa_satisfied() then
    raise exception 'Verified administrator session required' using errcode = '42501';
  end if;
  select payload into result from private.forecast_input_cache where id and expires_at > now()
    and payload->>'through' = (today-1)::text;
  if result is not null then return result; end if;
  perform pg_advisory_xact_lock(22092026, 1);
  select payload into result from private.forecast_input_cache where id and expires_at > now()
    and payload->>'through' = (today-1)::text;
  if result is not null then return result; end if;

  with eligible as materialized (
    select o.total, case when lower(o.payment_method)='cod' then h.delivered_at else t.paid_at end as settled_at
    from public.orders o
    left join public.payment_transactions t on t.order_id=o.id
    left join lateral (select min(changed_at) as delivered_at from public.order_status_history where order_id=o.id and status='delivered') h on true
    where o.payment_status='paid' and o.status<>'cancelled'
      and coalesce(o.refund_status,'') not in ('succeeded','demo_succeeded')
      and not exists(select 1 from public.payment_transactions tx where tx.order_id=o.id and not tx.livemode)
      and ((lower(o.payment_method)='cod' and o.status='delivered' and h.delivered_at is not null)
        or (lower(o.payment_method)<>'cod' and t.livemode and t.status='paid' and t.paid_at is not null))
  ), bounds as (
    select case when min(settled_at) is null then today else greatest(today-180,(min(settled_at) at time zone 'Asia/Manila')::date) end as start_day from eligible
  ), daily as (
    select (settled_at at time zone 'Asia/Manila')::date as date, sum(total) as sales, count(*) as orders
    from eligible where settled_at >= (today-180)::timestamp at time zone 'Asia/Manila'
      and settled_at < today::timestamp at time zone 'Asia/Manila'
    group by 1
  )
  select jsonb_build_object(
    'version',1,'generatedAt',now(),'through',today-1,'timezone','Asia/Manila',
    'basis','Retained settled sales by payment date; delivered paid COD uses its recorded delivery date. Cancelled, refunded and test-mode payments are excluded. Delivery charges and discounts remain in order totals.',
    'series',coalesce((select jsonb_agg(jsonb_build_object('date',d::date,'sales',coalesce(s.sales,0),'orders',coalesce(s.orders,0)) order by d)
      from bounds b cross join lateral generate_series(b.start_day::timestamp,(today-1)::timestamp,interval '1 day') d left join daily s on s.date=d::date),'[]'::jsonb),
    'excludedTestPayments',(select count(*) from public.payment_transactions where not livemode),
    'undatedSettlements',(select count(*) from public.orders o where payment_status='paid' and status<>'cancelled'
      and not exists(select 1 from public.payment_transactions t where t.order_id=o.id and not t.livemode)
      and ((lower(payment_method)='cod' and not exists(select 1 from public.order_status_history h where h.order_id=o.id and h.status='delivered'))
        or (lower(payment_method)<>'cod' and not exists(select 1 from public.payment_transactions t where t.order_id=o.id and t.livemode and t.paid_at is not null)))),
    'eligibleOrders',coalesce((select sum(orders) from daily),0)
  ) into result;
  insert into private.forecast_input_cache(id,expires_at,payload) values(true,now()+interval '15 minutes',result)
    on conflict(id) do update set expires_at=excluded.expires_at,payload=excluded.payload;
  return result;
end $$;
revoke all on function public.admin_forecast_inputs() from public, anon;
grant execute on function public.admin_forecast_inputs() to authenticated;

-- Existing reports now receive aggregates rather than full order/customer graphs.
-- These retain order-created-date reporting; forecasting uses settlement dates.
create or replace function public.admin_reports_summary(p_range text default 'This month')
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare start_at timestamptz; today date := (now() at time zone 'Asia/Manila')::date; result jsonb;
begin
  if not private.is_staff() or not private.customer_mfa_satisfied() or not private.admin_mfa_satisfied() then raise exception 'Verified administrator session required' using errcode='42501'; end if;
  if p_range not in ('This week','This month','Quarter') then raise exception 'Invalid report range'; end if;
  start_at := (case p_range when 'This week' then (today-6)::timestamp when 'Quarter' then date_trunc('quarter',today::timestamp) else date_trunc('month',today::timestamp) end) at time zone 'Asia/Manila';
  with period as materialized (select id,user_id,status,payment_status,total,created_at from public.orders where created_at>=start_at and created_at<=now()),
  paid as materialized (select * from period where payment_status='paid' and status<>'cancelled'),
  categories as (select coalesce(p.category,'Uncategorized') as category,sum(i.quantity*i.unit_price) as value from paid o join public.order_items i on i.order_id=o.id left join public.products p on p.id=i.product_id group by 1),
  sold as (select i.product_id,sum(i.quantity) as quantity from paid o join public.order_items i on i.order_id=o.id where i.product_id is not null group by 1)
  select jsonb_build_object('start',start_at,'generatedAt',now(),
    'grossSales',coalesce((select sum(total) from paid),0),'paidCount',(select count(*) from paid),'orderCount',(select count(*) from period),
    'fulfilled',(select count(*) from period where status='delivered'),'refundedValue',coalesce((select sum(total) from period where payment_status='refunded'),0),
    'cancelledCount',(select count(*) from period where status='cancelled'),
    'repeatCustomers',(select count(*) from (select user_id from public.orders where payment_status='paid' and status<>'cancelled' group by user_id having count(*)>1) r),
    'customerCount',(select count(*) from public.profiles where role='customer'),
    'categoryRevenue',coalesce((select jsonb_object_agg(category,value) from categories),'{}'::jsonb),
    'soldByProduct',coalesce((select jsonb_object_agg(product_id,quantity) from sold),'{}'::jsonb),
    'trendData',(select jsonb_agg(jsonb_build_object('label',to_char(d,'Mon DD'),'revenue',coalesce((select sum(total) from paid where (created_at at time zone 'Asia/Manila')::date=d::date),0)) order by d) from generate_series((start_at at time zone 'Asia/Manila')::date::timestamp,today::timestamp,interval '1 day') d)
  ) into result;
  return result;
end $$;
revoke all on function public.admin_reports_summary(text) from public,anon;
grant execute on function public.admin_reports_summary(text) to authenticated;

create or replace function public.admin_report_export(p_report text, p_range text, p_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare start_at timestamptz; today date := (now() at time zone 'Asia/Manila')::date; result jsonb;
begin
  if not private.is_staff() or not private.customer_mfa_satisfied() or not private.admin_mfa_satisfied() then raise exception 'Verified administrator session required' using errcode='42501'; end if;
  if p_range not in ('This week','This month','Quarter') or p_report not in ('Sales performance','Inventory velocity','Customer retention') or p_page<1 or p_page>200 then raise exception 'Invalid export request'; end if;
  start_at := (case p_range when 'This week' then (today-6)::timestamp when 'Quarter' then date_trunc('quarter',today::timestamp) else date_trunc('month',today::timestamp) end) at time zone 'Asia/Manila';
  if p_report='Sales performance' then
    select jsonb_build_object('headers',jsonb_build_array('Order','Status','Payment','Total','Created (UTC)'),
      'rows',coalesce(jsonb_agg(jsonb_build_array(order_number,status,payment_status,total,created_at) order by created_at,id),'[]'::jsonb)) into result
      from (select id,order_number,status,payment_status,total,created_at from public.orders where created_at>=start_at and created_at<=now() order by created_at,id limit 250 offset (p_page-1)*250) s;
  elsif p_report='Inventory velocity' then
    select jsonb_build_object('headers',jsonb_build_array('Product','Category','Stock','Status','Paid non-cancelled units in range'),
      'rows',coalesce(jsonb_agg(jsonb_build_array(name,category,stock_quantity,status,units) order by id),'[]'::jsonb)) into result
      from (select p.id,p.name,p.category,p.stock_quantity,p.status,coalesce((select sum(i.quantity) from public.order_items i join public.orders o on o.id=i.order_id where i.product_id=p.id and o.payment_status='paid' and o.status<>'cancelled' and o.created_at>=start_at and o.created_at<=now()),0) as units from public.products p order by p.id limit 250 offset (p_page-1)*250) s;
  else
    select jsonb_build_object('headers',jsonb_build_array('Customer','Email','Paid non-cancelled orders (all time)','Repeat customer'),
      'rows',coalesce(jsonb_agg(jsonb_build_array(name,email,paid_orders,case when paid_orders>1 then 'Yes' else 'No' end) order by id),'[]'::jsonb)) into result
      from (select p.id,coalesce(nullif(p.full_name,''),nullif(p.username,''),'Customer') as name,coalesce(p.email,'') as email,(select count(*) from public.orders o where o.user_id=p.id and o.payment_status='paid' and o.status<>'cancelled') as paid_orders from public.profiles p where p.role='customer' order by p.id limit 250 offset (p_page-1)*250) s;
  end if;
  return result;
end $$;
revoke all on function public.admin_report_export(text,text,integer) from public,anon;
grant execute on function public.admin_report_export(text,text,integer) to authenticated;
