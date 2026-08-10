create or replace function private.protect_order_financial_fields()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $$
begin
  -- Service-role requests have no authenticated user. Trusted SECURITY DEFINER
  -- workflows run as the function owner (postgres) after performing their own
  -- ownership and state checks. Ordinary authenticated table updates do not.
  if (select auth.uid()) is null or current_user = 'postgres' then
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
    or new.cancellation_status is distinct from old.cancellation_status
    or new.cancellation_reviewed_at is distinct from old.cancellation_reviewed_at
    or new.cancellation_reviewed_by is distinct from old.cancellation_reviewed_by
    or new.cancellation_decision_note is distinct from old.cancellation_decision_note
    or new.cancelled_by is distinct from old.cancelled_by
    or (new.status = 'cancelled' and old.status is distinct from 'cancelled')
  ) then
    raise exception 'Administrator access is required for financial or cancellation changes';
  end if;

  return new;
end;
$$;
