alter table public.cart_items
  add column selected_for_checkout boolean not null default true;

comment on column public.cart_items.selected_for_checkout is
  'Persists whether the customer selected this cart line for their next checkout.';
