// One-time, explicitly approved 0 -> 25 adjustment. Not a recurring stock reset.
// Default is a rolled-back rehearsal. --apply commits only these four products.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),'gwjsivqksyimuabbdyqq');
const reason='Classroom preparation 2026-10-15: user-approved out-of-stock restock to 25';
const apply=process.argv.includes('--apply');
const result=execFileSync('npx',['--yes','supabase@2.121.0','db','query','--linked',`
begin;
set local lock_timeout='3s'; set local statement_timeout='15s';
select pg_advisory_xact_lock(15102026,25);
create temporary table classroom_stock_before on commit drop as
  select id,stock_quantity,to_jsonb(p)-'stock_quantity'-'updated_at' as unchanged from public.products p;
do $$ begin
  if exists(select 1 from public.inventory_movements where reason='${reason}') then
    raise exception 'This one-time restock has already run; do not reset consumed inventory';
  end if;
  perform id from public.products where id in ('gr-fj-llet','knarrevik','malmm','tarva') for update;
  if (select count(*) from public.products where id in ('gr-fj-llet','knarrevik','malmm','tarva') and stock_quantity=0 and status='active')<>4
     or (select count(*) from public.products where stock_quantity=0)<>4 then
    raise exception 'Stock changed since approval; inspect current targets before proceeding';
  end if;
end $$;
select set_config('app.inventory_reason','${reason}',true);
update public.products set stock_quantity=25
where id in ('gr-fj-llet','knarrevik','malmm','tarva') and stock_quantity=0;
do $$ begin
  if exists(select 1 from public.products p join classroom_stock_before b using(id)
    where (b.stock_quantity>0 and p.stock_quantity<>b.stock_quantity)
       or to_jsonb(p)-'stock_quantity'-'updated_at'<>b.unchanged) then
    raise exception 'Unexpected change to positive inventory or product fields';
  end if;
  if (select count(*) from public.inventory_movements where reason='${reason}' and previous_quantity=0 and new_quantity=25 and quantity_delta=25)<>4 then
    raise exception 'Inventory ledger did not record all four changes';
  end if;
  if exists(select 1 from public.products p left join public.product_availability a on a.product_id=p.id
    where p.id in ('gr-fj-llet','knarrevik','malmm','tarva') and (a.available is distinct from true or a.updated_at<>p.updated_at)) then
    raise exception 'Realtime product availability signal was not updated';
  end if;
end $$;
select jsonb_build_object('applied',${apply},'products',(select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'before',b.stock_quantity,'after',p.stock_quantity) order by p.id)
  from public.products p join classroom_stock_before b using(id) where b.stock_quantity=0),
  'outOfStockRemaining',(select count(*) from public.products where stock_quantity=0),
  'existingPositiveStockPreserved',true,'auditReason','${reason}') as result;
${apply?'commit':'rollback'};
`],{encoding:'utf8',timeout:60000,maxBuffer:1024*1024});
const row=JSON.parse(result).rows.find(r=>r.result);
assert.equal(row?.result?.products?.length,4);
console.log(JSON.stringify(row.result,null,2));
