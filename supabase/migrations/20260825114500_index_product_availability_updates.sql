-- Storefront reconnect checks request only availability changes made since the
-- current browser session started. Keep that tiny delta query index-backed.
create index if not exists product_availability_updated_at_idx
on public.product_availability (updated_at);
