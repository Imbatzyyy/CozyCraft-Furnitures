-- Bounded real-data forecasting; no changes to orders or payment records.
create or replace function public.admin_forecast_inputs()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; today date := (now() at time zone 'Asia/Manila')::date;
begin
  if not private.is_staff() or not private.customer_mfa_satisfied() or not private.admin_mfa_satisfied() then
    raise exception 'Verified administrator session required' using errcode = '42501';
  end if;
  select payload into result from private.forecast_input_cache where id and expires_at > now()
    and payload->>'through' = (today-1)::text and payload->>'version'='2';
  if result is not null then return result; end if;
  perform pg_advisory_xact_lock(22092026, 1);
  select payload into result from private.forecast_input_cache where id and expires_at > now()
    and payload->>'through' = (today-1)::text and payload->>'version'='2';
  if result is not null then return result; end if;

  with source as materialized (
    select o.id,o.total,o.status,o.payment_status,o.refund_status,
      case when lower(o.payment_method)='cod' then h.delivered_at else t.paid_at end as settled_at,
      o.payment_status='paid' and o.status<>'cancelled'
        and coalesce(o.refund_status,'') not in ('succeeded','demo_succeeded')
        and not exists(select 1 from public.payment_transactions tx where tx.order_id=o.id and not tx.livemode)
        and ((lower(o.payment_method)='cod' and o.status='delivered') or (lower(o.payment_method)<>'cod' and t.paid_at is not null)) as retained,
      o.total is not null and o.total>=0 and o.total<'Infinity'::numeric as valid_amount
    from public.orders o
    left join lateral (select min(paid_at) as paid_at from public.payment_transactions where order_id=o.id and livemode and status='paid') t on true
    left join lateral (select min(changed_at) as delivered_at from public.order_status_history where order_id=o.id and status='delivered') h on true
  ), eligible as materialized (
    select * from source where retained and valid_amount and settled_at is not null
      and settled_at < today::timestamp at time zone 'Asia/Manila'
  ), bounds as (
    select case when min(settled_at) is null then today else greatest(today-180,(min(settled_at) at time zone 'Asia/Manila')::date) end as start_day from eligible
  ), daily as (
    select (settled_at at time zone 'Asia/Manila')::date as date,sum(total) as sales,count(*) as orders
    from eligible where settled_at >= (today-180)::timestamp at time zone 'Asia/Manila' group by 1
  )
  select jsonb_build_object(
    'version',2,'generatedAt',now(),'through',today-1,'timezone','Asia/Manila',
    'basis','Actual retained settlements by payment date; paid delivered COD uses its recorded delivery date. Test-mode, unpaid, cancelled, refunded, undated, future and invalid-amount records are excluded. Today is incomplete and excluded. Order totals include delivery charges and discounts.',
    'series',coalesce((select jsonb_agg(jsonb_build_object('date',d::date,'sales',coalesce(s.sales,0),'orders',coalesce(s.orders,0)) order by d)
      from bounds b cross join lateral generate_series(b.start_day::timestamp,(today-1)::timestamp,interval '1 day') d left join daily s on s.date=d::date),'[]'::jsonb),
    'historyStart',(select case when start_day<today then start_day else null end from bounds),
    'lastSettlementAt',(select max(settled_at) from eligible),
    'eligibleOrders',coalesce((select sum(orders) from daily),0),
    'excludedTestPayments',(select count(*) from public.payment_transactions where not livemode),
    'undatedSettlements',(select count(*) from public.orders o where payment_status='paid' and status<>'cancelled'
      and coalesce(refund_status,'') not in ('succeeded','demo_succeeded')
      and not exists(select 1 from public.payment_transactions t where t.order_id=o.id and not t.livemode)
      and ((lower(payment_method)='cod' and status='delivered' and not exists(select 1 from public.order_status_history h where h.order_id=o.id and h.status='delivered' and h.changed_at is not null))
        or (lower(payment_method)<>'cod' and not exists(select 1 from public.payment_transactions t where t.order_id=o.id and t.livemode and t.status='paid' and t.paid_at is not null)))),
    'sourceCounts',(select jsonb_build_object('recordedOrders',count(*),'unpaidOrders',count(*) filter(where payment_status not in ('paid','refunded')),
      'cancelledOrders',count(*) filter(where status='cancelled'),'refundedOrders',count(*) filter(where payment_status='refunded' or refund_status in ('succeeded','demo_succeeded')),
      'invalidAmounts',count(*) filter(where not valid_amount)) from source)
  ) into result;
  insert into private.forecast_input_cache(id,expires_at,payload) values(true,now()+interval '15 minutes',result)
    on conflict(id) do update set expires_at=excluded.expires_at,payload=excluded.payload;
  return result;
end $$;
revoke all on function public.admin_forecast_inputs() from public,anon;
grant execute on function public.admin_forecast_inputs() to authenticated;

-- Invalidation changes no customer data and sends no order graphs to clients.
-- Statement triggers avoid per-order cache work for bulk operations.
create or replace function private.invalidate_forecast_input_cache()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(22092026, 1);
  delete from private.forecast_input_cache where id;
  return null;
end $$;
revoke all on function private.invalidate_forecast_input_cache() from public,anon,authenticated;
create trigger forecast_orders_changed after insert or delete or update of total,payment_method,payment_status,status,refund_status
  on public.orders for each statement execute function private.invalidate_forecast_input_cache();
create trigger forecast_payments_changed after insert or delete or update of order_id,livemode,status,paid_at
  on public.payment_transactions for each statement execute function private.invalidate_forecast_input_cache();
create trigger forecast_delivery_history_changed after insert or delete or update of order_id,status,changed_at
  on public.order_status_history for each statement execute function private.invalidate_forecast_input_cache();
delete from private.forecast_input_cache where id;
