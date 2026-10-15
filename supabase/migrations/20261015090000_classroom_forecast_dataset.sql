-- Explicitly synthetic classroom history. Never inserts into orders, payments,
-- profiles, loyalty, email queues or inventory; never joins the live forecast.
create table private.classroom_forecast_datasets (
  id text primary key,
  label text not null,
  generated_at timestamptz not null default now(),
  through date not null,
  method text not null,
  series jsonb not null check (jsonb_typeof(series) = 'array' and jsonb_array_length(series) between 1 and 180)
);
alter table private.classroom_forecast_datasets enable row level security;
revoke all on private.classroom_forecast_datasets from public, anon, authenticated;

-- Reproducible 16-week scenario: weekly variation, a modest trend, quiet days,
-- two short promotions and deterministic noise. Not fitted to a winning model.
-- Dates are fixed when seeded: they never silently slide forward on refresh.
with days as (
  select i, (now() at time zone 'Asia/Manila')::date - 112 + i as day
  from generate_series(0,111) i
), observations as (
  select i, day, case when i % 23 = 5 then 0 else greatest(0,
    3 + floor(i/28.0)::integer
    + case extract(isodow from day)::integer when 6 then 3 when 7 then 2 else 0 end
    + case when i between 39 and 42 or i between 81 and 83 then 3 else 0 end
    + ((i*17+11)%5)-2) end as orders
  from days
)
insert into private.classroom_forecast_datasets(id,label,through,method,series)
select 'classroom-2026-10-v1', 'Classroom furniture sales scenario', max(day),
  'Deterministic synthetic scenario v1: 112 complete Philippine calendar days; weekly variation, trend, quiet days, two promotions and price variation. No observations are customer transactions. Validation measures this scenario only, not real-store accuracy.',
  jsonb_agg(jsonb_build_object('date',day,'orders',orders,'sales',orders*(6200+((i*7919+103)%18000))) order by day)
from observations;

create or replace function public.admin_classroom_forecast_inputs()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare dataset private.classroom_forecast_datasets%rowtype;
begin
  if not private.is_staff() or not private.customer_mfa_satisfied() or not private.admin_mfa_satisfied() then
    raise exception 'Verified administrator session required' using errcode = '42501';
  end if;
  select * into dataset from private.classroom_forecast_datasets where id='classroom-2026-10-v1';
  if not found then raise exception 'Classroom dataset is unavailable'; end if;
  return jsonb_build_object(
    'version',3,'generatedAt',dataset.generated_at,'through',dataset.through,'timezone','Asia/Manila',
    'basis',dataset.method,'series',dataset.series,
    'eligibleOrders',(select sum((r->>'orders')::integer) from jsonb_array_elements(dataset.series) r),
    'excludedTestPayments',0,'undatedSettlements',0,
    'dataset',jsonb_build_object('kind','synthetic','id',dataset.id,'label',dataset.label),
    'historyStart',dataset.series->0->>'date'
  );
end $$;
revoke all on function public.admin_classroom_forecast_inputs() from public, anon;
grant execute on function public.admin_classroom_forecast_inputs() to authenticated;
comment on table private.classroom_forecast_datasets is
  'Synthetic classroom-only daily aggregates. Not real sales. Admin/MFA RPC only; excluded from live reporting and realtime publication.';
notify pgrst,'reload schema';
