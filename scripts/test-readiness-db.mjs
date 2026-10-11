// Real PostgreSQL (WASM), isolated in memory. No credentials, linked database,
// email provider, or network requests. This is not a concurrency/load benchmark.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
const sql=async text=>(await db.query(text)).rows;
const file=name=>readFileSync(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8');
const owner='00000000-0000-4000-8000-000000000001';
const order='00000000-0000-4000-8000-000000000002';
const txn='00000000-0000-4000-8000-000000000003';
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema private; create schema auth; create schema vault; create schema net; create schema cron;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('qa.user',true),'')::uuid$$;
    create function private.is_staff() returns boolean language sql as $$select coalesce(current_setting('qa.staff',true),'false')='true'$$;
    create function private.customer_mfa_satisfied() returns boolean language sql as $$select true$$;
    create function private.admin_mfa_satisfied() returns boolean language sql as $$select true$$;
    create function public.security_action_allowed() returns boolean language sql as $$select auth.uid() is not null$$;
    create table vault.decrypted_secrets(name text,decrypted_secret text);
    create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as $$select 1::bigint$$;
    create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;
    create table profiles(id uuid primary key,full_name text,email text,username text,role text default 'customer',customer_active boolean default true);
    create table orders(id uuid primary key default gen_random_uuid(),user_id uuid,order_number text default 'CC-FIXTURE',status text default 'pending',payment_status text default 'pending',payment_method text default 'cod',total numeric default 100,created_at timestamptz default now(),cancellation_status text,refund_status text,shipping_address jsonb default '{}');
    create table payment_transactions(id uuid primary key,order_id uuid,provider text,provider_session_id text,status text,provider_status text,provider_payment_id text,amount numeric,currency text,livemode boolean,paid_at timestamptz,raw_payload jsonb,last_synced_at timestamptz,failure_reason text,updated_at timestamptz default now());
    create table order_items(id uuid,order_id uuid,product_id text,quantity integer,unit_price numeric);
    create table products(id text,name text,category text,status text,stock_quantity integer);
    create table support_tickets(id uuid primary key,user_id uuid,ticket_number text,admin_reply text,status text,priority text);
    create table email_templates(event_type text primary key,subject_template text,heading text,body_template text,enabled boolean default true);
    create table store_settings(id boolean primary key,store_name text,contact_email text,email_event_settings jsonb default '{}',low_stock_threshold integer default 8);
    create table email_delivery_logs(id uuid primary key default gen_random_uuid(),event_type text,entity_type text,entity_id text,recipient text,status text constraint email_delivery_logs_status_check check(status in ('sent','failed','skipped')),provider_message_id text,error_message text,sent_by uuid,created_at timestamptz default now());
    create table private.security_request_budgets(key text primary key,window_start timestamptz,uses integer);
    insert into profiles(id,full_name,email) values('${owner}','Fixture','fixture@example.invalid');
    insert into store_settings(id,store_name,contact_email) values(true,'CozyCraft','support@example.invalid');
    insert into email_templates(event_type,subject_template,heading,body_template) select e,'Order {{order_number}}','Order update','Status: {{status}}' from unnest(array['order_confirmation','payment_received','fulfillment_update','delivered','cancelled_refunded','support_reply']) e;
    select set_config('qa.user','${owner}',false);
    select set_config('qa.staff','true',false);
  `);
  const budget=file('20260906060000_security_access_boundaries.sql');
  await db.exec(budget.slice(budget.indexOf('create or replace function public.reserve_security_budget')));
  for(const migration of ['20260802160000_atomic_paymongo_settlement.sql','20260802173000_enforce_order_status_transitions.sql','20261011090000_fulfillment_payment_guard.sql','20261011091000_transactional_email_outbox.sql','20261011092000_reporting_environments.sql']) await db.exec(file(migration));

  await sql(`insert into orders(id,user_id,payment_method) values('${order}','${owner}','gcash')`);
  await assert.rejects(()=>sql(`update orders set status='processing' where id='${order}'`),/Confirm online payment/);
  await assert.rejects(()=>sql(`insert into orders(user_id,payment_method,status) values('${owner}','card','delivered')`),/Confirm online payment/);
  await sql(`insert into payment_transactions(id,order_id,provider,status,amount,currency,livemode) values('${txn}','${order}','paymongo','pending',100,'PHP',false)`);
  assert.equal((await sql(`select settle_paymongo_order('${order}','${txn}','pay_fixture',false,'{}') result`))[0].result,'settled');
  assert.equal((await sql(`select settle_paymongo_order('${order}','${txn}','pay_fixture',false,'{}') result`))[0].result,'already_paid');
  assert.equal((await sql(`select count(*)::int n from email_delivery_logs where event_type='payment_received'`))[0].n,1);
  await sql(`update orders set status='packed' where id='${order}'`);
  await sql(`update orders set status='shipped' where id='${order}'`);
  assert.equal((await sql(`select count(*)::int n from email_delivery_logs where event_type='fulfillment_update'`))[0].n,2,'rapid distinct statuses must not suppress each other');
  await sql(`select request_transactional_email('fulfillment_update','${order}')`);
  assert.equal((await sql(`select count(*)::int n from email_delivery_logs where event_type='fulfillment_update'`))[0].n,2,'compatibility caller deduplicated');
  await sql(`update orders set status='delivered' where id='${order}'`);
  await assert.rejects(()=>sql(`update orders set status='processing' where id='${order}'`),/Invalid order status transition/);
  await sql(`insert into orders(user_id,payment_method,payment_status,status) values('${owner}','cod','paid','delivered')`);
  console.log('PASS: database payment guard, settlement replay, COD exception, event deduplication.');

  // A failed transaction must roll its email back as well.
  const before=(await sql('select count(*)::int n from email_delivery_logs'))[0].n;
  await db.exec(`begin; insert into orders(user_id) values('${owner}'); rollback;`);
  assert.equal((await sql('select count(*)::int n from email_delivery_logs'))[0].n,before);
  let batch=(await sql('select claim_transactional_emails() b'))[0].b;
  assert.equal(batch.jobs.length,5);
  assert.deepEqual((await sql('select claim_transactional_emails() b'))[0].b.jobs,[],'one worker lease');
  const job=batch.jobs[0];
  assert.equal((await sql(`select finish_transactional_email('${job.id}','00000000-0000-4000-8000-000000000099','wrong') b`))[0].b,false);
  await sql(`select finish_transactional_email('${job.id}','${batch.lease}',null,'Provider 429',false)`);
  assert.equal((await sql(`select status from email_delivery_logs where id='${job.id}'`))[0].status,'queued');
  for(const j of batch.jobs.slice(1)) await sql(`select finish_transactional_email('${j.id}','${batch.lease}','provider-fixture')`);
  await sql(`select finish_transactional_email_batch('${batch.lease}')`);
  await sql(`update private.transactional_email_jobs set next_attempt_at=now()-interval '1 second' where id='${job.id}'`);
  batch=(await sql('select claim_transactional_emails() b'))[0].b;
  assert.ok(batch.jobs.some(j=>j.id===job.id && j.attempts===2),'retry keeps stable ID');
  for(const j of batch.jobs) await sql(`select finish_transactional_email('${j.id}','${batch.lease}','provider-fixture')`);
  await sql(`select finish_transactional_email_batch('${batch.lease}')`);
  console.log('PASS: rollback-safe email queue, exclusive leases, stale acknowledgement rejection, retry identity.');

  const hash='a'.repeat(64);
  for(let i=1;i<=45;i++) {
    const user=`00000000-0000-4000-9000-${String(i).padStart(12,'0')}`;
    await sql(`insert into profiles(id) values('${user}')`);
    assert.equal((await sql(`select reserve_discovery_search('${hash}','${user}') b`))[0].b,true);
  }
  for(let i=0;i<15;i++) assert.equal((await sql(`select reserve_discovery_search('${hash}',null) b`))[0].b,true);
  assert.equal((await sql(`select reserve_discovery_search('${hash}',null) b`))[0].b,false);
  assert.equal((await sql(`select has_function_privilege('authenticated','public.reserve_discovery_search(text,uuid)','execute') b`))[0].b,false);
  for(const fn of ['claim_transactional_emails()','finish_transactional_email(uuid,uuid,text,text,boolean)','finish_transactional_email_batch(uuid)']) {
    assert.equal((await sql(`select has_function_privilege('authenticated','public.${fn}','execute') b`))[0].b,false);
  }
  console.log('PASS: 45 distinct verified budgets behind one IP, guest cap and service-only worker grants.');

  for(const [scope,total] of [['test',100],['live',100],['all',200]]) {
    assert.equal((await sql(`select admin_reports_summary_scoped('This month','${scope}') r`))[0].r.grossSales,total);
    for(const report of ['Sales performance','Inventory velocity','Customer retention']) {
      const result=(await sql(`select admin_report_export_scoped('${report}','This month',1,'${scope}') r`))[0].r;
      assert.ok(Array.isArray(result.rows));
    }
  }
  const overview=(await sql('select admin_overview_snapshot() r'))[0].r;
  assert.equal(overview.sales,100);assert.equal(overview.excludedTestPaidOrders,1);
  await sql(`select set_config('qa.staff','false',false)`);
  await assert.rejects(()=>sql("select admin_reports_summary_scoped('This month','all')"),/Verified administrator/);
  await assert.rejects(()=>sql(`select request_transactional_email('support_reply','${order}')`),/Access denied/);
  await assert.rejects(()=>sql(`select request_transactional_email('order_confirmation','00000000-0000-4000-9000-000000000999')`),/Access denied/);
  console.log('PASS: scoped report totals/exports/overview and unauthorized access rejection.');
} catch(error) {
  console.error('FAIL:',error.message,error.where ?? '');
  process.exitCode=1;
} finally { await db.close(); }
