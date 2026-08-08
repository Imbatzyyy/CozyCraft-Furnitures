-- TONSTAD is used by two distinct catalog products. The original admin form
-- generated the same `tonstad` slug for both names, so Angela Faith Suba's
-- Bedroom nightstand update temporarily replaced the existing TV-stand row.
-- Keep the TV stand on its original id and restore Angela's nightstand under a
-- stable, collision-free id.

update public.products
set
  category = 'Living room',
  subcategory = 'Wooden TV Stand',
  price = 19999,
  stock_quantity = 20
where id = 'tonstad'
  and name = 'TONSTAD';

insert into public.products (
  id,
  name,
  category,
  subcategory,
  price,
  stock_quantity,
  status,
  color,
  material,
  dimensions,
  description,
  images,
  main_image_index,
  rating,
  review_count,
  created_at
) values (
  'tonstad-nightstand',
  'TONSTAD',
  'Bedroom',
  'Wooden Nightstand',
  7999,
  5,
  'active',
  '',
  '[{"type":"Top panel","description":"Solid oak, Particleboard, Oak veneer, Oak veneer, Beech veneer, Clear acrylic lacquer, Paper foil"},{"type":"Back panel","description":"Particleboard, Oak veneer, Clear acrylic lacquer, Oak veneer, Paper foil"},{"type":"Side panel/ Drawer front","description":"Particleboard, Oak veneer, Clear acrylic lacquer, Paper foil, Oak veneer"},{"type":"Drawer side/ Drawer back","description":"Particleboard, Plastic foil"},{"type":"Drawer bottom","description":"Fiberboard, Polyester paint, Paper foil"},{"type":"Leg","description":"Solid wood, Oak veneer, Clear acrylic lacquer"}]',
  '[{"label":"Height","value":"59","unit":"cm"},{"label":"Width","value":"40","unit":"cm"},{"label":"Depth","value":"40","unit":"cm"},{"label":"Drawer depth (inside)","value":"30","unit":"cm"},{"label":"Drawer width (inside)","value":"28","unit":"cm"},{"label":"Height under nightstand","value":"11","unit":"cm"}]',
  'Classic design meets beautifully brushed veneer in the TONSTAD series, giving the furniture a unique character. Details like an integrated handle and round legs add a timeless look to this bedside table.',
  array[
    'https://gwjsivqksyimuabbdyqq.supabase.co/storage/v1/object/public/product-images/1786073617764-7e89f7b7-14ee-4857-afe6-08f12360d192-main-photo.jpg',
    'https://gwjsivqksyimuabbdyqq.supabase.co/storage/v1/object/public/product-images/1786073620392-6bbb6e8f-23da-4d9a-81c0-94c6ba781a45-to.jpg',
    'https://gwjsivqksyimuabbdyqq.supabase.co/storage/v1/object/public/product-images/1786073623451-25cb4864-48b5-4409-8a3e-eea1ec4952cd-ns.jpg',
    'https://gwjsivqksyimuabbdyqq.supabase.co/storage/v1/object/public/product-images/1786073626217-d6575ab5-1e3e-4629-bc13-0fea94cbff6f-ta.jpg'
  ],
  0,
  0,
  0,
  '2026-08-07 03:33:46.43279+00'
)
on conflict (id) do update
set
  name = excluded.name,
  category = excluded.category,
  subcategory = excluded.subcategory,
  price = excluded.price,
  stock_quantity = excluded.stock_quantity,
  status = excluded.status,
  color = excluded.color,
  material = excluded.material,
  dimensions = excluded.dimensions,
  description = excluded.description,
  images = excluded.images,
  main_image_index = excluded.main_image_index;
