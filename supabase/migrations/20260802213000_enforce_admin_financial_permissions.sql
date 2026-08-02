drop policy if exists "payment_transactions_select_own_or_staff" on public.payment_transactions;
drop policy if exists "payment_transactions_select_own_or_admin" on public.payment_transactions;

create policy "payment_transactions_select_own_or_admin"
on public.payment_transactions for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where orders.id = payment_transactions.order_id
      and (
        orders.user_id = (select auth.uid())
        or (select private.is_admin())
      )
  )
);

create or replace function private.protect_order_financial_fields()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  -- Service-role Edge Functions have no authenticated user and remain able to
  -- settle provider payments and protected refunds after server-side checks.
  if (select auth.uid()) is null then
    return new;
  end if;

  if not (select private.is_admin()) and (
    new.payment_status is distinct from old.payment_status
    or new.refund_status is distinct from old.refund_status
    or new.provider_refund_id is distinct from old.provider_refund_id
    or new.refunded_at is distinct from old.refunded_at
    or new.refund_email_sent_at is distinct from old.refund_email_sent_at
    or new.refund_email_id is distinct from old.refund_email_id
    or new.refund_email_error is distinct from old.refund_email_error
    or new.cancellation_reason is distinct from old.cancellation_reason
    or new.cancellation_requested_at is distinct from old.cancellation_requested_at
    or new.cancelled_by is distinct from old.cancelled_by
    or (new.status = 'cancelled' and old.status is distinct from 'cancelled')
  ) then
    raise exception 'Administrator access is required for financial or cancellation changes';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_order_financial_fields() from public;

drop trigger if exists protect_order_financial_fields on public.orders;
create trigger protect_order_financial_fields
before update on public.orders
for each row execute function private.protect_order_financial_fields();
