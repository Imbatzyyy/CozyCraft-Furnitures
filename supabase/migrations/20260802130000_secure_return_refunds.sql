alter table public.return_requests
  add column inventory_restored_at timestamptz,
  add column provider_refund_id text,
  add column refunded_at timestamptz;

create or replace function private.restore_returned_inventory()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_item record;
begin
  if new.status in ('item_received','refund_processing','refunded','closed')
     and old.status not in ('item_received','refund_processing','refunded','closed')
     and old.inventory_restored_at is null then
    for v_item in select product_id,quantity from public.order_items where order_id=new.order_id and product_id is not null loop
      update public.products set stock_quantity=stock_quantity+v_item.quantity where id=v_item.product_id;
    end loop;
    new.inventory_restored_at=now();
  end if;
  return new;
end $$;

create trigger restore_returned_inventory before update of status on public.return_requests
for each row execute function private.restore_returned_inventory();

create or replace function private.guard_return_refund_status()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  if new.status='refunded' and old.status<>'refunded' and new.refunded_at is null then
    raise exception 'Use the protected refund workflow';
  end if;
  return new;
end $$;
create trigger guard_return_refund_status before update of status on public.return_requests
for each row execute function private.guard_return_refund_status();
