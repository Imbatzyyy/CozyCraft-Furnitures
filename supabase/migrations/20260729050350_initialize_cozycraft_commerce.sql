create schema if not exists private;

create type public.user_role as enum ('customer', 'staff', 'admin');
create type public.product_status as enum ('draft', 'active', 'inactive');
create type public.order_status as enum ('pending', 'processing', 'packed', 'shipped', 'delivered', 'cancelled');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  avatar_url text,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id bigint generated always as identity primary key,
  name text not null unique,
  slug text not null unique,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id text primary key,
  name text not null,
  category text not null,
  subcategory text not null default '',
  price numeric(12,2) not null check (price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  status public.product_status not null default 'draft',
  color text not null default '',
  material text not null default '',
  dimensions text not null default '',
  description text not null default '',
  images text[] not null default '{}',
  main_image_index integer not null default 0 check (main_image_index >= 0),
  rating numeric(2,1) not null default 0 check (rating between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'Home',
  recipient_name text not null,
  mobile text not null,
  email text not null,
  address_line text not null,
  barangay text not null default '',
  city text not null,
  province text not null,
  postal_code text not null,
  delivery_note text not null default '',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index addresses_one_primary_per_user
  on public.addresses(user_id) where is_primary;

create table public.cart_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.wishlist_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create sequence public.order_number_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default (
    'CC-' || to_char(current_date, 'YYYY') || '-' ||
    lpad(nextval('public.order_number_seq')::text, 5, '0')
  ),
  user_id uuid not null references public.profiles(id) on delete restrict,
  status public.order_status not null default 'pending',
  payment_method text not null check (payment_method in ('cod', 'card', 'gcash')),
  payment_status public.payment_status not null default 'pending',
  subtotal numeric(12,2) not null check (subtotal >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  total numeric(12,2) not null check (total >= 0),
  shipping_address jsonb not null,
  customer_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  image_url text,
  created_at timestamptz not null default now()
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique default (
    'CS-' || lpad(nextval('public.order_number_seq')::text, 5, '0')
  ),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  subject text not null default 'Customer support request',
  message text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  title text not null default '',
  body text not null default '',
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table public.store_settings (
  id boolean primary key default true check (id),
  store_name text not null default 'CozyCraft Furnitures',
  contact_email text not null default 'hello@cozycraftfurnitures.com',
  low_stock_threshold integer not null default 8 check (low_stock_threshold >= 0),
  delivery_area text not null default 'Metro Manila',
  inventory_alerts boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role in ('staff', 'admin')
  );
$$;

revoke all on function private.is_staff() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_staff() to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  );
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger products_updated_at before update on public.products
  for each row execute function private.set_updated_at();
create trigger addresses_updated_at before update on public.addresses
  for each row execute function private.set_updated_at();
create trigger orders_updated_at before update on public.orders
  for each row execute function private.set_updated_at();
create trigger tickets_updated_at before update on public.support_tickets
  for each row execute function private.set_updated_at();
create trigger reviews_updated_at before update on public.reviews
  for each row execute function private.set_updated_at();
create trigger settings_updated_at before update on public.store_settings
  for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.addresses enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.support_tickets enable row level security;
alter table public.reviews enable row level security;
alter table public.store_settings enable row level security;
alter table public.activity_logs enable row level security;

create policy "profiles_select_own_or_staff" on public.profiles for select
  to authenticated using ((select auth.uid()) = id or (select private.is_staff()));
create policy "profiles_update_own" on public.profiles for update
  to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "categories_public_read" on public.categories for select
  to anon, authenticated using (active or (select private.is_staff()));
create policy "categories_staff_insert" on public.categories for insert
  to authenticated with check ((select private.is_staff()));
create policy "categories_staff_update" on public.categories for update
  to authenticated using ((select private.is_staff()))
  with check ((select private.is_staff()));
create policy "categories_staff_delete" on public.categories for delete
  to authenticated using ((select private.is_staff()));

create policy "products_public_read" on public.products for select
  to anon, authenticated using (status = 'active' or (select private.is_staff()));
create policy "products_staff_insert" on public.products for insert
  to authenticated with check ((select private.is_staff()));
create policy "products_staff_update" on public.products for update
  to authenticated using ((select private.is_staff()))
  with check ((select private.is_staff()));
create policy "products_staff_delete" on public.products for delete
  to authenticated using ((select private.is_staff()));

create policy "addresses_own_all" on public.addresses for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "cart_own_all" on public.cart_items for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "wishlist_own_all" on public.wishlist_items for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "orders_select_own_or_staff" on public.orders for select
  to authenticated using ((select auth.uid()) = user_id or (select private.is_staff()));
create policy "orders_staff_update" on public.orders for update
  to authenticated using ((select private.is_staff()))
  with check ((select private.is_staff()));

create policy "order_items_select_own_or_staff" on public.order_items for select
  to authenticated using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and (orders.user_id = (select auth.uid()) or (select private.is_staff()))
    )
  );

create policy "tickets_select_own_or_staff" on public.support_tickets for select
  to authenticated using ((select auth.uid()) = user_id or (select private.is_staff()));
create policy "tickets_customer_insert" on public.support_tickets for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "tickets_staff_update" on public.support_tickets for update
  to authenticated using ((select private.is_staff()))
  with check ((select private.is_staff()));

create policy "reviews_public_read" on public.reviews for select
  to anon, authenticated using (approved or (select auth.uid()) = user_id or (select private.is_staff()));
create policy "reviews_customer_insert" on public.reviews for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "reviews_customer_update" on public.reviews for update
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and approved = false);
create policy "reviews_staff_update" on public.reviews for update
  to authenticated using ((select private.is_staff()))
  with check ((select private.is_staff()));

create policy "settings_public_read" on public.store_settings for select
  to anon, authenticated using (true);
create policy "settings_staff_update" on public.store_settings for update
  to authenticated using ((select private.is_staff()))
  with check ((select private.is_staff()));

create policy "activity_staff_read" on public.activity_logs for select
  to authenticated using ((select private.is_staff()));

grant usage on schema public to anon, authenticated;
grant select on public.categories, public.products, public.store_settings to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;
grant select, insert, update, delete on public.addresses, public.cart_items, public.wishlist_items to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select, insert, update on public.support_tickets, public.reviews to authenticated;
grant insert, update, delete on public.categories, public.products to authenticated;
grant update on public.store_settings to authenticated;
grant select on public.activity_logs to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create or replace function public.place_order(
  p_address_id uuid,
  p_payment_method text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_address public.addresses%rowtype;
  v_order_id uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_subtotal numeric(12,2) := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_payment_method not in ('cod', 'card', 'gcash') then
    raise exception 'Unsupported payment method';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty';
  end if;

  select * into v_address
  from public.addresses
  where id = p_address_id and user_id = v_user_id;
  if not found then
    raise exception 'Delivery address not found';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity <= 0 then
      raise exception 'Invalid item quantity';
    end if;
    select * into v_product
    from public.products
    where id = v_item ->> 'product_id' and status = 'active'
    for update;
    if not found then
      raise exception 'A product is no longer available';
    end if;
    if v_product.stock_quantity < v_quantity then
      raise exception 'Not enough stock for %', v_product.name;
    end if;
    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  end loop;

  insert into public.orders (
    user_id, payment_method, subtotal, total, shipping_address
  ) values (
    v_user_id,
    p_payment_method,
    v_subtotal,
    v_subtotal,
    jsonb_build_object(
      'label', v_address.label,
      'name', v_address.recipient_name,
      'mobile', v_address.mobile,
      'email', v_address.email,
      'line', v_address.address_line,
      'barangay', v_address.barangay,
      'city', v_address.city,
      'province', v_address.province,
      'postal', v_address.postal_code,
      'note', v_address.delivery_note
    )
  ) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item ->> 'quantity')::integer;
    select * into v_product
    from public.products
    where id = v_item ->> 'product_id'
    for update;

    insert into public.order_items (
      order_id, product_id, product_name, unit_price, quantity, image_url
    ) values (
      v_order_id,
      v_product.id,
      v_product.name,
      v_product.price,
      v_quantity,
      v_product.images[1]
    );

    update public.products
    set stock_quantity = stock_quantity - v_quantity
    where id = v_product.id;
  end loop;

  delete from public.cart_items where user_id = v_user_id;
  return v_order_id;
end;
$$;

revoke all on function public.place_order(uuid, text, jsonb) from public, anon;
grant execute on function public.place_order(uuid, text, jsonb) to authenticated;

insert into public.categories (name, slug, sort_order) values
  ('Living room', 'living-room', 1),
  ('Bedroom', 'bedroom', 2),
  ('Dining room', 'dining-room', 3);

insert into public.products (
  id, name, category, subcategory, price, stock_quantity, status, color,
  material, dimensions, description, images, main_image_index, rating, review_count
) values
  ('mara', 'Mara Lounge Chair', 'Living room', '2-Seater Fabric Sofa', 18900, 14, 'active', 'Oat bouclé', 'Bouclé upholstery · solid ash frame', '76W × 78D × 74H cm', 'A deeply comfortable lounge chair in a textured, soft oat bouclé. Its low, generous silhouette invites you to stay a little longer.', array['https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=1200&q=88','https://images.unsplash.com/photo-1564078516393-cf04bd966897?auto=format&fit=crop&w=1200&q=88','https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=1200&q=88'], 0, 4.9, 32),
  ('lino', 'Lino Oak Console', 'Living room', 'Modern TV Stand', 24500, 5, 'active', 'Natural oak', 'Natural oak veneer · brushed brass', '140W × 40D × 76H cm', 'A quietly architectural oak console designed to anchor an entryway, dining room, or living space with room for the things that matter.', array['https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=1200&q=88','https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=88','https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=88'], 0, 4.8, 18),
  ('noma', 'Noma Dining Chair', 'Dining room', 'Luxury Velvet Dining Chairs', 9800, 24, 'active', 'Warm sand', 'Textured weave · powder-coated steel', '52W × 55D × 82H cm', 'Sculpted for the long lunch. Noma pairs a welcoming upholstered seat with an elegantly pared-back profile.', array['https://images.unsplash.com/photo-1612372606404-0ab33e7187ee?auto=format&fit=crop&w=1200&q=88','https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=1200&q=88','https://images.unsplash.com/photo-1616486029423-aaa4789e8c9a?auto=format&fit=crop&w=1200&q=88'], 0, 4.9, 47),
  ('santo', 'Santo Bed Frame', 'Bedroom', 'Queen Size Bed', 38000, 9, 'active', 'Walnut', 'Walnut veneer · woven upholstery', '196W × 210D × 108H cm', 'A grounded frame in warm walnut, softened by a generous upholstered headboard and built for effortless, unhurried mornings.', array['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=88','https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&q=88','https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=88'], 0, 5.0, 15),
  ('hugo', 'Hugo Sectional Sofa', 'Living room', 'Sectional Sofa', 56900, 7, 'active', 'Stone linen', 'Linen blend · kiln-dried hardwood', '286W × 168D × 76H cm', 'A generous, low-profile sectional for rooms that favor lingering.', array['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1000&q=85','https://images.unsplash.com/photo-1493666438817-866a91353ca9?auto=format&fit=crop&w=1000&q=85'], 0, 4.9, 21),
  ('nilo', 'Nilo Coffee Table', 'Living room', 'Marble Coffee Table', 16400, 11, 'active', 'Travertine', 'Travertine stone · oak base', '110W × 70D × 34H cm', 'A grounded stone table with softly eased edges.', array['https://images.unsplash.com/photo-1532372576444-dda954194ad0?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=1000&q=85','https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1000&q=85'], 0, 4.8, 16),
  ('sola', 'Sola Wardrobe', 'Bedroom', '2-Door Wardrobe', 42800, 5, 'active', 'Smoked oak', 'Smoked oak veneer · soft-close hardware', '120W × 55D × 205H cm', 'A quietly capacious wardrobe in smoked oak.', array['https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1000&q=85','https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1000&q=85'], 0, 4.8, 12),
  ('milo', 'Milo Nightstand', 'Bedroom', 'Modern Nightstand', 11900, 12, 'active', 'Natural ash', 'Natural ash · brushed brass', '48W × 42D × 54H cm', 'A small bedside essential with a softly rounded profile.', array['https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1000&q=85','https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1000&q=85'], 0, 4.9, 28),
  ('arco', 'Arco Dining Table', 'Dining room', 'Extendable Dining Table', 46800, 6, 'active', 'European oak', 'European oak · matte protective finish', '220W × 98D × 75H cm', 'An expansive oak table made for everyday gatherings.', array['https://images.unsplash.com/photo-1577140917170-285929fb55b7?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1602872029708-84d970d3382b?auto=format&fit=crop&w=1000&q=85','https://images.unsplash.com/photo-1723750290151-164cb19ebab7?auto=format&fit=crop&w=1000&q=85'], 0, 4.9, 19),
  ('vera', 'Vera Dining Storage', 'Dining room', 'Buffet Cabinet', 33700, 8, 'active', 'Walnut veneer', 'Walnut veneer · fluted glass', '160W × 45D × 80H cm', 'Closed storage for the generous rituals of dining.', array['https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1577140917170-285929fb55b7?auto=format&fit=crop&w=1000&q=85','https://images.unsplash.com/photo-1602872029708-84d970d3382b?auto=format&fit=crop&w=1000&q=85'], 0, 4.7, 9);

insert into public.store_settings (id) values (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'order_items'
  ) then
    alter publication supabase_realtime add table public.order_items;
  end if;
end
$$;
