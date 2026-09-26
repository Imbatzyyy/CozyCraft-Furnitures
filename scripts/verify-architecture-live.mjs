// Role-simulated release checks. All schema/session changes are rolled back.
// Only boolean assertions leave the database; no customer records or tokens.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const migrations = ['20260925100000_low_egress_read_models.sql','20260925110000_customer_history_pages.sql','20260925120000_operations_summary_pages.sql','20260925130000_staff_job_health.sql'];
const definitions = process.argv.includes('--rehearse') ? migrations.map(file=>readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8')).join('\n') : '';
const query = `begin;
set local lock_timeout='3s'; set local statement_timeout='25s';
${definitions}
create temporary table architecture_results(label text,passed boolean) on commit drop;
grant insert on architecture_results to authenticated;
do $$ declare u uuid; s uuid:=gen_random_uuid(); begin
  select id into u from public.profiles where role='superadmin' and staff_active limit 1;
  if u is null then raise exception 'No administrator available for transactional role checks'; end if;
  insert into auth.sessions(id,user_id,created_at,updated_at) values(s,u,now(),now());
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','aal','aal1','session_id',s)::text,true);
end $$;
set local role authenticated;
do $$ declare f text; denied boolean; begin
  foreach f in array array['admin_activity_page','admin_review_page','admin_member_page','admin_payment_page','admin_operations_snapshot','admin_job_health'] loop
    denied:=false;
    begin execute format('select public.%I()',f); exception when insufficient_privilege then denied:=true; end;
    insert into architecture_results values(f||'_aal1_denied',denied);
  end loop;
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claims',(current_setting('request.jwt.claims')::jsonb||jsonb_build_object('aal','aal2'))::text,true); end $$;
set local role authenticated;
insert into architecture_results select 'activity_page_bounded',jsonb_array_length(public.admin_activity_page()->'rows')<=20;
insert into architecture_results select 'review_page_bounded',jsonb_array_length(public.admin_review_page()->'rows')<=10;
insert into architecture_results select 'member_page_bounded',jsonb_array_length(public.admin_member_page()->'rows')<=20;
insert into architecture_results select 'payment_page_bounded',jsonb_array_length(public.admin_payment_page()->'rows')<=20;
insert into architecture_results select 'operations_summary',jsonb_array_length(public.admin_operations_snapshot()->'errors')<=30;
insert into architecture_results select 'job_counts_only',jsonb_typeof(public.admin_job_health()->'voucherQueued')='number';
reset role;
do $$ declare u uuid; s uuid:=gen_random_uuid(); begin
  select p.id into u from public.profiles p where p.role='customer' and coalesce(p.customer_active,true) and exists(select 1 from public.orders o where o.user_id=p.id) limit 1;
  if u is null then raise exception 'No customer available for transactional role checks'; end if;
  insert into auth.sessions(id,user_id,created_at,updated_at) values(s,u,now(),now());
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','aal','aal2','session_id',s)::text,true);
end $$;
set local role authenticated;
insert into architecture_results select 'customer_orders_bounded',jsonb_array_length(public.customer_order_page()->'orders')<=5;
insert into architecture_results select 'customer_count_correct',(public.customer_order_page()->>'total')::bigint=(select count(*) from public.orders where user_id=auth.uid());
insert into architecture_results select 'customer_graph_owner_only',not exists(select 1 from jsonb_array_elements(public.customer_order_page()->'orders') row where row->>'user_id'<>auth.uid()::text);
insert into architecture_results select 'review_context_available',jsonb_typeof(public.current_product_review_context('ivar')->'purchased')='boolean';
do $$ declare denied boolean:=false; begin
  begin perform public.admin_job_health(); exception when insufficient_privilege then denied:=true; end;
  insert into architecture_results values('customer_private_queue_denied',denied);
end $$;
reset role;
insert into public.customer_device_sessions(session_id,user_id,device_label,browser_label,revoked_at)
values((auth.jwt()->>'session_id')::uuid,auth.uid(),'Transactional QA','Transactional QA',now());
set local role authenticated;
insert into architecture_results select 'revoked_customer_order_rows_hidden',jsonb_array_length(public.customer_order_page()->'orders')=0;
reset role;
select jsonb_agg(jsonb_build_object('check',label,'passed',passed)) as checks from architecture_results;
rollback;`;
let rows;
if (process.argv.includes('--management-api')) {
  assert.ok(process.env.SUPABASE_ACCESS_TOKEN,'Provide a token through the environment, never a command argument');
  const ref=readFileSync(new URL('../supabase/.temp/project-ref',import.meta.url),'utf8').trim();
  assert.equal(ref,'gwjsivqksyimuabbdyqq','Only the intended linked project may be verified');
  const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{
    method:'POST',headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},
    body:JSON.stringify({query}),signal:AbortSignal.timeout(60000),
  });
  if(!response.ok) throw new Error(`Transactional verification failed (${response.status}): ${await response.text()}`);
  rows=await response.json();
} else {
  try { rows=JSON.parse(execFileSync('npx',['supabase','db','query','--linked',query],{encoding:'utf8',timeout:60000,maxBuffer:1024*1024})).rows; }
  catch { throw new Error('Supabase CLI verification failed. No changes were committed.'); }
}
const checks=rows?.find(row=>row.checks)?.checks;
assert.equal(checks?.length,18,'All live role assertions returned');
assert.ok(checks.every(check=>check.passed),'Live authorization/read-model assertion failed');
console.log(JSON.stringify(checks));
