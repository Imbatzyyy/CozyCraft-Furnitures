create or replace function private.enforce_order_status_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status = old.status then return new; end if;

  if not (
    (old.status = 'pending' and new.status in ('processing', 'cancelled')) or
    (old.status = 'processing' and new.status in ('packed', 'cancelled')) or
    (old.status = 'packed' and new.status in ('shipped', 'cancelled')) or
    (old.status = 'shipped' and new.status = 'delivered')
  ) then
    raise exception 'Invalid order status transition from % to %', old.status, new.status;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_order_status_transition on public.orders;
create trigger enforce_order_status_transition
before update of status on public.orders
for each row execute function private.enforce_order_status_transition();
