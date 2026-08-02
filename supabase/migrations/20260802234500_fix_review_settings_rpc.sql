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
  v_settings jsonb;
  v_approved boolean;
begin
  if v_user_id is null then raise exception 'You must be signed in to review a product.'; end if;
  select s.review_settings into v_settings from public.store_settings s where s.id = true;
  if p_rating not between 1 and 5 then raise exception 'Rating must be between 1 and 5.'; end if;
  if length(trim(coalesce(p_body, ''))) < coalesce((v_settings->>'minimum_length')::integer, 5) then raise exception 'Your review is too short.'; end if;
  if length(trim(coalesce(p_body, ''))) > coalesce((v_settings->>'maximum_length')::integer, 2000) or length(trim(coalesce(p_title, ''))) > 120 then raise exception 'The review is too long.'; end if;
  if coalesce((v_settings->>'verified_purchases_only')::boolean, true) and not private.has_delivered_purchase(v_user_id, p_product_id) then raise exception 'Only delivered purchases can be reviewed.'; end if;
  v_approved := not coalesce((v_settings->>'approval_required')::boolean, false);

  insert into public.reviews (user_id, product_id, rating, title, body, approved)
  values (v_user_id, p_product_id, p_rating, trim(coalesce(p_title, '')), trim(p_body), v_approved)
  on conflict (user_id, product_id) do update set rating=excluded.rating,title=excluded.title,body=excluded.body,approved=excluded.approved,updated_at=now()
  returning reviews.* into v_review;
  return query select v_review.id, v_review.approved;
end;
$function$;
