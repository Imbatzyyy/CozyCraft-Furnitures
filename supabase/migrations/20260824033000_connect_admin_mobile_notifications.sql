-- Deliver actionable admin events without polling the database. Postgres writes
-- the durable notification row first, then pg_net dispatches asynchronously to
-- registered mobile devices. Secrets remain in Vault and never enter source.

create extension if not exists pg_net with schema extensions;

create or replace function private.dispatch_admin_notification_push()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_project_url text;
  v_webhook_secret text;
begin
  select decrypted_secret into v_project_url
  from vault.decrypted_secrets
  where name = 'cozycraft_project_url'
  limit 1;

  select decrypted_secret into v_webhook_secret
  from vault.decrypted_secrets
  where name = 'admin_push_webhook_secret'
  limit 1;

  if nullif(trim(v_project_url), '') is null
     or nullif(trim(v_webhook_secret), '') is null then
    raise warning 'Admin push dispatch is not configured';
    return new;
  end if;

  perform net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/dispatch-admin-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cozycraft-webhook-secret', v_webhook_secret
    ),
    body := jsonb_build_object(
      'type', tg_op,
      'table', tg_table_name,
      'schema', tg_table_schema,
      'record', to_jsonb(new),
      'old_record', null
    ),
    timeout_milliseconds := 5000
  );
  return new;
exception
  when others then
    raise warning 'Admin push dispatch failed to queue: %', sqlerrm;
    return new;
end;
$$;

revoke all on function private.dispatch_admin_notification_push() from public;

drop trigger if exists dispatch_admin_notification_push on public.admin_notifications;
create trigger dispatch_admin_notification_push
after insert on public.admin_notifications
for each row execute function private.dispatch_admin_notification_push();

-- Keep the existing customer notification webhook secret out of trigger
-- metadata as well. This preserves its behavior while allowing safe rotation.
create or replace function private.dispatch_customer_notification_push()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_project_url text;
  v_webhook_secret text;
begin
  select decrypted_secret into v_project_url
  from vault.decrypted_secrets
  where name = 'cozycraft_project_url'
  limit 1;

  select decrypted_secret into v_webhook_secret
  from vault.decrypted_secrets
  where name = 'customer_push_webhook_secret'
  limit 1;

  if nullif(trim(v_project_url), '') is null
     or nullif(trim(v_webhook_secret), '') is null then
    raise warning 'Customer push dispatch is not configured';
    return new;
  end if;

  perform net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/send-mobile-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_webhook_secret
    ),
    body := jsonb_build_object(
      'type', tg_op,
      'table', tg_table_name,
      'schema', tg_table_schema,
      'record', to_jsonb(new),
      'old_record', null
    ),
    timeout_milliseconds := 5000
  );
  return new;
exception
  when others then
    raise warning 'Customer push dispatch failed to queue: %', sqlerrm;
    return new;
end;
$$;

revoke all on function private.dispatch_customer_notification_push() from public;

drop trigger if exists send_mobile_push on public.customer_notifications;
drop trigger if exists dispatch_customer_notification_push on public.customer_notifications;
create trigger dispatch_customer_notification_push
after insert on public.customer_notifications
for each row execute function private.dispatch_customer_notification_push();

-- Actionable order workflow events that deserve an immediate administrator
-- alert in addition to the original new-order notification.
create or replace function private.notify_admin_order_workflow()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.cancellation_status is distinct from new.cancellation_status
     and new.cancellation_status = 'pending' then
    insert into public.admin_notifications(kind, title, message, entity_type, entity_id, route)
    values (
      'order',
      'Cancellation review needed',
      format('Order %s has a customer cancellation request.', new.order_number),
      'orders', new.id::text, '/admin/orders'
    );
  elsif old.payment_status is distinct from new.payment_status
        and new.payment_status in ('paid', 'refunded') then
    insert into public.admin_notifications(kind, title, message, entity_type, entity_id, route)
    values (
      'order',
      case when new.payment_status = 'paid' then 'Payment settled' else 'Payment refunded' end,
      format('Order %s is now %s.', new.order_number, new.payment_status),
      'orders', new.id::text, '/admin/orders'
    );
  end if;
  return new;
end;
$$;

revoke all on function private.notify_admin_order_workflow() from public;

drop trigger if exists notify_admin_order_workflow on public.orders;
create trigger notify_admin_order_workflow
after update of cancellation_status, payment_status on public.orders
for each row execute function private.notify_admin_order_workflow();

create or replace function private.notify_admin_return_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.admin_notifications(kind, title, message, entity_type, entity_id, route)
  values (
    'order',
    'New return request',
    format('%s is awaiting review.', new.return_number),
    'orders', new.order_id::text, '/admin/orders'
  );
  return new;
end;
$$;

revoke all on function private.notify_admin_return_request() from public;

drop trigger if exists notify_admin_return_request on public.return_requests;
create trigger notify_admin_return_request
after insert on public.return_requests
for each row execute function private.notify_admin_return_request();
