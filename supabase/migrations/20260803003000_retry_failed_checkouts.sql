-- A checkout key protects customers from duplicate orders when a request is
-- retried. Failed/cancelled attempts, however, must not permanently capture
-- that key or every later retry resolves to an unusable order.

create or replace function public.place_order(
  p_address_id uuid,
  p_payment_method text,
  p_items jsonb,
  p_checkout_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_existing public.orders%rowtype;
  v_order_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_checkout_key is null then raise exception 'Checkout key is required'; end if;
  if p_payment_method not in ('cod', 'card', 'gcash') then raise exception 'Unsupported payment method'; end if;

  select * into v_existing
  from public.orders
  where user_id = v_user_id and checkout_key = p_checkout_key
  for update;

  if found then
    if v_existing.status <> 'cancelled'
       and v_existing.payment_status <> 'failed' then
      return v_existing.id;
    end if;

    -- Keep the failed order for the audit trail, but release this retry key.
    update public.orders
       set checkout_key = null
     where id = v_existing.id
       and user_id = v_user_id;
  end if;

  v_order_id := private.place_order(p_address_id, p_payment_method, p_items);
  update public.orders
     set checkout_key = p_checkout_key
   where id = v_order_id
     and user_id = v_user_id;
  return v_order_id;
exception
  when unique_violation then
    select id into v_order_id
    from public.orders
    where user_id = v_user_id
      and checkout_key = p_checkout_key
      and status <> 'cancelled'
      and payment_status <> 'failed';
    if v_order_id is not null then return v_order_id; end if;
    raise;
end;
$function$;

revoke all on function public.place_order(uuid, text, jsonb, uuid)
from public, anon;
grant execute on function public.place_order(uuid, text, jsonb, uuid)
to authenticated;
