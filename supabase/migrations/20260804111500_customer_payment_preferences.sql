alter table public.profiles
  drop constraint if exists profiles_preferred_payment_method_check;

alter table public.profiles
  add constraint profiles_preferred_payment_method_check
  check (preferred_payment_method in ('cod', 'gcash', 'card'));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'order_status_history'
  ) then
    alter publication supabase_realtime add table public.order_status_history;
  end if;
end $$;

