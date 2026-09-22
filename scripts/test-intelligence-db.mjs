// Isolated local Postgres only. Never connects to the linked production database.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const container = "cozy-intelligence-qa";
const database = `intelligence_${Date.now()}`;
execFileSync("docker", ["exec", container, "createdb", "-U", "postgres", database]);
const args = ["exec", "-i", container, "psql", "-U", "postgres", "-d", database, "-X", "-qAt", "-v", "ON_ERROR_STOP=1"];
const sql = query => execFileSync("docker", args, { input: query, encoding: "utf8" }).trim();
try {
  sql(`do $$ begin if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; end $$;
    create schema private; create schema auth;
    create function private.is_staff() returns boolean language sql stable as $$ select coalesce(current_setting('test.role',true),'')='admin' $$;
    create function private.customer_mfa_satisfied() returns boolean language sql stable as $$select true$$;
    create function private.admin_mfa_satisfied() returns boolean language sql stable as $$select coalesce(current_setting('test.aal',true),'')='aal2'$$;
    grant usage on schema private to authenticated;
    create table public.orders(id uuid primary key,order_number text,user_id uuid,status text,payment_status text,payment_method text,total numeric,refund_status text,created_at timestamptz);
    create table public.payment_transactions(id uuid default gen_random_uuid(),order_id uuid,livemode boolean,status text,paid_at timestamptz);
    create table public.order_status_history(order_id uuid,status text,changed_at timestamptz);
    create table public.products(id text primary key,name text,category text,stock_quantity integer,status text);
    create table public.order_items(order_id uuid,product_id text,quantity integer,unit_price numeric);
    create table public.profiles(id uuid,full_name text,username text,email text,role text);
    grant select on all tables in schema public to authenticated;
    insert into public.orders select ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'CC-'||i,'00000000-0000-4000-8000-000000000099','delivered','paid',case when i in(3,5,6,9) then 'cod' else 'card' end,100,null,now()-interval '10 days' from generate_series(1,9) i;
    update public.orders set status='cancelled' where order_number='CC-4';
    update public.orders set payment_status='refunded' where order_number='CC-7';
    update public.orders set payment_status='pending' where order_number='CC-8';
    insert into public.payment_transactions(order_id,livemode,status,paid_at) select id,order_number<>'CC-2',case when order_number='CC-7' then 'refunded' when order_number='CC-8' then 'pending' else 'paid' end,(now() at time zone 'Asia/Manila')::date::timestamp at time zone 'Asia/Manila'-interval '2 days' from public.orders where payment_method='card';
    insert into public.order_status_history select id,'delivered',(now() at time zone 'Asia/Manila')::date::timestamp at time zone 'Asia/Manila'-interval '1 day' from public.orders where order_number='CC-3';
    insert into public.order_status_history select id,'delivered',now() from public.orders where order_number='CC-6';
    insert into public.order_status_history select id,'delivered',(now() at time zone 'Asia/Manila')::date::timestamp at time zone 'Asia/Manila'+interval '1 day' from public.orders where order_number='CC-9';
    insert into public.products values('piece','=HYPERLINK("unsafe")','Living room',2,'active');
    insert into public.order_items select id,'piece',1,100 from public.orders;
    insert into public.profiles values('00000000-0000-4000-8000-000000000099','Test Customer','test','test@example.invalid','customer');`);
  sql(readFileSync(new URL("../supabase/migrations/20260922090000_ai_forecast_read_model.sql", import.meta.url), "utf8"));
  const admin = query => sql(`begin; set local test.role='admin'; set local test.aal='aal2'; set local role authenticated; ${query}; commit;`).split("\n").at(-1);
  const result = JSON.parse(admin("select public.admin_forecast_inputs()"));
  assert.equal(result.eligibleOrders, 2);
  assert.equal(result.excludedTestPayments, 1);
  assert.equal(result.undatedSettlements, 1);
  assert.equal(result.series.length, 2);
  assert.equal(result.series.reduce((s,r) => s+r.sales,0), 200);
  assert.equal(result.series[0].orders, 1);
  assert.equal(result.series[1].orders, 1);
  assert.ok(!JSON.stringify(result).includes("example.invalid"));
  const cached = JSON.parse(admin("select public.admin_forecast_inputs()"));
  assert.equal(cached.generatedAt,result.generatedAt,"server cache reused");
  for (const role of ["customer", "revoked", ""]) {
    const denied = sql(`begin; set local test.role='${role}'; set local role authenticated; do $$begin begin perform public.admin_forecast_inputs(); raise exception 'Access leaked'; exception when insufficient_privilege then null; end; end$$; rollback; select 'denied';`);
    assert.equal(denied,"denied");
  }
  assert.equal(sql("select has_function_privilege('anon','public.admin_forecast_inputs()','execute')"),"f");
  assert.equal(sql("select has_table_privilege('authenticated','private.forecast_input_cache','select')"),"f");
  assert.equal(sql("begin; set local test.role='admin'; set local test.aal='aal1'; do $$begin begin perform public.admin_forecast_inputs(); raise exception 'MFA bypass'; exception when insufficient_privilege then null; end; end$$; rollback; select 'denied';"),"denied");
  for (const call of ["public.admin_reports_summary('Quarter')", "public.admin_report_export('Sales performance','Quarter',1)"]) {
    for (const [role, aal] of [["customer", "aal2"], ["admin", "aal1"]]) {
      assert.equal(sql(`begin; set local test.role='${role}'; set local test.aal='${aal}'; set local role authenticated; do $$begin begin perform ${call}; raise exception 'Report access leaked'; exception when insufficient_privilege then null; end; end$$; rollback; select 'denied';`), "denied");
    }
  }
  const summary = JSON.parse(admin("select public.admin_reports_summary('Quarter')"));
  assert.equal(summary.grossSales,600); assert.equal(summary.paidCount,6); assert.equal(summary.soldByProduct.piece,6);
  assert.equal(summary.customerCount,1); assert.equal(summary.repeatCustomers,1);
  assert.ok(!JSON.stringify(summary).includes("example.invalid"));
  const exported = JSON.parse(admin("select public.admin_report_export('Inventory velocity','Quarter',1)"));
  assert.equal(exported.rows[0][4],6,"cancelled and unpaid units excluded");
  assert.equal(JSON.parse(admin("select public.admin_report_export('Inventory velocity','Quarter',2)")).rows.length,0);
  sql("truncate public.orders,public.payment_transactions,public.order_status_history; update private.forecast_input_cache set expires_at=now()-interval '1 second';");
  assert.equal(JSON.parse(admin("select public.admin_forecast_inputs()")).series.length,0,"empty history is not invented");
  console.log("PASS: settlement dates, COD history, test/cancel/refund/unpaid/today/future exclusions, private cache, cache hits, MFA, role denial, aggregates, exports and empty history.");
} finally {
  execFileSync("docker", ["exec", container, "dropdb", "-U", "postgres", database]);
}
