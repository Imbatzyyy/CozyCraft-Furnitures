-- Give active administrators a read-only, RLS-protected view of Home Circle
-- membership records while preserving each customer's existing self-access.
drop policy if exists "mobile_loyalty_accounts_select_admin" on public.mobile_loyalty_accounts;
create policy "mobile_loyalty_accounts_select_admin"
on public.mobile_loyalty_accounts
for select
to authenticated
using ((select private.is_admin()));

drop policy if exists "mobile_loyalty_transactions_select_admin" on public.mobile_loyalty_transactions;
create policy "mobile_loyalty_transactions_select_admin"
on public.mobile_loyalty_transactions
for select
to authenticated
using ((select private.is_admin()));

drop policy if exists "mobile_loyalty_redemptions_select_admin" on public.mobile_loyalty_redemptions;
create policy "mobile_loyalty_redemptions_select_admin"
on public.mobile_loyalty_redemptions
for select
to authenticated
using ((select private.is_admin()));

-- Keep the monitor and its per-member history queries index-backed.
create index if not exists mobile_loyalty_accounts_tier_updated_idx
  on public.mobile_loyalty_accounts (tier, updated_at desc);

create index if not exists mobile_loyalty_transactions_user_created_idx
  on public.mobile_loyalty_transactions (user_id, created_at desc);

create index if not exists mobile_loyalty_redemptions_user_created_idx
  on public.mobile_loyalty_redemptions (user_id, created_at desc);

-- Every customer should appear in the monitor immediately after account
-- creation, even before their first eligible order or points transaction.
create or replace function private.ensure_mobile_loyalty_account()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.role::text = 'customer' then
    insert into public.mobile_loyalty_accounts (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.ensure_mobile_loyalty_account() from public, anon, authenticated;

drop trigger if exists ensure_mobile_loyalty_account on public.profiles;
create trigger ensure_mobile_loyalty_account
after insert or update of role on public.profiles
for each row
execute function private.ensure_mobile_loyalty_account();

insert into public.mobile_loyalty_accounts (user_id)
select id
from public.profiles
where role::text = 'customer'
on conflict (user_id) do nothing;
