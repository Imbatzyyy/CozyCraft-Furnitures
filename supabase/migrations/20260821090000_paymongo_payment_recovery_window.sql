-- Keep abandoned PayMongo checkouts recoverable for a short, server-timed
-- window.  The browser only renders the countdown; PostgreSQL remains the
-- source of truth so the same deadline is visible on every signed-in device.

alter table public.orders
  add column if not exists payment_expires_at timestamptz;

alter table public.payment_transactions
  add column if not exists expires_at timestamptz;

update public.payment_transactions
set expires_at = created_at + interval '15 minutes'
where status = 'pending' and expires_at is null;

update public.orders as orders
set payment_expires_at = transactions.expires_at
from public.payment_transactions as transactions
where transactions.order_id = orders.id
  and transactions.status = 'pending'
  and orders.payment_status = 'pending'
  and orders.payment_method in ('card', 'gcash')
  and orders.payment_expires_at is null;

create index if not exists orders_pending_payment_expiry_idx
  on public.orders(payment_expires_at)
  where payment_status = 'pending'
    and payment_method in ('card', 'gcash')
    and status <> 'cancelled';

create index if not exists payment_transactions_pending_expiry_idx
  on public.payment_transactions(expires_at)
  where status = 'pending';

create or replace function public.expire_paymongo_order(
  p_order_id uuid,
  p_reason text default 'PayMongo payment window expired'
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.orders%rowtype;
  v_transaction public.payment_transactions%rowtype;
  v_now timestamptz := now();
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found
     or v_order.payment_method not in ('card', 'gcash')
     or v_order.payment_status <> 'pending'
     or v_order.status = 'cancelled'
     or v_order.payment_expires_at is null
     or v_order.payment_expires_at > v_now then
    return false;
  end if;

  select * into v_transaction
  from public.payment_transactions
  where order_id = p_order_id
  for update;

  if found and v_transaction.status = 'paid' then
    return false;
  end if;

  update public.orders
  set status = 'cancelled',
      payment_status = 'failed',
      payment_expires_at = null,
      cancellation_reason = coalesce(nullif(left(trim(p_reason), 500), ''), 'PayMongo payment window expired'),
      updated_at = v_now
  where id = p_order_id;

  update public.payment_transactions
  set status = 'expired',
      provider_status = 'expired',
      failure_reason = coalesce(nullif(left(trim(p_reason), 500), ''), 'PayMongo payment window expired'),
      expires_at = coalesce(expires_at, v_now),
      last_synced_at = v_now,
      updated_at = v_now
  where order_id = p_order_id and status <> 'paid';

  return true;
end;
$$;

revoke all on function public.expire_paymongo_order(uuid, text)
from public, anon, authenticated;
grant execute on function public.expire_paymongo_order(uuid, text)
to service_role;

create or replace function private.expire_stale_paymongo_orders()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order record;
  v_expired integer := 0;
begin
  for v_order in
    select id
    from public.orders
    where payment_method in ('card', 'gcash')
      and payment_status = 'pending'
      and status <> 'cancelled'
      and payment_expires_at <= now()
    order by payment_expires_at
    limit 250
  loop
    if public.expire_paymongo_order(v_order.id, 'PayMongo payment window expired') then
      v_expired := v_expired + 1;
    end if;
  end loop;
  return v_expired;
end;
$$;

revoke all on function private.expire_stale_paymongo_orders()
from public, anon, authenticated;

-- One lightweight server-side cleanup replaces client polling.  Orders and
-- inventory are updated once, then existing Realtime subscriptions deliver
-- that single change to any open customer/admin screen.
do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'cozycraft-expire-paymongo-windows';

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'cozycraft-expire-paymongo-windows',
    '* * * * *',
    'select private.expire_stale_paymongo_orders()'
  );
end
$$;
