create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  provider text not null default 'paymongo' check (provider = 'paymongo'),
  provider_session_id text unique,
  provider_payment_id text,
  checkout_url text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'expired', 'refunded')),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  livemode boolean not null default false,
  raw_payload jsonb not null default '{}'::jsonb,
  failure_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders
  add column inventory_released_at timestamptz;

create or replace function private.restore_cancelled_order_inventory()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_item record;
begin
  if new.status = 'cancelled'
     and old.status <> 'cancelled'
     and old.inventory_released_at is null then
    for v_item in
      select product_id, quantity
      from public.order_items
      where order_id = new.id and product_id is not null
    loop
      update public.products
      set stock_quantity = stock_quantity + v_item.quantity
      where id = v_item.product_id;
    end loop;
    new.inventory_released_at := now();
  end if;
  return new;
end;
$$;

revoke all on function private.restore_cancelled_order_inventory()
from public, anon, authenticated;

drop trigger if exists restore_cancelled_order_inventory on public.orders;
create trigger restore_cancelled_order_inventory
before update of status on public.orders
for each row execute function private.restore_cancelled_order_inventory();

create index payment_transactions_status_created_at_idx
  on public.payment_transactions(status, created_at desc);
create index payment_transactions_provider_payment_id_idx
  on public.payment_transactions(provider_payment_id)
  where provider_payment_id is not null;

alter table public.payment_transactions enable row level security;

create policy "payment_transactions_select_own_or_staff"
on public.payment_transactions for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where orders.id = payment_transactions.order_id
      and (
        orders.user_id = (select auth.uid())
        or (select private.is_staff())
      )
  )
);

revoke all on public.payment_transactions from public, anon, authenticated;
grant select on public.payment_transactions to authenticated;

create or replace function public.place_order(
  p_address_id uuid,
  p_payment_method text,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, private
as $$
begin
  if p_payment_method not in ('cod', 'card', 'gcash') then
    raise exception 'Unsupported payment method';
  end if;

  return private.place_order(p_address_id, p_payment_method, p_items);
end;
$$;

revoke all on function public.place_order(uuid, text, jsonb) from public, anon;
grant execute on function public.place_order(uuid, text, jsonb) to authenticated;

create or replace function public.fail_paymongo_order(
  p_order_id uuid,
  p_reason text default 'PayMongo checkout creation failed'
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found
     or v_order.payment_method = 'cod'
     or v_order.payment_status <> 'pending'
     or v_order.status = 'cancelled' then
    return;
  end if;

  update public.orders
  set status = 'cancelled', payment_status = 'failed'
  where id = p_order_id;

  update public.payment_transactions
  set status = 'failed', failure_reason = left(coalesce(p_reason, ''), 500), updated_at = now()
  where order_id = p_order_id;
end;
$$;

revoke all on function public.fail_paymongo_order(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_paymongo_order(uuid, text) to service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'payment_transactions'
  ) then
    alter publication supabase_realtime add table public.payment_transactions;
  end if;
end;
$$;
