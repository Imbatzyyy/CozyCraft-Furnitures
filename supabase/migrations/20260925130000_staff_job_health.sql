-- Narrow SECURITY DEFINER exception: expose counts only, never private queue
-- rows, recipient addresses, provider payloads, keys or error-message bodies.
create or replace function public.admin_job_health()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_staff() or not private.customer_mfa_satisfied() or not private.admin_mfa_satisfied() then raise exception 'Verified administrator session required' using errcode='42501'; end if;
  return jsonb_build_object(
    'photoQueued',(select count(*) from private.furniture_photo_index_queue where attempts<6),
    'photoExhausted',(select count(*) from private.furniture_photo_index_queue where attempts>=6),
    'voucherQueued',(select count(*) from public.voucher_claim_emails where status in ('queued','sending')),
    'voucherFailed',(select count(*) from public.voucher_claim_emails where status='failed'),
    'voucherOverdue',(select count(*) from public.voucher_claim_emails where status in ('queued','sending') and created_at<now()-interval '15 minutes'),
    'generatedAt',now());
end $$;
revoke all on function public.admin_job_health() from public,anon;
grant execute on function public.admin_job_health() to authenticated;
notify pgrst,'reload schema';
