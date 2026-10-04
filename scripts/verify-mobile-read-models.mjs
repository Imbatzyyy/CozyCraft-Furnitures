// All rehearsal/session changes roll back. Only aggregate assertions are output.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const migration = readFileSync(new URL('../supabase/migrations/20261004090000_mobile_bounded_reads_and_recovery.sql', import.meta.url), 'utf8');
const sql = `begin; set local lock_timeout='3s'; set local statement_timeout='25s';
${process.argv.includes('--rehearse') ? migration : ''}
create temporary table mobile_checks(label text, passed boolean) on commit drop;
grant insert on mobile_checks to anon,authenticated;
insert into mobile_checks select 'delivery_published',exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='delivery_service_areas');
insert into mobile_checks select 'safe_signal_published',exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='mobile_storefront_signals');
insert into mobile_checks select 'safe_signal_rls',relrowsecurity from pg_class where oid='public.mobile_storefront_signals'::regclass;
insert into mobile_checks select 'safe_signal_read_only',not has_table_privilege('anon','public.mobile_storefront_signals','INSERT') and not has_table_privilege('authenticated','public.mobile_storefront_signals','UPDATE');
insert into mobile_checks select 'safe_signal_triggers',count(*)=2 from pg_trigger where tgname in ('mobile_delivery_signal','mobile_review_signal') and tgenabled='O';
-- Synthetic tables invoke only the new signal function, never customer email
-- or fulfillment triggers. All signal writes roll back with this transaction.
create temporary table delivery_service_areas(id integer,active boolean);
create trigger rehearsal_delivery after insert or update or delete on pg_temp.delivery_service_areas for each row execute function private.signal_mobile_storefront_change();
insert into pg_temp.delivery_service_areas values(1,true);
update pg_temp.delivery_service_areas set active=false;
insert into mobile_checks select 'deactivated_area_signalled',exists(select 1 from public.mobile_storefront_signals where topic='delivery-areas');
create temporary table reviews(product_id text,approved boolean);
create trigger rehearsal_review after insert or update or delete on pg_temp.reviews for each row execute function private.signal_mobile_storefront_change();
insert into pg_temp.reviews values('qa-rollback-signal',true);
update pg_temp.reviews set approved=false;
insert into mobile_checks select 'hidden_review_signalled',exists(select 1 from public.mobile_storefront_signals where topic='reviews:qa-rollback-signal');
delete from public.mobile_storefront_signals where topic='reviews:qa-rollback-signal';
delete from pg_temp.reviews;
insert into mobile_checks select 'deleted_review_signalled',exists(select 1 from public.mobile_storefront_signals where topic='reviews:qa-rollback-signal');
set local role anon;
insert into mobile_checks select 'public_reviews_bounded',coalesce(bool_and(jsonb_array_length(public.mobile_product_review_page(p.id)->'reviews')<=5),true) from public.products p;
insert into mobile_checks select 'public_reviews_approved_only',not exists(select 1 from public.products p, jsonb_array_elements(public.mobile_product_review_page(p.id)->'reviews') r where (r->>'approved')::boolean is not true);
insert into mobile_checks select 'review_totals_correct',coalesce(bool_and((public.mobile_product_review_page(p.id)->>'total')::bigint=(select count(*) from public.reviews r where r.product_id=p.id and r.approved)),true) from public.products p;
do $$ declare denied boolean:=false; begin begin perform public.mobile_product_review_page('qa',0); exception when invalid_parameter_value then denied:=true; end; insert into mobile_checks values('invalid_page_denied',denied); end $$;
reset role;
do $$ declare u uuid; s uuid:=gen_random_uuid(); begin
 select p.id into u from public.profiles p where p.role='customer' and coalesce(p.customer_active,true) and exists(select 1 from public.orders o where o.user_id=p.id) limit 1;
 if u is null then raise exception 'No customer for transactional role test'; end if;
 insert into auth.sessions(id,user_id,created_at,updated_at) values(s,u,now(),now());
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','aal','aal2','session_id',s)::text,true);
end $$;
set local role authenticated;
insert into mobile_checks select 'order_page_bounded',jsonb_array_length(public.customer_order_page()->'orders')<=5;
insert into mobile_checks select 'order_totals_global',(public.customer_order_page()->>'total')::bigint=(select count(*) from public.orders where user_id=auth.uid());
insert into mobile_checks select 'order_owner_only',not exists(select 1 from jsonb_array_elements(public.customer_order_page()->'orders') r where r->>'user_id'<>auth.uid()::text);
insert into mobile_checks select 'order_pages_disjoint',not exists(select 1 from jsonb_array_elements(public.customer_order_page(p_page=>1)->'orders') a join jsonb_array_elements(public.customer_order_page(p_page=>2)->'orders') b on a->>'id'=b->>'id');
reset role;
select jsonb_agg(jsonb_build_object('check',label,'passed',passed)) as checks from mobile_checks;
rollback;`;
const result=JSON.parse(execFileSync('npx',['--yes','supabase','db','query','--linked','--project-ref','gwjsivqksyimuabbdyqq','-o','json',sql],{encoding:'utf8',timeout:180000,maxBuffer:1024*1024}));
const checks=result.rows?.find(row=>row.checks)?.checks;
assert.equal(checks?.length,16);
assert.ok(checks.every(check=>check.passed),JSON.stringify(checks));
console.log(JSON.stringify(checks,null,2));
