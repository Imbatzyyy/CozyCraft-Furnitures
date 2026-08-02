alter table public.orders
  add column if not exists refund_email_sent_at timestamptz,
  add column if not exists refund_email_id text,
  add column if not exists refund_email_error text;

