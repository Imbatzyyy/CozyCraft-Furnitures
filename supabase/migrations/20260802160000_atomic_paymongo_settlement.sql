alter table public.payment_transactions
  add column if not exists last_synced_at timestamptz,
  add column if not exists provider_status text;

create or replace function public.settle_paymongo_order(
  p_order_id uuid,
  p_transaction_id uuid,
  p_provider_payment_id text,
  p_livemode boolean,
  p_raw_payload jsonb
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.orders%rowtype;
  v_transaction public.payment_transactions%rowtype;
  v_now timestamptz := now();
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  select * into v_transaction
  from public.payment_transactions
  where id = p_transaction_id and order_id = p_order_id
  for update;
  if not found then raise exception 'Payment transaction not found'; end if;

  if v_order.payment_status = 'paid' and v_transaction.status = 'paid' then
    return 'already_paid';
  end if;

  if v_order.status = 'cancelled' or v_order.payment_status <> 'pending' then
    raise exception 'Order is no longer eligible for payment settlement';
  end if;

  update public.payment_transactions
  set status = 'paid',
      provider_status = 'paid',
      provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
      paid_at = coalesce(paid_at, v_now),
      livemode = p_livemode,
      raw_payload = coalesce(p_raw_payload, '{}'::jsonb),
      last_synced_at = v_now,
      failure_reason = null,
      updated_at = v_now
  where id = p_transaction_id;

  update public.orders
  set payment_status = 'paid', status = 'processing'
  where id = p_order_id;

  return 'settled';
end;
$$;

revoke all on function public.settle_paymongo_order(uuid, uuid, text, boolean, jsonb)
from public, anon, authenticated;
grant execute on function public.settle_paymongo_order(uuid, uuid, text, boolean, jsonb)
to service_role;

create or replace function public.fail_paymongo_order(
  p_order_id uuid,
  p_reason text default 'PayMongo checkout creation failed'
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.orders%rowtype;
  v_transaction public.payment_transactions%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.payment_method = 'cod' then return; end if;

  select * into v_transaction
  from public.payment_transactions
  where order_id = p_order_id
  for update;

  if v_order.payment_status <> 'pending'
     or v_order.status = 'cancelled'
     or v_transaction.status = 'paid' then
    return;
  end if;

  update public.orders
  set status = 'cancelled', payment_status = 'failed'
  where id = p_order_id;

  update public.payment_transactions
  set status = case when lower(coalesce(p_reason, '')) like '%expired%' then 'expired' else 'failed' end,
      provider_status = case when lower(coalesce(p_reason, '')) like '%expired%' then 'expired' else provider_status end,
      failure_reason = left(coalesce(p_reason, ''), 500),
      last_synced_at = now(),
      updated_at = now()
  where order_id = p_order_id;
end;
$$;

revoke all on function public.fail_paymongo_order(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_paymongo_order(uuid, text) to service_role;
