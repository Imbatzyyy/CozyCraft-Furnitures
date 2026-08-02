create or replace function private.place_order(
  p_address_id uuid,
  p_payment_method text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_address public.addresses%rowtype;
  v_order_id uuid;
  v_line record;
  v_product public.products%rowtype;
  v_subtotal numeric(12,2) := 0;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_payment_method not in ('cod', 'card', 'gcash') then raise exception 'Unsupported payment method'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty'; end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'A checkout can contain at most 50 product lines'; end if;

  select * into v_address
  from public.addresses
  where id = p_address_id and user_id = v_user_id;
  if not found then raise exception 'Delivery address not found'; end if;

  -- Aggregate duplicate IDs and lock in a stable order. This makes concurrent
  -- checkouts deterministic and prevents duplicate JSON lines bypassing stock checks.
  for v_line in
    select line.product_id, sum(line.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as line(product_id text, quantity integer)
    group by line.product_id
    order by line.product_id
  loop
    if nullif(trim(v_line.product_id), '') is null or v_line.quantity is null or v_line.quantity <= 0 then
      raise exception 'Invalid checkout item';
    end if;
    select * into v_product
    from public.products
    where id = v_line.product_id and status = 'active'
    for update;
    if not found then raise exception 'A product is no longer available'; end if;
    if v_product.stock_quantity < v_line.quantity then raise exception 'Not enough stock for %', v_product.name; end if;
    v_subtotal := v_subtotal + (v_product.price * v_line.quantity);
  end loop;

  insert into public.orders(user_id, payment_method, subtotal, total, shipping_address)
  values (
    v_user_id,
    p_payment_method,
    v_subtotal,
    v_subtotal,
    jsonb_build_object(
      'label', v_address.label,
      'name', v_address.recipient_name,
      'mobile', v_address.mobile,
      'email', v_address.email,
      'line', v_address.address_line,
      'barangay', v_address.barangay,
      'city', v_address.city,
      'province', v_address.province,
      'postal', v_address.postal_code,
      'note', v_address.delivery_note
    )
  ) returning id into v_order_id;

  perform set_config('app.inventory_reason', 'Reserved for order ' || v_order_id::text, true);
  for v_line in
    select line.product_id, sum(line.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as line(product_id text, quantity integer)
    group by line.product_id
    order by line.product_id
  loop
    select * into v_product from public.products where id = v_line.product_id for update;
    insert into public.order_items(order_id, product_id, product_name, unit_price, quantity, image_url)
    values (v_order_id, v_product.id, v_product.name, v_product.price, v_line.quantity, v_product.images[1]);
    update public.products set stock_quantity = stock_quantity - v_line.quantity where id = v_product.id;
  end loop;

  -- Remove only purchased products. Unchecked bag items and their selection
  -- state remain persisted without a client-side reconstruction window.
  delete from public.cart_items cart
  where cart.user_id = v_user_id
    and cart.product_id in (
      select distinct line.product_id
      from jsonb_to_recordset(p_items) as line(product_id text, quantity integer)
    );

  return v_order_id;
end;
$$;

revoke all on function private.place_order(uuid, text, jsonb) from public, anon;
grant execute on function private.place_order(uuid, text, jsonb) to authenticated;
