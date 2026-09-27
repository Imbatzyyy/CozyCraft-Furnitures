// Targeted migration and live role checks. Default is rollback; --apply commits
// ONLY the new forecasting migration. Temporary auth/session QA always rolls back.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const ref=readFileSync('supabase/.temp/project-ref','utf8').trim();
assert.equal(ref,'gwjsivqksyimuabbdyqq');
const migration=readFileSync('supabase/migrations/20260927090000_live_forecast_inputs.sql','utf8');
const query=sql=>JSON.parse(execFileSync('npx',['--no-install','supabase','db','query','--linked',sql],{encoding:'utf8',timeout:60000,maxBuffer:1024*1024})).rows;
const installed=process.argv.includes('--installed');
const rows=query(`begin; set local lock_timeout='5s'; set local statement_timeout='25s';
${installed ? '' : migration}
create temporary table forecast_qa(label text,passed boolean) on commit drop;
grant insert on forecast_qa to authenticated;
do $$ declare u uuid; s uuid:=gen_random_uuid(); begin
 select id into u from public.profiles where role='superadmin' and staff_active limit 1;
 if u is null then raise exception 'No administrator available for transactional role verification'; end if;
 insert into auth.sessions(id,user_id,created_at,updated_at) values(s,u,now(),now());
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','aal','aal1','session_id',s)::text,true);
end $$;
set local role authenticated;
do $$ declare denied boolean:=false; begin
 begin perform public.admin_forecast_inputs(); exception when insufficient_privilege then denied:=true; end;
 insert into forecast_qa values('aal1_denied',denied);
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claims',(current_setting('request.jwt.claims')::jsonb||jsonb_build_object('aal','aal2'))::text,true); end $$;
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.admin_forecast_inputs();
 insert into forecast_qa values('bounded_live_aggregates',jsonb_array_length(r->'series')<=180 and r->>'version'='2');
 insert into forecast_qa values('complete_philippine_days',r->>'through'=((now() at time zone 'Asia/Manila')::date-1)::text);
 insert into forecast_qa values('aggregate_count_matches',(r->>'eligibleOrders')::bigint=coalesce((select sum((x->>'orders')::bigint) from jsonb_array_elements(r->'series') x),0));
 insert into forecast_qa values('cache_reused',public.admin_forecast_inputs()->>'generatedAt'=r->>'generatedAt');
end $$;
reset role;
insert into forecast_qa values('anon_denied',not has_function_privilege('anon','public.admin_forecast_inputs()','execute'));
insert into forecast_qa values('private_cache_not_readable',not has_table_privilege('authenticated','private.forecast_input_cache','select'));
insert into forecast_qa values('invalidator_not_callable',not has_function_privilege('authenticated','private.invalidate_forecast_input_cache()','execute'));
insert into forecast_qa values('source_triggers_installed',(select count(*)=3 from pg_trigger where tgname in ('forecast_orders_changed','forecast_payments_changed','forecast_delivery_history_changed') and tgenabled='O'));
do $$ declare u uuid; s uuid:=gen_random_uuid(); begin
 select id into u from public.profiles where role='customer' and coalesce(customer_active,true) limit 1;
 if u is null then raise exception 'No customer available for transactional role verification'; end if;
 insert into auth.sessions(id,user_id,created_at,updated_at) values(s,u,now(),now());
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','aal','aal2','session_id',s)::text,true);
end $$;
set local role authenticated;
do $$ declare denied boolean:=false; begin
 begin perform public.admin_forecast_inputs(); exception when insufficient_privilege then denied:=true; end;
 insert into forecast_qa values('customer_denied',denied);
end $$;
reset role;
select (select jsonb_agg(jsonb_build_object('check',label,'passed',passed)) from forecast_qa) as checks,(select payload from private.forecast_input_cache where id) as snapshot;
rollback;`);
const result=rows.find(row=>row.checks);
assert.equal(result?.checks?.length,10); assert.ok(result.checks.every(check=>check.passed),JSON.stringify(result.checks));
console.log(JSON.stringify({checks:result.checks,historyDays:result.snapshot.series.length,activeDays:result.snapshot.series.filter(r=>r.orders>0).length,eligibleOrders:result.snapshot.eligibleOrders,excludedTestPayments:result.snapshot.excludedTestPayments,undatedSettlements:result.snapshot.undatedSettlements,bytes:Buffer.byteLength(JSON.stringify(result.snapshot)),through:result.snapshot.through}));
const outputIndex=process.argv.indexOf('--snapshot');
if(outputIndex>=0) {
 const output=process.argv[outputIndex+1];
 assert.ok(output?.startsWith('/tmp/cozy-forecast-') && output.endsWith('.json'),'Snapshots must be temporary QA artifacts, never source files');
 writeFileSync(output,JSON.stringify(result.snapshot),{mode:0o600});
}
if(process.argv.includes('--apply')) {
 assert.ok(!installed,'Do not reapply an installed migration');
 query(`begin; set local lock_timeout='5s'; set local statement_timeout='25s'; ${migration}
 insert into supabase_migrations.schema_migrations(version,name,statements) values('20260927090000','live_forecast_inputs',array[$migration$${migration}$migration$]);
 notify pgrst,'reload schema'; commit;`);
 console.log('Applied and recorded only 20260927090000_live_forecast_inputs.sql.');
}
