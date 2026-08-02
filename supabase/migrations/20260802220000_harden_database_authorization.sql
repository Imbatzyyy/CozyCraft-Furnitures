-- Defense in depth for every Data API table. RLS remains the primary row-level
-- boundary; explicit grants below also remove operations each client role never
-- needs to perform.

do $rls$
declare
  target record;
begin
  for target in
    select format('%I.%I', schemaname, tablename) as qualified_name
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table %s enable row level security', target.qualified_name);
    execute format('alter table %s force row level security', target.qualified_name);
  end loop;
end
$rls$;

revoke all on all tables in schema public from public, anon, authenticated;

grant select on public.categories, public.products, public.reviews,
  public.store_settings to anon;

grant select on public.activity_logs, public.admin_notifications,
  public.client_error_events, public.inventory_movements,
  public.order_items, public.order_status_history,
  public.payment_transactions to authenticated;

grant select, insert, update, delete on public.addresses,
  public.admin_notification_reads, public.cart_items,
  public.product_views, public.wishlist_items to authenticated;

grant select, insert, update, delete on public.categories,
  public.products to authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_url, email, username, gender,
  date_of_birth, preferred_payment_method)
  on public.profiles to authenticated;

grant select on public.orders to authenticated;
grant update (status, payment_status) on public.orders to authenticated;

grant select, insert, update on public.return_requests,
  public.support_tickets to authenticated;

grant select, update on public.reviews, public.store_settings to authenticated;

grant select on public.customer_notifications to authenticated;
grant update (read_at) on public.customer_notifications to authenticated;

-- Private functions are trigger implementations or narrowly scoped RLS helpers.
-- Remove PostgreSQL's default PUBLIC execute privilege and re-open only the
-- functions that authenticated policy evaluation and checkout actually require.
revoke all on all functions in schema private from public, anon, authenticated;
revoke usage on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_superadmin() to authenticated;
grant execute on function private.place_order(uuid, text, jsonb)
  to authenticated, service_role;

-- Keep SECURITY DEFINER implementations outside the exposed public schema.
-- Public RPC wrappers run as the caller and contain no privileged logic.
create or replace function private.adjust_product_inventory(
  p_product_id text,
  p_delta integer,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  current_quantity integer;
  resulting_quantity integer;
begin
  if not private.is_staff() then
    raise exception 'Administrator access required';
  end if;
  if p_delta = 0 then
    raise exception 'Adjustment must not be zero';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'A reason is required';
  end if;

  select stock_quantity into current_quantity
  from public.products
  where id = p_product_id
  for update;

  if current_quantity is null then
    raise exception 'Product not found';
  end if;

  resulting_quantity := current_quantity + p_delta;
  if resulting_quantity < 0 then
    raise exception 'Stock cannot be negative';
  end if;

  perform set_config('app.inventory_reason', trim(p_reason), true);
  update public.products
  set stock_quantity = resulting_quantity
  where id = p_product_id;

  return resulting_quantity;
end;
$function$;

create or replace function public.adjust_product_inventory(
  p_product_id text,
  p_delta integer,
  p_reason text
)
returns integer
language sql
security invoker
set search_path = pg_catalog, private
as $function$
  select private.adjust_product_inventory(p_product_id, p_delta, p_reason);
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
begin
  if v_user_id is null then
    raise exception 'You must be signed in to review a product.';
  end if;
  if p_rating not between 1 and 5 then
    raise exception 'Rating must be between 1 and 5.';
  end if;
  if length(trim(coalesce(p_body, ''))) < 5 then
    raise exception 'Please write at least 5 characters about the product.';
  end if;
  if length(trim(coalesce(p_body, ''))) > 2000
     or length(trim(coalesce(p_title, ''))) > 120 then
    raise exception 'The review is too long.';
  end if;
  if not private.has_delivered_purchase(v_user_id, p_product_id) then
    raise exception 'Only delivered purchases can be reviewed.';
  end if;

  insert into public.reviews (user_id, product_id, rating, title, body, approved)
  values (v_user_id, p_product_id, p_rating,
    trim(coalesce(p_title, '')), trim(p_body), true)
  on conflict (user_id, product_id)
  do update set rating = excluded.rating, title = excluded.title,
    body = excluded.body, updated_at = now()
  returning reviews.* into v_review;

  return query select v_review.id, v_review.approved;
end;
$function$;

create or replace function public.submit_product_review(
  p_product_id text,
  p_rating integer,
  p_title text,
  p_body text
)
returns table (id uuid, approved boolean)
language sql
security invoker
set search_path = pg_catalog, private
as $function$
  select * from private.submit_product_review(
    p_product_id, p_rating, p_title, p_body
  );
$function$;

create or replace function private.report_client_error(
  p_message text,
  p_stack text,
  p_path text,
  p_context text,
  p_user_agent text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then return; end if;
  if length(trim(coalesce(p_message, ''))) = 0 then return; end if;
  if (
    select count(*) from public.client_error_events
    where user_id = v_user_id and created_at > now() - interval '1 hour'
  ) >= 20 then
    return;
  end if;

  insert into public.client_error_events(
    user_id, message, stack, path, context, user_agent
  ) values (
    v_user_id,
    left(p_message, 1000),
    left(coalesce(p_stack, ''), 5000),
    left(coalesce(p_path, '/'), 500),
    left(coalesce(p_context, 'application'), 100),
    left(coalesce(p_user_agent, ''), 500)
  );
end;
$function$;

create or replace function public.report_client_error(
  p_message text,
  p_stack text,
  p_path text,
  p_context text,
  p_user_agent text
)
returns void
language sql
security invoker
set search_path = pg_catalog, private
as $function$
  select private.report_client_error(
    p_message, p_stack, p_path, p_context, p_user_agent
  );
$function$;

revoke all on function private.adjust_product_inventory(text, integer, text)
  from public, anon, authenticated;
revoke all on function private.submit_product_review(text, integer, text, text)
  from public, anon, authenticated;
revoke all on function private.report_client_error(text, text, text, text, text)
  from public, anon, authenticated;

grant execute on function private.adjust_product_inventory(text, integer, text)
  to authenticated;
grant execute on function private.submit_product_review(text, integer, text, text)
  to authenticated;
grant execute on function private.report_client_error(text, text, text, text, text)
  to authenticated;

revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function public.adjust_product_inventory(text, integer, text)
  to authenticated;
grant execute on function public.place_order(uuid, text, jsonb, uuid)
  to authenticated;
grant execute on function public.report_client_error(text, text, text, text, text)
  to authenticated;
grant execute on function public.submit_product_review(text, integer, text, text)
  to authenticated;

grant execute on function public.begin_return_refund(uuid, uuid) to service_role;
grant execute on function public.fail_paymongo_order(uuid, text) to service_role;
grant execute on function public.settle_paymongo_order(
  uuid, uuid, text, boolean, jsonb
) to service_role;

-- Future objects are private by default until a migration grants the exact role
-- and operation required by the application.
alter default privileges in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private
  revoke execute on functions from public, anon, authenticated;
