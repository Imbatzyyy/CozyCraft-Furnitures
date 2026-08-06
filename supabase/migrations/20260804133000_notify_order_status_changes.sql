create or replace function private.notify_customer_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  notification_title text;
  notification_message text;
begin
  if tg_op <> 'UPDATE' or old.status is not distinct from new.status then
    return new;
  end if;

  notification_title := case new.status
    when 'processing' then 'Order confirmed'
    when 'packed' then 'Your order is packed'
    when 'shipped' then 'Your order is on the way'
    when 'delivered' then 'Order delivered'
    when 'cancelled' then 'Order cancelled'
    else 'Order status updated'
  end;

  notification_message := case new.status
    when 'processing' then format('Order %s is now being prepared.', new.order_number)
    when 'packed' then format('Order %s has been packed and is ready for dispatch.', new.order_number)
    when 'shipped' then format('Order %s has shipped. You can follow its progress in My Orders.', new.order_number)
    when 'delivered' then format('Order %s was delivered. We hope you enjoy your CozyCraft pieces.', new.order_number)
    when 'cancelled' then format('Order %s was cancelled. Open My Orders for refund and support details.', new.order_number)
    else format('Order %s is now %s.', new.order_number, replace(new.status::text, '_', ' '))
  end;

  insert into public.customer_notifications (
    user_id,
    kind,
    title,
    message,
    entity_type,
    entity_id
  ) values (
    new.user_id,
    'order_status',
    notification_title,
    notification_message,
    'orders',
    new.id::text
  );

  return new;
end;
$$;

drop trigger if exists notify_customer_order_status_change on public.orders;
create trigger notify_customer_order_status_change
after update of status on public.orders
for each row
when (old.status is distinct from new.status)
execute function private.notify_customer_order_status_change();


