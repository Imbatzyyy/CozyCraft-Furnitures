// Narrow release; defaults to a rolled-back rehearsal. No customer data purge.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const project='gwjsivqksyimuabbdyqq',version='20261107130000',name='free_plan_reliability';
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),project);
const migration=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8');
const apply=process.argv.includes('--apply');
if(apply){
  const backupDir=process.argv[process.argv.indexOf('--backup-dir')+1];
  assert.ok(process.argv.includes('--backup-dir')&&backupDir,'A verified local backup is required');
  const verified=JSON.parse(execFileSync(process.execPath,['scripts/backup-local.mjs','verify',backupDir],{encoding:'utf8'}).trim());
  assert.ok(verified.verified&&verified.project===project&&verified.hasOperationalHistory,'Backup scope mismatch');
  assert.ok(Date.now()-Date.parse(verified.createdAt)<24*60*60*1000,'Take a fresh backup before maintenance');
}
const stored=execFileSync('security',['find-generic-password','-s','Supabase CLI','-w'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
const token=stored.startsWith('go-keyring-base64:')?Buffer.from(stored.slice(18),'base64').toString():stored;
async function query(sql){
  const response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql}),signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw Error(`Database release failed (${response.status}); inspect provider logs before retrying`);
  return response.json();
}
const existing=await query(`select statements from supabase_migrations.schema_migrations where version='${version}'`);
if(existing.length){assert.deepEqual(existing[0].statements,[migration]);console.log('This exact migration is already applied.');process.exit(0);}
const sql=`begin;set local lock_timeout='5s';set local statement_timeout='30s';
${migration}
do $qa$ begin
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity) then raise exception 'Unprotected public table';end if;
 if has_function_privilege('anon','private.prune_operational_history()','execute') or has_function_privilege('authenticated','private.invoke_newsletter_worker()','execute') then raise exception 'Worker privilege exposed';end if;
 if not exists(select 1 from cron.job where jobname='cozycraft-operational-history-retention' and active) then raise exception 'Retention schedule missing';end if;
 if exists(select 1 from storage.buckets where id='mobile-updates' and file_size_limit>52428800) then raise exception 'Upload cap mismatch';end if;
end $qa$;
insert into supabase_migrations.schema_migrations(version,name,statements)values('${version}','${name}',array[$source$${migration}$source$]);
${apply?'commit':'rollback'};
select '${apply?'Applied Free-plan reliability migration':'Rehearsal passed and rolled back'}' result;`;
console.log(JSON.stringify(await query(sql)));
