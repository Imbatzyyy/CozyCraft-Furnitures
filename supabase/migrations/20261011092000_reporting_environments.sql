-- Add scoped reports without breaking older mobile RPC signatures.
create or replace function private.order_reporting_environment(p_order uuid,p_method text)
returns text language sql stable security invoker set search_path='' as $$
  select case when lower(p_method)='cod' then 'cod'
    when exists(select 1 from public.payment_transactions where order_id=p_order and not livemode) then 'test'
    when exists(select 1 from public.payment_transactions where order_id=p_order and livemode) then 'live'
    else 'unverified' end;
$$;
create or replace function private.reporting_order_matches(p_order uuid,p_method text,p_scope text)
returns boolean language sql stable security invoker set search_path='' as $$
  select p_scope='all' or (p_scope='test' and private.order_reporting_environment(p_order,p_method)='test')
    or (p_scope='live' and private.order_reporting_environment(p_order,p_method) in ('live','cod'));
$$;
revoke all on function private.order_reporting_environment(uuid,text),private.reporting_order_matches(uuid,text,text) from public,anon;
grant execute on function private.order_reporting_environment(uuid,text),private.reporting_order_matches(uuid,text,text) to authenticated,service_role;
-- Existing reports now receive aggregates rather than full order/customer graphs.
-- These retain order-created-date reporting; forecasting uses settlement dates.
create or replace function public.admin_reports_summary_scoped(p_range text default 'This month', p_scope text default 'live')
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare start_at timestamptz; today date := (now() at time zone 'Asia/Manila')::date; result jsonb;
begin
  if not private.is_staff() or not private.customer_mfa_satisfied() or not private.admin_mfa_satisfied() then raise exception 'Verified administrator session required' using errcode='42501'; end if;
  if p_scope not in ('live','test','all') then raise exception 'Invalid data scope'; end if;
  if p_range not in ('This week','This month','Quarter') then raise exception 'Invalid report range'; end if;
  start_at := (case p_range when 'This week' then (today-6)::timestamp when 'Quarter' then date_trunc('quarter',today::timestamp) else date_trunc('month',today::timestamp) end) at time zone 'Asia/Manila';
  with period as materialized (select id,user_id,status,payment_status,total,created_at from public.orders where private.reporting_order_matches(id,payment_method,p_scope) and created_at>=start_at and created_at<=now()),
  paid as materialized (select * from period where payment_status='paid' and status<>'cancelled'),
  categories as (select coalesce(p.category,'Uncategorized') as category,sum(i.quantity*i.unit_price) as value from paid o join public.order_items i on i.order_id=o.id left join public.products p on p.id=i.product_id group by 1),
  sold as (select i.product_id,sum(i.quantity) as quantity from paid o join public.order_items i on i.order_id=o.id where i.product_id is not null group by 1)
  select jsonb_build_object('start',start_at,'generatedAt',now(),'scope',p_scope,'basis','Paid non-cancelled orders by order-created date in Asia/Manila. COD is not automatically classified as test data.',
    'grossSales',coalesce((select sum(total) from paid),0),'paidCount',(select count(*) from paid),'orderCount',(select count(*) from period),
    'fulfilled',(select count(*) from period where status='delivered'),'refundedValue',coalesce((select sum(total) from period where payment_status='refunded'),0),
    'cancelledCount',(select count(*) from period where status='cancelled'),
    'repeatCustomers',(select count(*) from (select user_id from public.orders where private.reporting_order_matches(id,payment_method,p_scope) and payment_status='paid' and status<>'cancelled' group by user_id having count(*)>1) r),
    'customerCount',(select count(*) from public.profiles where role='customer'),
    'categoryRevenue',coalesce((select jsonb_object_agg(category,value) from categories),'{}'::jsonb),
    'soldByProduct',coalesce((select jsonb_object_agg(product_id,quantity) from sold),'{}'::jsonb),
    'trendData',(select jsonb_agg(jsonb_build_object('label',to_char(d,'Mon DD'),'revenue',coalesce((select sum(total) from paid where (created_at at time zone 'Asia/Manila')::date=d::date),0)) order by d) from generate_series((start_at at time zone 'Asia/Manila')::date::timestamp,today::timestamp,interval '1 day') d)
  ) into result;
  return result;
end $$;
revoke all on function public.admin_reports_summary_scoped(text,text) from public,anon;
grant execute on function public.admin_reports_summary_scoped(text,text) to authenticated;

create or replace function public.admin_report_export_scoped(p_report text, p_range text, p_page integer default 1, p_scope text default 'live')
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare start_at timestamptz; today date := (now() at time zone 'Asia/Manila')::date; result jsonb;
begin
  if not private.is_staff() or not private.customer_mfa_satisfied() or not private.admin_mfa_satisfied() then raise exception 'Verified administrator session required' using errcode='42501'; end if;
  if p_scope not in ('live','test','all') then raise exception 'Invalid data scope'; end if;
  if p_range not in ('This week','This month','Quarter') or p_report not in ('Sales performance','Inventory velocity','Customer retention') or p_page<1 or p_page>200 then raise exception 'Invalid export request'; end if;
  start_at := (case p_range when 'This week' then (today-6)::timestamp when 'Quarter' then date_trunc('quarter',today::timestamp) else date_trunc('month',today::timestamp) end) at time zone 'Asia/Manila';
  if p_report='Sales performance' then
    select jsonb_build_object('headers',jsonb_build_array('Order','Status','Payment','Total','Created (UTC)','Environment'),
      'rows',coalesce(jsonb_agg(jsonb_build_array(order_number,status,payment_status,total,created_at,private.order_reporting_environment(id,payment_method)) order by created_at,id),'[]'::jsonb)) into result
      from (select id,order_number,status,payment_status,total,created_at,payment_method from public.orders where private.reporting_order_matches(id,payment_method,p_scope) and created_at>=start_at and created_at<=now() order by created_at,id limit 250 offset (p_page-1)*250) s;
  elsif p_report='Inventory velocity' then
    select jsonb_build_object('headers',jsonb_build_array('Product','Category','Stock','Status','Paid non-cancelled units in range'),
      'rows',coalesce(jsonb_agg(jsonb_build_array(name,category,stock_quantity,status,units) order by id),'[]'::jsonb)) into result
      from (select p.id,p.name,p.category,p.stock_quantity,p.status,coalesce((select sum(i.quantity) from public.order_items i join public.orders o on o.id=i.order_id where private.reporting_order_matches(o.id,o.payment_method,p_scope) and i.product_id=p.id and o.payment_status='paid' and o.status<>'cancelled' and o.created_at>=start_at and o.created_at<=now()),0) as units from public.products p order by p.id limit 250 offset (p_page-1)*250) s;
  else
    select jsonb_build_object('headers',jsonb_build_array('Customer','Email','Paid non-cancelled orders (all time)','Repeat customer'),
      'rows',coalesce(jsonb_agg(jsonb_build_array(name,email,paid_orders,case when paid_orders>1 then 'Yes' else 'No' end) order by id),'[]'::jsonb)) into result
      from (select p.id,coalesce(nullif(p.full_name,''),nullif(p.username,''),'Customer') as name,coalesce(p.email,'') as email,(select count(*) from public.orders o where private.reporting_order_matches(o.id,o.payment_method,p_scope) and o.user_id=p.id and o.payment_status='paid' and o.status<>'cancelled') as paid_orders from public.profiles p where p.role='customer' order by p.id limit 250 offset (p_page-1)*250) s;
  end if;
  return result;
end $$;
revoke all on function public.admin_report_export_scoped(text,text,integer,text) from public,anon;
grant execute on function public.admin_report_export_scoped(text,text,integer,text) to authenticated;

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
    'excludedTestPaidOrders',(select count(*) from public.orders where payment_status='paid' and private.order_reporting_environment(id,payment_method)='test'),
    'paymentAnomalies',(select count(*) from public.orders where lower(payment_method) in ('card','gcash') and payment_status='pending' and status in ('processing','packed','shipped','delivered')),
    'sales', (select coalesce(sum(total),0) from public.orders where private.reporting_order_matches(id,payment_method,'live') and payment_status = 'paid' and status <> 'cancelled'),
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
    'salesData', (select jsonb_agg(jsonb_build_object('m',to_char(m,'Mon'),'v',coalesce((select sum(o.total) from public.orders o where private.reporting_order_matches(o.id,o.payment_method,'live') and o.payment_status='paid' and o.status<>'cancelled' and o.created_at >= m at time zone 'Asia/Manila' and o.created_at < (m+interval '1 month') at time zone 'Asia/Manila'),0)) order by m)
      from dates, lateral generate_series(month_start-interval '6 months',month_start,interval '1 month') m),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'order_number',o.order_number,'status',o.status,'total',o.total,'shipping_address',jsonb_build_object('name',o.shipping_address->>'name')) order by o.created_at desc,o.id),'[]'::jsonb) from (select id,order_number,status,total,shipping_address,created_at from public.orders order by created_at desc,id limit 5) o)
  ) into result;
  return result;
end $$;
revoke all on function public.admin_overview_snapshot() from public, anon;
grant execute on function public.admin_overview_snapshot() to authenticated;


-- Existing callers get safe, explicitly non-PayMongo-test financial totals.
create or replace function public.admin_reports_summary(p_range text default 'This month')
returns jsonb language sql stable security invoker set search_path='' as $$select public.admin_reports_summary_scoped(p_range,'live')$$;
create or replace function public.admin_report_export(p_report text,p_range text,p_page integer default 1)
returns jsonb language sql stable security invoker set search_path='' as $$select public.admin_report_export_scoped(p_report,p_range,p_page,'live')$$;
notify pgrst,'reload schema';
