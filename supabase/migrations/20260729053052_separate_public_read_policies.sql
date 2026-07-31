drop policy if exists "categories_public_read" on public.categories;
create policy "categories_anon_read_active"
on public.categories for select to anon
using (active);
create policy "categories_authenticated_read"
on public.categories for select to authenticated
using (active or (select private.is_staff()));

drop policy if exists "products_public_read" on public.products;
create policy "products_anon_read_active"
on public.products for select to anon
using (status = 'active');
create policy "products_authenticated_read"
on public.products for select to authenticated
using (status = 'active' or (select private.is_staff()));

drop policy if exists "reviews_public_read" on public.reviews;
create policy "reviews_anon_read_approved"
on public.reviews for select to anon
using (approved);
create policy "reviews_authenticated_read"
on public.reviews for select to authenticated
using (
  approved
  or (select auth.uid()) = user_id
  or (select private.is_staff())
);
