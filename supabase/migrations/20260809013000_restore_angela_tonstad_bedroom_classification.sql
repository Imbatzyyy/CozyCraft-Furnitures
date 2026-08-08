-- Restore the storefront placement completed by Angela Faith Suba (staff)
-- for the original TONSTAD product. A later administrative edit moved the
-- same row to Living room / Wooden TV Stand, which made it disappear from the
-- Bedroom nightstand catalog even though the product itself was not deleted.
--
-- Preserve the original id, catalog timestamp, images, price, inventory, and
-- specifications. Only the incorrect room/type classification is repaired.
update public.products
set
  category = 'Bedroom',
  subcategory = 'Wooden Nightstand'
where id = 'tonstad'
  and name = 'TONSTAD';
