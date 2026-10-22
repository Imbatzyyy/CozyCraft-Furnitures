// Applies ONLY this reviewed migration, never pending migrations from other work.
// The default is an atomic rehearsal with rollback.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
if (readFileSync('supabase/.temp/project-ref','utf8').trim() !== 'gwjsivqksyimuabbdyqq') throw new Error('Unexpected project');
const version='20261022150000',name='checkout_consistency_and_popularity';
const migration=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8');
const apply=process.argv.includes('--apply');
const probes=`do $qa$ begin
  if strpos(pg_get_functiondef('private.place_order(uuid,text,jsonb)'::regprocedure),'private.validate_checkout_items')=0 then raise exception 'Quantity policy missing'; end if;
  if strpos(pg_get_functiondef('private.enforce_checkout_payment_limits()'::regprocedure),'current_order.total>500000')=0 then raise exception 'Amount policy missing'; end if;
  if has_function_privilege('anon','place_web_order(uuid,text,jsonb,uuid,uuid,numeric)','execute') then raise exception 'Anonymous checkout exposed'; end if;
  if has_table_privilege('anon','product_engagement_counts','SELECT') then raise exception 'Raw counter table exposed'; end if;
  if exists(select 1 from product_engagement_counts c where c.viewers<>(select count(*) from product_views v where v.product_id=c.product_id) or c.saves<>(select count(*) from wishlist_items w where w.product_id=c.product_id)) then raise exception 'Counter bootstrap mismatch'; end if;
end $qa$;`;
const query=`begin; set local lock_timeout='5s'; set local statement_timeout='30s';
${migration}
${probes}
insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[$source$${migration}$source$]);
${apply?'commit':'rollback'};
select '${apply?'Checkout consistency applied':'Rehearsal passed and rolled back'}' result;`;
process.stdout.write(execFileSync('npx',['--yes','supabase@2.121.0','db','query','--linked',query],{encoding:'utf8',maxBuffer:2*1024*1024}));
