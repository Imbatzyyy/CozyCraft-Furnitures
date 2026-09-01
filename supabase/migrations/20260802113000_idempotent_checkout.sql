alter table public.orders add column if not exists checkout_key uuid;

create unique index if not exists orders_user_checkout_key_uidx
  on public.orders(user_id, checkout_key)
  where checkout_key is not null;

drop function if exists public.place_order(uuid, text, jsonb);

create or replace function public.place_order(
  p_address_id uuid,
  p_payment_method text,
  p_items jsonb,
  p_checkout_key uuid
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_existing uuid;
  v_order_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_checkout_key is null then raise exception 'Checkout key is required'; end if;
  if p_payment_method not in ('cod', 'card', 'gcash') then raise exception 'Unsupported payment method'; end if;

  select id into v_existing
  from public.orders
  where user_id = v_user_id and checkout_key = p_checkout_key;
  if found then return v_existing; end if;

  v_order_id := private.place_order(p_address_id, p_payment_method, p_items);
  update public.orders set checkout_key = p_checkout_key where id = v_order_id;
  return v_order_id;
exception
  when unique_violation then
    select id into v_existing
    from public.orders
    where user_id = v_user_id and checkout_key = p_checkout_key;
    if v_existing is not null then return v_existing; end if;
    raise;
end;
$$;

revoke all on function public.place_order(uuid, text, jsonb, uuid) from public, anon;
grant execute on function public.place_order(uuid, text, jsonb, uuid) to authenticated;
