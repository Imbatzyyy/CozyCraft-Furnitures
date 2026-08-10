alter table public.orders
  add column if not exists cancellation_status text,
  add column if not exists cancellation_reviewed_at timestamptz,
  add column if not exists cancellation_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists cancellation_decision_note text;

alter table public.orders
  drop constraint if exists orders_cancellation_status_check;

alter table public.orders
  add constraint orders_cancellation_status_check
  check (cancellation_status is null or cancellation_status in ('pending', 'approved', 'rejected'));

alter table public.orders
  drop constraint if exists orders_cancellation_decision_note_length_check;

alter table public.orders
  add constraint orders_cancellation_decision_note_length_check
  check (cancellation_decision_note is null or char_length(cancellation_decision_note) <= 500);

create index if not exists orders_pending_cancellation_idx
  on public.orders (cancellation_requested_at desc)
  where cancellation_status = 'pending';

create or replace function public.request_order_cancellation(
  p_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_window_hours integer := 0;
  v_now timestamptz := clock_timestamp();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if char_length(v_reason) < 5 then
    raise exception using errcode = '22023', message = 'Provide a cancellation reason of at least 5 characters.';
  end if;

  if char_length(v_reason) > 500 then
    raise exception using errcode = '22023', message = 'Cancellation reason must be 500 characters or fewer.';
  end if;

  select *
    into v_order
    from public.orders
   where id = p_order_id
   for update;

  if not found or v_order.user_id <> v_user_id then
    raise exception using errcode = 'P0002', message = 'Order not found.';
  end if;

  if v_order.cancellation_status = 'pending' then
    return jsonb_build_object(
      'orderId', v_order.id,
      'orderNumber', v_order.order_number,
      'status', 'pending',
      'requestedAt', v_order.cancellation_requested_at,
      'alreadyPending', true
    );
  end if;

  if v_order.cancellation_status in ('approved', 'rejected') then
    raise exception using errcode = 'P0001', message = 'This cancellation request has already been reviewed.';
  end if;

  if v_order.status in ('shipped', 'delivered') then
    raise exception using errcode = 'P0001', message = 'This order has already shipped and can no longer be cancelled.';
  end if;

  if v_order.status = 'cancelled' then
    raise exception using errcode = 'P0001', message = 'This order is already cancelled.';
  end if;

  if v_order.status not in ('pending', 'processing', 'packed') then
    raise exception using errcode = 'P0001', message = 'This order is no longer eligible for cancellation.';
  end if;

  select greatest(0, coalesce((fulfillment_settings ->> 'cancellation_window_hours')::integer, 0))
    into v_window_hours
    from public.store_settings
   where id = true;

  v_window_hours := coalesce(v_window_hours, 0);
  if v_window_hours = 0 or v_now > v_order.created_at + make_interval(hours => v_window_hours) then
    raise exception using errcode = 'P0001', message = format(
      'The %s-hour cancellation window has closed. Contact support for assistance.',
      v_window_hours
    );
  end if;

  update public.orders
     set cancellation_reason = v_reason,
         cancellation_requested_at = v_now,
         cancellation_status = 'pending',
         cancellation_reviewed_at = null,
         cancellation_reviewed_by = null,
         cancellation_decision_note = null
   where id = v_order.id;

  insert into public.customer_notifications (
    user_id,
    kind,
    title,
    message,
    entity_type,
    entity_id
  ) values (
    v_user_id,
    'cancellation_requested',
    format('Cancellation requested for %s', v_order.order_number),
    'Your request is pending approval. We will update this order as soon as it is reviewed.',
    'orders',
    v_order.id
  );

  return jsonb_build_object(
    'orderId', v_order.id,
    'orderNumber', v_order.order_number,
    'status', 'pending',
    'requestedAt', v_now,
    'alreadyPending', false
  );
end;
$$;

revoke all on function public.request_order_cancellation(uuid, text) from public;
revoke all on function public.request_order_cancellation(uuid, text) from anon;
grant execute on function public.request_order_cancellation(uuid, text) to authenticated;

comment on function public.request_order_cancellation(uuid, text) is
  'Creates an idempotent customer cancellation request after locking and rechecking ownership, fulfillment state, and the configured cancellation window.';

create or replace function private.prevent_fulfillment_during_cancellation_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.cancellation_status = 'pending'
     and new.cancellation_status = 'pending'
     and new.status in ('shipped', 'delivered')
     and new.status is distinct from old.status then
    raise exception using
      errcode = 'P0001',
      message = 'Review the pending cancellation request before shipping this order.';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_prevent_fulfillment_during_cancellation_review on public.orders;
create trigger orders_prevent_fulfillment_during_cancellation_review
before update of status, cancellation_status on public.orders
for each row
execute function private.prevent_fulfillment_during_cancellation_review();
