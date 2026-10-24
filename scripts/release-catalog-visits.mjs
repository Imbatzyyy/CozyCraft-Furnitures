// Only this migration. Default is a transactionally rolled-back rehearsal.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const project='gwjsivqksyimuabbdyqq',version='20261025010000',name='catalog_guest_visits';
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),project);
const migration=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8');
const apply=process.argv.includes('--apply');
let token=process.env.SUPABASE_ACCESS_TOKEN;
if(!token && process.platform==='darwin') {
  const stored=execFileSync('security',['find-generic-password','-s','Supabase CLI','-w'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
  token=stored.startsWith('go-keyring-base64:')?Buffer.from(stored.slice(18),'base64').toString():stored;
}
assert.ok(token,'Sign in with Supabase CLI or provide SUPABASE_ACCESS_TOKEN');
const query=`begin; set local lock_timeout='5s'; set local statement_timeout='30s';
${migration}
do $qa$ begin
  if exists(select 1 from product_engagement_counts where visits<>viewers) then raise exception 'Historical baseline mismatch'; end if;
  if has_function_privilege('anon','record_catalog_visit(text,uuid,text)','execute')
    or has_function_privilege('authenticated','record_catalog_visit(text,uuid,text)','execute') then raise exception 'Counter write exposed'; end if;
  if has_table_privilege('anon','private.catalog_visit_events','select') then raise exception 'Retry ledger exposed'; end if;
  if not exists(select 1 from cron.job where jobname='catalog-visit-cleanup' and active) then raise exception 'Cleanup missing'; end if;
end $qa$;
insert into supabase_migrations.schema_migrations(version,name,statements)
values('${version}','${name}',array[$source$${migration}$source$]);
${apply?'commit':'rollback'};
select '${apply?'Applied catalog guest visits':'Rehearsal passed and rolled back'}' result;`;
const response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{
  method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
  body:JSON.stringify({query}),signal:AbortSignal.timeout(45000),
});
const result=await response.text();
if(!response.ok) throw new Error(`Database release failed (${response.status}): ${result}`);
console.log(result);
