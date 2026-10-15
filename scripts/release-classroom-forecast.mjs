// Rehearses only this additive migration against the linked production schema.
// QA auth sessions/cache writes always roll back. --apply then commits just the
// migration; --installed verifies the installed RPC without recreating data.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const version='20261015090000';
const name='classroom_forecast_dataset';
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),'gwjsivqksyimuabbdyqq');
const migration=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8');
const query=sql=>JSON.parse(execFileSync('npx',['--yes','supabase@2.121.0','db','query','--linked',sql],{encoding:'utf8',timeout:60000,maxBuffer:1024*1024})).rows;
const installed=process.argv.includes('--installed');
const rows=query(`begin; set local lock_timeout='3s'; set local statement_timeout='20s';
create temporary table original_live_function as select md5(pg_get_functiondef('public.admin_forecast_inputs()'::regprocedure)) hash;
${installed?'':migration}
create temporary table classroom_qa(label text,passed boolean) on commit drop;
grant insert on classroom_qa to authenticated;
insert into classroom_qa values('live_forecast_unchanged',(select hash=md5(pg_get_functiondef('public.admin_forecast_inputs()'::regprocedure)) from original_live_function));
insert into classroom_qa values('anonymous_denied',not has_function_privilege('anon','public.admin_classroom_forecast_inputs()','execute'));
insert into classroom_qa values('raw_table_private',not has_table_privilege('authenticated','private.classroom_forecast_datasets','select'));
insert into classroom_qa values('no_realtime_publication',not exists(select 1 from pg_publication_tables where schemaname='private' and tablename='classroom_forecast_datasets'));
do $$ declare u uuid; s uuid:=gen_random_uuid(); begin
 select id into u from public.profiles where role='superadmin' and staff_active limit 1;
 if u is null then raise exception 'No administrator available for rollback-only role verification'; end if;
 insert into auth.sessions(id,user_id,created_at,updated_at) values(s,u,now(),now());
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','aal','aal1','session_id',s)::text,true);
end $$;
set local role authenticated;
do $$ declare denied boolean:=false; begin
 begin perform public.admin_classroom_forecast_inputs(); exception when insufficient_privilege then denied:=true; end;
 insert into classroom_qa values('aal1_denied',denied);
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claims',(current_setting('request.jwt.claims')::jsonb||jsonb_build_object('aal','aal2'))::text,true); end $$;
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.admin_classroom_forecast_inputs();
 insert into classroom_qa values('explicit_synthetic_source',r->'dataset'->>'kind'='synthetic' and r->>'version'='3');
 insert into classroom_qa values('bounded_history',jsonb_array_length(r->'series')=112 and octet_length(r::text)<12000);
 insert into classroom_qa values('totals_match',(r->>'eligibleOrders')::integer=(select sum((v->>'orders')::integer) from jsonb_array_elements(r->'series') v));
 insert into classroom_qa values('stable_dataset',public.admin_classroom_forecast_inputs()=r);
 insert into classroom_qa values('live_source_separate',public.admin_forecast_inputs()->>'version'='2' and not(public.admin_forecast_inputs() ? 'dataset'));
end $$;
reset role;
do $$ declare u uuid; s uuid:=gen_random_uuid(); begin
 select id into u from public.profiles where role='customer' and coalesce(customer_active,true) limit 1;
 if u is null then raise exception 'No customer available for rollback-only role verification'; end if;
 insert into auth.sessions(id,user_id,created_at,updated_at) values(s,u,now(),now());
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','aal','aal2','session_id',s)::text,true);
end $$;
set local role authenticated;
do $$ declare denied boolean:=false; begin
 begin perform public.admin_classroom_forecast_inputs(); exception when insufficient_privilege then denied:=true; end;
 insert into classroom_qa values('customer_denied',denied);
end $$;
reset role;
select (select jsonb_agg(jsonb_build_object('check',label,'passed',passed)) from classroom_qa) as checks,
 (select jsonb_build_object('version',3,'generatedAt',generated_at,'through',through,'timezone','Asia/Manila','basis',method,
  'series',series,'eligibleOrders',(select sum((r->>'orders')::integer) from jsonb_array_elements(series) r),
  'excludedTestPayments',0,'undatedSettlements',0,'dataset',jsonb_build_object('kind','synthetic','id',id,'label',label))
 from private.classroom_forecast_datasets where id='classroom-2026-10-v1') as snapshot;
rollback;`);
const result=rows.find(row=>row.checks);
assert.equal(result?.checks?.length,11); assert.ok(result.checks.every(c=>c.passed),JSON.stringify(result.checks));
console.log(JSON.stringify({checks:result.checks,days:result.snapshot.series.length,simulatedOrders:result.snapshot.eligibleOrders,bytes:Buffer.byteLength(JSON.stringify(result.snapshot)),through:result.snapshot.through},null,2));
const index=process.argv.indexOf('--snapshot');
if(index>=0){const path=process.argv[index+1];assert.ok(path?.startsWith('/tmp/cozy-forecast-')&&path.endsWith('.json'));writeFileSync(path,JSON.stringify(result.snapshot),{mode:0o600});}
if(process.argv.includes('--apply')) {
 assert.ok(!installed,'Do not reapply an installed migration');
 query(`begin; set local lock_timeout='3s'; set local statement_timeout='20s'; ${migration}
 insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[$migration$${migration}$migration$]); commit;`);
 console.log('Applied only the classroom forecast dataset migration. No production orders/payments were inserted or relabeled.');
}
