-- Keep every product's public rating/count derived from approved reviews only.
-- This backfills older rows and keeps mobile, storefront, and admin in sync.
create or replace function private.refresh_one_product_review_summary(p_product_id text)
returns void
language sql
security definer
set search_path = pg_catalog, public
as $function$
  update public.products p
  set
    rating = coalesce((
      select round(avg(r.rating)::numeric, 1)
      from public.reviews r
      where r.product_id = p_product_id and r.approved
    ), 0),
    review_count = (
      select count(*)::integer
      from public.reviews r
      where r.product_id = p_product_id and r.approved
    ),
    updated_at = now()
  where p.id = p_product_id;
$function$;

create or replace function private.refresh_product_review_summary()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  if tg_op = 'DELETE' then
    perform private.refresh_one_product_review_summary(old.product_id);
    return old;
  end if;

  perform private.refresh_one_product_review_summary(new.product_id);
  if tg_op = 'UPDATE' and old.product_id is distinct from new.product_id then
    perform private.refresh_one_product_review_summary(old.product_id);
  end if;
  return new;
end;
$function$;

drop trigger if exists refresh_product_review_summary on public.reviews;
create trigger refresh_product_review_summary
after insert or update or delete on public.reviews
for each row execute function private.refresh_product_review_summary();

update public.products p
set
  rating = coalesce((
    select round(avg(r.rating)::numeric, 1)
    from public.reviews r
    where r.product_id = p.id and r.approved
  ), 0),
  review_count = (
    select count(*)::integer
    from public.reviews r
    where r.product_id = p.id and r.approved
  ),
  updated_at = now();

do $block$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reviews'
  ) then
    alter publication supabase_realtime add table public.reviews;
  end if;
end
$block$;
