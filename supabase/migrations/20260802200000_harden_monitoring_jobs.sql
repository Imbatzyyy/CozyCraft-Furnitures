-- Scheduled monitoring notifications need explicit supported kinds and
-- idempotency. Keep raw browser error telemetry bounded while preserving a
-- useful 90-day operational window.

alter table public.admin_notifications
  drop constraint if exists admin_notifications_kind_check;
alter table public.admin_notifications
  add constraint admin_notifications_kind_check
  check (kind in ('order', 'review', 'support', 'inventory', 'report', 'system'));

create unique index if not exists admin_notifications_scheduled_unique
  on public.admin_notifications(kind, entity_type, entity_id)
  where kind in ('report', 'system') and entity_id is not null;

create or replace function private.create_weekly_report_briefing()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if coalesce((select weekly_report_enabled from public.store_settings where id = true), false) then
    insert into public.admin_notifications(kind, title, message, entity_type, entity_id, route)
    values (
      'report',
      'Weekly performance report is ready',
      'Review settled sales, fulfillment, refunds, customer retention, and inventory risk for the last seven days.',
      'reports',
      'weekly-' || to_char(current_date, 'IYYY-IW'),
      '/admin/reports'
    )
    on conflict (kind, entity_type, entity_id)
      where kind in ('report', 'system') and entity_id is not null
      do nothing;
  end if;
end;
$$;

create or replace function private.run_daily_application_health_check()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_error_count integer;
begin
  select count(*) into v_error_count
  from public.client_error_events
  where created_at >= now() - interval '24 hours';

  if v_error_count >= 5 then
    insert into public.admin_notifications(kind, title, message, entity_type, entity_id, route)
    values (
      'system',
      'Customer application errors need review',
      format('%s customer-side errors were recorded in the last 24 hours.', v_error_count),
      'errors',
      'daily-' || to_char(current_date, 'YYYY-MM-DD'),
      '/admin/activity-logs'
    )
    on conflict (kind, entity_type, entity_id)
      where kind in ('report', 'system') and entity_id is not null
      do nothing;
  end if;

  delete from public.client_error_events
  where created_at < now() - interval '90 days';
end;
$$;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job from cron.job
  where jobname = 'cozycraft-daily-application-health';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule(
    'cozycraft-daily-application-health',
    '15 0 * * *',
    'select private.run_daily_application_health_check()'
  );
end
$$;
