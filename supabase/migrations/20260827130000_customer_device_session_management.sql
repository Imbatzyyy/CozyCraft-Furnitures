-- Keep a compact, privacy-conscious device registry for customer account
-- security. We intentionally store friendly device/browser labels instead of
-- raw user-agent strings or IP addresses.

create table if not exists public.customer_device_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_label text not null check (char_length(device_label) between 1 and 80),
  browser_label text not null check (char_length(browser_label) between 1 and 80),
  signed_in_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists customer_device_sessions_user_recent_idx
  on public.customer_device_sessions (user_id, last_seen_at desc);

alter table public.customer_device_sessions enable row level security;
revoke all on table public.customer_device_sessions from anon, authenticated;
grant all on table public.customer_device_sessions to service_role;

create or replace function public.touch_customer_device_session(
  p_session_id uuid,
  p_device_label text,
  p_browser_label text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_current_session_id uuid := nullif((select auth.jwt()->>'session_id'), '')::uuid;
  v_active boolean;
begin
  if v_user_id is null or v_current_session_id is null or p_session_id is distinct from v_current_session_id then
    raise exception 'The active session could not be verified.' using errcode = '42501';
  end if;

  if btrim(coalesce(p_device_label, '')) = '' or btrim(coalesce(p_browser_label, '')) = '' then
    raise exception 'Device details are required.' using errcode = '22023';
  end if;

  insert into public.customer_device_sessions (
    session_id,
    user_id,
    device_label,
    browser_label
  ) values (
    p_session_id,
    v_user_id,
    left(btrim(p_device_label), 80),
    left(btrim(p_browser_label), 80)
  )
  on conflict (session_id) do update
  set device_label = excluded.device_label,
      browser_label = excluded.browser_label,
      last_seen_at = now()
  where customer_device_sessions.user_id = excluded.user_id
    and customer_device_sessions.revoked_at is null
    and (
      customer_device_sessions.last_seen_at < now() - interval '15 minutes'
      or customer_device_sessions.device_label is distinct from excluded.device_label
      or customer_device_sessions.browser_label is distinct from excluded.browser_label
    );

  select exists (
    select 1
    from public.customer_device_sessions
    where session_id = p_session_id
      and user_id = v_user_id
      and revoked_at is null
  ) into v_active;

  return v_active;
end;
$$;

create or replace function public.list_customer_device_sessions()
returns table (
  session_id uuid,
  device_label text,
  browser_label text,
  signed_in_at timestamptz,
  last_seen_at timestamptz,
  is_current boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    sessions.session_id,
    sessions.device_label,
    sessions.browser_label,
    sessions.signed_in_at,
    sessions.last_seen_at,
    sessions.session_id = nullif((select auth.jwt()->>'session_id'), '')::uuid as is_current
  from public.customer_device_sessions as sessions
  where sessions.user_id = (select auth.uid())
    and sessions.revoked_at is null
    and sessions.last_seen_at >= now() - interval '90 days'
  order by is_current desc, sessions.last_seen_at desc
  limit 12;
$$;

create or replace function public.revoke_customer_device_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_session_id uuid := nullif((select auth.jwt()->>'session_id'), '')::uuid;
begin
  if (select auth.uid()) is null or v_current_session_id is null then
    raise exception 'The active session could not be verified.' using errcode = '42501';
  end if;
  if p_session_id = v_current_session_id then
    raise exception 'The current device cannot be signed out from this control.' using errcode = '22023';
  end if;

  update public.customer_device_sessions
  set revoked_at = now()
  where session_id = p_session_id
    and user_id = (select auth.uid())
    and revoked_at is null;

  return found;
end;
$$;

create or replace function public.revoke_other_customer_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_session_id uuid := nullif((select auth.jwt()->>'session_id'), '')::uuid;
  v_count integer;
begin
  if (select auth.uid()) is null or v_current_session_id is null then
    raise exception 'The active session could not be verified.' using errcode = '42501';
  end if;

  update public.customer_device_sessions
  set revoked_at = now()
  where user_id = (select auth.uid())
    and session_id <> v_current_session_id
    and revoked_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.touch_customer_device_session(uuid, text, text) from public, anon;
revoke all on function public.list_customer_device_sessions() from public, anon;
revoke all on function public.revoke_customer_device_session(uuid) from public, anon;
revoke all on function public.revoke_other_customer_sessions() from public, anon;
grant execute on function public.touch_customer_device_session(uuid, text, text) to authenticated, service_role;
grant execute on function public.list_customer_device_sessions() to authenticated, service_role;
grant execute on function public.revoke_customer_device_session(uuid) to authenticated, service_role;
grant execute on function public.revoke_other_customer_sessions() to authenticated, service_role;

create or replace function private.customer_session_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then false
    when nullif((select auth.jwt()->>'session_id'), '') is null then true
    when not exists (
      select 1
      from public.customer_device_sessions
      where session_id = nullif((select auth.jwt()->>'session_id'), '')::uuid
        and user_id = (select auth.uid())
    ) then true
    else exists (
      select 1
      from public.customer_device_sessions
      where session_id = nullif((select auth.jwt()->>'session_id'), '')::uuid
        and user_id = (select auth.uid())
        and revoked_at is null
    )
  end;
$$;

revoke all on function private.customer_session_allowed() from public, anon;
grant execute on function private.customer_session_allowed() to authenticated, service_role;

create or replace function private.customer_mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then false
    when not (select private.customer_session_allowed()) then false
    when exists (
      select 1
      from auth.mfa_factors
      where user_id = (select auth.uid())
        and status = 'verified'
    ) then coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2'
    else true
  end;
$$;

comment on table public.customer_device_sessions is
  'Compact customer device registry used for account security controls; no IP address or raw user agent is retained.';
comment on function public.list_customer_device_sessions() is
  'Returns at most twelve non-revoked devices used by the current customer during the last ninety days.';
comment on function public.revoke_customer_device_session(uuid) is
  'Revokes one other CozyCraft customer session after verifying row ownership and protecting the current browser.';
