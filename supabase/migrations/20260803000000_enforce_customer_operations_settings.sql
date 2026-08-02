create or replace function private.validate_report_settings()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  if coalesce(new.report_settings->>'frequency', '') not in ('weekly', 'monthly') then
    raise exception 'Report frequency must be weekly or monthly';
  end if;
  if coalesce(new.report_settings->>'default_range', '') not in ('This week', 'This month', 'Quarter') then
    raise exception 'Default report range is invalid';
  end if;
  if not exists (select 1 from pg_timezone_names where name = new.report_settings->>'timezone') then
    raise exception 'Reporting timezone is invalid';
  end if;
  if (new.report_settings->>'data_retention_days')::integer not between 7 and 3650 then
    raise exception 'Data retention must be between 7 and 3650 days';
  end if;
  return new;
end;
$function$;

drop trigger if exists validate_report_settings on public.store_settings;
create trigger validate_report_settings before insert or update on public.store_settings
for each row execute function private.validate_report_settings();

create or replace function private.validate_storefront_links()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
declare
  v_link text;
begin
  if new.announcement_link <> '' and new.announcement_link !~ '^(\/|https:\/\/)' then
    raise exception 'Announcement links must be internal paths or HTTPS URLs';
  end if;
  for v_link in select value from jsonb_each_text(new.social_links) loop
    if v_link <> '' and v_link !~ '^https:\/\/' then raise exception 'Social links must use HTTPS'; end if;
  end loop;
  return new;
end;
$function$;

drop trigger if exists validate_storefront_links on public.store_settings;
create trigger validate_storefront_links before insert or update on public.store_settings
for each row execute function private.validate_storefront_links();

drop policy if exists "returns_eligible_order_insert" on public.return_requests;
create policy "returns_eligible_order_insert"
on public.return_requests for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'requested'
  and reviewed_by is null
  and reviewed_at is null
  and admin_note is null
  and provider_refund_id is null
  and refunded_at is null
  and inventory_restored_at is null
  and exists (
    select 1
    from public.orders
    where orders.id = order_id
      and orders.user_id = (select auth.uid())
      and orders.status = 'delivered'
      and exists (
        select 1 from public.order_status_history history
        cross join public.store_settings settings
        where history.order_id = orders.id
          and history.status = 'delivered'
          and settings.id = true
          and (settings.fulfillment_settings->>'return_window_days')::integer > 0
          and history.changed_at >= now() - make_interval(days => (settings.fulfillment_settings->>'return_window_days')::integer)
      )
  )
);

create or replace function private.create_weekly_report_briefing()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_settings public.store_settings%rowtype;
  v_frequency text;
  v_period_key text;
  v_title text;
  v_local_date date;
begin
  select * into v_settings from public.store_settings where id = true;
  if not coalesce(v_settings.weekly_report_enabled, false) then return; end if;
  v_frequency := coalesce(v_settings.report_settings->>'frequency', 'weekly');
  v_local_date := (now() at time zone coalesce(v_settings.report_settings->>'timezone', 'Asia/Manila'))::date;
  if v_frequency = 'monthly' and extract(day from v_local_date) > 7 then return; end if;
  v_period_key := case when v_frequency = 'monthly' then to_char(v_local_date, 'YYYY-MM') else to_char(v_local_date, 'IYYY-IW') end;
  v_title := case when v_frequency = 'monthly' then 'Monthly performance report is ready' else 'Weekly performance report is ready' end;
  insert into public.admin_notifications(kind, title, message, entity_type, entity_id, route)
  values ('report', v_title, 'Review settled sales, fulfillment, refunds, customer retention, and inventory risk.', 'reports', v_frequency || '-' || v_period_key, '/admin/reports')
  on conflict (kind, entity_type, entity_id)
    where kind in ('report', 'system') and entity_id is not null
    do nothing;
end;
$function$;
