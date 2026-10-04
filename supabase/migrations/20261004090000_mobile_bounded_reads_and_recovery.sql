-- Public reviews, five at a time. Aggregates cover all approved reviews, not
-- just the visible page. Invoker security preserves all existing RLS policies.
create or replace function public.mobile_product_review_page(p_product_id text, p_page integer default 1, p_rating integer default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if p_product_id is null or length(p_product_id)>200 or p_page is null or p_page<1 or p_page>100000
    or (p_rating is not null and p_rating not between 1 and 5) then
    raise exception 'Invalid review page' using errcode='22023';
  end if;
  with visible as materialized (
    select r.id,r.rating,r.body,r.image_urls,r.created_at,r.approved,r.reviewer_display_name
    from public.reviews r where r.product_id=p_product_id and r.approved
  ), page as (
    select * from visible where p_rating is null or rating=p_rating
    order by created_at desc,id desc limit 5 offset (p_page-1)*5
  ) select jsonb_build_object(
    'reviews',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
    'total',(select count(*) from visible),
    'matched',(select count(*) from visible where p_rating is null or rating=p_rating),
    'average',(select coalesce(avg(rating),0) from visible),
    'counts',coalesce((select jsonb_object_agg(rating,n) from (select rating,count(*) n from visible group by rating) c),'{}'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.mobile_product_review_page(text,integer,integer) from public;
grant execute on function public.mobile_product_review_page(text,integer,integer) to anon,authenticated;
create index if not exists reviews_public_product_page_idx on public.reviews(product_id,created_at desc,id desc) where approved;

-- An inactive area or moderated review no longer passes customer SELECT RLS,
-- so its final row update cannot reliably notify a customer subscription.
-- Publish only a topic and timestamp; never expose the hidden row itself.
create table if not exists public.mobile_storefront_signals (
  topic text primary key,
  updated_at timestamptz not null default now()
);
alter table public.mobile_storefront_signals enable row level security;
revoke all on public.mobile_storefront_signals from anon,authenticated;
grant select on public.mobile_storefront_signals to anon,authenticated;
drop policy if exists mobile_storefront_signals_read on public.mobile_storefront_signals;
create policy mobile_storefront_signals_read on public.mobile_storefront_signals for select to anon,authenticated using (true);
create or replace function private.signal_mobile_storefront_change()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='delivery_service_areas' then
    insert into public.mobile_storefront_signals(topic) values('delivery-areas')
      on conflict(topic) do update set updated_at=clock_timestamp();
  else
    if tg_op <> 'DELETE' then
      insert into public.mobile_storefront_signals(topic) values('reviews:'||new.product_id)
        on conflict(topic) do update set updated_at=clock_timestamp();
    end if;
    if tg_op='DELETE' or (tg_op='UPDATE' and old.product_id is distinct from new.product_id) then
      insert into public.mobile_storefront_signals(topic) values('reviews:'||old.product_id)
        on conflict(topic) do update set updated_at=clock_timestamp();
    end if;
  end if;
  return null;
end $$;
revoke all on function private.signal_mobile_storefront_change() from public,anon,authenticated;
drop trigger if exists mobile_delivery_signal on public.delivery_service_areas;
create trigger mobile_delivery_signal after insert or update or delete on public.delivery_service_areas for each row execute function private.signal_mobile_storefront_change();
drop trigger if exists mobile_review_signal on public.reviews;
create trigger mobile_review_signal after insert or update or delete on public.reviews for each row execute function private.signal_mobile_storefront_change();
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='delivery_service_areas') then
    alter publication supabase_realtime add table public.delivery_service_areas;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='mobile_storefront_signals') then
    alter publication supabase_realtime add table public.mobile_storefront_signals;
  end if;
end $$;
notify pgrst,'reload schema';
