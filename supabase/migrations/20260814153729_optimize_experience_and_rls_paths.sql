-- Keep the catalog-search RPC on caller privileges so RLS remains the source
-- of truth, and remove per-row auth function evaluation from existing mobile
-- and customer preference policies identified by the performance advisor.

create policy search_events_owner_read
  on public.search_events for select
  to authenticated using ((select auth.uid()) = user_id);
create policy search_events_owner_insert
  on public.search_events for insert
  to authenticated with check ((select auth.uid()) = user_id);
grant insert on table public.search_events to authenticated;
grant usage, select on sequence public.search_events_id_seq to authenticated;

alter function public.record_catalog_search(text, integer, text) security invoker;

drop policy if exists "Customers can read their communication preferences" on public.customer_preferences;
drop policy if exists "Customers can create their communication preferences" on public.customer_preferences;
drop policy if exists "Customers can update their communication preferences" on public.customer_preferences;
create policy "Customers can read their communication preferences"
  on public.customer_preferences for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "Customers can create their communication preferences"
  on public.customer_preferences for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "Customers can update their communication preferences"
  on public.customer_preferences for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists mobile_push_tokens_own_select on public.mobile_push_tokens;
drop policy if exists mobile_push_tokens_own_delete on public.mobile_push_tokens;
create policy mobile_push_tokens_own_select
  on public.mobile_push_tokens for select
  to authenticated using ((select auth.uid()) = user_id);
create policy mobile_push_tokens_own_delete
  on public.mobile_push_tokens for delete
  to authenticated using ((select auth.uid()) = user_id);

create index if not exists admin_security_settings_updated_by_idx
  on public.admin_security_settings (updated_by)
  where updated_by is not null;
create index if not exists reviews_user_id_idx
  on public.reviews (user_id)
  where user_id is not null;
