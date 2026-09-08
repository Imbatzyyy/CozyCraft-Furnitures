-- Run with `supabase db query --linked --file supabase/tests/web-vouchers.sql`.
-- Every fixture, claim, email job and order is rolled back. No payment provider
-- is contacted and no email job becomes visible to the worker. Order sequences
-- may advance (normal PostgreSQL sequence semantics).
begin;
set local statement_timeout = '30s';
do $$
declare
  candidate record; v_user uuid; v_address uuid; v_product text; v_price numeric;
  v_claim public.mobile_loyalty_redemptions; v_repeat public.mobile_loyalty_redemptions;
  v_claim_key uuid := gen_random_uuid(); v_checkout_key uuid; v_order uuid; v_order_repeat uuid;
  v_count bigint; v_stock integer; v_after integer; v_cart bigint; v_total numeric; v_discount numeric;
  v_rejected boolean; v_method text; v_points integer; v_credit uuid; v_zero uuid;
begin
  for candidate in select s.user_id,s.id from auth.sessions s join public.profiles p on p.id=s.user_id join auth.users u on u.id=s.user_id
    where p.role='customer' and u.email_confirmed_at is not null and exists(select 1 from public.addresses where user_id=s.user_id)
    order by s.created_at desc limit 20
  loop
    perform set_config('request.jwt.claim.sub',candidate.user_id::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',candidate.user_id,'session_id',candidate.id,'role','authenticated','aal','aal2')::text,true);
    if public.security_action_allowed() then v_user:=candidate.user_id; exit; end if;
  end loop;
  if v_user is null then raise exception 'No eligible test session: authenticate a test customer first'; end if;
  select a.id into v_address from public.addresses a join public.delivery_service_areas d on d.area_code=private.delivery_area_code_for_address(a.province,a.city) and d.active where a.user_id=v_user limit 1;
  select id,price into v_product,v_price from public.products where status='active' and stock_quantity>=4 and price>0 order by price limit 1;
  if v_address is null or v_product is null then raise exception 'Checkout fixtures unavailable'; end if;
  if has_function_privilege('anon','public.claim_home_circle_reward(integer,uuid)','execute') or has_function_privilege('authenticated','public.claim_voucher_emails()','execute') then raise exception 'Unexpected privileged RPC grant'; end if;
  if has_table_privilege('authenticated','public.voucher_claim_emails','select') then raise exception 'Email recipients exposed'; end if;

  insert into public.mobile_loyalty_transactions(user_id,event_key,kind,points,description) values(v_user,'qa:'||gen_random_uuid(),'adjustment',2000,'Rollback-only voucher test') returning id into v_credit;
  perform private.refresh_mobile_loyalty_account(v_user);
  select points_balance into v_points from public.mobile_loyalty_accounts where user_id=v_user;
  select * into v_claim from public.claim_home_circle_reward(100,v_claim_key);
  select * into v_repeat from public.claim_home_circle_reward(100,v_claim_key);
  if v_claim.id<>v_repeat.id then raise exception 'Claim retry created another voucher'; end if;
  if (select points_balance from public.mobile_loyalty_accounts where user_id=v_user)<>v_points-100 then raise exception 'Claim deducted points incorrectly'; end if;
  if (select count(*) from public.voucher_claim_emails where redemption_id=v_claim.id)<>1 then raise exception 'Claim email is missing or duplicated'; end if;
  if v_claim.expires_at < now()+interval '29 days' or v_claim.discount_amount<>100 then raise exception 'Claim value or expiry is incorrect'; end if;
  v_rejected:=false;
  begin perform public.claim_home_circle_reward(250,v_claim_key); exception when others then v_rejected:=sqlerrm like '%different reward%'; end;
  if not v_rejected then raise exception 'Mismatched claim key accepted'; end if;
  v_rejected:=false;
  begin perform public.claim_home_circle_reward(123,gen_random_uuid()); exception when others then v_rejected:=sqlerrm like '%valid reward%'; end;
  if not v_rejected then raise exception 'Invalid points amount accepted'; end if;
  select points_balance into v_points from public.mobile_loyalty_accounts where user_id=v_user;
  insert into public.mobile_loyalty_transactions(user_id,event_key,kind,points,description) values(v_user,'qa:'||gen_random_uuid(),'adjustment',-v_points,'Rollback-only insufficient balance test') returning id into v_zero;
  v_rejected:=false;
  begin perform public.claim_home_circle_reward(500,gen_random_uuid()); exception when others then v_rejected:=sqlerrm like '%Not enough points%'; end;
  if not v_rejected then raise exception 'Insufficient balance accepted'; end if;
  delete from public.mobile_loyalty_transactions where id=v_zero;
  perform private.refresh_mobile_loyalty_account(v_user);

  select count(*) into v_count from public.orders where user_id=v_user;
  select stock_quantity into v_stock from public.products where id=v_product;
  select count(*) into v_cart from public.cart_items where user_id=v_user;
  update public.mobile_loyalty_redemptions set expires_at=now()-interval '1 second' where id=v_claim.id;
  v_rejected:=false;
  begin perform public.place_order_with_reward(v_address,'cod',jsonb_build_array(jsonb_build_object('product_id',v_product,'quantity',1)),gen_random_uuid(),v_claim.id); exception when others then v_rejected:=sqlerrm like '%unavailable or expired%'; end;
  if not v_rejected then raise exception 'Expired voucher accepted'; end if;
  if (select count(*) from public.orders where user_id=v_user)<>v_count or (select stock_quantity from public.products where id=v_product)<>v_stock or (select count(*) from public.cart_items where user_id=v_user)<>v_cart then raise exception 'Rejected voucher changed order, stock or cart'; end if;
  update public.mobile_loyalty_redemptions set expires_at=now()+interval '30 days',minimum_order_amount=v_price+1 where id=v_claim.id;
  v_rejected:=false;
  begin perform public.place_order_with_reward(v_address,'cod',jsonb_build_array(jsonb_build_object('product_id',v_product,'quantity',1)),gen_random_uuid(),v_claim.id); exception when others then v_rejected:=sqlerrm like '%requires a merchandise subtotal%'; end;
  if not v_rejected then raise exception 'Minimum spend ignored'; end if;
  update public.mobile_loyalty_redemptions set minimum_order_amount=0 where id=v_claim.id;

  foreach v_method in array array['cod','card','gcash'] loop
    v_checkout_key:=gen_random_uuid();
    v_order:=public.place_order_with_reward(v_address,v_method,jsonb_build_array(jsonb_build_object('product_id',v_product,'quantity',1)),v_checkout_key,v_claim.id);
    v_order_repeat:=public.place_order_with_reward(v_address,v_method,jsonb_build_array(jsonb_build_object('product_id',v_product,'quantity',1)),v_checkout_key,v_claim.id);
    if v_order<>v_order_repeat then raise exception 'Order retry created a duplicate'; end if;
    select total,reward_discount into v_total,v_discount from public.orders where id=v_order;
    if v_total<1 or v_discount<>least(100,v_total+v_discount-1) then raise exception 'Discount total mismatch'; end if;
    if (select status from public.mobile_loyalty_redemptions where id=v_claim.id)<>'applied' then raise exception 'Voucher not reserved'; end if;
    v_rejected:=false;
    begin perform public.place_order_with_reward(v_address,v_method,jsonb_build_array(jsonb_build_object('product_id',v_product,'quantity',1)),gen_random_uuid(),v_claim.id); exception when others then v_rejected:=sqlerrm like '%unavailable or expired%'; end;
    if not v_rejected then raise exception 'Same voucher used twice'; end if;
    v_rejected:=false;
    begin perform public.place_order_with_reward(v_address,v_method,jsonb_build_array(jsonb_build_object('product_id',v_product,'quantity',2)),v_checkout_key,v_claim.id); exception when others then v_rejected:=sqlerrm like '%different order%'; end;
    if not v_rejected then raise exception 'Changed checkout intent accepted'; end if;
    update public.orders set status='cancelled' where id=v_order;
    if (select status from public.mobile_loyalty_redemptions where id=v_claim.id)<>'available' then raise exception 'Cancelled order did not restore voucher'; end if;
  end loop;
  v_order:=public.place_order_with_reward(v_address,'cod',jsonb_build_array(jsonb_build_object('product_id',v_product,'quantity',1)),gen_random_uuid(),null);
  update public.orders set status='processing' where id=v_order;
  v_rejected:=false;
  begin perform public.apply_mobile_reward_to_order(v_order,v_claim.id); exception when others then v_rejected:=sqlerrm like '%already started%'; end;
  if not v_rejected then raise exception 'Voucher altered an order already in fulfillment'; end if;
  -- Provider payloads and network sending are tested separately, not with real charges.
end $$;
select 'Claim replay, balances, expiry, minimum spend, COD/card/GCash totals, duplicate use, intent binding, cancellation restoration and grants passed; all fixtures rolled back' as result;
rollback;
