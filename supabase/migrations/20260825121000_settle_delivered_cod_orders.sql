-- A delivered cash-on-delivery order has been collected by definition. Keep
-- this invariant in the database so the storefront, admin, mobile clients,
-- reports, and downloadable receipts all receive the same settled status.
create or replace function private.settle_cod_payment_on_delivery()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.payment_method = 'cod'
     and new.status = 'delivered'
     and new.payment_status = 'pending' then
    new.payment_status := 'paid';
  end if;

  return new;
end;
$$;

revoke all on function private.settle_cod_payment_on_delivery() from public, anon, authenticated;

drop trigger if exists settle_cod_payment_on_delivery on public.orders;
create trigger settle_cod_payment_on_delivery
before insert or update of status, payment_method, payment_status
on public.orders
for each row
execute function private.settle_cod_payment_on_delivery();

-- Repair delivered COD orders created before the invariant existed. This is
-- intentionally one bounded update and does not add a recurring read/query.
update public.orders
set payment_status = 'paid'
where payment_method = 'cod'
  and status = 'delivered'
  and payment_status = 'pending';
