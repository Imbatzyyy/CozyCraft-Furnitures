// Targeted release: preserve the separate mobile app's migration history.
// Default: transaction rollback validation. --apply: apply this one migration.
// Requires an authenticated Supabase CLI linked to the intended project.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const project = readFileSync('supabase/.temp/project-ref', 'utf8').trim();
if (project !== 'gwjsivqksyimuabbdyqq') throw new Error('Unexpected linked project; refusing release.');
const migration = readFileSync('supabase/migrations/20260922090000_ai_forecast_read_model.sql', 'utf8');
const apply = process.argv.includes('--apply');
// Session-local copies validate all SQL against the live schema without
// bypassing or modifying the authorization helpers/public function gates.
const probes = [...migration.matchAll(/create or replace function public\.(admin_forecast_inputs|admin_reports_summary|admin_report_export)[\s\S]*?end \$\$;/g)].map(m =>
  m[0].replace(`public.${m[1]}`, `pg_temp.qa_${m[1]}`).replace(/  if not private\.is_staff\(\)[\s\S]*?end if;/, '')
).join('\n');
if (!apply && !probes.includes('qa_admin_report_export')) throw new Error('Probe extraction failed');
const assertions = `do $qa$ declare r jsonb; begin
  r := pg_temp.qa_admin_forecast_inputs();
  if jsonb_typeof(r->'series') <> 'array' or jsonb_array_length(r->'series') > 180 then raise exception 'Invalid forecast input'; end if;
  r := pg_temp.qa_admin_reports_summary('Quarter');
  if r->'trendData' is null then raise exception 'Summary missing'; end if;
  r := pg_temp.qa_admin_report_export('Sales performance','Quarter',1);
  r := pg_temp.qa_admin_report_export('Inventory velocity','Quarter',1);
  r := pg_temp.qa_admin_report_export('Customer retention','Quarter',1);
  begin perform public.admin_forecast_inputs(); raise exception 'Unauthenticated access leaked'; exception when insufficient_privilege then null; end;
end $qa$;`;
const history = `insert into supabase_migrations.schema_migrations(version,name,statements) values ('20260922090000','ai_forecast_read_model',array[$migration$${migration}$migration$]);`;
const sql = apply ? `begin; ${migration}\n${history}\nnotify pgrst,'reload schema'; commit; select 'AI migration applied and recorded' as result;`
  : `begin; ${migration}\n${probes}\n${assertions}\nrollback; select 'Live schema validation passed; all changes rolled back' as result;`;
process.stdout.write(execFileSync('npx', ['supabase','db','query','--linked',sql], { encoding:'utf8', maxBuffer: 1024 * 1024 }));
