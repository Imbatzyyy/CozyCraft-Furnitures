-- Device registrations for battery-safe background notifications. Tokens are
-- never exposed across accounts and can only be registered for auth.uid().
create table if not exists public.mobile_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('android', 'ios', 'web', 'unknown')),
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists mobile_push_tokens_user_active_idx
  on public.mobile_push_tokens(user_id, active);

alter table public.mobile_push_tokens enable row level security;
revoke all on public.mobile_push_tokens from public, anon, authenticated;
grant select, delete on public.mobile_push_tokens to authenticated;

create policy "mobile_push_tokens_own_select"
on public.mobile_push_tokens for select to authenticated
using (user_id = auth.uid());

create policy "mobile_push_tokens_own_delete"
on public.mobile_push_tokens for delete to authenticated
using (user_id = auth.uid());

create or replace function public.register_mobile_push_token(
  p_token text,
  p_platform text default 'unknown'
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_platform text := lower(coalesce(nullif(trim(p_platform), ''), 'unknown'));
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(p_token, ''))) < 20 then raise exception 'Invalid push token'; end if;
  if v_platform not in ('android', 'ios', 'web', 'unknown') then v_platform := 'unknown'; end if;

  insert into public.mobile_push_tokens(user_id, token, platform, active, last_seen_at)
  values (v_user_id, trim(p_token), v_platform, true, now())
  on conflict (token) do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    active = true,
    last_seen_at = now();
end;
$$;

create or replace function public.unregister_mobile_push_token(p_token text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.mobile_push_tokens
  where user_id = auth.uid() and token = trim(p_token);
$$;

revoke all on function public.register_mobile_push_token(text, text) from public;
revoke all on function public.unregister_mobile_push_token(text) from public;
grant execute on function public.register_mobile_push_token(text, text) to authenticated;
grant execute on function public.unregister_mobile_push_token(text) to authenticated;
