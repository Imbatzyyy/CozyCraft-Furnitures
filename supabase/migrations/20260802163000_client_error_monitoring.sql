create table if not exists public.client_error_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  message text not null,
  stack text,
  path text not null default '/',
  context text not null default 'application',
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists client_error_events_created_idx
  on public.client_error_events(created_at desc);
create index if not exists client_error_events_user_created_idx
  on public.client_error_events(user_id, created_at desc);

alter table public.client_error_events enable row level security;

create policy "client_errors_staff_select"
  on public.client_error_events for select to authenticated
  using ((select private.is_staff()));

revoke all on public.client_error_events from public, anon, authenticated;
grant select on public.client_error_events to authenticated;

create or replace function public.report_client_error(
  p_message text,
  p_stack text,
  p_path text,
  p_context text,
  p_user_agent text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then return; end if;
  if length(trim(coalesce(p_message, ''))) = 0 then return; end if;

  if (
    select count(*) from public.client_error_events
    where user_id = v_user_id and created_at > now() - interval '1 hour'
  ) >= 20 then
    return;
  end if;

  insert into public.client_error_events(user_id, message, stack, path, context, user_agent)
  values (
    v_user_id,
    left(p_message, 1000),
    left(coalesce(p_stack, ''), 5000),
    left(coalesce(p_path, '/'), 500),
    left(coalesce(p_context, 'application'), 100),
    left(coalesce(p_user_agent, ''), 500)
  );
end;
$$;

revoke all on function public.report_client_error(text, text, text, text, text)
from public, anon;
grant execute on function public.report_client_error(text, text, text, text, text)
to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'client_error_events'
  ) then
    alter publication supabase_realtime add table public.client_error_events;
  end if;
end
$$;
