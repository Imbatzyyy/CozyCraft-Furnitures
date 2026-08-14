-- Keep public storefront configuration readable without evaluating staff-only
-- helper functions for anonymous visitors. Authenticated users retain access to
-- active rows, while staff can also manage and inspect inactive configuration.

drop policy if exists delivery_service_areas_public_read
  on public.delivery_service_areas;

create policy delivery_service_areas_anon_read
  on public.delivery_service_areas for select
  to anon
  using (active);

create policy delivery_service_areas_authenticated_read
  on public.delivery_service_areas for select
  to authenticated
  using (active or (select private.is_staff()));

drop policy if exists search_synonyms_public_read
  on public.search_synonyms;

create policy search_synonyms_anon_read
  on public.search_synonyms for select
  to anon
  using (active);

create policy search_synonyms_authenticated_read
  on public.search_synonyms for select
  to authenticated
  using (active or (select private.is_staff()));
