-- Shared website/mobile checkout rules. No historical orders are rewritten.
create or replace function private.validate_checkout_items(items jsonb)
returns void language plpgsql immutable set search_path=pg_catalog as $fn$
declare item jsonb; units numeric := 0; seen text[] := '{}'; product text; quantity numeric;
begin
  if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items)=0 then raise exception 'Your cart is empty'; end if;
  if jsonb_array_length(items)>10 then raise exception 'Choose at most 10 different products per checkout. Contact CozyCraft for a bulk order.'; end if;
  for item in select value from jsonb_array_elements(items) loop
    product := item->>'product_id';
    if jsonb_typeof(item) is distinct from 'object' or nullif(trim(product),'') is null or length(product)>200
       or jsonb_typeof(item->'quantity') is distinct from 'number' or coalesce(item->>'quantity','') !~ '^[0-9]+$' then
      raise exception 'Choose a valid whole-number quantity for each product';
    end if;
    quantity := (item->>'quantity')::numeric;
    if quantity<1 or quantity>10 then raise exception 'Choose at most 10 pieces of each product. Contact CozyCraft for a bulk order.'; end if;
    if product=any(seen) then raise exception 'A product appears more than once. Refresh your bag before checkout.'; end if;
    seen := array_append(seen,product); units := units+quantity;
  end loop;
  if units>20 then raise exception 'Choose at most 20 pieces in one checkout. Contact CozyCraft for a bulk order.'; end if;
end $fn$;
revoke all on function private.validate_checkout_items(jsonb) from public,anon,authenticated;

-- Serialize new orders per account, not shared Wi-Fi. Idempotent retries return
-- from the existing wrapper before this function and do not consume this limit.
do $migration$
declare body text := pg_get_functiondef('private.place_order(uuid,text,jsonb)'::regprocedure);
  anchor text := 'if v_user_id is null then raise exception ''Authentication required''; end if;';
begin
  if strpos(body,anchor)=0 then raise exception 'Checkout function changed; review before migration'; end if;
  body := replace(body,anchor,anchor || $guard$
  perform pg_advisory_xact_lock(hashtextextended('checkout-account:' || v_user_id::text,0));
  perform private.validate_checkout_items(p_items);
  if (select count(*) from public.orders where user_id=v_user_id and created_at>now()-interval '5 minutes') >= 5 then
    raise exception 'Too many new checkouts. Wait a few minutes or resume an existing payment from your orders.';
  end if;
  if p_payment_method in ('card','gcash') and (select count(*) from public.orders
    where user_id=v_user_id and payment_method in ('card','gcash') and status not in ('cancelled','delivered')
      and payment_status='pending' and created_at>now()-interval '15 minutes') >= 3 then
    raise exception 'You already have three recent unpaid checkouts. Resume a payment from your orders before starting another.';
  end if;
  $guard$);
  execute body;
end $migration$;

-- The final amount includes delivery and subtracts a valid reward in the same
-- transaction. Keep provider limits and existing COD exposure protections.
do $migration$
declare body text := pg_get_functiondef('private.enforce_checkout_payment_limits()'::regprocedure);
  anchor text := 'if current_order.payment_method::text=''cod'' then';
begin
  if strpos(body,anchor)=0 or strpos(body,'current_order.total > 100000')=0 then raise exception 'Unexpected payment guard'; end if;
  body := replace(body,anchor,$guard$
  if current_order.total>500000 then
    raise exception 'Online checkout is available up to PHP 500,000, including delivery and after discounts. Contact CozyCraft for a bulk order.';
  end if;
  $guard$ || anchor);
  execute body;
end $migration$;

-- Website submits the amount actually shown to the customer. A changed price,
-- fee, voucher, or quantity rolls back the entire reservation, not just the UI.
create or replace function public.place_web_order(p_address_id uuid,p_payment_method text,p_items jsonb,p_checkout_key uuid,p_redemption_id uuid,p_expected_total numeric)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,private as $fn$
declare order_id uuid; actual numeric;
begin
  if auth.uid() is null or not coalesce(public.security_action_allowed(),false) then raise exception 'Authentication required'; end if;
  if p_expected_total is null or p_expected_total<1 or p_expected_total>500000 or p_expected_total<>round(p_expected_total,2) then raise exception 'Review a valid checkout total before continuing'; end if;
  order_id := public.place_order_with_reward(p_address_id,p_payment_method,p_items,p_checkout_key,p_redemption_id);
  select total into actual from public.orders where id=order_id and user_id=auth.uid();
  if actual is distinct from p_expected_total then raise exception 'Your price, delivery fee or reward changed. Refresh checkout and review the updated total before paying.'; end if;
  return order_id;
end $fn$;
revoke all on function public.place_web_order(uuid,text,jsonb,uuid,uuid,numeric) from public,anon;
grant execute on function public.place_web_order(uuid,text,jsonb,uuid,uuid,numeric) to authenticated;

-- Compact public counters only: no viewer identity, history, or customer data.
-- Views mean unique signed-in viewers; repeated clicks never increase ranking.
lock table public.product_views,public.wishlist_items in share row exclusive mode;
create table public.product_engagement_counts (
  product_id text primary key references public.products(id) on delete cascade,
  viewers bigint not null default 0 check(viewers>=0),
  saves bigint not null default 0 check(saves>=0)
);
alter table public.product_engagement_counts enable row level security;
revoke all on public.product_engagement_counts from anon,authenticated;
insert into public.product_engagement_counts(product_id,viewers,saves)
select p.id,(select count(*) from public.product_views v where v.product_id=p.id),
  (select count(*) from public.wishlist_items w where w.product_id=p.id) from public.products p;
create or replace function private.update_product_engagement()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $fn$
declare product text := case when tg_op='DELETE' then old.product_id else new.product_id end;
  step integer := case when tg_op='DELETE' then -1 else 1 end;
begin
  if tg_op='UPDATE' then
    if old.product_id=new.product_id then return null; end if;
    if tg_table_name='product_views' then
      update public.product_engagement_counts set viewers=greatest(0,viewers-1) where product_id=old.product_id;
    else
      update public.product_engagement_counts set saves=greatest(0,saves-1) where product_id=old.product_id;
    end if;
  end if;
  if tg_op in ('INSERT','UPDATE') then
    insert into public.product_engagement_counts(product_id) values(product) on conflict do nothing;
  end if;
  if tg_table_name='product_views' then
    update public.product_engagement_counts set viewers=greatest(0,viewers+step) where product_id=product;
  else
    update public.product_engagement_counts set saves=greatest(0,saves+step) where product_id=product;
  end if;
  return null;
end $fn$;
revoke all on function private.update_product_engagement() from public,anon,authenticated;
create trigger track_product_viewers after insert or delete or update of product_id on public.product_views for each row execute function private.update_product_engagement();
create trigger track_product_saves after insert or delete or update of product_id on public.wishlist_items for each row execute function private.update_product_engagement();
create or replace function public.catalog_popularity()
returns table(product_id text,viewers bigint,saves bigint) language sql stable security definer set search_path=pg_catalog,public as $fn$
  select c.product_id,c.viewers,c.saves from public.product_engagement_counts c
  join public.products p on p.id=c.product_id where p.status='active' order by c.product_id;
$fn$;
revoke all on function public.catalog_popularity() from public;
grant execute on function public.catalog_popularity() to anon,authenticated;

-- Keep the published policy snapshot useful to older clients too.
do $migration$
declare body text := pg_get_functiondef('public.get_checkout_payment_policy()'::regprocedure);
begin
  if strpos(body,'''gcash_limit'',100000,''card_limit_exclusive'',10000000')=0 then raise exception 'Unexpected policy snapshot'; end if;
  execute replace(body,'''gcash_limit'',100000,''card_limit_exclusive'',10000000',
    '''gcash_limit'',100000,''card_limit_exclusive'',10000000,''checkout_total_limit'',500000,''max_products'',10,''max_per_product'',10,''max_pieces'',20');
end $migration$;
