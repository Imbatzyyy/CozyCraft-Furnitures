alter table public.reviews
  add column if not exists order_item_id bigint;

-- Legacy reviews predate the order-item relationship. Attach each one to the
-- most recent delivered purchase that existed when the review was written.
-- This preserves the original review without leaking it onto later repeat
-- purchases of the same product.
with review_purchase as (
  select
    r.id as review_id,
    candidate.order_item_id
  from public.reviews r
  cross join lateral (
    select oi.id as order_item_id
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.user_id = r.user_id
      and o.status = 'delivered'
      and oi.product_id = r.product_id
      and o.created_at <= r.created_at
    order by o.created_at desc, oi.id desc
    limit 1
  ) candidate
  where r.order_item_id is null
)
update public.reviews r
set order_item_id = review_purchase.order_item_id
from review_purchase
where r.id = review_purchase.review_id;

alter table public.reviews
  drop constraint if exists reviews_user_id_product_id_key;

alter table public.reviews
  drop constraint if exists reviews_order_item_id_fkey;

alter table public.reviews
  add constraint reviews_order_item_id_fkey
  foreign key (order_item_id)
  references public.order_items(id)
  on delete restrict;

alter table public.reviews
  alter column order_item_id set not null;

create unique index if not exists reviews_order_item_id_key
  on public.reviews (order_item_id);

drop policy if exists reviews_customer_insert_delivered_purchase on public.reviews;
create policy reviews_customer_insert_delivered_purchase
on public.reviews
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.id = reviews.order_item_id
      and oi.product_id = reviews.product_id
      and o.user_id = (select auth.uid())
      and o.status = 'delivered'
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
  where r.order_item_id = p_order_item_id;

  if found then
    return query
    select v_existing.id, v_existing.rating, v_existing.body,
      v_existing.image_urls, v_existing.approved, v_existing.created_at;
    return;
  end if;

  return query
  insert into public.reviews (
    user_id,
    product_id,
    order_item_id,
    rating,
    title,
    body,
    image_urls
  )
  values (
    v_user_id,
    v_product_id,
    p_order_item_id,
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
;
