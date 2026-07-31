-- Orders already have the richer orders_activity_log trigger. Keep that single
-- source of order activity so one order change does not create duplicate entries.
drop trigger if exists audit_orders on public.orders;
