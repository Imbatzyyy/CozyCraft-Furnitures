-- Additive only: preserve mobile contracts and existing authorization/RLS.
-- Tiny catalog invalidations now cover stock/price/content as well as status.
drop trigger if exists sync_product_availability_after_product_change on public.products;
create trigger sync_product_availability_after_product_change
after insert or update or delete on public.products
for each row execute function private.sync_product_availability();

create or replace function public.admin_activity_page(p_scope text default 'all', p_query text default '', p_page integer default 1, p_size integer default 20)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if not private.is_staff() or not private.customer_mfa_satisfied() or not private.admin_mfa_satisfied() then
    raise exception 'Verified administrator session required' using errcode = '42501';
  end if;
  if p_page is null or p_page < 1 or p_page > 100000 or p_size is null or p_size not in (20,50,100) or length(p_query) > 200 then raise exception 'Invalid page parameters'; end if;
  with events as (
    select 'activity-'||a.id::text id, a.action, a.entity_type, a.entity_id::text,
      a.details, a.created_at, a.platform::text, a.actor_role::text,
      jsonb_build_object('full_name',p.full_name,'email',p.email,'role',p.role) profiles
    from public.activity_logs a left join public.profiles p on p.id=a.actor_id
    where a.created_at >= now()-interval '7 days'
    union all
    select 'error-'||e.id::text, 'client_error', 'errors', null,
      jsonb_build_object('message',e.message,'path',e.path), e.created_at,
      case when e.user_agent ~* '(android|iphone|ipad|mobile|capacitor|cordova)' then 'mobile' else 'web' end,
      p.role::text, jsonb_build_object('full_name',p.full_name,'email',p.email,'role',p.role)
    from public.client_error_events e left join public.profiles p on p.id=e.user_id
    where e.created_at >= now()-interval '7 days'
  ), filtered as materialized (
    select * from events e where
      case coalesce(p_scope,'all')
        when 'all' then true
        when 'orders' then e.entity_type in ('order','orders')
        when 'customers' then e.entity_type='profiles' or e.action like 'team_member_%'
        when 'support' then e.entity_type in ('support_ticket','support_tickets')
        when 'cart' then e.entity_type in ('cart_item','cart_items')
        when 'wishlist' then e.entity_type in ('wishlist_item','wishlist_items')
        when 'addresses' then e.entity_type in ('address','addresses')
        else e.entity_type=p_scope or e.entity_type=regexp_replace(p_scope,'s$','') end
      and (coalesce(trim(p_query),'')='' or strpos(lower(concat_ws(' ',e.action,e.entity_type,e.entity_id,e.details::text,e.profiles::text,e.actor_role,e.platform)),lower(trim(p_query)))>0)
  ), page as (
    select id,action,entity_type,entity_id,created_at,platform,actor_role,profiles,
      jsonb_strip_nulls(jsonb_build_object('name',details->'name','order_number',details->'order_number','message',details->'message','path',details->'path')) details
    from filtered order by created_at desc,id desc limit p_size offset (p_page-1)*p_size
  ) select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc,id desc) from page p),'[]'::jsonb),
    'total',(select count(*) from filtered),'generatedAt',now()) into result;
  return result;
end $$;

create or replace function public.admin_review_page(p_filter text default 'all', p_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if not private.is_staff() or not private.customer_mfa_satisfied() or not private.admin_mfa_satisfied() then raise exception 'Verified administrator session required' using errcode='42501'; end if;
  if p_page is null or p_page<1 or p_page>100000 or p_filter not in ('all','visible','hidden','photos') then raise exception 'Invalid page parameters'; end if;
  with filtered as materialized (
    select r.* from public.reviews r where p_filter='all' or (p_filter='visible' and r.approved) or (p_filter='hidden' and not r.approved) or (p_filter='photos' and cardinality(r.image_paths)>0)
  ), page as (
    select r.id,r.rating,r.title,r.body,r.approved,r.image_paths,r.created_at,
      jsonb_build_object('full_name',p.full_name,'email',p.email,'avatar_url',p.avatar_url) profiles,
      jsonb_build_object('name',product.name) products
    from (select * from filtered order by created_at desc,id desc limit 10 offset (p_page-1)*10) r
    left join public.profiles p on p.id=r.user_id left join public.products product on product.id=r.product_id
  ) select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc,id desc) from page p),'[]'::jsonb),
    'total',(select count(*) from filtered), 'allCount',(select count(*) from public.reviews),
    'visible',(select count(*) from public.reviews where approved), 'hidden',(select count(*) from public.reviews where not approved),
    'photos',(select count(*) from public.reviews where cardinality(image_paths)>0),
    'average',(select coalesce(avg(rating),0) from public.reviews where approved)) into result;
  return result;
end $$;

create or replace function public.admin_member_page(p_query text default '', p_tier text default 'all', p_sort text default 'points', p_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if not private.is_staff() or not private.customer_mfa_satisfied() or not private.admin_mfa_satisfied() then raise exception 'Verified administrator session required' using errcode='42501'; end if;
  if p_page is null or p_page<1 or p_page>100000 or length(p_query)>200 or p_tier not in ('all','member','plus','premium','elite') or p_sort not in ('points','spend','recent') then raise exception 'Invalid page parameters'; end if;
  with members as materialized (
    select p.id,p.id user_id,p.full_name,p.username,p.email,p.avatar_url,p.created_at,
      coalesce(a.points_balance,0) points_balance,coalesce(a.lifetime_eligible_spend,0) lifetime_eligible_spend,
      coalesce(a.tier::text,'member') tier,a.tier_valid_until,a.last_activity_at,a.updated_at
    from public.profiles p left join public.mobile_loyalty_accounts a on a.user_id=p.id where p.role='customer'
  ), filtered as materialized (
    select * from members m where (p_tier='all' or m.tier=p_tier) and
      (coalesce(trim(p_query),'')='' or strpos(lower(concat_ws(' ',m.full_name,m.username,m.email,m.tier)),lower(trim(p_query)))>0)
  ), page as (
    select * from filtered order by
      case when p_sort='points' then points_balance end desc,
      case when p_sort='spend' then lifetime_eligible_spend end desc,
      case when p_sort='recent' then coalesce(last_activity_at,created_at) end desc,id
    limit 20 offset (p_page-1)*20
  ) select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p) order by
      case when p_sort='points' then points_balance end desc,
      case when p_sort='spend' then lifetime_eligible_spend end desc,
      case when p_sort='recent' then coalesce(last_activity_at,created_at) end desc,id) from page p),'[]'::jsonb),
    'total',(select count(*) from filtered), 'members',(select count(*) from members),
    'points',(select coalesce(sum(points_balance),0) from members),
    'spend',(select coalesce(sum(lifetime_eligible_spend),0) from members),
    'elite',(select count(*) from members where tier='elite'),
    'tiers',(select coalesce(jsonb_object_agg(tier,n),'{}'::jsonb) from (select tier,count(*) n from members group by tier) counts)) into result;
  return result;
end $$;

revoke all on function public.admin_activity_page(text,text,integer,integer) from public,anon;
revoke all on function public.admin_review_page(text,integer) from public,anon;
revoke all on function public.admin_member_page(text,text,text,integer) from public,anon;
grant execute on function public.admin_activity_page(text,text,integer,integer) to authenticated;
grant execute on function public.admin_review_page(text,integer) to authenticated;
grant execute on function public.admin_member_page(text,text,text,integer) to authenticated;

-- These existing owner-protected tables are subscribed to only while the
-- corresponding customer panel is mounted. No policies or write grants change.
do $$ declare t text; begin
  foreach t in array array['mobile_loyalty_accounts','mobile_loyalty_transactions','mobile_loyalty_redemptions'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;
notify pgrst, 'reload schema';
