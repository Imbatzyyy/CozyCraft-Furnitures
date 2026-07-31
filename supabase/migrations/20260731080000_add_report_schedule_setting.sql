alter table public.store_settings
  add column if not exists weekly_report_enabled boolean not null default false;
