alter table public.orders
  add column if not exists cancellation_reason text,
  add column if not exists cancellation_requested_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null,
  add column if not exists refund_status text,
  add column if not exists provider_refund_id text,
  add column if not exists refunded_at timestamptz;

alter table public.orders drop constraint if exists orders_refund_status_check;
alter table public.orders add constraint orders_refund_status_check
  check (refund_status is null or refund_status in ('processing', 'succeeded', 'failed', 'demo_succeeded'));

create table if not exists public.customer_notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  message text not null,
  entity_type text,
  entity_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists customer_notifications_user_created_idx
  on public.customer_notifications(user_id, created_at desc);

alter table public.customer_notifications enable row level security;

drop policy if exists "customer_notifications_own_read" on public.customer_notifications;
create policy "customer_notifications_own_read"
on public.customer_notifications for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "customer_notifications_own_update" on public.customer_notifications;
create policy "customer_notifications_own_update"
on public.customer_notifications for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on public.customer_notifications from public, anon, authenticated;
grant select, update on public.customer_notifications to authenticated;

create or replace function private.guard_paid_order_cancellation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'cancelled'
     and old.status <> 'cancelled'
     and old.payment_status = 'paid'
     and new.payment_status <> 'refunded' then
    raise exception 'Paid orders must be refunded before cancellation';
  end if;
  if old.status in ('shipped', 'delivered') and new.status = 'cancelled' then
    raise exception 'Shipped or delivered orders require the return workflow';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_paid_order_cancellation on public.orders;
create trigger guard_paid_order_cancellation
before update of status, payment_status on public.orders
for each row execute function private.guard_paid_order_cancellation();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'customer_notifications'
  ) then
    alter publication supabase_realtime add table public.customer_notifications;
  end if;
end
$$;
