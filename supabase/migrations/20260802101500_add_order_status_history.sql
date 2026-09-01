create table if not exists public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null,
  unique (order_id, status)
);

create index if not exists order_status_history_order_time_idx
  on public.order_status_history(order_id, changed_at);

alter table public.order_status_history enable row level security;

drop policy if exists "order_status_history_select_own_or_staff" on public.order_status_history;
create policy "order_status_history_select_own_or_staff"
on public.order_status_history for select to authenticated
using (
  exists (
    select 1 from public.orders
    where orders.id = order_status_history.order_id
      and (orders.user_id = (select auth.uid()) or (select private.is_staff()))
  )
);

revoke all on public.order_status_history from public, anon, authenticated;
grant select on public.order_status_history to authenticated;

create or replace function private.record_order_status_history()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.order_status_history(order_id, status, changed_at, changed_by)
    values (new.id, new.status, coalesce(new.updated_at, now()), (select auth.uid()))
    on conflict (order_id, status) do update
      set changed_at = excluded.changed_at,
          changed_by = excluded.changed_by;
  end if;
  return new;
end;
$$;

drop trigger if exists record_order_status_history on public.orders;
create trigger record_order_status_history
after insert or update of status on public.orders
for each row execute function private.record_order_status_history();

insert into public.order_status_history(order_id, status, changed_at)
select id, 'pending'::public.order_status, created_at
from public.orders
on conflict (order_id, status) do nothing;

insert into public.order_status_history(order_id, status, changed_at)
select id, status, coalesce(updated_at, created_at)
from public.orders
where status <> 'pending'
on conflict (order_id, status) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'order_status_history'
  ) then
    alter publication supabase_realtime add table public.order_status_history;
  end if;
end
$$;
