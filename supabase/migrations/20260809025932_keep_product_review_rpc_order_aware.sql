create or replace function private.submit_product_review(
  p_product_id text,
  p_rating integer,
  p_title text,
  p_body text
)
returns table (id uuid, approved boolean)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_review public.reviews%rowtype;
  v_order_item_id bigint;
  v_settings jsonb;
  v_approved boolean;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to review a product.';
  end if;

  select s.review_settings
  into v_settings
  from public.store_settings s
  where s.id = true;

  if p_rating not between 1 and 5 then
    raise exception 'Rating must be between 1 and 5.';
  end if;

  if length(trim(coalesce(p_body, ''))) < coalesce((v_settings->>'minimum_length')::integer, 5) then
    raise exception 'Your review is too short.';
  end if;

  if length(trim(coalesce(p_body, ''))) > coalesce((v_settings->>'maximum_length')::integer, 2000)
     or length(trim(coalesce(p_title, ''))) > 120 then
    raise exception 'The review is too long.';
  end if;

  select oi.id
  into v_order_item_id
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  left join public.reviews existing on existing.order_item_id = oi.id
  where o.user_id = v_user_id
    and o.status = 'delivered'
    and oi.product_id = p_product_id
    and existing.id is null
  order by o.created_at desc, oi.id desc
  limit 1;

  if v_order_item_id is null then
    select r.*
    into v_review
    from public.reviews r
    where r.user_id = v_user_id
      and r.product_id = p_product_id
    order by r.created_at desc
    limit 1;

    if not found then
      raise exception 'Only delivered purchases can be reviewed.';
    end if;
  end if;

  v_approved := not coalesce((v_settings->>'approval_required')::boolean, false);

  if v_order_item_id is not null then
    insert into public.reviews (
      user_id,
      product_id,
      order_item_id,
      rating,
      title,
      body,
      approved
    )
    values (
      v_user_id,
      p_product_id,
      v_order_item_id,
      p_rating,
      trim(coalesce(p_title, '')),
      trim(p_body),
      v_approved
    )
    returning reviews.* into v_review;
  else
    update public.reviews
    set rating = p_rating,
        title = trim(coalesce(p_title, '')),
        body = trim(p_body),
        approved = v_approved,
        updated_at = now()
    where reviews.id = v_review.id
    returning reviews.* into v_review;
  end if;

  return query select v_review.id, v_review.approved;
end;
$function$;
;
