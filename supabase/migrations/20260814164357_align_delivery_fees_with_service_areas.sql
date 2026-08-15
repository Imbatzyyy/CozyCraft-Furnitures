-- Delivery fees are determined by the customer's saved Philippine address.
-- Keeping this in Postgres prevents a modified browser from changing the fee.

create or replace function private.delivery_area_code_for_address(
  p_province text,
  p_city text
)
returns text
language plpgsql
immutable
set search_path = pg_catalog
as $function$
declare
  v_location text := lower(regexp_replace(coalesce(p_province, '') || ' ' || coalesce(p_city, ''), '[^a-zA-Z0-9]+', ' ', 'g'));
begin
  if v_location ~ '(metro manila|national capital region|(^| )ncr( |$))' then
    return 'metro-manila';
  elsif v_location ~ '(bulacan|cavite|laguna|rizal)' then
    return 'greater-manila';
  elsif v_location ~ '(western visayas|central visayas|eastern visayas|aklan|antique|capiz|guimaras|iloilo|negros|bacolod|bohol|cebu|siquijor|biliran|samar|leyte)' then
    return 'visayas';
  elsif v_location ~ '(mindanao|bangsamoro|barmm|zamboanga|bukidnon|camiguin|lanao|misamis|davao|cotabato|sarangani|sultan kudarat|agusan|dinagat|surigao|basilan|sulu|tawi tawi|caraga|soccsksargen|cagayan de oro)' then
    return 'mindanao';
  end if;
  return 'luzon';
end;
$function$;

revoke all on function private.delivery_area_code_for_address(text, text)
from public, anon, authenticated;

create or replace function private.place_order(
  p_address_id uuid,
  p_payment_method text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_address public.addresses%rowtype;
  v_order_id uuid;
  v_line record;
  v_product public.products%rowtype;
  v_delivery_area public.delivery_service_areas%rowtype;
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

  select * into v_delivery_area
  from public.delivery_service_areas
  where area_code = private.delivery_area_code_for_address(v_address.province, v_address.city)
    and active = true;
  if not found then raise exception 'Delivery is not currently available for this address'; end if;

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

  if v_delivery_area.free_delivery_minimum is null or v_subtotal < v_delivery_area.free_delivery_minimum then
    v_delivery_fee := v_delivery_area.delivery_fee;
  end if;
  v_prefix := upper(coalesce(v_fulfillment->>'order_number_prefix', 'CC'));

  insert into public.orders(order_number, user_id, payment_method, subtotal, delivery_fee, total, shipping_address)
  values (
    v_prefix || '-' || lpad(nextval('public.order_number_seq')::text, 5, '0'),
    v_user_id, p_payment_method, v_subtotal, v_delivery_fee, v_subtotal + v_delivery_fee,
    jsonb_build_object(
      'label', v_address.label, 'name', v_address.recipient_name, 'mobile', v_address.mobile,
      'email', v_address.email, 'line', v_address.address_line, 'barangay', v_address.barangay,
      'city', v_address.city, 'province', v_address.province, 'postal', v_address.postal_code,
      'note', v_address.delivery_note, 'delivery_fee', v_delivery_fee,
      'delivery_area_code', v_delivery_area.area_code, 'delivery_area_name', v_delivery_area.name,
      'lead_time_min_days', v_delivery_area.lead_time_min_days,
      'lead_time_max_days', v_delivery_area.lead_time_max_days,
      'assembly_available', v_delivery_area.assembly_available
    )
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

revoke all on function private.place_order(uuid, text, jsonb) from public, anon;
grant execute on function private.place_order(uuid, text, jsonb) to authenticated;

-- Compatibility values for older clients that only understand one fee.
update public.store_settings
set checkout_settings = jsonb_set(
      jsonb_set(checkout_settings, '{standard_delivery_fee}', '650'::jsonb, true),
      '{free_delivery_minimum}', '50000'::jsonb, true
    ),
    updated_at = now()
where id = true
  and coalesce((checkout_settings->>'standard_delivery_fee')::numeric, 0) = 0
  and coalesce((checkout_settings->>'free_delivery_minimum')::numeric, 0) = 0;
