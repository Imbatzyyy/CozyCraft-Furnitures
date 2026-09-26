// Disposable fixture database only. Never reads credentials or a linked project.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const container = process.env.COZY_QA_CONTAINER || 'cozy-architecture-qa';
const database = `architecture_${Date.now()}`;
execFileSync('docker', ['exec', container, 'createdb', '-U', 'postgres', database]);
const sql = query => execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', database, '-At', '-v', 'ON_ERROR_STOP=1'], {input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
try {
  sql(`
    do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    create schema private;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('qa.actor_id',true),'')::uuid$$;
    create function private.is_staff() returns boolean language sql as $$select coalesce(current_setting('qa.staff',true),'false')='true'$$;
    create function private.customer_mfa_satisfied() returns boolean language sql as $$select true$$;
    create function private.admin_mfa_satisfied() returns boolean language sql as $$select coalesce(current_setting('qa.mfa',true),'false')='true'$$;
    create table products(id text primary key,name text,status text,stock_quantity integer,updated_at timestamptz default now());
    create table profiles(id uuid primary key,full_name text,username text,email text,avatar_url text,created_at timestamptz default now(),role text);
    create table activity_logs(id bigint generated always as identity,actor_id uuid,action text,entity_type text,entity_id text,details jsonb,created_at timestamptz default now(),platform text,actor_role text);
    create table client_error_events(id bigint generated always as identity,user_id uuid,message text,stack text,path text,user_agent text,created_at timestamptz default now());
    create table reviews(id bigint generated always as identity,user_id uuid,product_id text,rating int,title text,body text,approved boolean,image_paths text[],created_at timestamptz default now());
    create table mobile_loyalty_accounts(user_id uuid,points_balance int,lifetime_eligible_spend numeric,tier text,tier_valid_until timestamptz,last_activity_at timestamptz,updated_at timestamptz);
    create table mobile_loyalty_transactions(user_id uuid);
    create table mobile_loyalty_redemptions(user_id uuid);
    create table orders(id uuid primary key,order_number text,user_id uuid,status text,updated_at timestamptz default now(),payment_method text default 'cod',payment_status text default 'pending',payment_expires_at timestamptz,
      cancellation_reason text,cancellation_requested_at timestamptz,cancellation_status text,cancellation_reviewed_at timestamptz,cancellation_decision_note text,refund_status text,refunded_at timestamptz,
      subtotal numeric default 100,delivery_fee numeric default 0,reward_discount numeric default 0,total numeric default 100,shipping_address jsonb default '{"name":"Fixture Customer"}',created_at timestamptz default now());
    create table order_items(id bigint generated always as identity,order_id uuid,product_id text,product_name text,unit_price numeric,quantity integer,image_url text);
    create table order_status_history(id bigint generated always as identity,order_id uuid,status text,changed_at timestamptz,changed_by uuid);
    create table payment_transactions(id uuid,order_id uuid,provider text,provider_session_id text,provider_payment_id text,status text,amount numeric,currency text,livemode boolean,failure_reason text,paid_at timestamptz,expires_at timestamptz,created_at timestamptz,updated_at timestamptz);
    create table support_tickets(id uuid,user_id uuid,status text,priority text,created_at timestamptz);
    create table private.furniture_photo_index_queue(product_id text,attempts integer);
    create table public.voucher_claim_emails(status text,created_at timestamptz,recipient text);
    create publication supabase_realtime;
  `);
  for (const file of ['20260825103000_add_public_product_availability_signal.sql','20260925100000_low_egress_read_models.sql','20260925110000_customer_history_pages.sql','20260925120000_operations_summary_pages.sql','20260925130000_staff_job_health.sql'])
    sql(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
  sql(`
    insert into products(id,name,status,stock_quantity) values('sofa','Sofa','active',5);
    insert into profiles(id,full_name,username,email,role) select md5(i::text)::uuid,'Customer '||i,'user'||i,'test'||i||'@example.invalid','customer' from generate_series(1,25) i;
    insert into mobile_loyalty_accounts(user_id,points_balance,lifetime_eligible_spend,tier) select id,100,1000,'plus' from profiles order by id limit 5;
    insert into activity_logs(action,entity_type,entity_id,details,platform) select 'update_order','orders',i::text,jsonb_build_object('order_number',i,'huge',repeat('x',10000)),'web' from generate_series(1,45) i;
    insert into client_error_events(message,stack,path) values('Fixture failure',repeat('secret stack fixture ',1000),'/fixture');
    insert into reviews(user_id,product_id,rating,title,body,approved,image_paths) select (select id from profiles limit 1),'sofa',5,'Fixture','Review',i>2,case when i<=3 then array['fixture/photo.webp'] else array[]::text[] end from generate_series(1,12) i;
    grant usage on schema private to authenticated;
    grant usage on schema auth to authenticated;
    grant select on all tables in schema public to authenticated;
    insert into orders(id,order_number,user_id,status) select md5(('order'||i)::text)::uuid,'CC-'||i,md5('1')::uuid,case when i<5 then 'delivered' else 'pending' end from generate_series(1,13) i;
    insert into orders(id,order_number,user_id,status) values(md5('other')::uuid,'CC-OTHER',md5('2')::uuid,'delivered');
    insert into order_items(order_id,product_id,product_name,quantity,unit_price) select id,'sofa','Sofa',1,100 from orders;
  `);
  const call = (query,staff=true,mfa=true) => JSON.parse(sql(`begin;set local role authenticated;set local qa.staff='${staff}';set local qa.mfa='${mfa}';select ${query};rollback;`).split('\n').at(-2));
  const activity = call("public.admin_activity_page('all','',1,20)");
  assert.equal(activity.total,46); assert.equal(activity.rows.length,20);
  assert.ok(JSON.stringify(activity).length<15000,'bounded summaries omit huge details and stacks');
  const second = call("public.admin_activity_page('all','',2,20)");
  assert.ok(!second.rows.some(row => activity.rows.some(first => first.id===row.id)),'stable tie-breaking avoids duplicate pages');
  assert.equal(call("public.admin_activity_page('errors','Fixture failure',1,20)").total,1);
  const reviews=call("public.admin_review_page('all',1)");
  assert.equal(reviews.total,12); assert.equal(reviews.rows.length,10); assert.equal(reviews.hidden,2); assert.equal(reviews.photos,3); assert.equal(reviews.average,5);
  assert.equal(call("public.admin_review_page('all',2)").rows.length,2);
  const members=call("public.admin_member_page('', 'all','points',1)");
  assert.equal(members.total,25); assert.equal(members.rows.length,20); assert.equal(members.points,500); assert.equal(members.tiers.member,20);
  assert.equal(call("public.admin_member_page('', 'plus','points',1)").total,5);
  for(const query of ["public.admin_activity_page()","public.admin_review_page()","public.admin_member_page()","public.admin_operations_snapshot()","public.admin_payment_page()","public.admin_job_health()"]){
    assert.throws(()=>call(query,false,true),/./,'customer cannot read staff models');
    assert.throws(()=>call(query,true,false),/./,'MFA is required');
  }
  assert.throws(()=>call("public.admin_activity_page('all','',0,20)"));
  assert.throws(()=>call("public.admin_activity_page('all','',1,500)"));
  const user=sql("select md5('1')::uuid");
  const customerCall=query=>JSON.parse(sql(`begin;set local role authenticated;set local qa.actor_id='${user}';select ${query};rollback;`).split('\n').at(-2));
  const firstOrders=customerCall("public.customer_order_page('all',1,null)");
  assert.equal(firstOrders.orders.length,5);assert.equal(firstOrders.counts.all,13);assert.equal(firstOrders.counts.delivered,4);
  const nextOrders=customerCall("public.customer_order_page('all',2,null)");
  assert.ok(!firstOrders.ids.some(id=>nextOrders.ids.includes(id)));
  const focus=nextOrders.ids[0];
  assert.equal(customerCall(`public.customer_order_page('all',1,'${focus}')`).orders.length,6,'direct links add at most one authorized order');
  assert.equal(customerCall("public.customer_order_page('all',1,md5('other')::uuid)").orders.length,5,'foreign focused order is never exposed');
  assert.equal(customerCall("public.current_product_review_context('sofa')").purchased,true,'purchase eligibility does not depend on loaded history page');
  const payment=call("public.admin_payment_page(1,20,null)"); assert.equal(payment.total,14);assert.equal(payment.rows.length,14);
  const health=call("public.admin_operations_snapshot()");assert.equal(health.recentClientErrors,1);assert.equal(health.errors.length,1);
  sql("insert into private.furniture_photo_index_queue values ('sofa',6); insert into voucher_claim_emails values ('queued',now()-interval '1 hour','private@example.invalid'); revoke all on voucher_claim_emails from authenticated;");
  const jobs=call("public.admin_job_health()");assert.equal(jobs.photoExhausted,1);assert.equal(jobs.voucherOverdue,1);assert.ok(!JSON.stringify(jobs).includes('private@example.invalid'));
  sql("update product_availability set updated_at='2000-01-01'; update products set stock_quantity=4 where id='sofa';");
  assert.equal(sql("select updated_at>'2000-01-02' from product_availability where product_id='sofa'"),'t','stock-only updates emit catalog invalidations');
  sql("delete from products where id='sofa'");
  assert.equal(sql("select available from product_availability where product_id='sofa'"),'f','deletes retain an unavailable tombstone');
  console.log('PASS: bounded activity/review/member/order/payment pages, global totals, direct links, owner isolation, eligibility, operations aggregates, authorization, MFA, input limits, stock signals and tombstones.');
} finally {
  // Exact disposable fixture created above; never a user/production database.
  execFileSync('docker',['exec',container,'dropdb','-U','postgres',database]);
}
