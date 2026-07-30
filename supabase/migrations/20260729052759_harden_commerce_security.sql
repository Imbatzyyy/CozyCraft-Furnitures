drop policy if exists "product_images_public_read" on storage.objects;
drop policy if exists "avatars_public_read" on storage.objects;

alter function public.place_order(uuid, text, jsonb) set schema private;
revoke all on function private.place_order(uuid, text, jsonb) from public, anon;
grant execute on function private.place_order(uuid, text, jsonb) to authenticated;

create or replace function public.place_order(
  p_address_id uuid,
  p_payment_method text,
  p_items jsonb
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, private
as $$
  select private.place_order(p_address_id, p_payment_method, p_items);
$$;

revoke all on function public.place_order(uuid, text, jsonb) from public, anon;
grant execute on function public.place_order(uuid, text, jsonb) to authenticated;

create index activity_logs_actor_id_idx on public.activity_logs(actor_id);
create index cart_items_product_id_idx on public.cart_items(product_id);
create index order_items_order_id_idx on public.order_items(order_id);
create index order_items_product_id_idx on public.order_items(product_id);
create index orders_user_id_idx on public.orders(user_id);
create index reviews_product_id_idx on public.reviews(product_id);
create index support_tickets_order_id_idx on public.support_tickets(order_id);
create index support_tickets_user_id_idx on public.support_tickets(user_id);
create index wishlist_items_product_id_idx on public.wishlist_items(product_id);

drop policy if exists "reviews_customer_update" on public.reviews;
drop policy if exists "reviews_staff_update" on public.reviews;
create policy "reviews_owner_or_staff_update"
on public.reviews for update
to authenticated
using (
  (select auth.uid()) = user_id
  or (select private.is_staff())
)
with check (
  (select private.is_staff())
  or ((select auth.uid()) = user_id and approved = false)
);
