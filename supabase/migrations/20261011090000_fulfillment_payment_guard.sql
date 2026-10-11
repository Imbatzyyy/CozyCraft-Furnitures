-- Protect every client, including older mobile builds. Do not falsify or erase
-- historical delivered/pending records: expose them for administrator review.
create or replace function private.enforce_fulfillment_payment() returns trigger
language plpgsql set search_path = '' as $$
begin
  if lower(new.payment_method) in ('card','gcash')
    and new.status in ('processing','packed','shipped','delivered')
    and new.payment_status <> 'paid'
    and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    raise exception 'Confirm online payment before progressing fulfillment' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function private.enforce_fulfillment_payment() from public,anon,authenticated;
create trigger enforce_fulfillment_payment before insert or update of status on public.orders
for each row execute function private.enforce_fulfillment_payment();

-- Guests retain a small allowance; verified accounts get independent budgets.
-- IP hashes never contain raw addresses and only the server may call this RPC.
create or replace function public.reserve_discovery_search(p_ip text, p_user uuid default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_ip is null or length(p_ip) <> 64 then return false; end if;
  if p_user is not null then
    if not exists(select 1 from public.profiles where id=p_user and customer_active is not false) then return false; end if;
    if not public.reserve_security_budget('discovery:user:'||p_user::text,15,600) then return false; end if;
    -- Enough room for a 45-person shared network, while preserving cost caps.
    if not public.reserve_security_budget('discovery:network:'||p_ip,300,600) then return false; end if;
  elsif not public.reserve_security_budget('discovery:guest:'||p_ip,15,600) then
    return false;
  end if;
  return public.reserve_security_budget('discovery:global',500,86400);
end $$;
revoke all on function public.reserve_discovery_search(text,uuid) from public,anon,authenticated;
grant execute on function public.reserve_discovery_search(text,uuid) to service_role;
