// Validates the additive migration in a rolled-back transaction. No customer
// records are changed and no identifiers or credentials are printed.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const migration = readFileSync(new URL("../supabase/migrations/20260905140000_admin_workspace_read_models.sql", import.meta.url), "utf8");
const notesMigration = readFileSync(new URL("../supabase/migrations/20260905141000_private_support_handover_notes.sql", import.meta.url), "utf8");
const sql = `begin;
${process.env.TEST_DEPLOYED_SCHEMA === "1" ? "" : migration + notesMigration}
do $$ begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',(select id from public.profiles where role='superadmin' and staff_active limit 1),'role','authenticated','aal','aal2')::text,true);
end $$;
set local role authenticated;
do $$ declare s jsonb; q jsonb; expected numeric; begin
  s := public.admin_overview_snapshot();
  select coalesce(sum(total),0) into expected from public.orders where payment_status='paid' and status<>'cancelled';
  if (s->>'sales')::numeric <> expected then raise exception 'Sales mismatch'; end if;
  q := public.admin_order_queue('{"dateRange":"all","sort":"oldest"}',1);
  if (q->>'total')::int <> (select count(*) from public.orders) then raise exception 'Count mismatch'; end if;
  if jsonb_array_length(q->'orders') <> least(5,(q->>'total')::int) then raise exception 'Page-size mismatch'; end if;
  if (q->>'total')::int > 5 and q->'orders'->0->>'id' = public.admin_order_queue('{"dateRange":"all","sort":"oldest"}',2)->'orders'->0->>'id' then raise exception 'Pagination duplicated page'; end if;
  q := public.admin_order_queue('{"dateRange":"today","sort":"oldest"}',1);
  if (q->>'total')::int <> (select count(*) from public.orders where (created_at at time zone 'Asia/Manila')::date=(now() at time zone 'Asia/Manila')::date) then raise exception 'Manila today mismatch'; end if;
  q := public.admin_order_queue('{"dateRange":"all","view":"awaiting_payment"}',1);
  if (q->>'total')::int <> (select count(*) from public.orders where status='pending' and lower(payment_method)<>'cod' and payment_status='pending') then raise exception 'Payment filter mismatch'; end if;
  insert into public.support_internal_notes(ticket_id,body) select id,'Synthetic handover test, rolled back' from public.support_tickets limit 1;
  if exists(select 1 from public.support_tickets) and not exists(select 1 from public.support_internal_notes) then raise exception 'Staff note was not saved'; end if;
end $$;
reset role;
do $$ begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',(select id from public.profiles where role='customer' limit 1),'role','authenticated','aal','aal2')::text,true);
end $$;
set local role authenticated;
do $$ begin
  begin perform public.admin_overview_snapshot(); raise exception 'Customer accessed overview'; exception when insufficient_privilege then null; end;
  begin perform public.admin_order_queue(); raise exception 'Customer accessed orders'; exception when insufficient_privilege then null; end;
  if exists(select 1 from public.support_internal_notes) then raise exception 'Customer could read staff notes'; end if;
  begin insert into public.support_internal_notes(ticket_id,body) values(gen_random_uuid(),'Synthetic forbidden note'); raise exception 'Customer could insert staff note'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: summary totals, five-row pagination, Manila date, payment filter, staff note insert and customer read/write rejection; all rolled back' as result;
rollback;`;
const result = spawnSync("npx", ["supabase", "db", "query", "--linked", sql], { encoding: "utf8", maxBuffer: 2_000_000 });
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
process.exit(result.status ?? 1);
