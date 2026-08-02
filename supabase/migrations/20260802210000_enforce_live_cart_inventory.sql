-- Keep persisted carts truthful as inventory changes across devices. Checkout
-- still performs authoritative row locks, but invalid quantities should never
-- be accepted or remain saved before checkout.

create or replace function private.validate_cart_inventory()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_stock integer;
  v_status public.product_status;
begin
  select stock_quantity, status
    into v_stock, v_status
  from public.products
  where id = new.product_id;

  if not found or v_status <> 'active' then
    raise exception 'This product is not currently available.';
  end if;
  if v_stock <= 0 then
    raise exception 'This product is out of stock.';
  end if;
  if new.quantity > v_stock then
    raise exception 'Only % units are currently available.', v_stock;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_cart_inventory on public.cart_items;
create trigger validate_cart_inventory
before insert or update of product_id, quantity on public.cart_items
for each row execute function private.validate_cart_inventory();

create or replace function private.reconcile_carts_after_inventory_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status <> 'active' or new.stock_quantity <= 0 then
    delete from public.cart_items where product_id = new.id;
  elsif new.stock_quantity < old.stock_quantity then
    update public.cart_items
       set quantity = new.stock_quantity,
           updated_at = now()
     where product_id = new.id
       and quantity > new.stock_quantity;
  end if;
  return new;
end;
$$;

drop trigger if exists reconcile_carts_after_inventory_change on public.products;
create trigger reconcile_carts_after_inventory_change
after update of stock_quantity, status on public.products
for each row
when (new.stock_quantity is distinct from old.stock_quantity or new.status is distinct from old.status)
execute function private.reconcile_carts_after_inventory_change();

revoke all on function private.validate_cart_inventory() from public;
revoke all on function private.reconcile_carts_after_inventory_change() from public;
