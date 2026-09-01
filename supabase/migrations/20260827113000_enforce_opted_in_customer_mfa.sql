-- Customers who opt into Supabase Auth MFA expect their private commerce data
-- to require an AAL2 session. The storefront challenge screen upgrades the JWT
-- before these tables are loaded. Accounts without a verified factor continue
-- to work at AAL1, so MFA remains optional.

create or replace function private.customer_mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then false
    when exists (
      select 1
      from auth.mfa_factors
      where user_id = (select auth.uid())
        and status = 'verified'
    ) then coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2'
    else true
  end;
$$;

revoke all on function private.customer_mfa_satisfied() from public, anon;
grant execute on function private.customer_mfa_satisfied() to authenticated, service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'addresses',
    'billing_profiles',
    'cart_items',
    'customer_notifications',
    'customer_policy_acceptances',
    'customer_preferences',
    'mobile_loyalty_accounts',
    'mobile_loyalty_redemptions',
    'mobile_loyalty_transactions',
    'mobile_push_tokens',
    'order_items',
    'order_status_history',
    'orders',
    'payment_transactions',
    'product_alerts',
    'return_requests',
    'reviews',
    'support_tickets',
    'wishlist_items'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format(
        'drop policy if exists %I on public.%I',
        'Verified MFA accounts require AAL2',
        table_name
      );
      execute format(
        'create policy %I on public.%I as restrictive to authenticated using ((select private.customer_mfa_satisfied())) with check ((select private.customer_mfa_satisfied()))',
        'Verified MFA accounts require AAL2',
        table_name
      );
    end if;
  end loop;
end;
$$;

comment on function private.customer_mfa_satisfied() is
  'Allows AAL1 for accounts without verified MFA and requires AAL2 after a factor is verified.';
