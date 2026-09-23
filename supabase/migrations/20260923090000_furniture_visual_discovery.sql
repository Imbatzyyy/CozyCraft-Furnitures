create table public.product_visual_profiles (
  product_id text primary key references public.products(id) on delete cascade,
  image_key text not null,
  version integer not null default 2,
  colors jsonb not null default '[]',
  appearance jsonb not null default '[]',
  features jsonb not null default '[]',
  caption text not null default '',
  clarity text not null check(clarity in ('clear','uncertain')),
  model text not null,
  analysed_at timestamptz not null default now()
);
alter table public.product_visual_profiles enable row level security;
revoke all on public.product_visual_profiles from public,anon,authenticated;
grant select on public.product_visual_profiles to anon,authenticated;
grant all on public.product_visual_profiles to service_role;
create policy "Only active product observations are public" on public.product_visual_profiles for select to anon,authenticated
using(exists(select 1 from public.products p where p.id=product_id and p.status='active'));

create table private.discovery_request_budgets(bucket text primary key, requests integer not null, expires_at timestamptz not null);
revoke all on private.discovery_request_budgets from public,anon,authenticated;
create or replace function public.reserve_discovery_request(p_key text,p_index boolean default false)
returns boolean language plpgsql security definer set search_path='' as $$
declare accepted integer; slot text := floor(extract(epoch from now())/600)::text;
begin
  if p_key is null or length(p_key)>150 then return false; end if;
  delete from private.discovery_request_budgets where bucket in (select bucket from private.discovery_request_budgets where expires_at<now() limit 100);
  insert into private.discovery_request_budgets as b values('caller:'||p_key||':'||slot,1,now()+interval '20 minutes')
    on conflict(bucket) do update set requests=b.requests+1 where b.requests < case when p_index then 100 else 15 end returning requests into accepted;
  if accepted is null then return false; end if;
  accepted:=null;
  insert into private.discovery_request_budgets as b values(case when p_index then 'index:' else 'search:' end||(now() at time zone 'UTC')::date::text,1,now()+interval '2 days')
    on conflict(bucket) do update set requests=b.requests+1 where b.requests < case when p_index then 120 else 500 end returning requests into accepted;
  return accepted is not null;
end $$;
revoke all on function public.reserve_discovery_request(text,boolean) from public,anon,authenticated;
grant execute on function public.reserve_discovery_request(text,boolean) to service_role;
