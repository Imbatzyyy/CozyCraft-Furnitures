alter table public.store_settings
  add column if not exists store_description text not null default 'Designed for a slower, warmer life at home.',
  add column if not exists support_phone text not null default '',
  add column if not exists business_address text not null default '',
  add column if not exists social_links jsonb not null default '{"facebook":"","instagram":"","tiktok":""}'::jsonb,
  add column if not exists announcement_enabled boolean not null default false,
  add column if not exists announcement_text text not null default '',
  add column if not exists announcement_link text not null default '',
  add column if not exists maintenance_mode boolean not null default false,
  add column if not exists checkout_settings jsonb not null default '{"standard_delivery_fee":0,"free_delivery_minimum":0,"minimum_order_amount":0,"maximum_order_amount":0,"cod_enabled":true,"card_enabled":true,"gcash_enabled":true,"cod_maximum_order":0}'::jsonb,
  add column if not exists fulfillment_settings jsonb not null default '{"estimated_delivery_days_min":5,"estimated_delivery_days_max":7,"cancellation_window_hours":24,"return_window_days":7,"order_number_prefix":"CC","stock_reservation_minutes":15,"out_of_stock_behavior":"show_unavailable","auto_archive_discontinued":false}'::jsonb,
  add column if not exists review_settings jsonb not null default '{"approval_required":false,"verified_purchases_only":true,"minimum_length":5,"maximum_length":2000,"photos_enabled":false}'::jsonb,
  add column if not exists account_settings jsonb not null default '{"username_required":true,"google_auth_enabled":true,"email_verification_required":true,"password_minimum_length":8,"customer_mfa_available":true}'::jsonb,
  add column if not exists email_event_settings jsonb not null default '{"account_confirmation":true,"order_confirmation":true,"payment_received":true,"fulfillment_updates":true,"delivered":true,"cancelled_refunded":true,"support_replies":true}'::jsonb,
  add column if not exists report_settings jsonb not null default '{"timezone":"Asia/Manila","frequency":"weekly","default_range":"This month","recipients":[],"data_retention_days":90}'::jsonb;

create table if not exists public.admin_security_settings (
  id boolean primary key default true check (id),
  require_admin_mfa boolean not null default true,
  session_timeout_minutes integer not null default 480 check (session_timeout_minutes between 15 and 1440),
  maximum_failed_logins integer not null default 5 check (maximum_failed_logins between 3 and 20),
  lockout_minutes integer not null default 15 check (lockout_minutes between 5 and 1440),
  security_alerts_enabled boolean not null default true,
  notification_email text not null default '',
  integration_status jsonb not null default '{"supabase":true,"paymongo":true,"resend":true,"google_oauth":true,"chatbot":true}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.admin_security_settings (id) values (true)
on conflict (id) do nothing;

alter table public.admin_security_settings enable row level security;
alter table public.admin_security_settings force row level security;

drop policy if exists "admin_security_superadmin_select" on public.admin_security_settings;
drop policy if exists "admin_security_staff_select" on public.admin_security_settings;
create policy "admin_security_staff_select"
on public.admin_security_settings for select to authenticated
using ((select private.is_staff()));

drop policy if exists "admin_security_superadmin_update" on public.admin_security_settings;
create policy "admin_security_superadmin_update"
on public.admin_security_settings for update to authenticated
using ((select private.is_superadmin()))
with check ((select private.is_superadmin()));

revoke all on public.admin_security_settings from public, anon, authenticated;
grant select, update on public.admin_security_settings to authenticated;

create or replace function private.validate_store_settings()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
declare
  checkout jsonb := new.checkout_settings;
  fulfillment jsonb := new.fulfillment_settings;
  reviews jsonb := new.review_settings;
  accounts jsonb := new.account_settings;
begin
  if length(trim(new.store_name)) < 2 or length(new.store_name) > 100 then raise exception 'Store name must contain 2 to 100 characters'; end if;
  if new.contact_email <> '' and new.contact_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid contact email'; end if;
  if new.announcement_enabled and length(trim(new.announcement_text)) < 3 then raise exception 'Announcement text is required when the banner is enabled'; end if;
  if (checkout->>'standard_delivery_fee')::numeric < 0 or (checkout->>'free_delivery_minimum')::numeric < 0 then raise exception 'Delivery values cannot be negative'; end if;
  if (checkout->>'minimum_order_amount')::numeric < 0 or (checkout->>'maximum_order_amount')::numeric < 0 then raise exception 'Order limits cannot be negative'; end if;
  if (checkout->>'maximum_order_amount')::numeric > 0 and (checkout->>'maximum_order_amount')::numeric < (checkout->>'minimum_order_amount')::numeric then raise exception 'Maximum order must be greater than the minimum order'; end if;
  if not coalesce((checkout->>'cod_enabled')::boolean, false) and not coalesce((checkout->>'card_enabled')::boolean, false) and not coalesce((checkout->>'gcash_enabled')::boolean, false) then raise exception 'At least one payment method must remain enabled'; end if;
  if (fulfillment->>'estimated_delivery_days_min')::integer < 1 or (fulfillment->>'estimated_delivery_days_max')::integer < (fulfillment->>'estimated_delivery_days_min')::integer then raise exception 'Delivery estimate is invalid'; end if;
  if coalesce(fulfillment->>'out_of_stock_behavior', '') not in ('hide','show_unavailable') then raise exception 'Out-of-stock behavior is invalid'; end if;
  if coalesce(fulfillment->>'order_number_prefix', '') !~ '^[A-Z0-9-]{1,10}$' then raise exception 'Order prefix must use 1 to 10 uppercase letters, numbers, or hyphens'; end if;
  if (reviews->>'minimum_length')::integer < 5 or (reviews->>'maximum_length')::integer < (reviews->>'minimum_length')::integer or (reviews->>'maximum_length')::integer > 5000 then raise exception 'Review length limits are invalid'; end if;
  if (accounts->>'password_minimum_length')::integer not between 8 and 72 then raise exception 'Password minimum must be between 8 and 72 characters'; end if;
  return new;
end;
$function$;

drop trigger if exists validate_store_settings on public.store_settings;
create trigger validate_store_settings before insert or update on public.store_settings
for each row execute function private.validate_store_settings();

create or replace function private.stamp_admin_security_settings()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$function$;

drop trigger if exists stamp_admin_security_settings on public.admin_security_settings;
create trigger stamp_admin_security_settings before update on public.admin_security_settings
for each row execute function private.stamp_admin_security_settings();

drop trigger if exists audit_admin_security_settings on public.admin_security_settings;
create trigger audit_admin_security_settings after update on public.admin_security_settings
for each row execute function private.record_admin_activity();

do $realtime$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_security_settings'
  ) then
    alter publication supabase_realtime add table public.admin_security_settings;
  end if;
end
$realtime$;

create or replace function private.create_weekly_report_briefing()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_settings public.store_settings%rowtype;
  v_frequency text;
  v_period_key text;
  v_title text;
begin
  select * into v_settings from public.store_settings where id = true;
  if not coalesce(v_settings.weekly_report_enabled, false) then return; end if;
  v_frequency := coalesce(v_settings.report_settings->>'frequency', 'weekly');
  if v_frequency = 'monthly' and extract(day from current_date) > 7 then return; end if;
  v_period_key := case when v_frequency = 'monthly' then to_char(current_date, 'YYYY-MM') else to_char(current_date, 'IYYY-IW') end;
  v_title := case when v_frequency = 'monthly' then 'Monthly performance report is ready' else 'Weekly performance report is ready' end;
  insert into public.admin_notifications(kind, title, message, entity_type, entity_id, route)
  values ('report', v_title, 'Review settled sales, fulfillment, refunds, customer retention, and inventory risk.', 'reports', v_frequency || '-' || v_period_key, '/admin/reports')
  on conflict (kind, entity_type, entity_id)
    where kind in ('report', 'system') and entity_id is not null
    do nothing;
end;
$function$;

create or replace function private.run_daily_application_health_check()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_error_count integer;
  v_retention integer;
  v_alerts_enabled boolean;
begin
  select count(*) into v_error_count from public.client_error_events where created_at >= now() - interval '24 hours';
  select greatest(7, least(3650, coalesce((s.report_settings->>'data_retention_days')::integer, 90))) into v_retention
  from public.store_settings s where s.id = true;
  select security_alerts_enabled into v_alerts_enabled from public.admin_security_settings where id = true;
  if coalesce(v_alerts_enabled, true) and v_error_count >= 5 then
    insert into public.admin_notifications(kind, title, message, entity_type, entity_id, route)
    values ('system', 'Customer application errors need review', format('%s customer-side errors were recorded in the last 24 hours.', v_error_count), 'errors', 'daily-' || to_char(current_date, 'YYYY-MM-DD'), '/admin/activity-logs')
    on conflict (kind, entity_type, entity_id)
      where kind in ('report', 'system') and entity_id is not null
      do nothing;
  end if;
  delete from public.client_error_events where created_at < now() - make_interval(days => coalesce(v_retention, 90));
end;
$function$;

create or replace function private.place_order(
  p_address_id uuid,
  p_payment_method text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_address public.addresses%rowtype;
  v_order_id uuid;
  v_line record;
  v_product public.products%rowtype;
  v_subtotal numeric(12,2) := 0;
  v_delivery_fee numeric(12,2) := 0;
  v_checkout jsonb;
  v_fulfillment jsonb;
  v_prefix text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_payment_method not in ('cod', 'card', 'gcash') then raise exception 'Unsupported payment method'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty'; end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'A checkout can contain at most 50 product lines'; end if;

  select checkout_settings, fulfillment_settings into v_checkout, v_fulfillment
  from public.store_settings where id = true;
  if not coalesce((v_checkout->>(p_payment_method || '_enabled'))::boolean, false) then raise exception 'This payment method is currently unavailable'; end if;

  select * into v_address from public.addresses where id = p_address_id and user_id = v_user_id;
  if not found then raise exception 'Delivery address not found'; end if;

  for v_line in
    select line.product_id, sum(line.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as line(product_id text, quantity integer)
    group by line.product_id order by line.product_id
  loop
    if nullif(trim(v_line.product_id), '') is null or v_line.quantity is null or v_line.quantity <= 0 then raise exception 'Invalid checkout item'; end if;
    select * into v_product from public.products where id = v_line.product_id and status = 'active' for update;
    if not found then raise exception 'A product is no longer available'; end if;
    if v_product.stock_quantity < v_line.quantity then raise exception 'Not enough stock for %', v_product.name; end if;
    v_subtotal := v_subtotal + (v_product.price * v_line.quantity);
  end loop;

  if v_subtotal < coalesce((v_checkout->>'minimum_order_amount')::numeric, 0) then raise exception 'Order does not meet the minimum amount'; end if;
  if coalesce((v_checkout->>'maximum_order_amount')::numeric, 0) > 0 and v_subtotal > (v_checkout->>'maximum_order_amount')::numeric then raise exception 'Order exceeds the maximum amount'; end if;
  if p_payment_method = 'cod' and coalesce((v_checkout->>'cod_maximum_order')::numeric, 0) > 0 and v_subtotal > (v_checkout->>'cod_maximum_order')::numeric then raise exception 'Cash on delivery is unavailable for this order amount'; end if;

  if coalesce((v_checkout->>'free_delivery_minimum')::numeric, 0) <= 0 or v_subtotal < (v_checkout->>'free_delivery_minimum')::numeric then
    v_delivery_fee := coalesce((v_checkout->>'standard_delivery_fee')::numeric, 0);
  end if;
  v_prefix := upper(coalesce(v_fulfillment->>'order_number_prefix', 'CC'));

  insert into public.orders(order_number, user_id, payment_method, subtotal, total, shipping_address)
  values (
    v_prefix || '-' || lpad(nextval('public.order_number_seq')::text, 5, '0'),
    v_user_id, p_payment_method, v_subtotal, v_subtotal + v_delivery_fee,
    jsonb_build_object('label',v_address.label,'name',v_address.recipient_name,'mobile',v_address.mobile,'email',v_address.email,'line',v_address.address_line,'barangay',v_address.barangay,'city',v_address.city,'province',v_address.province,'postal',v_address.postal_code,'note',v_address.delivery_note,'delivery_fee',v_delivery_fee)
  ) returning id into v_order_id;

  perform set_config('app.inventory_reason', 'Reserved for order ' || v_order_id::text, true);
  for v_line in
    select line.product_id, sum(line.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as line(product_id text, quantity integer)
    group by line.product_id order by line.product_id
  loop
    select * into v_product from public.products where id = v_line.product_id for update;
    insert into public.order_items(order_id, product_id, product_name, unit_price, quantity, image_url)
    values (v_order_id, v_product.id, v_product.name, v_product.price, v_line.quantity, v_product.images[1]);
    update public.products set stock_quantity = stock_quantity - v_line.quantity where id = v_product.id;
  end loop;

  delete from public.cart_items cart where cart.user_id = v_user_id and cart.product_id in (
    select distinct line.product_id from jsonb_to_recordset(p_items) as line(product_id text, quantity integer)
  );
  return v_order_id;
end;
$function$;

create or replace function private.submit_product_review(
  p_product_id text,
  p_rating integer,
  p_title text,
  p_body text
)
returns table (id uuid, approved boolean)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_review public.reviews%rowtype;
  v_settings jsonb;
  v_approved boolean;
begin
  if v_user_id is null then raise exception 'You must be signed in to review a product.'; end if;
  select s.review_settings into v_settings from public.store_settings s where s.id = true;
  if p_rating not between 1 and 5 then raise exception 'Rating must be between 1 and 5.'; end if;
  if length(trim(coalesce(p_body, ''))) < coalesce((v_settings->>'minimum_length')::integer, 5) then raise exception 'Your review is too short.'; end if;
  if length(trim(coalesce(p_body, ''))) > coalesce((v_settings->>'maximum_length')::integer, 2000) or length(trim(coalesce(p_title, ''))) > 120 then raise exception 'The review is too long.'; end if;
  if coalesce((v_settings->>'verified_purchases_only')::boolean, true) and not private.has_delivered_purchase(v_user_id, p_product_id) then raise exception 'Only delivered purchases can be reviewed.'; end if;
  v_approved := not coalesce((v_settings->>'approval_required')::boolean, false);

  insert into public.reviews (user_id, product_id, rating, title, body, approved)
  values (v_user_id, p_product_id, p_rating, trim(coalesce(p_title, '')), trim(p_body), v_approved)
  on conflict (user_id, product_id) do update set rating=excluded.rating,title=excluded.title,body=excluded.body,approved=excluded.approved,updated_at=now()
  returning reviews.* into v_review;
  return query select v_review.id, v_review.approved;
end;
$function$;
