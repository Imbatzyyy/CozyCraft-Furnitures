-- Preserve Lino Oak Console's original catalog age after recovering the row
-- referenced by the August 5, 2026 product-deletion audit event.
--
-- The product was first inserted by the initial commerce catalog migration
-- (20260729050350_initialize_cozycraft_commerce.sql). The recovery migration
-- intentionally used a separate insert, so PostgreSQL assigned a new
-- created_at value. Restore the original seed timestamp so New Arrivals and
-- other age-based storefront views do not treat this recovered product as new.
update public.products
set created_at = '2026-07-29 05:03:50+00'::timestamptz
where id = 'lino'
  and name = 'Lino Oak Console';
