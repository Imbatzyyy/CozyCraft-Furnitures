// Isolated real PostgreSQL (WASM); never creates live orders or charges money.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
const file = name => readFileSync(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8');
const owner = '00000000-0000-4000-8000-000000000001';
const address = '00000000-0000-4000-8000-000000000002';
const reward = '00000000-0000-4000-8000-000000000003';
const key = '00000000-0000-4000-8000-000000000004';
const rows = async sql => (await db.query(sql)).rows;
const cod = (checkoutKey = key, voucher = 'null') => `select place_mobile_cod_order('${address}','[{"product_id":"chair","quantity":1}]','${checkoutKey}',${voucher}) result`;
const reject = async (sql, expected) => {
  try { await assert.rejects(() => db.exec(sql), expected); } finally { await db.exec('rollback'); }
};
try {
  await db.exec(`
    create role anon; create role authenticated; create schema private; create schema auth;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('qa.user',true),'')::uuid$$;
    create function security_action_allowed() returns boolean language sql as $$select auth.uid() is not null$$;
    create table auth.users(id uuid primary key);
    insert into auth.users values('${owner}');
    create table store_settings(id boolean primary key,checkout_settings jsonb,fulfillment_settings jsonb,updated_at timestamptz);
    insert into store_settings values(true,'{"cod_maximum_order":0,"cod_enabled":true,"gcash_enabled":true,"card_enabled":true}','{}',now());
    create table addresses(id uuid,user_id uuid,label text,recipient_name text,mobile text,email text,address_line text,barangay text,city text,province text,postal_code text,delivery_note text);
    insert into addresses(id,user_id,province,city) values('${address}','${owner}','Metro Manila','Quezon City');
    create table delivery_service_areas(area_code text,name text,delivery_fee numeric,free_delivery_minimum numeric,lead_time_min_days int,lead_time_max_days int,assembly_available boolean,active boolean);
    insert into delivery_service_areas values('metro-manila','Metro Manila',650,null,2,4,true,true);
    create table products(id text primary key,name text,price numeric,images text[],stock_quantity int,status text);
    insert into products values('chair','Chair',19350,array['fixture'],100,'active');
    create sequence order_number_seq;
    create table orders(id uuid primary key default gen_random_uuid(),user_id uuid,order_number text,payment_method text,subtotal numeric,delivery_fee numeric,total numeric,shipping_address jsonb,status text default 'pending',payment_status text default 'pending',checkout_key uuid,created_at timestamptz default now(),reward_discount numeric default 0,unique(user_id,checkout_key));
    create table order_items(order_id uuid,product_id text,product_name text,unit_price numeric,quantity int,image_url text);
    create table cart_items(user_id uuid,product_id text);
    insert into cart_items values('${owner}','chair');
    create table fixture_rewards(id uuid,status text default 'available');
    insert into fixture_rewards values('${reward}');
    -- Reward fixture models the existing atomic total update; policy runs after it.
    create function apply_mobile_reward_to_order(o uuid,r uuid) returns void language plpgsql as $$begin update orders set total=total-500,reward_discount=500 where id=o; update fixture_rewards set status='applied' where id=r; end$$;
    create function mark_mobile_order(uuid) returns void language sql as $$select$$;
    select set_config('qa.user','${owner}',false);
  `);
  await db.exec(file('20260814164357_align_delivery_fees_with_service_areas'));
  const wrapper=file('20260803003000_retry_failed_checkouts');
  await db.exec(wrapper.slice(wrapper.indexOf('create or replace function public.place_order(')));
  await db.exec(file('20260906073850_mobile_atomic_cod_checkout'));
  // A pre-policy large order must remain fulfillable/settleable.
  const legacy=(await rows(`insert into orders(user_id,payment_method,total) values('${owner}','cod',50000) returning id`))[0].id;
  await db.exec(file('20261022010000_checkout_payment_limits'));
  await db.exec(`update orders set status='delivered',payment_status='paid' where id='${legacy}'`);
  assert.equal((await rows('select private.checkout_cod_limit() n'))[0].n,'20000');
  const first=(await rows(cod()))[0].result;
  assert.equal(first.total,20000);
  assert.equal((await rows(cod()))[0].result.id,first.id,'same retry returns one order');
  assert.equal((await rows("select stock_quantity from products"))[0].stock_quantity,99);
  await db.exec(`update products set price=1;`);
  await reject(cod('00000000-0000-4000-8000-000000000005'),/unpaid COD orders would exceed/);
  assert.equal((await rows("select stock_quantity from products"))[0].stock_quantity,99,'rejected order restores stock');
  await db.exec(`update orders set status='cancelled' where id='${first.id}'; update products set price=19350.01; insert into cart_items values('${owner}','chair');`);
  await reject(cod('00000000-0000-4000-8000-000000000006'),/Cash on delivery is available up to/);
  assert.equal((await rows('select count(*)::int n from cart_items'))[0].n,1,'rejected checkout keeps cart');
  // Voucher takes 20,500 down to exactly 20,000 in the same transaction.
  await db.exec('update products set price=19850');
  const discounted=(await rows(cod('00000000-0000-4000-8000-000000000007',`'${reward}'`)))[0].result;
  assert.equal(discounted.total,20000);
  assert.equal(discounted.reward_discount,500);
  await db.exec(`update orders set payment_status='paid' where id='${discounted.id}'; update products set price=19850.01; update fixture_rewards set status='available';`);
  await reject(cod('00000000-0000-4000-8000-000000000008',`'${reward}'`),/Cash on delivery is available up to/);
  assert.equal((await rows('select status from fixture_rewards'))[0].status,'available','rejected voucher update rolls back');
  // Provider boundaries, inclusive GCash and exclusive card maximum.
  for (const [method,amount,allowed] of [['gcash',100000,true],['gcash',100000.01,false],['card',9999999.99,true],['card',10000000,false]]) {
    const sql=`insert into orders(user_id,payment_method,total) values('${owner}','${method}',${amount})`;
    if(allowed) await db.exec(sql); else await reject(sql,/GCash is available|Card payments must/);
  }
  // Exercise the website's real atomic wrapper too, with an isolated reward stub.
  await db.exec(`
    alter table orders add column home_circle_redemption_id uuid;
    create table payment_transactions(order_id uuid);
    create table private.web_reward_checkout_intents(user_id uuid,checkout_key uuid,intent jsonb,primary key(user_id,checkout_key));
    create or replace function apply_mobile_reward_to_order(o uuid,r uuid) returns void language plpgsql as $$begin
      update orders set total=total-500,reward_discount=500,home_circle_redemption_id=r where id=o and home_circle_redemption_id is null;
      update fixture_rewards set status='applied' where id=r;
    end$$;
  `);
  const webMigration = file('20260908010000_web_vouchers_and_claim_email');
  await db.exec(webMigration.slice(webMigration.indexOf('create or replace function public.place_order_with_reward('), webMigration.indexOf('create table public.voucher_claim_emails')));
  const webKey = '00000000-0000-4000-8000-000000000009';
  const webCod = checkoutKey => `select place_order_with_reward('${address}','cod','[{"product_id":"chair","quantity":1}]','${checkoutKey}','${reward}') id`;
  await db.exec('update products set price=19850');
  const webOrder = (await rows(webCod(webKey)))[0].id;
  assert.equal(Number((await rows(`select total from orders where id='${webOrder}'`))[0].total),20000);
  assert.equal((await rows(webCod(webKey)))[0].id,webOrder,'website retries reuse the same order');
  assert.equal(Number((await rows(`select total from orders where id='${webOrder}'`))[0].total),20000,'website retry does not discount twice');
  await db.exec(`update orders set payment_status='paid' where id='${webOrder}'; update products set price=19850.01; update fixture_rewards set status='available'; insert into cart_items values('${owner}','chair');`);
  const stockBefore = (await rows('select stock_quantity from products'))[0].stock_quantity;
  await reject(webCod('00000000-0000-4000-8000-000000000010'),/Cash on delivery is available up to/);
  assert.equal((await rows('select stock_quantity from products'))[0].stock_quantity,stockBefore,'website rejection restores inventory');
  assert.equal((await rows('select count(*)::int n from cart_items'))[0].n,1,'website rejection preserves the cart');
  assert.equal((await rows('select status from fixture_rewards'))[0].status,'available','website rejection preserves the voucher');
  const policy=(await rows('select get_checkout_payment_policy() p'))[0].p;
  assert.equal(policy.outstanding_cod_total,0);
  await db.exec(`select set_config('qa.user','',false)`);
  await reject('select get_checkout_payment_policy()',/Authentication required/);
  assert.equal((await rows("select has_function_privilege('anon','get_checkout_payment_policy()','execute') ok"))[0].ok,false);
  assert.equal((await rows("select has_function_privilege('authenticated','private.enforce_checkout_payment_limits()','execute') ok"))[0].ok,false);
  console.log('PASS: final-total boundaries, delivery, website/mobile atomic voucher discount/rollback, stock/cart rollback, COD exposure, idempotent retries, legacy settlement and policy access control.');
  console.log('NOTE: PGlite is single-connection; this is not a concurrent load test.');
} finally { await db.close(); }
