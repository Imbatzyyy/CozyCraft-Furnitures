-- Restore the original Lino console after its product row was removed from the
-- live catalog. The storefront taxonomy has always assigned this product to
-- Living room > TV Stands > Wooden TV Stand.
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
  review_count
)
values (
  'lino',
  'Lino Oak Console',
  'Living room',
  'Wooden TV Stand',
  24500,
  5,
  'active',
  'Natural oak',
  'Natural oak veneer · brushed brass',
  '140W × 40D × 76H cm',
  'A quietly architectural oak console designed to anchor an entryway, dining room, or living space with room for the things that matter.',
  array[
    'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=1200&q=88',
    'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=88',
    'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=88'
  ],
  0,
  4.8,
  18
)
on conflict (id) do nothing;
