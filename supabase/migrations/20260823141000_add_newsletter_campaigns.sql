-- CozyCraft newsletter campaigns are server-managed. Subscriber addresses and
-- delivery records remain unavailable to browser Data API roles; administrators
-- operate them through authenticated Edge Functions that return aggregates.
alter table public.newsletter_subscribers
  drop constraint if exists newsletter_subscribers_status_check;
alter table public.newsletter_subscribers
  alter column status set default 'pending';
alter table public.newsletter_subscribers
  add constraint newsletter_subscribers_status_check
  check (status in ('pending', 'active', 'unsubscribed', 'bounced', 'complained')),
  add column if not exists confirmation_token text,
  add column if not exists unsubscribe_token text,
  add column if not exists confirmation_sent_at timestamptz,
  add column if not exists confirmed_at timestamptz,
  add column if not exists last_delivery_at timestamptz;
update public.newsletter_subscribers
set
  unsubscribe_token = coalesce(
    unsubscribe_token,
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  ),
  confirmed_at = case
    when status = 'active' then coalesce(confirmed_at, consented_at)
    else confirmed_at
  end
where unsubscribe_token is null or (status = 'active' and confirmed_at is null);
create unique index if not exists newsletter_subscribers_confirmation_token_idx
  on public.newsletter_subscribers (confirmation_token)
  where confirmation_token is not null;
create unique index if not exists newsletter_subscribers_unsubscribe_token_idx
  on public.newsletter_subscribers (unsubscribe_token)
  where unsubscribe_token is not null;
create table if not exists public.newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  internal_name text not null,
  subject text not null,
  preheader text not null default '',
  heading text not null,
  body text not null,
  cta_label text not null default 'Explore the collection',
  cta_path text not null default '/new-arrivals',
  product_ids text[] not null default '{}',
  product_snapshot jsonb not null default '[]'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed')),
  scheduled_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  recipient_count integer not null default 0 check (recipient_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  started_at timestamptz,
  sent_at timestamptz,
  worker_locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.newsletter_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.newsletter_campaigns(id) on delete cascade,
  subscriber_id bigint not null references public.newsletter_subscribers(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, subscriber_id)
);
create index if not exists newsletter_campaigns_worker_idx
  on public.newsletter_campaigns (status, scheduled_at, created_at);
create index if not exists newsletter_deliveries_worker_idx
  on public.newsletter_deliveries (campaign_id, status, updated_at);
drop trigger if exists newsletter_campaigns_updated_at on public.newsletter_campaigns;
create trigger newsletter_campaigns_updated_at
  before update on public.newsletter_campaigns
  for each row execute function private.set_updated_at();
drop trigger if exists newsletter_deliveries_updated_at on public.newsletter_deliveries;
create trigger newsletter_deliveries_updated_at
  before update on public.newsletter_deliveries
  for each row execute function private.set_updated_at();
alter table public.newsletter_campaigns enable row level security;
alter table public.newsletter_deliveries enable row level security;
revoke all on table public.newsletter_campaigns from public, anon, authenticated;
revoke all on table public.newsletter_deliveries from public, anon, authenticated;
grant select, insert, update, delete on table public.newsletter_campaigns to service_role;
grant select, insert, update, delete on table public.newsletter_deliveries to service_role;
-- A cron invocation claims at most one due campaign. The row lock and lease
-- keep overlapping worker invocations from sending the same delivery twice.
create or replace function public.claim_newsletter_campaign()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_campaign_id uuid;
begin
  if auth.role() is distinct from 'service_role' and current_user <> 'postgres' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;

  select id into v_campaign_id
  from public.newsletter_campaigns
  where (
    status = 'scheduled' and scheduled_at <= now()
  ) or (
    status = 'sending'
    and (worker_locked_at is null or worker_locked_at < now() - interval '2 minutes')
  )
  order by coalesce(scheduled_at, created_at), created_at
  for update skip locked
  limit 1;

  if v_campaign_id is null then return null; end if;

  update public.newsletter_campaigns
  set
    status = 'sending',
    started_at = coalesce(started_at, now()),
    worker_locked_at = now()
  where id = v_campaign_id;

  -- A worker interrupted after claiming a delivery can safely retry it. Resend
  -- receives a stable idempotency key for the delivery UUID.
  update public.newsletter_deliveries
  set status = 'queued'
  where campaign_id = v_campaign_id
    and status = 'sending'
    and updated_at < now() - interval '10 minutes';

  return v_campaign_id;
end;
$$;
revoke all on function public.claim_newsletter_campaign() from public, anon, authenticated;
grant execute on function public.claim_newsletter_campaign() to service_role;
-- Reuse the project's existing Vault convention. No service credential is
-- committed to source control or exposed to a client bundle.
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
revoke all on function private.invoke_newsletter_worker() from public, anon, authenticated;
do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job from cron.job
  where jobname = 'cozycraft-send-newsletter-campaigns';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule(
    'cozycraft-send-newsletter-campaigns',
    '* * * * *',
    'select private.invoke_newsletter_worker()'
  );
end
$$;
comment on table public.newsletter_campaigns is
  'Draft, scheduled, and completed CozyCraft editorial email campaigns.';
comment on table public.newsletter_deliveries is
  'Idempotent per-recipient newsletter delivery attempts, inaccessible to clients.';
