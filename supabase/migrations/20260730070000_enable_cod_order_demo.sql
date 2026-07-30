create or replace function public.place_order(
  p_address_id uuid,
  p_payment_method text,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, private
as $$
begin
  if p_payment_method <> 'cod' then
    raise exception 'Cash on delivery is the only payment method currently available';
  end if;

  return private.place_order(p_address_id, p_payment_method, p_items);
end;
$$;

revoke all on function public.place_order(uuid, text, jsonb) from public, anon;
grant execute on function public.place_order(uuid, text, jsonb) to authenticated;

create or replace function private.log_order_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      details
    )
    values (
      new.user_id,
      'order_placed',
      'order',
      new.id::text,
      jsonb_build_object(
        'order_number', new.order_number,
        'payment_method', new.payment_method,
        'total', new.total,
        'status', new.status
      )
    );
  elsif old.status is distinct from new.status
     or old.payment_status is distinct from new.payment_status then
    insert into public.activity_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      details
    )
    values (
      (select auth.uid()),
      'order_updated',
      'order',
      new.id::text,
      jsonb_build_object(
        'order_number', new.order_number,
        'previous_status', old.status,
        'status', new.status,
        'payment_status', new.payment_status
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function private.log_order_activity() from public, anon, authenticated;

drop trigger if exists orders_activity_log on public.orders;
create trigger orders_activity_log
after insert or update on public.orders
for each row execute function private.log_order_activity();
