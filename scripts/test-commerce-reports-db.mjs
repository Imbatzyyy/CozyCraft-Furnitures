// Isolated PostgreSQL fixture. No linked database, customer writes, or payments.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
const query = async sql => (await db.query(sql)).rows;
const file = name => readFileSync(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8');
const report = async (kind='orders',filters={},extras='') => (await query(`select admin_commerce_report_page('${kind}','${JSON.stringify(filters)}'${extras}) r`))[0].r;
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role; create schema private;
    create function private.is_staff() returns boolean language sql as $$select coalesce(current_setting('qa.staff',true),'false')='true'$$;
    create function private.is_admin() returns boolean language sql as $$select coalesce(current_setting('qa.admin',true),'false')='true'$$;
    create function private.customer_mfa_satisfied() returns boolean language sql as $$select coalesce(current_setting('qa.mfa',true),'false')='true'$$;
    create function private.admin_mfa_satisfied() returns boolean language sql as $$select coalesce(current_setting('qa.mfa',true),'false')='true'$$;
    create table profiles(id uuid,full_name text,email text,phone text);
    create table orders(id uuid primary key default gen_random_uuid(),user_id uuid,order_number text,status text,payment_status text,payment_method text,total numeric,subtotal numeric,delivery_fee numeric,created_at timestamptz,shipping_address jsonb,cancellation_status text,refund_status text);
    create table order_items(id bigint,order_id uuid,product_name text,quantity int,unit_price numeric);
    create table payment_transactions(id uuid default gen_random_uuid(),order_id uuid,provider_payment_id text,provider_session_id text,status text,paid_at timestamptz,updated_at timestamptz,livemode boolean,raw_payload jsonb);
    create table return_requests(order_id uuid);
    select set_config('qa.staff','true',false),set_config('qa.admin','true',false),set_config('qa.mfa','true',false);
    insert into profiles values('00000000-0000-4000-8000-000000000001','Fixture Customer','fixture@example.invalid','09000000000');
    insert into orders(user_id,order_number,status,payment_status,payment_method,total,subtotal,delivery_fee,created_at,shipping_address)
    select '00000000-0000-4000-8000-000000000001', 'CC-'||lpad(n::text,5,'0'),
      (array['pending','processing','packed','shipped','delivered','cancelled'])[(n%6)+1],
      (array['pending','paid','failed','refunded'])[(n%4)+1], (array['cod','gcash','card'])[(n%3)+1],
      n+650,n,650,now()-interval '1 hour','{"name":"Fixture Customer","email":"fixture@example.invalid","mobile":"09000000000","line":"Test Street","city":"Quezon City"}'::jsonb
    from generate_series(1,261) n;
    insert into order_items select row_number() over(),id,'Fixture Sofa',2,100 from orders;
    insert into payment_transactions(order_id,provider_payment_id,status,updated_at,livemode,raw_payload)
    select id,'pay_fixture','paid',now(),false,'{"sensitive":"never exported"}' from orders where payment_method='gcash';
    insert into payment_transactions(order_id,provider_session_id,status,updated_at,livemode)
    select id,'retry_fixture','pending',now()+interval '1 minute',false from orders where payment_method='gcash';
    insert into payment_transactions(order_id,provider_payment_id,status,updated_at,livemode)
    select id,'pay_live','paid',now(),true from orders where payment_method='card';
    insert into return_requests select id from orders limit 1;
  `);
  const environments = file('20261011092000_reporting_environments');
  await db.exec(environments.slice(0,environments.indexOf('-- Existing reports')));
  await db.exec(file('20261022120000_admin_commerce_exports'));
  const first = await report();
  assert.equal(first.total,261); assert.equal(first.rows.length,250); assert.equal(first.hasMore,true);
  const second = await report('orders',{},`,250,'${JSON.stringify(first.nextCursor)}','${first.asOf}'`);
  assert.equal(second.rows.length,11); assert.equal(second.hasMore,false);
  assert.equal(second.snapshotKey,first.snapshotKey);
  assert.equal(new Set([...first.rows,...second.rows].map(r=>r.id)).size,261,'equal timestamps paginate without duplicates');
  assert.equal(first.rows[0].email,undefined,'contact excluded by default');
  assert.equal(first.rows[0].items,undefined,'products excluded by default');
  for (const status of ['pending','processing','packed','shipped','delivered','cancelled']) {
    const r=await report('orders',{status});
    assert.equal(r.total,(await query(`select count(*)::int n from orders where status='${status}'`))[0].n);
    assert.ok(r.rows.every(row=>row.status===status));
  }
  for (const method of ['cod','gcash','card']) for(const paymentStatus of ['pending','paid','failed','refunded']) {
    const r=await report('payments',{paymentMethod:method,paymentStatus});
    assert.equal(r.total,(await query(`select count(*)::int n from orders where payment_method='${method}' and payment_status='${paymentStatus}'`))[0].n);
  }
  for (const [scope,expected] of [['all',261],['test',87],['live',174],['unverified',0]]) assert.equal((await report('payments',{scope})).total,expected);
  const detailed=await report('orders',{paymentMethod:'gcash'},`,250,null,null,'{"contact":true,"address":true,"items":true}'`);
  assert.equal(detailed.rows[0].email,'fixture@example.invalid'); assert.ok(detailed.rows[0].address.includes('Quezon City'));
  assert.equal(detailed.rows[0].items[0].name,'Fixture Sofa');
  assert.equal(detailed.rows[0].payment_reference,'pay_fixture','settled attempt preferred over newer pending retry');
  assert.ok(!JSON.stringify(detailed).includes('never exported'));
  const settled=(await query("select sum(total) v from orders where payment_status='paid' and status<>'cancelled'"))[0].v;
  assert.equal(first.summary.settledValue,Number(settled),'cancelled paid orders excluded from settled sales');
  const thirdPage=await report('payments',{},`,20,null,null,'{}',2`);
  assert.equal(thirdPage.rows.length,20); assert.notEqual(thirdPage.rows[0].id,first.rows[0].id);
  await db.exec(`insert into orders(order_number,status,payment_status,payment_method,total,subtotal,delivery_fee,created_at,shipping_address) values
    ('DATE-IN','pending','pending','cod',1,1,0,'2026-01-01T16:00:00Z','{}'),
    ('DATE-OUT','pending','pending','cod',1,1,0,'2026-01-01T15:59:59Z','{}');`);
  const dated=await report('orders',{dateRange:'custom',from:'2026-01-02',to:'2026-01-02'});
  assert.equal(dated.total,1); assert.equal(dated.rows[0].order_number,'DATE-IN','Manila inclusive date boundary');
  const latest=await report();
  await db.exec(`update orders set total=total+1 where id='${first.rows[0].id}'`);
  const changed=await report('orders',{},`,250,null,'${latest.asOf}'`);
  assert.notEqual(changed.snapshotKey,latest.snapshotKey,'mid-export changes are detectable');
  await assert.rejects(()=>report('orders',{status:'injected'}),/Invalid report filters/);
  await assert.rejects(()=>report('orders',{dateRange:'custom',from:'2026-01-03',to:'2026-01-02'}),/valid start/);
  assert.equal((await report('orders',{query:'not found'})).total,0);
  assert.equal((await report('orders',{view:'returns'})).total,1);
  await db.exec("select set_config('qa.admin','false',false)");
  await assert.rejects(()=>report('payments'),/Administrator payment access/);
  assert.ok((await report('orders')).total>0,'staff retains order-report access');
  await db.exec("select set_config('qa.mfa','false',false)");
  await assert.rejects(()=>report(),/Verified administrator/);
  await db.exec("select set_config('qa.mfa','true',false),set_config('qa.staff','false',false)");
  await assert.rejects(()=>report(),/Verified administrator/);
  assert.equal((await query("select has_function_privilege('anon','admin_commerce_report_page(text,jsonb,integer,jsonb,timestamptz,jsonb,integer)','execute') ok"))[0].ok,false);
  const security=(await query("select prosecdef from pg_proc where proname='admin_commerce_report_page'"))[0];
  assert.equal(security.prosecdef,false,'RLS is not bypassed');
  console.log('PASS: complete cursor pagination, every order/payment filter, scopes, Manila dates, optional details, settlement totals, snapshot changes, staff/admin/MFA gates and invoker/RLS boundary.');
} catch (error) { console.error('FAIL:',error.message,error.where ?? ''); process.exitCode=1; }
finally { await db.close(); }
