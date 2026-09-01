alter table public.reviews
  add column if not exists image_urls text[] not null default '{}';

grant insert on table public.reviews to authenticated;

drop policy if exists reviews_customer_insert_delivered_purchase on public.reviews;
create policy reviews_customer_insert_delivered_purchase
on public.reviews
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.user_id = (select auth.uid())
      and o.status = 'delivered'
      and oi.product_id = reviews.product_id
  )
);

create or replace function public.submit_order_item_review(
  p_order_item_id bigint,
  p_rating integer,
  p_title text,
  p_body text,
  p_image_urls text[] default '{}'
)
returns table (
  id uuid,
  rating integer,
  body text,
  image_urls text[],
  approved boolean,
  created_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_product_id text;
  v_order_status text;
  v_existing public.reviews%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication is required to review a purchase.';
  end if;

  if p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5.';
  end if;

  if length(trim(coalesce(p_body, ''))) < 5 then
    raise exception 'Review must contain at least 5 characters.';
  end if;

  if coalesce(array_length(p_image_urls, 1), 0) > 3 then
    raise exception 'A review can contain at most 3 photos.';
  end if;

  select oi.product_id, o.status
  into v_product_id, v_order_status
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.id = p_order_item_id
    and o.user_id = v_user_id;

  if v_product_id is null then
    raise exception 'This purchase could not be found.';
  end if;

  if v_order_status <> 'delivered' then
    raise exception 'Only delivered purchases can be reviewed.';
  end if;

  select r.*
  into v_existing
  from public.reviews r
  where r.user_id = v_user_id
    and r.product_id = v_product_id;

  if found then
    return query
    select v_existing.id, v_existing.rating, v_existing.body,
      v_existing.image_urls, v_existing.approved, v_existing.created_at;
    return;
  end if;

  return query
  insert into public.reviews (user_id, product_id, rating, title, body, image_urls)
  values (
    v_user_id,
    v_product_id,
    p_rating,
    left(trim(coalesce(p_title, '')), 120),
    trim(p_body),
    coalesce(p_image_urls, '{}')
  )
  returning reviews.id, reviews.rating, reviews.body, reviews.image_urls,
    reviews.approved, reviews.created_at;
end;
$$;

revoke all on function public.submit_order_item_review(bigint, integer, text, text, text[]) from public;
grant execute on function public.submit_order_item_review(bigint, integer, text, text, text[]) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-images',
  'review-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists review_images_public_read on storage.objects;
create policy review_images_public_read
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'review-images');

drop policy if exists review_images_customer_insert on storage.objects;
create policy review_images_customer_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'review-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
;
