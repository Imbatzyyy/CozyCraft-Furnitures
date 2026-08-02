create extension if not exists pg_cron with schema pg_catalog;

create or replace function private.create_weekly_report_briefing()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if coalesce((select weekly_report_enabled from public.store_settings where id = true), false) then
    insert into public.admin_notifications(kind, title, message, entity_type, entity_id)
    values (
      'report',
      'Weekly performance report is ready',
      'Review settled sales, fulfillment, refunds, customer retention, and inventory risk for the last seven days.',
      'reports',
      'weekly-' || to_char(current_date, 'IYYY-IW')
    );
  end if;
end;
$$;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'cozycraft-weekly-report-briefing';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule(
    'cozycraft-weekly-report-briefing',
    '0 0 * * 1',
    'select private.create_weekly_report_briefing()'
  );
end
$$;
