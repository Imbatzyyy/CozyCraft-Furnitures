-- Reviews are submitted through one secured database function. Eligibility is
-- proven from delivered orders rather than trusted from frontend state.

create or replace function private.has_delivered_purchase(
  p_user_id uuid,
  p_product_id text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.orders
    join public.order_items on order_items.order_id = orders.id
    where orders.user_id = p_user_id
      and orders.status = 'delivered'
      and order_items.product_id = p_product_id
  );
$$;

revoke all on function private.has_delivered_purchase(uuid, text) from public;

drop policy if exists "reviews_customer_insert" on public.reviews;
drop policy if exists "reviews_customer_update" on public.reviews;
drop policy if exists "reviews_owner_or_staff_update" on public.reviews;
drop policy if exists "reviews_staff_update" on public.reviews;

create policy "reviews_staff_update"
on public.reviews for update
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create or replace function public.submit_product_review(
  p_product_id text,
  p_rating integer,
  p_title text,
  p_body text
)
returns table (id uuid, approved boolean)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_review public.reviews%rowtype;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to review a product.';
  end if;

  if p_rating not between 1 and 5 then
    raise exception 'Rating must be between 1 and 5.';
  end if;

  if length(trim(coalesce(p_body, ''))) < 5 then
    raise exception 'Please write at least 5 characters about the product.';
  end if;

  if length(trim(coalesce(p_body, ''))) > 2000
     or length(trim(coalesce(p_title, ''))) > 120 then
    raise exception 'The review is too long.';
  end if;

  if not private.has_delivered_purchase(v_user_id, p_product_id) then
    raise exception 'Only delivered purchases can be reviewed.';
  end if;

  insert into public.reviews (
    user_id,
    product_id,
    rating,
    title,
    body,
    approved
  )
  values (
    v_user_id,
    p_product_id,
    p_rating,
    trim(coalesce(p_title, '')),
    trim(p_body),
    true
  )
  on conflict (user_id, product_id)
  do update set
    rating = excluded.rating,
    title = excluded.title,
    body = excluded.body,
    updated_at = now()
  returning reviews.* into v_review;

  return query select v_review.id, v_review.approved;
end;
$$;

revoke all on function public.submit_product_review(text, integer, text, text)
  from public, anon;
grant execute on function public.submit_product_review(text, integer, text, text)
  to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reviews'
  ) then
    alter publication supabase_realtime add table public.reviews;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;
end
$$;
