create table if not exists public.inventory_movements (
  id bigint generated always as identity primary key,
  product_id text not null references public.products(id) on delete cascade,
  previous_quantity integer not null check (previous_quantity >= 0),
  new_quantity integer not null check (new_quantity >= 0),
  quantity_delta integer not null,
  reason text not null default 'Stock updated',
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists inventory_movements_product_created_idx
  on public.inventory_movements(product_id, created_at desc);
create index if not exists inventory_movements_created_idx
  on public.inventory_movements(created_at desc);

alter table public.inventory_movements enable row level security;

create policy "inventory_movements_staff_select"
  on public.inventory_movements for select
  to authenticated using ((select private.is_staff()));

revoke all on public.inventory_movements from anon;
grant select on public.inventory_movements to authenticated;

create or replace function private.record_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  movement_reason text;
begin
  if new.stock_quantity is distinct from old.stock_quantity then
    movement_reason := nullif(current_setting('app.inventory_reason', true), '');
    insert into public.inventory_movements (
      product_id, previous_quantity, new_quantity, quantity_delta, reason, actor_id
    ) values (
      new.id,
      old.stock_quantity,
      new.stock_quantity,
      new.stock_quantity - old.stock_quantity,
      coalesce(movement_reason, 'System stock update'),
      auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists products_inventory_movement on public.products;
create trigger products_inventory_movement
after update of stock_quantity on public.products
for each row execute function private.record_inventory_movement();

create or replace function public.adjust_product_inventory(
  p_product_id text,
  p_delta integer,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  current_quantity integer;
  resulting_quantity integer;
begin
  if not private.is_staff() then
    raise exception 'Administrator access required';
  end if;
  if p_delta = 0 then
    raise exception 'Adjustment must not be zero';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'A reason is required';
  end if;

  select stock_quantity into current_quantity
  from public.products
  where id = p_product_id
  for update;

  if current_quantity is null then
    raise exception 'Product not found';
  end if;

  resulting_quantity := current_quantity + p_delta;
  if resulting_quantity < 0 then
    raise exception 'Stock cannot be negative';
  end if;

  perform set_config('app.inventory_reason', trim(p_reason), true);
  update public.products
  set stock_quantity = resulting_quantity
  where id = p_product_id;

  return resulting_quantity;
end;
$$;

revoke all on function public.adjust_product_inventory(text, integer, text) from public;
grant execute on function public.adjust_product_inventory(text, integer, text) to authenticated;

alter publication supabase_realtime add table public.inventory_movements;
