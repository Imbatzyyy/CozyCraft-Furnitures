// Exactly one additive reporting function. Default rehearses and rolls back.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const workdir=process.env.COZY_SUPABASE_WORKDIR || process.cwd();
if(readFileSync(`${workdir}/supabase/.temp/project-ref`,'utf8').trim()!=='gwjsivqksyimuabbdyqq')throw new Error('Unexpected linked project');
const version='20261022120000', name='admin_commerce_exports';
const migration=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8');
const apply=process.argv.includes('--apply');
const checks=`do $qa$ begin
  if has_function_privilege('anon','public.admin_commerce_report_page(text,jsonb,integer,jsonb,timestamptz,jsonb,integer)','execute') then raise exception 'Anonymous report access'; end if;
  if exists(select 1 from pg_proc where oid='public.admin_commerce_report_page(text,jsonb,integer,jsonb,timestamptz,jsonb,integer)'::regprocedure and prosecdef) then raise exception 'RLS bypass'; end if;
  begin perform public.admin_commerce_report_page('orders'); raise exception 'Report gate missing'; exception when insufficient_privilege then null; end;
end $qa$;
-- Read-only validation through an existing active admin session and table RLS.
-- No session, factor, permission, or customer record is created or updated.
do $live$ declare u uuid; s uuid; r jsonb; expected bigint; expected_sales numeric; begin
  select a.user_id,a.id into u,s from auth.sessions a join public.profiles p on p.id=a.user_id
    left join private.admin_session_activity t on t.session_id=a.id
    where p.role::text in ('admin','superadmin') and p.staff_active order by coalesce(t.last_active,a.created_at) desc limit 1;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'session_id',s,'role','authenticated','aal','aal2')::text,true);
  if not coalesce(private.is_admin(),false) then raise exception 'An active administrator session is needed for the live read check'; end if;
  execute 'set local role authenticated';
  r:=public.admin_commerce_report_page('orders');
  select count(*),coalesce(sum(total) filter(where payment_status='paid' and status<>'cancelled'),0) into expected,expected_sales from public.orders where created_at<=(r->>'asOf')::timestamptz;
  if (r->>'total')::bigint<>expected or (r->'summary'->>'settledValue')::numeric<>expected_sales then raise exception 'Live order totals mismatch'; end if;
  r:=public.admin_commerce_report_page('payments','{"paymentMethod":"cod","paymentStatus":"pending"}',20);
  select count(*) into expected from public.orders where payment_method='cod' and payment_status='pending' and created_at<=(r->>'asOf')::timestamptz;
  if (r->>'total')::bigint<>expected then raise exception 'Live filtered payment totals mismatch'; end if;
  r:=public.admin_commerce_report_page('orders','{}',20,null,null,'{"items":true,"contact":true,"address":true}');
  if jsonb_array_length(r->'rows')>0 and not ((r->'rows'->0) ? 'items') then raise exception 'Live detailed report incomplete'; end if;
  execute 'reset role';
end $live$;`;
const sql=`begin; set local lock_timeout='5s'; set local statement_timeout='30s';
do $guard$ begin if exists(select 1 from supabase_migrations.schema_migrations where version='${version}') then raise exception 'Reporting migration already recorded'; end if; end $guard$;
${migration}
${checks}
insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[$source$${migration}$source$]);
${apply?'commit':'rollback'}; select '${apply?'Commerce reporting function deployed':'Commerce reporting rehearsal passed; all changes rolled back'}' result;`;
process.stdout.write(execFileSync(process.env.COZY_SUPABASE_CLI || 'supabase',['db','query','--linked',sql],{cwd:workdir,encoding:'utf8',maxBuffer:1024*1024}));
