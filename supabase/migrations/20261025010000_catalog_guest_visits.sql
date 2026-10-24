-- Aggregate product opens, including guests. Keep account-only recently viewed
-- history and the legacy catalog_popularity contract unchanged for older clients.
alter table public.product_engagement_counts
  add column visits bigint not null default 0 check (visits >= 0);
-- Only use genuinely recorded prior opens as a conservative starting point.
-- Historical anonymous visits were never recorded and cannot be reconstructed.
update public.product_engagement_counts set visits = viewers;

create table private.catalog_visit_events (
  event_id uuid primary key,
  created_at timestamptz not null default now()
);
create index catalog_visit_events_expiry on private.catalog_visit_events(created_at);
revoke all on private.catalog_visit_events from public, anon, authenticated;
alter table private.catalog_visit_events enable row level security;
create index catalog_visit_budget_expiry on private.security_request_budgets(window_start)
  where key like 'catalog-visit:%';

create function public.catalog_visit_counts()
returns table(product_id text, visits bigint, saves bigint)
language sql stable security definer set search_path = '' as $$
  select p.id, coalesce(c.visits,0), coalesce(c.saves,0)
  from public.products p left join public.product_engagement_counts c on c.product_id=p.id
  where p.status='active';
$$;
revoke all on function public.catalog_visit_counts() from public;
grant execute on function public.catalog_visit_counts() to anon, authenticated;

-- Only the Edge service can write. Origin checks alone are not an abuse boundary.
create function public.record_catalog_visit(p_product text,p_event uuid,p_source text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_count bigint;
begin
  if p_event is null or p_source is null or p_source !~ '^[0-9a-f]{64}$'
    or p_product is null or length(p_product) not between 1 and 120 then
    return jsonb_build_object('accepted',false);
  end if;
  -- Lock the product against deletion/status changes during the increment.
  perform 1 from public.products where id=p_product and status='active' for share;
  if not found then return jsonb_build_object('accepted',false); end if;
  if exists(select 1 from private.catalog_visit_events where event_id=p_event) then
    return jsonb_build_object('accepted',false);
  end if;
  -- Shared classroom Wi-Fi is supported. These are ceilings, not unique-user counts.
  if not public.reserve_security_budget('catalog-visit:global',10000,3600)
    or not public.reserve_security_budget('catalog-visit:network:'||p_source,3000,3600)
    or not public.reserve_security_budget('catalog-visit:product:'||p_source||':'||md5(p_product),120,600) then
    return jsonb_build_object('accepted',false);
  end if;
  insert into private.catalog_visit_events(event_id) values(p_event) on conflict do nothing;
  if not found then return jsonb_build_object('accepted',false); end if;
  insert into public.product_engagement_counts as c(product_id,visits) values(p_product,1)
  on conflict(product_id) do update set visits=c.visits+1 returning visits into v_count;
  return jsonb_build_object('accepted',true,'visits',v_count);
end;
$$;
revoke all on function public.record_catalog_visit(text,uuid,text) from public,anon,authenticated;
grant execute on function public.record_catalog_visit(text,uuid,text) to service_role;

-- No account IDs, raw IP addresses, or browsing history in the event ledger.
-- Keep short-lived request deduplication and rate-limit records bounded.
do $cleanup$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('catalog-visit-cleanup','17 * * * *',
      $job$delete from private.catalog_visit_events where created_at < now()-interval '24 hours';
      delete from private.security_request_budgets where key like 'catalog-visit:%' and window_start < now()-interval '24 hours';$job$);
  end if;
end $cleanup$;
notify pgrst,'reload schema';
