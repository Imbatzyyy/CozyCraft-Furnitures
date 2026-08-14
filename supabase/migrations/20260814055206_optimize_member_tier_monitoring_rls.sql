-- One combined policy is cheaper than evaluating parallel permissive policies
-- while retaining the same customer-owner and active-admin access boundaries.
drop policy if exists "mobile_loyalty_accounts_select_own" on public.mobile_loyalty_accounts;
drop policy if exists "mobile_loyalty_accounts_select_admin" on public.mobile_loyalty_accounts;
create policy "mobile_loyalty_accounts_select_own_or_admin"
on public.mobile_loyalty_accounts
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_admin())
);

drop policy if exists "mobile_loyalty_transactions_select_own" on public.mobile_loyalty_transactions;
drop policy if exists "mobile_loyalty_transactions_select_admin" on public.mobile_loyalty_transactions;
create policy "mobile_loyalty_transactions_select_own_or_admin"
on public.mobile_loyalty_transactions
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_admin())
);

drop policy if exists "mobile_loyalty_redemptions_select_own" on public.mobile_loyalty_redemptions;
drop policy if exists "mobile_loyalty_redemptions_select_admin" on public.mobile_loyalty_redemptions;
create policy "mobile_loyalty_redemptions_select_own_or_admin"
on public.mobile_loyalty_redemptions
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_admin())
);

create index if not exists mobile_loyalty_transactions_order_id_idx
  on public.mobile_loyalty_transactions (order_id)
  where order_id is not null;

create index if not exists mobile_loyalty_transactions_review_id_idx
  on public.mobile_loyalty_transactions (review_id)
  where review_id is not null;

create index if not exists orders_home_circle_redemption_id_idx
  on public.orders (home_circle_redemption_id)
  where home_circle_redemption_id is not null;

create or replace function private.mobile_loyalty_tier(p_spend numeric)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when p_spend >= 120000 then 'elite'
    when p_spend >= 50000 then 'premium'
    when p_spend >= 15000 then 'plus'
    else 'member'
  end
$$;
