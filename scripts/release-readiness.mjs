// Only the three reviewed migrations. Never repair another app's history.
// Default rehearses in a transaction and rolls back; --apply commits once.
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const project=readFileSync('supabase/.temp/project-ref','utf8').trim();
if(project!=='gwjsivqksyimuabbdyqq') throw new Error('Unexpected linked project');
const files=['20261011090000_fulfillment_payment_guard','20261011091000_transactional_email_outbox','20261011092000_reporting_environments'];
const migrations=files.map(name=>({version:name.slice(0,14),name:name.slice(15),sql:readFileSync(`supabase/migrations/${name}.sql`,'utf8')}));
const cli=process.env.COZY_SUPABASE_CLI || 'supabase';
const apply=process.argv.includes('--apply');
const probes=`do $qa$ declare job uuid; v_order uuid; result jsonb; begin
  if has_function_privilege('authenticated','public.claim_transactional_emails()','execute') then raise exception 'Worker exposed'; end if;
  if has_function_privilege('authenticated','public.reserve_discovery_search(text,uuid)','execute') then raise exception 'Budget exposed'; end if;
  begin perform public.admin_reports_summary_scoped('This month','all'); raise exception 'Missing admin gate'; exception when insufficient_privilege then null; end;
  -- Exercise the actual row types, templates and queue in a rollback-only probe.
  select id into v_order from public.orders order by created_at desc limit 1;
  if v_order is not null then job:=private.enqueue_transactional_email('order_confirmation',v_order); end if;
end $qa$;`;
const body=migrations.map(m=>`${m.sql}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('${m.version}','${m.name}',array[$migration$${m.sql}$migration$]);`).join('\n');
// Never run the queue probe in a committed transaction: no historical emails.
const query=`begin; set local lock_timeout='5s'; set local statement_timeout='30s'; ${body}\n${apply?'':probes}\n${apply?'commit':'rollback'}; select '${apply?'Readiness migrations applied':'Live schema rehearsal passed; all changes rolled back'}' result;`;
process.stdout.write(execFileSync(cli,['db','query','--linked',query],{encoding:'utf8',maxBuffer:1024*1024}));
