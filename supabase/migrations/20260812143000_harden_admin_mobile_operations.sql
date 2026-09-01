-- Harden the shared backend for the native administrator client. The UI remains
-- role aware, but protected writes are also constrained at the database edge.

alter table public.orders
  add column if not exists cancellation_claim_token uuid,
  add column if not exists cancellation_claimed_at timestamptz;
alter table public.return_requests
  add column if not exists refund_claim_token uuid,
  add column if not exists refund_claimed_at timestamptz;
-- Recipient email addresses are administrative data, not storefront settings.
-- Keep the public JSON contract intact while moving that sensitive property to
-- a superadmin-only row.
create table if not exists public.admin_report_recipients (
  id boolean primary key default true check (id),
  recipients text[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.admin_report_recipients(id, recipients)
select true, coalesce(array(
  select jsonb_array_elements_text(coalesce(report_settings -> 'recipients', '[]'::jsonb))
), '{}'::text[])
from public.store_settings
where id = true
on conflict (id) do nothing;
update public.store_settings
set report_settings = coalesce(report_settings, '{}'::jsonb) - 'recipients'
where id = true and coalesce(report_settings, '{}'::jsonb) ? 'recipients';
alter table public.admin_report_recipients enable row level security;
revoke all on public.admin_report_recipients from public, anon, authenticated;
grant select on public.admin_report_recipients to authenticated;
drop policy if exists admin_report_recipients_superadmin_select on public.admin_report_recipients;
create policy admin_report_recipients_superadmin_select
on public.admin_report_recipients for select to authenticated
using ((select private.is_superadmin()));
create or replace function private.capture_private_report_recipients()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_recipients text[];
begin
  if coalesce(new.report_settings, '{}'::jsonb) ? 'recipients' then
    select coalesce(array_agg(distinct lower(btrim(value))) filter (where btrim(value) <> ''), '{}'::text[])
    into v_recipients
    from jsonb_array_elements_text(coalesce(new.report_settings -> 'recipients', '[]'::jsonb)) item(value);

    insert into public.admin_report_recipients(id, recipients, updated_at, updated_by)
    values(true, v_recipients, clock_timestamp(), auth.uid())
    on conflict (id) do update
      set recipients = excluded.recipients,
          updated_at = excluded.updated_at,
          updated_by = excluded.updated_by;
  end if;
  new.report_settings := coalesce(new.report_settings, '{}'::jsonb) - 'recipients';
  return new;
end;
$$;
revoke all on function private.capture_private_report_recipients() from public, anon, authenticated;
drop trigger if exists capture_private_report_recipients on public.store_settings;
create trigger capture_private_report_recipients
before update of report_settings on public.store_settings
for each row execute function private.capture_private_report_recipients();
create or replace function private.admin_mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    not coalesce((
      select require_admin_mfa
      from public.admin_security_settings
      where id = true
    ), true)
    or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;
revoke all on function private.admin_mfa_satisfied() from public, anon, authenticated;
grant execute on function private.admin_mfa_satisfied() to authenticated, service_role;
-- Preserve the trusted customer cancellation RPC and service-role settlement
-- paths while requiring AAL2 for direct administrator financial mutations.
create or replace function private.protect_order_financial_fields()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  sensitive_change boolean;
begin
  if (select auth.uid()) is null or current_user = 'postgres' then
    return new;
  end if;

  sensitive_change :=
    new.payment_status is distinct from old.payment_status
    or new.refund_status is distinct from old.refund_status
    or new.provider_refund_id is distinct from old.provider_refund_id
    or new.refunded_at is distinct from old.refunded_at
    or new.refund_email_sent_at is distinct from old.refund_email_sent_at
    or new.refund_email_id is distinct from old.refund_email_id
    or new.refund_email_error is distinct from old.refund_email_error
    or new.cancellation_reason is distinct from old.cancellation_reason
    or new.cancellation_requested_at is distinct from old.cancellation_requested_at
    or new.cancellation_status is distinct from old.cancellation_status
    or new.cancellation_reviewed_at is distinct from old.cancellation_reviewed_at
    or new.cancellation_reviewed_by is distinct from old.cancellation_reviewed_by
    or new.cancellation_decision_note is distinct from old.cancellation_decision_note
    or new.cancelled_by is distinct from old.cancelled_by
    or new.cancellation_claim_token is distinct from old.cancellation_claim_token
    or new.cancellation_claimed_at is distinct from old.cancellation_claimed_at
    or (new.status = 'cancelled' and old.status is distinct from 'cancelled');

  if sensitive_change and not (select private.is_admin()) then
    raise exception 'Administrator access is required for financial or cancellation changes';
  end if;
  if sensitive_change and not (select private.admin_mfa_satisfied()) then
    raise exception 'Complete administrator MFA before changing financial records';
  end if;

  return new;
end;
$$;
revoke all on function private.protect_order_financial_fields() from public, anon, authenticated;
-- A non-financial staff member may progress a return through the physical
-- inspection workflow, but only an administrator may touch financial states.
create or replace function private.protect_return_financial_fields()
returns trigger
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
begin
  -- Service-role Edge Functions own the atomic refund path. Interactive JWTs
  -- must still pass the active-staff helpers below.
  if auth.role() is distinct from 'service_role' and current_user <> 'postgres' and not private.is_staff() then
    raise exception 'Active staff access required';
  end if;

  if auth.role() is distinct from 'service_role' and current_user <> 'postgres' and not private.is_admin() and (
    new.status in ('refund_processing', 'refunded') or
    new.provider_refund_id is distinct from old.provider_refund_id or
    new.refunded_at is distinct from old.refunded_at or
    new.inventory_restored_at is distinct from old.inventory_restored_at or
    new.refund_claim_token is distinct from old.refund_claim_token or
    new.refund_claimed_at is distinct from old.refund_claimed_at
  ) then
    raise exception 'Administrator access required for return refunds';
  end if;

  if auth.role() is distinct from 'service_role' and current_user <> 'postgres'
     and (
       new.status in ('refund_processing', 'refunded') or
       new.provider_refund_id is distinct from old.provider_refund_id or
       new.refunded_at is distinct from old.refunded_at or
       new.refund_claim_token is distinct from old.refund_claim_token or
       new.refund_claimed_at is distinct from old.refund_claimed_at
     )
     and not private.admin_mfa_satisfied() then
    raise exception 'Complete administrator MFA before changing return financials';
  end if;

  -- Financial completion must come from the atomic protected workflow, which
  -- stamps both the provider reference and refund time together.
  if new.status = 'refunded' and (
    new.provider_refund_id is null or new.refunded_at is null
  ) then
    raise exception 'Use the protected return refund workflow';
  end if;

  return new;
end;
$$;
drop trigger if exists protect_return_financial_fields on public.return_requests;
create trigger protect_return_financial_fields
before update on public.return_requests
for each row execute function private.protect_return_financial_fields();
create or replace function private.protect_sensitive_admin_settings()
returns trigger
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
begin
  if (select auth.uid()) is null or current_user = 'postgres' then
    return new;
  end if;
  if not private.is_superadmin() then
    raise exception 'Super administrator access required';
  end if;
  if not private.admin_mfa_satisfied() then
    raise exception 'Complete administrator MFA before changing workspace settings';
  end if;
  return new;
end;
$$;
revoke all on function private.protect_sensitive_admin_settings() from public, anon, authenticated;
drop trigger if exists protect_sensitive_admin_settings on public.store_settings;
create trigger protect_sensitive_admin_settings
before update on public.store_settings
for each row execute function private.protect_sensitive_admin_settings();
drop trigger if exists protect_sensitive_admin_security on public.admin_security_settings;
create trigger protect_sensitive_admin_security
before update on public.admin_security_settings
for each row execute function private.protect_sensitive_admin_settings();
-- Give operations staff the customer context needed for an order or an open
-- support request without broadly exposing every saved address.
create or replace function public.admin_customer_directory()
returns table (
  id uuid,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  username text,
  gender text,
  date_of_birth date,
  role public.user_role,
  staff_active boolean,
  created_at timestamptz,
  primary_address jsonb,
  address_count bigint,
  order_count bigint,
  support_ticket_count bigint
)
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select
    p.id,
    p.full_name,
    p.email,
    p.phone,
    p.avatar_url,
    p.username,
    p.gender,
    p.date_of_birth,
    p.role,
    p.staff_active,
    p.created_at,
    case when private.is_admin() then (
      select to_jsonb(a) - 'user_id' - 'created_at' - 'updated_at'
      from public.addresses a
      where a.user_id = p.id
      order by a.is_primary desc, a.created_at desc
      limit 1
    ) else null end,
    (select count(*) from public.addresses a where a.user_id = p.id),
    (select count(*) from public.orders o where o.user_id = p.id),
    (select count(*) from public.support_tickets t where t.user_id = p.id)
  from public.profiles p
  where private.is_admin() and p.role = 'customer';
$$;
revoke all on function public.admin_customer_directory() from public, anon;
grant execute on function public.admin_customer_directory() to authenticated;
-- Staff handling a ticket need a safe customer label, but not the customer's
-- full profile or address book. This RPC deliberately exposes only three
-- fields and remains unavailable to customer accounts.
create or replace function public.staff_customer_labels()
returns table (id uuid, full_name text, email text)
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select p.id, p.full_name, p.email
  from public.profiles p
  where private.is_staff() and p.role = 'customer';
$$;
revoke all on function public.staff_customer_labels() from public, anon;
grant execute on function public.staff_customer_labels() to authenticated;
create or replace function public.mark_all_admin_notifications_read()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_count bigint;
begin
  if v_user_id is null or not private.is_staff() then
    raise exception using errcode = '42501', message = 'Active staff access required';
  end if;
  insert into public.admin_notification_reads(notification_id, user_id, read_at, dismissed_at)
  select n.id, v_user_id, clock_timestamp(), null
  from public.admin_notifications n
  left join public.admin_notification_reads existing
    on existing.notification_id = n.id and existing.user_id = v_user_id
  where existing.dismissed_at is null
  on conflict (notification_id, user_id) do update
    set read_at = excluded.read_at;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.mark_all_admin_notifications_read() from public, anon;
grant execute on function public.mark_all_admin_notifications_read() to authenticated;
-- Add the important operational events missing from the original in-app feed.
create or replace function private.notify_admin_order_workflow()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.cancellation_status is distinct from new.cancellation_status
     and new.cancellation_status = 'pending' then
    insert into public.admin_notifications(kind,title,message,entity_type,entity_id,route)
    values('order','Cancellation review needed',format('Order %s has a customer cancellation request.',new.order_number),'orders',new.id::text,'/admin/orders');
  elsif old.payment_status is distinct from new.payment_status
     and new.payment_status in ('paid','refunded') then
    insert into public.admin_notifications(kind,title,message,entity_type,entity_id,route)
    values('order',case when new.payment_status='paid' then 'Payment settled' else 'Payment refunded' end,format('Order %s is now %s.',new.order_number,new.payment_status),'orders',new.id::text,'/admin/orders');
  end if;
  return new;
end;
$$;
drop trigger if exists notify_admin_order_workflow on public.orders;
create trigger notify_admin_order_workflow
after update of cancellation_status, payment_status on public.orders
for each row execute function private.notify_admin_order_workflow();
create or replace function private.notify_admin_return_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.admin_notifications(kind,title,message,entity_type,entity_id,route)
    values('order','New return request',format('%s is awaiting review.',new.return_number),'return_requests',new.id::text,'/admin/orders');
  end if;
  return new;
end;
$$;
drop trigger if exists notify_admin_return_request on public.return_requests;
create trigger notify_admin_return_request
after insert on public.return_requests
for each row execute function private.notify_admin_return_request();
-- A provider refund cannot share an order with a fulfillment transition. The
-- claim is committed before the external request, so a concurrent ship action
-- observes refund_status = processing and is rejected before money and stock
-- can diverge. A failed provider request is released only by the service RPC
-- below, which returns the request to review rather than silently shipping it.
create or replace function private.prevent_fulfillment_during_cancellation_review()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('shipped', 'delivered')
     and (
       (old.cancellation_status = 'pending' and new.cancellation_status = 'pending')
       or old.refund_status = 'processing'
       or new.refund_status = 'processing'
     ) then
    raise exception using
      errcode = 'P0001',
      message = 'Finish or release the cancellation refund before shipping this order.';
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_fulfillment_during_cancellation_review() from public, anon, authenticated;
-- Once an external refund is being processed, interactive users cannot move
-- the return backwards underneath it. Only a service-role recovery RPC may
-- release a claim after a provider explicitly rejects the refund.
create or replace function private.protect_return_financial_fields()
returns trigger
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
begin
  if auth.role() is distinct from 'service_role' and current_user <> 'postgres' and not private.is_staff() then
    raise exception 'Active staff access required';
  end if;

  if auth.role() is distinct from 'service_role' and current_user <> 'postgres'
     and old.status = 'refund_processing'
     and new.status is distinct from old.status then
    raise exception 'The protected refund is in progress and cannot be changed manually';
  end if;

  if auth.role() is distinct from 'service_role' and current_user <> 'postgres' and not private.is_admin() and (
    new.status in ('refund_processing', 'refunded') or
    new.provider_refund_id is distinct from old.provider_refund_id or
    new.refunded_at is distinct from old.refunded_at or
    new.inventory_restored_at is distinct from old.inventory_restored_at or
    new.refund_claim_token is distinct from old.refund_claim_token or
    new.refund_claimed_at is distinct from old.refund_claimed_at
  ) then
    raise exception 'Administrator access required for return refunds';
  end if;

  if auth.role() is distinct from 'service_role' and current_user <> 'postgres'
     and (
       new.status in ('refund_processing', 'refunded') or
       new.provider_refund_id is distinct from old.provider_refund_id or
       new.refunded_at is distinct from old.refunded_at or
       new.refund_claim_token is distinct from old.refund_claim_token or
       new.refund_claimed_at is distinct from old.refund_claimed_at
     )
     and not private.admin_mfa_satisfied() then
    raise exception 'Complete administrator MFA before changing return financials';
  end if;

  if new.status = 'refunded' and (
    new.provider_refund_id is null or new.refunded_at is null
  ) then
    raise exception 'Use the protected return refund workflow';
  end if;

  return new;
end;
$$;
create or replace function public.claim_return_refund(
  p_return_id uuid,
  p_reviewer uuid,
  p_claim_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_return public.return_requests%rowtype;
  v_now timestamptz := clock_timestamp();
  v_recovered boolean := false;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  if p_claim_token is null then
    raise exception using errcode = '22023', message = 'Refund claim token is required';
  end if;

  select * into v_return
  from public.return_requests
  where id = p_return_id
  for update;
  if not found then raise exception 'Return request not found'; end if;

  if v_return.status = 'refunded' then
    return jsonb_build_object('claimed', false, 'alreadyRefunded', true, 'alreadyProcessing', false);
  end if;
  if v_return.status = 'refund_processing'
     and v_return.refund_claim_token is not null
     and v_return.refund_claimed_at > v_now - interval '10 minutes' then
    return jsonb_build_object('claimed', false, 'alreadyRefunded', false, 'alreadyProcessing', true);
  end if;
  if v_return.status not in ('item_received', 'refund_processing') then
    raise exception 'Returned item must be received before refunding';
  end if;

  v_recovered := v_return.status = 'refund_processing';
  update public.return_requests
  set status = 'refund_processing',
      reviewed_by = p_reviewer,
      reviewed_at = v_now,
      refund_claim_token = p_claim_token,
      refund_claimed_at = v_now
  where id = v_return.id;

  return jsonb_build_object(
    'claimed', true,
    'alreadyRefunded', false,
    'alreadyProcessing', false,
    'recovered', v_recovered,
    'claimToken', p_claim_token
  );
end;
$$;
revoke all on function public.claim_return_refund(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_return_refund(uuid, uuid, uuid) to service_role;
-- Retire the unscoped legacy claim so a rolling Edge deployment fails safely
-- before contacting the provider instead of creating a tokenless operation.
drop function if exists public.begin_return_refund(uuid, uuid);
create or replace function public.release_return_refund_claim(
  p_return_id uuid,
  p_reviewer uuid,
  p_claim_token uuid,
  p_failure text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_return public.return_requests%rowtype;
  v_failure text := left(coalesce(nullif(btrim(coalesce(p_failure, '')), ''), 'The payment provider did not accept the refund.'), 500);
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;

  select * into v_return
  from public.return_requests
  where id = p_return_id
  for update;
  if not found then raise exception 'Return request not found'; end if;

  if v_return.status = 'refunded' or v_return.provider_refund_id is not null or v_return.refunded_at is not null then
    raise exception 'A recorded provider refund cannot be released';
  end if;
  if v_return.status <> 'refund_processing' or v_return.refund_claim_token is distinct from p_claim_token then
    raise exception using errcode = '40001', message = 'This refund claim is no longer owned by this request';
  end if;

  update public.return_requests
  set status = 'item_received',
      admin_note = v_failure,
      reviewed_by = p_reviewer,
      reviewed_at = clock_timestamp(),
      refund_claim_token = null,
      refund_claimed_at = null
  where id = v_return.id;

  return jsonb_build_object('returnId', v_return.id, 'status', 'item_received', 'released', true);
end;
$$;
revoke all on function public.release_return_refund_claim(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.release_return_refund_claim(uuid, uuid, uuid, text) to service_role;
create or replace function public.release_admin_order_cancellation_claim(
  p_order_id uuid,
  p_reviewer uuid,
  p_claim_token uuid,
  p_failure text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_order public.orders%rowtype;
  v_failure text := left(coalesce(nullif(btrim(coalesce(p_failure, '')), ''), 'The payment provider did not accept the refund.'), 500);
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then raise exception 'Order not found'; end if;

  if v_order.status = 'cancelled' or v_order.provider_refund_id is not null or v_order.payment_status = 'refunded' then
    raise exception 'A completed or recorded refund claim cannot be released';
  end if;
  if v_order.refund_status <> 'processing' or v_order.cancellation_claim_token is distinct from p_claim_token then
    raise exception using errcode = '40001', message = 'This cancellation claim is no longer owned by this request';
  end if;

  update public.orders
  set refund_status = 'failed',
      cancellation_status = 'pending',
      cancellation_reviewed_at = null,
      cancellation_reviewed_by = null,
      cancellation_decision_note = v_failure,
      cancellation_claim_token = null,
      cancellation_claimed_at = null
  where id = v_order.id;

  return jsonb_build_object('orderId', v_order.id, 'status', v_order.status, 'released', true);
end;
$$;
revoke all on function public.release_admin_order_cancellation_claim(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.release_admin_order_cancellation_claim(uuid, uuid, uuid, text) to service_role;
-- Financial finalization belongs in one transaction. Edge Functions may call
-- a payment provider first, then safely retry these idempotent service-only
-- functions until the shared ledger is consistent.
create or replace function public.finalize_return_refund(
  p_return_id uuid,
  p_reviewer uuid,
  p_claim_token uuid,
  p_refund_id text,
  p_demo boolean default false,
  p_raw_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_return public.return_requests%rowtype;
  v_order public.orders%rowtype;
  v_transaction public.payment_transactions%rowtype;
  v_refunded_at timestamptz;
  v_refund_id text := nullif(btrim(coalesce(p_refund_id, '')), '');
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  if v_refund_id is null then
    raise exception using errcode = '22023', message = 'Provider refund reference is required';
  end if;

  select * into v_return
  from public.return_requests
  where id = p_return_id
  for update;
  if not found then raise exception 'Return request not found'; end if;
  if v_return.status not in ('refund_processing', 'refunded') then
    raise exception 'Return request is not ready to finalize';
  end if;
  if v_return.status = 'refund_processing' and v_return.refund_claim_token is distinct from p_claim_token then
    raise exception using errcode = '40001', message = 'This refund claim is no longer owned by this request';
  end if;
  if v_return.status = 'refunded'
     and v_return.provider_refund_id is not null
     and v_return.provider_refund_id is distinct from v_refund_id then
    raise exception 'A different provider refund is already recorded';
  end if;

  select * into v_order
  from public.orders
  where id = v_return.order_id
  for update;
  if not found then raise exception 'Related order not found'; end if;

  select * into v_transaction
  from public.payment_transactions
  where order_id = v_order.id
  for update;
  if v_order.payment_method <> 'cod' and v_transaction.id is null then
    raise exception 'Related payment transaction not found';
  end if;

  v_refunded_at := coalesce(v_return.refunded_at, clock_timestamp());

  update public.return_requests
  set status = 'refunded',
      provider_refund_id = v_refund_id,
      refunded_at = v_refunded_at,
      reviewed_by = p_reviewer,
      reviewed_at = v_refunded_at,
      refund_claim_token = null,
      refund_claimed_at = null
  where id = v_return.id;

  update public.orders
  set payment_status = 'refunded',
      refund_status = case when p_demo then 'demo_succeeded' else 'succeeded' end,
      provider_refund_id = v_refund_id,
      refunded_at = v_refunded_at
  where id = v_order.id;

  if v_transaction.id is not null then
    update public.payment_transactions
    set status = 'refunded',
        raw_payload = coalesce(v_transaction.raw_payload, '{}'::jsonb) || coalesce(p_raw_payload, '{}'::jsonb),
        updated_at = v_refunded_at
    where id = v_transaction.id;
  end if;

  return jsonb_build_object(
    'returnId', v_return.id,
    'orderId', v_order.id,
    'refundId', v_refund_id,
    'refundedAt', v_refunded_at
  );
end;
$$;
revoke all on function public.finalize_return_refund(uuid, uuid, uuid, text, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_return_refund(uuid, uuid, uuid, text, boolean, jsonb) to service_role;
create or replace function public.claim_admin_order_cancellation(
  p_order_id uuid,
  p_reviewer uuid,
  p_reason text,
  p_claim_token uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_order public.orders%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_requires_refund boolean;
  v_now timestamptz := clock_timestamp();
  v_recovered boolean := false;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  if char_length(v_reason) not between 5 and 500 then
    raise exception using errcode = '22023', message = 'Cancellation reason must contain 5 to 500 characters';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status in ('shipped', 'delivered') then
    raise exception 'This order has already shipped and requires the return workflow';
  end if;

  v_requires_refund := v_order.payment_method <> 'cod'
    and v_order.payment_status in ('paid', 'refunded');

  if v_requires_refund and p_claim_token is null then
    raise exception using errcode = '22023', message = 'Cancellation claim token is required';
  end if;

  if v_order.payment_method = 'cod' and v_order.payment_status = 'paid' then
    raise exception 'A settled cash-on-delivery order requires manual financial review';
  end if;

  if v_requires_refund
     and v_order.refund_status = 'processing'
     and v_order.cancellation_claim_token is not null
     and v_order.cancellation_claimed_at > v_now - interval '10 minutes' then
    return jsonb_build_object(
      'orderId', v_order.id,
      'alreadyCancelled', v_order.status = 'cancelled',
      'alreadyProcessing', true,
      'claimed', false,
      'requiresRefund', true,
      'paymentStatus', v_order.payment_status
    );
  end if;

  v_recovered := v_requires_refund and v_order.refund_status = 'processing';
  update public.orders
  set cancellation_reason = case when status = 'cancelled' then cancellation_reason else v_reason end,
      cancellation_requested_at = case when status = 'cancelled' then cancellation_requested_at else coalesce(cancellation_requested_at, v_now) end,
      cancellation_status = case when status = 'cancelled' then cancellation_status else 'approved' end,
      cancellation_reviewed_at = case when status = 'cancelled' then cancellation_reviewed_at else v_now end,
      cancellation_reviewed_by = case when status = 'cancelled' then cancellation_reviewed_by else p_reviewer end,
      cancellation_decision_note = case when status = 'cancelled' then cancellation_decision_note else nullif(btrim(coalesce(p_note, '')), '') end,
      cancelled_by = case when status = 'cancelled' then cancelled_by else p_reviewer end,
      refund_status = case when v_requires_refund then 'processing' else refund_status end,
      cancellation_claim_token = case when v_requires_refund then p_claim_token else null end,
      cancellation_claimed_at = case when v_requires_refund then v_now else null end
  where id = v_order.id;

  return jsonb_build_object(
    'orderId', v_order.id,
    'alreadyCancelled', v_order.status = 'cancelled',
    'alreadyProcessing', false,
    'claimed', true,
    'recovered', v_recovered,
    'requiresRefund', v_requires_refund,
    'providerRefundId', v_order.provider_refund_id,
    'paymentStatus', v_order.payment_status
  );
end;
$$;
revoke all on function public.claim_admin_order_cancellation(uuid, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_admin_order_cancellation(uuid, uuid, text, uuid, text) to service_role;
create or replace function public.reject_admin_order_cancellation(
  p_order_id uuid,
  p_reviewer uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_order public.orders%rowtype;
  v_note text := coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'The order is continuing through fulfillment.');
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.cancellation_status <> 'pending' then
    raise exception 'This cancellation request was already reviewed';
  end if;

  update public.orders
  set cancellation_status = 'rejected',
      cancellation_reviewed_at = clock_timestamp(),
      cancellation_reviewed_by = p_reviewer,
      cancellation_decision_note = v_note
  where id = v_order.id;

  insert into public.customer_notifications(user_id, kind, title, message, entity_type, entity_id)
  values(v_order.user_id, 'cancellation_rejected', format('Cancellation request reviewed for %s', v_order.order_number), v_note, 'orders', v_order.id::text);

  return jsonb_build_object('orderId', v_order.id, 'cancellationStatus', 'rejected');
end;
$$;
revoke all on function public.reject_admin_order_cancellation(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reject_admin_order_cancellation(uuid, uuid, text) to service_role;
create or replace function public.finalize_admin_order_cancellation(
  p_order_id uuid,
  p_reviewer uuid,
  p_reason text,
  p_claim_token uuid,
  p_note text default null,
  p_refund_id text default null,
  p_demo boolean default false,
  p_raw_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_order public.orders%rowtype;
  v_transaction public.payment_transactions%rowtype;
  v_was_cancelled boolean;
  v_requires_refund boolean;
  v_refund_id text;
  v_now timestamptz := clock_timestamp();
  v_payment_status text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status in ('shipped', 'delivered') then
    raise exception 'This order has already shipped and requires the return workflow';
  end if;

  select * into v_transaction
  from public.payment_transactions
  where order_id = v_order.id
  for update;

  v_was_cancelled := v_order.status = 'cancelled';
  v_refund_id := coalesce(nullif(btrim(coalesce(p_refund_id, '')), ''), v_order.provider_refund_id);
  v_requires_refund := v_order.payment_method <> 'cod'
    and (v_order.payment_status in ('paid', 'refunded') or v_refund_id is not null);

  if v_requires_refund and v_order.cancellation_claim_token is distinct from p_claim_token then
    raise exception using errcode = '40001', message = 'This cancellation claim is no longer owned by this request';
  end if;
  if v_requires_refund and v_refund_id is null then
    raise exception 'Provider refund reference is required';
  end if;
  if v_requires_refund and v_transaction.id is null then
    raise exception 'Related payment transaction not found';
  end if;
  if v_order.payment_method = 'cod' and v_order.payment_status = 'paid' then
    raise exception 'A settled cash-on-delivery order requires manual financial review';
  end if;

  v_payment_status := case
    when v_requires_refund then 'refunded'
    when v_order.payment_status = 'pending' then 'failed'
    else v_order.payment_status
  end;

  update public.orders
  set cancellation_reason = btrim(p_reason),
      cancellation_requested_at = coalesce(cancellation_requested_at, v_now),
      cancellation_status = 'approved',
      cancellation_reviewed_at = v_now,
      cancellation_reviewed_by = p_reviewer,
      cancellation_decision_note = nullif(btrim(coalesce(p_note, '')), ''),
      cancelled_by = p_reviewer,
      status = 'cancelled',
      payment_status = v_payment_status,
      refund_status = case when v_requires_refund then case when p_demo then 'demo_succeeded' else 'succeeded' end else refund_status end,
      provider_refund_id = case when v_requires_refund then v_refund_id else provider_refund_id end,
      refunded_at = case when v_requires_refund then coalesce(refunded_at, v_now) else refunded_at end,
      cancellation_claim_token = null,
      cancellation_claimed_at = null
  where id = v_order.id;

  if v_transaction.id is not null then
    update public.payment_transactions
    set status = case when v_requires_refund then 'refunded' when status = 'pending' then 'failed' else status end,
        raw_payload = case when v_requires_refund then coalesce(raw_payload, '{}'::jsonb) || coalesce(p_raw_payload, '{}'::jsonb) else raw_payload end,
        failure_reason = case when not v_requires_refund and status = 'pending' then 'Order cancelled before settlement' else failure_reason end,
        updated_at = v_now
    where id = v_transaction.id;
  end if;

  if not v_was_cancelled then
    insert into public.customer_notifications(user_id, kind, title, message, entity_type, entity_id)
    values(
      v_order.user_id,
      case when v_requires_refund then 'refund_completed' else 'order_cancelled' end,
      case when v_requires_refund then format('Refund recorded for %s', v_order.order_number) else format('Order %s cancelled', v_order.order_number) end,
      case when v_requires_refund then case when p_demo then 'Your test payment refund was completed for this demo order.' else 'Your refund was submitted to the original payment method.' end else 'Your order was cancelled before payment settlement. No refund is required.' end,
      'orders',
      v_order.id::text
    );
  end if;

  return jsonb_build_object(
    'orderId', v_order.id,
    'cancelled', true,
    'reused', v_was_cancelled,
    'requiresRefund', v_requires_refund,
    'refundId', v_refund_id
  );
end;
$$;
revoke all on function public.finalize_admin_order_cancellation(uuid, uuid, text, uuid, text, text, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_admin_order_cancellation(uuid, uuid, text, uuid, text, text, boolean, jsonb) to service_role;
-- One atomic settings save prevents half-applied global configuration.
create or replace function public.save_admin_workspace_settings(
  p_store jsonb,
  p_security jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_store public.store_settings%rowtype;
  v_security public.admin_security_settings%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if not private.is_superadmin() then
    raise exception using errcode = '42501', message = 'Super administrator access required';
  end if;
  if not private.admin_mfa_satisfied() then
    raise exception using errcode = '42501', message = 'Complete administrator MFA before changing workspace settings';
  end if;

  select * into v_store from public.store_settings where id = true for update;
  select * into v_security from public.admin_security_settings where id = true for update;
  if v_store.id is null or v_security.id is null then
    raise exception 'Workspace settings are not initialized';
  end if;

  v_store := jsonb_populate_record(v_store, coalesce(p_store, '{}'::jsonb) - array['id', 'updated_at']);
  v_security := jsonb_populate_record(v_security, coalesce(p_security, '{}'::jsonb) - array['id', 'updated_at', 'updated_by', 'integration_status']);

  update public.store_settings set
    store_name = v_store.store_name,
    store_description = v_store.store_description,
    contact_email = v_store.contact_email,
    support_phone = v_store.support_phone,
    business_address = v_store.business_address,
    delivery_area = v_store.delivery_area,
    low_stock_threshold = v_store.low_stock_threshold,
    inventory_alerts = v_store.inventory_alerts,
    weekly_report_enabled = v_store.weekly_report_enabled,
    social_links = v_store.social_links,
    announcement_enabled = v_store.announcement_enabled,
    announcement_text = v_store.announcement_text,
    announcement_link = v_store.announcement_link,
    maintenance_mode = v_store.maintenance_mode,
    checkout_settings = v_store.checkout_settings,
    fulfillment_settings = v_store.fulfillment_settings,
    review_settings = v_store.review_settings,
    account_settings = v_store.account_settings,
    email_event_settings = v_store.email_event_settings,
    report_settings = v_store.report_settings,
    updated_at = v_now
  where id = true;

  update public.admin_security_settings set
    require_admin_mfa = v_security.require_admin_mfa,
    session_timeout_minutes = v_security.session_timeout_minutes,
    maximum_failed_logins = v_security.maximum_failed_logins,
    lockout_minutes = v_security.lockout_minutes,
    security_alerts_enabled = v_security.security_alerts_enabled,
    notification_email = v_security.notification_email,
    updated_at = v_now,
    updated_by = auth.uid()
  where id = true;

  return jsonb_build_object('saved', true, 'updatedAt', v_now);
end;
$$;
revoke all on function public.save_admin_workspace_settings(jsonb, jsonb) from public, anon;
grant execute on function public.save_admin_workspace_settings(jsonb, jsonb) to authenticated;
-- Server-side constraints for COD settlement and last-superadmin protection.
create or replace function public.mark_cod_payment_received(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_order public.orders%rowtype;
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;
  if not private.admin_mfa_satisfied() then
    raise exception using errcode = '42501', message = 'Complete administrator MFA before settling a payment';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.payment_method <> 'cod' or v_order.payment_status <> 'pending' or v_order.status <> 'delivered' then
    raise exception 'Only a delivered, pending cash-on-delivery order can be settled';
  end if;
  update public.orders set payment_status = 'paid' where id = v_order.id;
  return jsonb_build_object('orderId', v_order.id, 'paymentStatus', 'paid');
end;
$$;
revoke all on function public.mark_cod_payment_received(uuid) from public, anon;
grant execute on function public.mark_cod_payment_received(uuid) to authenticated;
create or replace function public.mutate_team_member(
  p_actor_id uuid,
  p_target_id uuid,
  p_action text,
  p_role text default null,
  p_active boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_active_superadmins integer;
  v_message text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  perform pg_advisory_xact_lock(hashtext('cozycraft-active-superadmins'));
  select * into v_actor from public.profiles where id = p_actor_id for update;
  if not found or v_actor.role <> 'superadmin' or not v_actor.staff_active then
    raise exception using errcode = '42501', message = 'Active super administrator required';
  end if;
  if p_actor_id = p_target_id then
    raise exception 'You cannot change your own super administrator access';
  end if;
  select * into v_target from public.profiles where id = p_target_id for update;
  if not found or v_target.role not in ('staff', 'admin', 'superadmin') then
    raise exception 'Team member not found';
  end if;
  select count(*) into v_active_superadmins from public.profiles where role = 'superadmin' and staff_active;

  if p_action = 'update-role' then
    if p_role not in ('staff', 'admin', 'superadmin') then raise exception 'Invalid team role'; end if;
    if v_target.role = 'superadmin' and v_target.staff_active and p_role <> 'superadmin' and v_active_superadmins <= 1 then
      raise exception 'At least one active super administrator must remain';
    end if;
    update public.profiles set role = p_role::public.user_role where id = v_target.id;
    insert into public.activity_logs(actor_id, action, entity_type, entity_id, details, platform, actor_role)
    values(p_actor_id, 'team_member_role_changed', 'profile', v_target.id::text, jsonb_build_object('email', v_target.email, 'from', v_target.role, 'to', p_role), 'edge', 'superadmin');
    v_message := 'Role updated.';
  elsif p_action = 'set-status' then
    if p_active is null then raise exception 'Active status is required'; end if;
    if v_target.role = 'superadmin' and v_target.staff_active and not p_active and v_active_superadmins <= 1 then
      raise exception 'At least one active super administrator must remain';
    end if;
    update public.profiles set staff_active = p_active where id = v_target.id;
    insert into public.activity_logs(actor_id, action, entity_type, entity_id, details, platform, actor_role)
    values(p_actor_id, case when p_active then 'team_member_reactivated' else 'team_member_suspended' end, 'profile', v_target.id::text, jsonb_build_object('email', v_target.email, 'role', v_target.role), 'edge', 'superadmin');
    v_message := case when p_active then 'Team member access restored.' else 'Team member access suspended.' end;
  else
    raise exception 'Unsupported team action';
  end if;
  return jsonb_build_object('success', true, 'message', v_message);
end;
$$;
revoke all on function public.mutate_team_member(uuid, uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.mutate_team_member(uuid, uuid, text, text, boolean) to service_role;
drop policy if exists support_attachments_owner_or_staff_delete on storage.objects;
create policy support_attachments_owner_or_staff_delete on storage.objects for delete to authenticated
using (bucket_id = 'support-attachments' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_staff())));
drop policy if exists return_evidence_owner_or_staff_delete on storage.objects;
create policy return_evidence_owner_or_staff_delete on storage.objects for delete to authenticated
using (bucket_id = 'return-evidence' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_staff())));
drop policy if exists review_images_owner_or_staff_delete on storage.objects;
create policy review_images_owner_or_staff_delete on storage.objects for delete to authenticated
using (bucket_id = 'review-images' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_staff())));
-- Return notifications deep-link to the related order, not the return UUID.
create or replace function private.notify_admin_return_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.admin_notifications(kind,title,message,entity_type,entity_id,route)
    values('order','New return request',format('%s is awaiting review.',new.return_number),'return_requests',new.order_id::text,'/admin/orders');
  end if;
  return new;
end;
$$;
