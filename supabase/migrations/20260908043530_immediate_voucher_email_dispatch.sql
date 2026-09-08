-- pg_net sends after commit, so the worker sees the durable outbox record.
-- Rollback creates neither an email nor an HTTP request. Cron remains fallback.
create or replace function private.dispatch_new_voucher_email() returns trigger
language plpgsql security definer set search_path=pg_catalog,private as $$
begin
  perform private.invoke_voucher_email_worker();
  return new;
exception when others then
  -- Dispatch failure must not undo the customer's voucher; cron retries it.
  raise warning 'Immediate voucher email dispatch unavailable; queued for retry';
  return new;
end; $$;
revoke all on function private.dispatch_new_voucher_email() from public,anon,authenticated;
create trigger dispatch_new_voucher_email after insert on public.voucher_claim_emails
for each row execute function private.dispatch_new_voucher_email();
