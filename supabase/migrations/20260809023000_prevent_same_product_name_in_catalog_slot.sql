-- Product names may repeat across different rooms or product types, but the
-- same normalized name must be unique inside one category + subcategory.
-- This database rule closes the race between two admin devices and backs up
-- the matching validation in the catalog editor.
create unique index if not exists products_unique_name_in_catalog_slot_idx
on public.products (
  lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')),
  lower(regexp_replace(btrim(category), '[[:space:]]+', ' ', 'g')),
  lower(regexp_replace(btrim(subcategory), '[[:space:]]+', ' ', 'g'))
);

