-- PayMongo Checkout Sessions remain payable indefinitely until the merchant
-- explicitly expires them. Never cancel a CozyCraft order or release its
-- reserved stock until PayMongo has confirmed that the hosted session is
-- either paid or expired.

create extension if not exists pg_net with schema extensions;

-- Persist the provider session and its customer-visible deadline in one
-- database transaction. The order row lock serializes two browser retries
-- that use the same checkout key. Combined with PayMongo's Idempotency-Key,
-- both requests resolve to the same hosted checkout instead of allowing the
-- losing insert to cancel the valid reserved order.
create or replace function public.register_paymongo_checkout(
  p_order_id uuid,
  p_provider_session_id text,
  p_checkout_url text,
  p_amount numeric,
  p_livemode boolean,
  p_raw_payload jsonb,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.orders%rowtype;
  v_transaction public.payment_transactions%rowtype;
  v_created boolean := false;
  v_now timestamptz := now();
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Reserved order not found';
  end if;
  if v_order.payment_method not in ('card', 'gcash')
     or v_order.payment_status <> 'pending'
     or v_order.status <> 'pending' then
    raise exception 'Reserved order is no longer eligible for online payment';
  end if;
  if p_provider_session_id is null or btrim(p_provider_session_id) = ''
     or p_checkout_url is null or btrim(p_checkout_url) = '' then
    raise exception 'PayMongo checkout session is incomplete';
  end if;
  if p_amount is null or abs(p_amount - v_order.total) > 0.01 then
    raise exception 'PayMongo checkout amount does not match the reserved order';
  end if;
  if p_expires_at is null
     or p_expires_at <= v_now
     or p_expires_at > v_now + interval '20 minutes' then
    raise exception 'PayMongo checkout deadline is invalid';
  end if;

  insert into public.payment_transactions (
    order_id,
    provider_session_id,
    checkout_url,
    status,
    amount,
    livemode,
    raw_payload,
    expires_at,
    provider_status,
    last_synced_at
  ) values (
    p_order_id,
    p_provider_session_id,
    p_checkout_url,
    'pending',
    p_amount,
    coalesce(p_livemode, false),
    coalesce(p_raw_payload, '{}'::jsonb),
    p_expires_at,
    'active',
    v_now
  )
  on conflict (order_id) do nothing
  returning * into v_transaction;

  v_created := found;
  if not v_created then
    select * into v_transaction
    from public.payment_transactions
    where order_id = p_order_id
    for update;
  end if;

  if not found then
    raise exception 'PayMongo checkout session could not be persisted';
  end if;
  if v_transaction.status = 'paid' then
    return jsonb_build_object(
      'transactionId', v_transaction.id,
      'providerSessionId', v_transaction.provider_session_id,
      'checkoutUrl', v_transaction.checkout_url,
      'status', v_transaction.status,
      'expiresAt', v_transaction.expires_at,
      'created', false
    );
  end if;
  if v_transaction.status <> 'pending'
     or v_transaction.provider_session_id is distinct from p_provider_session_id then
    raise exception 'A different PayMongo checkout is already registered for this order';
  end if;

  -- A prior response may have been lost after the insert committed. Fill any
  -- missing details but preserve the original server deadline.
  update public.payment_transactions
  set checkout_url = coalesce(checkout_url, p_checkout_url),
      expires_at = coalesce(expires_at, p_expires_at),
      raw_payload = case
        when raw_payload = '{}'::jsonb then coalesce(p_raw_payload, '{}'::jsonb)
        else raw_payload
      end,
      updated_at = case
        when checkout_url is null or expires_at is null then v_now
        else updated_at
      end
  where id = v_transaction.id
  returning * into v_transaction;

  update public.orders
  set payment_expires_at = v_transaction.expires_at,
      updated_at = v_now
  where id = p_order_id
    and payment_status = 'pending'
    and status <> 'cancelled';

  return jsonb_build_object(
    'transactionId', v_transaction.id,
    'providerSessionId', v_transaction.provider_session_id,
    'checkoutUrl', v_transaction.checkout_url,
    'status', v_transaction.status,
    'expiresAt', v_transaction.expires_at,
    'created', v_created
  );
end;
$$;

revoke all on function public.register_paymongo_checkout(
  uuid, text, text, numeric, boolean, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.register_paymongo_checkout(
  uuid, text, text, numeric, boolean, jsonb, timestamptz
) to service_role;

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
     or v_order.status <> 'pending'
     or v_order.payment_expires_at is null then
    return false;
  end if;

  select * into v_transaction
  from public.payment_transactions
  where order_id = p_order_id
  for update;

  -- This value is written only after the expiry worker has read an `expired`
  -- status back from PayMongo. The old database-only cleanup job therefore
  -- becomes harmless even during a rolling deployment.
  if not found
     or v_transaction.status = 'paid'
     or v_transaction.provider_status is distinct from 'expired' then
    return false;
  end if;

  update public.orders
  set status = 'cancelled',
      payment_status = 'failed',
      payment_expires_at = null,
      cancellation_reason = coalesce(
        nullif(left(trim(p_reason), 500), ''),
        'PayMongo payment window expired'
      ),
      updated_at = v_now
  where id = p_order_id;

  update public.payment_transactions
  set status = 'expired',
      provider_status = 'expired',
      failure_reason = coalesce(
        nullif(left(trim(p_reason), 500), ''),
        'PayMongo payment window expired'
      ),
      expires_at = coalesce(expires_at, v_now),
      last_synced_at = v_now,
      updated_at = v_now
  where id = v_transaction.id and status <> 'paid';

  return true;
end;
$$;

revoke all on function public.expire_paymongo_order(uuid, text)
from public, anon, authenticated;
grant execute on function public.expire_paymongo_order(uuid, text)
to service_role;

create or replace function public.claim_expired_paymongo_checkouts(
  p_limit integer default 50
)
returns table(
  order_id uuid,
  transaction_id uuid,
  provider_session_id text
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  with candidates as (
    select transactions.id
    from public.payment_transactions as transactions
    join public.orders as orders on orders.id = transactions.order_id
    where transactions.status = 'pending'
      and transactions.provider_session_id is not null
      and orders.payment_method in ('card', 'gcash')
      and orders.payment_status = 'pending'
      and orders.status = 'pending'
      and orders.payment_expires_at is not null
      and orders.payment_expires_at <= now()
      and (
        transactions.provider_status is distinct from 'expiring'
        or transactions.last_synced_at is null
        or transactions.last_synced_at < now() - interval '90 seconds'
      )
    order by orders.payment_expires_at, transactions.created_at
    for update of transactions skip locked
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  ), claimed as (
    update public.payment_transactions as transactions
    set provider_status = 'expiring',
        last_synced_at = now(),
        updated_at = now()
    from candidates
    where transactions.id = candidates.id
    returning
      transactions.order_id,
      transactions.id as transaction_id,
      transactions.provider_session_id
  )
  select claimed.order_id, claimed.transaction_id, claimed.provider_session_id
  from claimed;
$$;

revoke all on function public.claim_expired_paymongo_checkouts(integer)
from public, anon, authenticated;
grant execute on function public.claim_expired_paymongo_checkouts(integer)
to service_role;

-- The worker invocation reads its URL and credential from hosted project
-- settings when available, then from Supabase Vault. For Vault-managed
-- projects use secret names `cozycraft_project_url` and
-- `cozycraft_service_role_key` (the common `supabase_url` and
-- `service_role_key` names are also recognized). No credential is stored in
-- this migration or exposed to a browser bundle.
create or replace function private.invoke_paymongo_expiry_worker()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_project_url text := nullif(current_setting('app.settings.supabase_url', true), '');
  v_service_role_key text := nullif(current_setting('app.settings.service_role_key', true), '');
  v_request_id bigint;
begin
  if v_project_url is null then
    select decrypted_secret into v_project_url
    from vault.decrypted_secrets
    where name in ('cozycraft_project_url', 'supabase_url')
    order by case name when 'cozycraft_project_url' then 0 else 1 end
    limit 1;
  end if;

  if v_service_role_key is null then
    select decrypted_secret into v_service_role_key
    from vault.decrypted_secrets
    where name in ('cozycraft_service_role_key', 'service_role_key')
    order by case name when 'cozycraft_service_role_key' then 0 else 1 end
    limit 1;
  end if;

  if v_project_url is null or v_service_role_key is null then
    raise warning 'PayMongo expiry worker skipped: project URL or service-role Vault secret is missing';
    return null;
  end if;

  select net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/expire-paymongo-checkouts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_service_role_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 45000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.invoke_paymongo_expiry_worker()
from public, anon, authenticated;

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
    'select private.invoke_paymongo_expiry_worker()'
  );
end
$$;
