create index if not exists orders_cancellation_reviewed_by_idx
  on public.orders (cancellation_reviewed_by)
  where cancellation_reviewed_by is not null;
