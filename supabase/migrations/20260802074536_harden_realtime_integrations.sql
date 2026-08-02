-- Close an RPC grant left behind by an earlier default privilege and add the
-- covering indexes reported by the live Supabase performance advisor. The
-- authenticated inventory function still performs its own staff-role check.

revoke execute on function public.adjust_product_inventory(text, integer, text)
from anon;

create index if not exists inventory_movements_actor_id_idx
  on public.inventory_movements(actor_id);

create index if not exists order_status_history_changed_by_idx
  on public.order_status_history(changed_by);

create index if not exists orders_cancelled_by_idx
  on public.orders(cancelled_by);

create index if not exists product_views_product_id_idx
  on public.product_views(product_id);

create index if not exists return_requests_reviewed_by_idx
  on public.return_requests(reviewed_by);
