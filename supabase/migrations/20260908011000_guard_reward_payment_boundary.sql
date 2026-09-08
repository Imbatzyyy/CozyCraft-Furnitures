-- The shared application helper is also callable directly by older clients.
-- Protect that path as well: a voucher cannot change an already-created
-- provider session's amount or an order that has entered fulfillment.
alter function public.apply_mobile_reward_to_order(uuid,uuid) set schema private;
revoke all on function private.apply_mobile_reward_to_order(uuid,uuid) from public,anon,authenticated;
create function public.apply_mobile_reward_to_order(p_order_id uuid,p_redemption_id uuid)
returns public.orders language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_order public.orders;
begin
  if not coalesce(public.security_action_allowed(),false) then raise exception 'Please sign in and complete account verification'; end if;
  select * into v_order from public.orders where id=p_order_id and user_id=auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.home_circle_redemption_id is null and
    (v_order.status<>'pending' or exists(select 1 from public.payment_transactions where order_id=v_order.id)) then
    raise exception 'Payment or fulfillment has already started for this order';
  end if;
  return private.apply_mobile_reward_to_order(p_order_id,p_redemption_id);
end; $$;
revoke all on function public.apply_mobile_reward_to_order(uuid,uuid) from public,anon;
grant execute on function public.apply_mobile_reward_to_order(uuid,uuid) to authenticated;
