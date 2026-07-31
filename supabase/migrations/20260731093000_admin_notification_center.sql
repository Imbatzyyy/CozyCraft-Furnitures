create table if not exists public.admin_notifications (
  id bigint generated always as identity primary key,
  kind text not null check (
    kind in ('order', 'review', 'support', 'inventory')
  ),
  title text not null,
  message text not null,
  entity_type text not null,
  entity_id text,
  route text not null default '/admin',
  created_at timestamptz not null default now()
);

create table if not exists public.admin_notification_reads (
  notification_id bigint not null
    references public.admin_notifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz,
  dismissed_at timestamptz,
  primary key (notification_id, user_id)
);

create index if not exists admin_notifications_created_at_idx
  on public.admin_notifications (created_at desc);
create index if not exists admin_notification_reads_user_idx
  on public.admin_notification_reads (user_id, dismissed_at, read_at);

alter table public.admin_notifications enable row level security;
alter table public.admin_notification_reads enable row level security;

create policy "notifications_active_staff_read"
on public.admin_notifications for select
to authenticated
using ((select private.is_staff()));

create policy "notification_reads_own_select"
on public.admin_notification_reads for select
to authenticated
using ((select auth.uid()) = user_id and (select private.is_staff()));

create policy "notification_reads_own_insert"
on public.admin_notification_reads for insert
to authenticated
with check ((select auth.uid()) = user_id and (select private.is_staff()));

create policy "notification_reads_own_update"
on public.admin_notification_reads for update
to authenticated
using ((select auth.uid()) = user_id and (select private.is_staff()))
with check ((select auth.uid()) = user_id and (select private.is_staff()));

create policy "notification_reads_own_delete"
on public.admin_notification_reads for delete
to authenticated
using ((select auth.uid()) = user_id and (select private.is_staff()));

grant select on public.admin_notifications to authenticated;
grant select, insert, update, delete
  on public.admin_notification_reads to authenticated;

create or replace function private.notify_new_order()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.admin_notifications (
    kind, title, message, entity_type, entity_id, route
  ) values (
    'order',
    'New order received',
    format(
      'Order %s was placed for PHP %s using %s.',
      new.order_number,
      to_char(new.total, 'FM999,999,990.00'),
      upper(new.payment_method)
    ),
    'orders',
    new.id::text,
    '/admin/orders'
  );
  return new;
end;
$$;

create or replace function private.notify_new_review()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_product_name text;
begin
  select name into v_product_name
  from public.products
  where id = new.product_id;

  insert into public.admin_notifications (
    kind, title, message, entity_type, entity_id, route
  ) values (
    'review',
    'New customer review',
    format(
      'A %s-star review for %s is awaiting moderation.',
      new.rating,
      coalesce(v_product_name, new.product_id)
    ),
    'reviews',
    new.id::text,
    '/admin/reviews'
  );
  return new;
end;
$$;

create or replace function private.notify_new_support_ticket()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.admin_notifications (
    kind, title, message, entity_type, entity_id, route
  ) values (
    'support',
    'New support request',
    format('%s: %s', new.ticket_number, new.subject),
    'support_tickets',
    new.id::text,
    '/admin/support'
  );
  return new;
end;
$$;

create or replace function private.notify_low_stock()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_threshold integer := 8;
  v_alerts boolean := true;
begin
  select low_stock_threshold, inventory_alerts
  into v_threshold, v_alerts
  from public.store_settings
  where id = true;

  if coalesce(v_alerts, true)
     and new.stock_quantity < old.stock_quantity
     and new.stock_quantity <= coalesce(v_threshold, 8)
     and old.stock_quantity > coalesce(v_threshold, 8) then
    insert into public.admin_notifications (
      kind, title, message, entity_type, entity_id, route
    ) values (
      'inventory',
      'Low-stock alert',
      format(
        '%s has reached %s unit%s.',
        new.name,
        new.stock_quantity,
        case when new.stock_quantity = 1 then '' else 's' end
      ),
      'products',
      new.id,
      '/admin/inventory'
    );
  end if;
  return new;
end;
$$;

revoke all on function private.notify_new_order() from public;
revoke all on function private.notify_new_review() from public;
revoke all on function private.notify_new_support_ticket() from public;
revoke all on function private.notify_low_stock() from public;

drop trigger if exists notify_new_order on public.orders;
create trigger notify_new_order
after insert on public.orders
for each row execute function private.notify_new_order();

drop trigger if exists notify_new_review on public.reviews;
create trigger notify_new_review
after insert on public.reviews
for each row execute function private.notify_new_review();

drop trigger if exists notify_new_support_ticket on public.support_tickets;
create trigger notify_new_support_ticket
after insert on public.support_tickets
for each row execute function private.notify_new_support_ticket();

drop trigger if exists notify_low_stock on public.products;
create trigger notify_low_stock
after update of stock_quantity on public.products
for each row execute function private.notify_low_stock();

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'admin_notifications',
    'admin_notification_reads'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        v_table
      );
    end if;
  end loop;
end
$$;

insert into public.admin_notifications (
  kind, title, message, entity_type, entity_id, route, created_at
)
select
  'order',
  'Order awaiting review',
  format(
    'Order %s was placed for PHP %s using %s.',
    orders.order_number,
    to_char(orders.total, 'FM999,999,990.00'),
    upper(orders.payment_method)
  ),
  'orders',
  orders.id::text,
  '/admin/orders',
  orders.created_at
from public.orders
where orders.status in ('pending', 'processing')
order by orders.created_at desc
limit 20;

insert into public.admin_notifications (
  kind, title, message, entity_type, entity_id, route, created_at
)
select
  'review',
  'Customer review awaiting moderation',
  format(
    'A %s-star review for %s is awaiting moderation.',
    reviews.rating,
    coalesce(products.name, reviews.product_id)
  ),
  'reviews',
  reviews.id::text,
  '/admin/reviews',
  reviews.created_at
from public.reviews
left join public.products on products.id = reviews.product_id
where not reviews.approved
order by reviews.created_at desc
limit 20;

insert into public.admin_notifications (
  kind, title, message, entity_type, entity_id, route, created_at
)
select
  'support',
  'Open support request',
  format('%s: %s', tickets.ticket_number, tickets.subject),
  'support_tickets',
  tickets.id::text,
  '/admin/support',
  tickets.created_at
from public.support_tickets as tickets
where tickets.status in ('open', 'in_progress')
order by tickets.created_at desc
limit 20;
