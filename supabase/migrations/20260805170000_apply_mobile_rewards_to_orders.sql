alter table public.orders
  add column if not exists home_circle_redemption_id uuid references public.mobile_loyalty_redemptions(id) on delete set null,
  add column if not exists reward_discount numeric(12,2) not null default 0 check (reward_discount >= 0);

create or replace function public.apply_mobile_reward_to_order(p_order_id uuid, p_redemption_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_user uuid := auth.uid();
  v_order public.orders;
  v_reward public.mobile_loyalty_redemptions;
  v_discount numeric(12,2);
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  select * into v_order from public.orders
    where id = p_order_id and user_id = v_user for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.home_circle_redemption_id = p_redemption_id then
    return v_order;
  end if;
  if v_order.home_circle_redemption_id is not null then
    raise exception 'This order already has a Home Circle reward';
  end if;
  if v_order.status in ('cancelled','delivered') or v_order.payment_status in ('paid','refunded','failed') then
    raise exception 'This order can no longer accept a reward';
  end if;

  select * into v_reward from public.mobile_loyalty_redemptions
    where id = p_redemption_id and user_id = v_user for update;
  if not found or v_reward.status <> 'available' or v_reward.expires_at <= now() then
    raise exception 'This Home Circle reward is unavailable or expired';
  end if;

  v_discount := least(v_reward.discount_amount, greatest(v_order.total - 1, 0));
  if v_discount <= 0 then raise exception 'This order cannot use the selected reward'; end if;

  update public.orders set
    total = total - v_discount,
    reward_discount = v_discount,
    home_circle_redemption_id = v_reward.id,
    updated_at = now()
  where id = v_order.id returning * into v_order;

  update public.mobile_loyalty_redemptions
    set status = 'applied', used_at = now()
    where id = v_reward.id;
  return v_order;
end;
$$;

revoke all on function public.apply_mobile_reward_to_order(uuid,uuid) from public, anon;
grant execute on function public.apply_mobile_reward_to_order(uuid,uuid) to authenticated;

create or replace function private.restore_mobile_order_reward()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.home_circle_redemption_id is not null
     and (new.status = 'cancelled' or new.payment_status in ('failed','refunded'))
     and not (old.status = 'cancelled' or old.payment_status in ('failed','refunded')) then
    update public.mobile_loyalty_redemptions
      set status = 'available', used_at = null
      where id = new.home_circle_redemption_id and status = 'applied';
  end if;
  return new;
end;
$$;

drop trigger if exists restore_mobile_order_reward_trigger on public.orders;
create trigger restore_mobile_order_reward_trigger
after update of status, payment_status on public.orders
for each row execute function private.restore_mobile_order_reward();
