-- Restore the product relationship for legacy/demo order items so delivered
-- purchases can use the verified-review flow.
update public.order_items as order_item
set product_id = product.id
from public.products as product
where order_item.product_id is null
  and lower(btrim(order_item.product_name)) = lower(btrim(product.name));

-- Preserve the relationship for any integration that sends a product name but
-- omits product_id. The trigger only fills a missing value and never overrides
-- an explicit product selection.
create or replace function private.link_order_item_product()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.product_id is null and nullif(btrim(new.product_name), '') is not null then
    select product.id
    into new.product_id
    from public.products as product
    where lower(btrim(product.name)) = lower(btrim(new.product_name))
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists link_order_item_product on public.order_items;
create trigger link_order_item_product
before insert or update of product_id, product_name on public.order_items
for each row execute function private.link_order_item_product();
