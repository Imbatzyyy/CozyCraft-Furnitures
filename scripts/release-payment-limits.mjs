// Exactly one reviewed migration. Default rehearses and rolls back.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const project = readFileSync('supabase/.temp/project-ref', 'utf8').trim();
if (project !== 'gwjsivqksyimuabbdyqq') throw new Error('Unexpected linked project');
const version = '20261022010000';
const name = 'checkout_payment_limits';
const migration = readFileSync(`supabase/migrations/${version}_${name}.sql`, 'utf8');
const apply = process.argv.includes('--apply');
const probes = `do $qa$ begin
  if private.checkout_cod_limit()>20000 then raise exception 'COD cap missing'; end if;
  if has_function_privilege('anon','public.get_checkout_payment_policy()','execute') then raise exception 'Policy exposed to anonymous clients'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='enforce_checkout_payment_limits' and tgdeferrable and tginitdeferred) then raise exception 'Final-total trigger missing'; end if;
  if strpos(pg_get_functiondef('private.place_order(uuid,text,jsonb)'::regprocedure),'checkout-cod:')=0 then raise exception 'Checkout serialization missing'; end if;
end $qa$;`;
const query = `begin; set local lock_timeout='5s'; set local statement_timeout='30s';
${migration}
${probes}
insert into supabase_migrations.schema_migrations(version,name,statements)
values('${version}','${name}',array[$source$${migration}$source$]);
${apply ? 'commit' : 'rollback'};
select '${apply ? 'Payment limits applied' : 'Live schema rehearsal passed; changes rolled back'}' result;`;
process.stdout.write(execFileSync('npx', ['--yes','supabase@2.121.0','db','query','--linked',query], {encoding:'utf8',maxBuffer:1024*1024}));
