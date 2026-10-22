-- Final payable limits apply to every checkout client, after atomic rewards.
-- Existing orders are not revalidated on status updates or provider settlement.
create or replace function private.checkout_cod_limit()
returns numeric language sql stable security definer
set search_path = pg_catalog, public
as $fn$
  select least(20000::numeric, coalesce(nullif(greatest(coalesce(
    (select (checkout_settings->>'cod_maximum_order')::numeric from public.store_settings where id=true),0),0),0),20000));
$fn$;
revoke all on function private.checkout_cod_limit() from public, anon, authenticated;

-- Serialize each customer's COD creation before inventory locks. Retain the
-- current function body and every existing security/address/inventory check.
do $migration$
declare
  body text := pg_get_functiondef('private.place_order(uuid,text,jsonb)'::regprocedure);
  old_guard text := 'if p_payment_method = ''cod'' and coalesce((v_checkout->>''cod_maximum_order'')::numeric, 0) > 0 and v_subtotal > (v_checkout->>''cod_maximum_order'')::numeric then raise exception ''Cash on delivery is unavailable for this order amount''; end if;';
  anchor text := 'if v_user_id is null then raise exception ''Authentication required''; end if;';
begin
  if strpos(body,old_guard)=0 or strpos(body,anchor)=0 then
    raise exception 'Unexpected place_order body; review before applying payment policy';
  end if;
  body := replace(body,old_guard,'-- Final-total policy is checked at transaction completion, after rewards.');
  body := replace(body,anchor,anchor || E'\n  if p_payment_method = ''cod'' then perform pg_advisory_xact_lock(hashtextextended(''checkout-cod:'' || v_user_id::text,0)); end if;');
  execute body;
end $migration$;

create or replace function private.lock_checkout_cod_exposure()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $fn$
begin
  if new.payment_method::text='cod' then
    perform pg_advisory_xact_lock(hashtextextended('checkout-cod:' || new.user_id::text,0));
  end if;
  return new;
end $fn$;
revoke all on function private.lock_checkout_cod_exposure() from public, anon, authenticated;
create trigger lock_checkout_cod_exposure
before insert or update of total, payment_method, user_id on public.orders
for each row execute function private.lock_checkout_cod_exposure();

create or replace function private.enforce_checkout_payment_limits()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, private
as $fn$
declare current_order public.orders%rowtype; cod_limit numeric; exposure numeric;
begin
  if tg_op='UPDATE' then
    if new.total is not distinct from old.total and new.payment_method is not distinct from old.payment_method
      and new.user_id is not distinct from old.user_id then return null; end if;
  end if;
  -- NEW may represent the pre-voucher insert: always read the final row.
  select * into current_order from public.orders where id=new.id;
  if not found or current_order.status::text='cancelled' then return null; end if;
  if current_order.total is null or current_order.total < 1 then
    raise exception 'The final payable total must be at least PHP 1';
  end if;
  if current_order.payment_method::text='cod' then
    cod_limit := private.checkout_cod_limit();
    if current_order.total > cod_limit then
      raise exception 'Cash on delivery is available up to PHP %, including delivery and after discounts. Choose GCash or card.', cod_limit;
    end if;
    select coalesce(sum(total),0) into exposure from public.orders
    where user_id=current_order.user_id and payment_method='cod'
      and status not in ('cancelled','delivered') and payment_status not in ('paid','refunded');
    if exposure > cod_limit then
      raise exception 'Your unpaid COD orders would exceed PHP %. Choose GCash or card, or wait until your COD orders are settled.', cod_limit;
    end if;
  elsif current_order.payment_method::text='gcash' and current_order.total > 100000 then
    raise exception 'GCash is available up to PHP 100,000 per order. Choose a card for this total.';
  elsif current_order.payment_method::text='card' and current_order.total >= 10000000 then
    raise exception 'Card payments must be below PHP 10,000,000. Please contact CozyCraft for this order.';
  end if;
  return null;
end $fn$;
revoke all on function private.enforce_checkout_payment_limits() from public, anon, authenticated;
create constraint trigger enforce_checkout_payment_limits
after insert or update on public.orders deferrable initially deferred
for each row execute function private.enforce_checkout_payment_limits();

-- No order rows or personal details leave the database. Read once on checkout.
create or replace function public.get_checkout_payment_policy()
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public, private
as $fn$
declare customer uuid := auth.uid(); exposure numeric;
begin
  if customer is null or not public.security_action_allowed() then raise exception 'Authentication required' using errcode='42501'; end if;
  select coalesce(sum(total),0) into exposure from public.orders
  where user_id=customer and payment_method='cod'
    and status not in ('cancelled','delivered') and payment_status not in ('paid','refunded');
  return jsonb_build_object('cod_limit',private.checkout_cod_limit(),'outstanding_cod_total',exposure,
    'gcash_limit',100000,'card_limit_exclusive',10000000);
end $fn$;
revoke all on function public.get_checkout_payment_policy() from public, anon;
grant execute on function public.get_checkout_payment_policy() to authenticated;

update public.store_settings set checkout_settings=jsonb_set(coalesce(checkout_settings,'{}'::jsonb),
  '{cod_maximum_order}',to_jsonb(private.checkout_cod_limit()),true) where id=true;

-- Existing user_id indexes narrow this aggregate; keep the additional index
-- small and useful even for customers with a long completed-order history.
create index if not exists orders_open_cod_user_idx on public.orders(user_id) include(total)
where payment_method='cod' and status not in ('cancelled','delivered') and payment_status not in ('paid','refunded');
