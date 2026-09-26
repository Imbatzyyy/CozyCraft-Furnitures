create or replace function public.admin_payment_page(p_page integer default 1,p_size integer default 20,p_before timestamptz default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; cutoff timestamptz:=coalesce(p_before,now());
begin
  if not private.is_staff() or not private.customer_mfa_satisfied() or not private.admin_mfa_satisfied() then raise exception 'Verified administrator session required' using errcode='42501'; end if;
  if p_page is null or p_page<1 or p_page>100000 or p_size is null or p_size not in (20,250) then raise exception 'Invalid page'; end if;
  with eligible as materialized (
    select id,order_number,payment_method,payment_status,status,total,created_at,jsonb_build_object('name',shipping_address->>'name') shipping_address
    from public.orders where created_at<=cutoff
  ), page as (select * from eligible order by created_at desc,id desc limit p_size offset (p_page-1)*p_size)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc,id desc) from page p),'[]'::jsonb),
    'total',(select count(*) from eligible),'collected',(select coalesce(sum(total),0) from eligible where payment_status='paid'),
    'paidCount',(select count(*) from eligible where payment_status='paid'),'asOf',cutoff) into result;
  return result;
end $$;

create or replace function public.admin_operations_snapshot()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if not private.is_staff() or not private.customer_mfa_satisfied() or not private.admin_mfa_satisfied() then raise exception 'Verified administrator session required' using errcode='42501'; end if;
  select jsonb_build_object(
    'failedPayments',(select count(*) from public.orders where payment_status='failed'),
    'failedRefunds',(select count(*) from public.orders where refund_status='failed'),
    'overdueFulfillment',(select count(*) from public.orders where status in ('pending','processing','packed') and created_at<now()-interval '48 hours'),
    'priorityTickets',(select count(*) from public.support_tickets where status not in ('resolved','closed') and priority in ('high','urgent')),
    'outOfStockProducts',(select count(*) from public.products where status<>'inactive' and stock_quantity=0),
    'recentClientErrors',(select count(*) from public.client_error_events where created_at>=now()-interval '24 hours'),
    'errors',coalesce((select jsonb_agg(to_jsonb(e) order by created_at desc,id desc) from (select id,message,path,created_at from public.client_error_events where created_at>=now()-interval '24 hours' order by created_at desc,id desc limit 30) e),'[]'::jsonb),
    'generatedAt',now()) into result;
  return result;
end $$;
revoke all on function public.admin_payment_page(integer,integer,timestamptz) from public,anon;
revoke all on function public.admin_operations_snapshot() from public,anon;
grant execute on function public.admin_payment_page(integer,integer,timestamptz) to authenticated;
grant execute on function public.admin_operations_snapshot() to authenticated;
notify pgrst,'reload schema';
