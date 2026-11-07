-- Free-plan housekeeping. No customer, order, payment or inventory data is removed.
create or replace function private.newsletter_work_due() returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.newsletter_campaigns where
   (status='scheduled' and scheduled_at<=now()) or
   (status='sending' and (worker_locked_at is null or worker_locked_at<now()-interval '2 minutes')));
$$;
create or replace function private.paymongo_expiry_work_due() returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.payment_transactions t join public.orders o on o.id=t.order_id
 where t.status='pending' and t.provider_session_id is not null
   and o.payment_method in ('card','gcash') and o.payment_status='pending' and o.status='pending'
   and o.payment_expires_at<=now()
   and (t.provider_status is distinct from 'expiring' or t.last_synced_at is null or t.last_synced_at<now()-interval '90 seconds'));
$$;
revoke all on function private.newsletter_work_due(), private.paymongo_expiry_work_due() from public,anon,authenticated;

create or replace function private.invoke_newsletter_worker()
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
  if not private.newsletter_work_due() then return null; end if;
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
    raise warning 'Newsletter worker skipped: project URL or service-role Vault secret is missing';
    return null;
  end if;

  select net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/newsletter-worker',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', v_service_role_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 45000
  ) into v_request_id;
  return v_request_id;
end;
$$;
revoke all on function private.invoke_newsletter_worker() from public,anon,authenticated;

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
  if not private.paymongo_expiry_work_due() then return null; end if;
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
revoke all on function private.invoke_paymongo_expiry_worker() from public,anon,authenticated;

-- Preserve failures longer; each pass has a hard row bound and a short timeout.
-- A verified encrypted archive must exist before scheduling this migration.
create or replace function private.prune_operational_history() returns integer
language plpgsql security definer set search_path='' set statement_timeout='10s' as $$
declare removed integer;
begin
  delete from cron.job_run_details where runid in (
    select runid from cron.job_run_details where end_time is not null and
      ((status='succeeded' and end_time<now()-interval '30 days') or end_time<now()-interval '90 days')
    order by runid limit 10000
  );
  get diagnostics removed=row_count;
  return removed;
end; $$;
revoke all on function private.prune_operational_history() from public,anon,authenticated;
do $$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
   perform cron.schedule('cozycraft-operational-history-retention','23 * * * *','select private.prune_operational_history()');
 end if;
end $$;
-- This matches the effective global Free limit; no existing object is removed.
update storage.buckets set file_size_limit=52428800 where id='mobile-updates' and file_size_limit>52428800;
