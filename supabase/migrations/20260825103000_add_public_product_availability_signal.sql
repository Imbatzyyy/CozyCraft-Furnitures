-- Give the storefront a small, public-safe realtime signal when a product is
-- published or hidden. Product details remain protected by the products RLS
-- policies; this table exposes only an opaque product id and availability.
create table if not exists public.product_availability (
  product_id text primary key,
  available boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.product_availability enable row level security;

drop policy if exists "product_availability_public_read" on public.product_availability;
create policy "product_availability_public_read"
on public.product_availability
for select
to anon, authenticated
using (true);

revoke all on table public.product_availability from public, anon, authenticated;
grant select on table public.product_availability to anon, authenticated;

insert into public.product_availability (product_id, available, updated_at)
select id, status = 'active', now()
from public.products
on conflict (product_id) do update
set available = excluded.available,
    updated_at = excluded.updated_at;

create or replace function private.sync_product_availability()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.product_availability (product_id, available, updated_at)
    values (old.id, false, now())
    on conflict (product_id) do update
    set available = false,
        updated_at = excluded.updated_at;
    return old;
  end if;

  insert into public.product_availability (product_id, available, updated_at)
  values (new.id, new.status = 'active', now())
  on conflict (product_id) do update
  set available = excluded.available,
      updated_at = excluded.updated_at;

  return new;
end;
$$;
revoke all on function private.sync_product_availability() from public, anon, authenticated;

drop trigger if exists sync_product_availability_after_product_change on public.products;
create trigger sync_product_availability_after_product_change
after insert or update of status or delete on public.products
for each row
execute function private.sync_product_availability();

alter table public.product_availability replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'product_availability'
  ) then
    alter publication supabase_realtime add table public.product_availability;
  end if;
end;
$$;
