-- Complete the workspace audit trail for customer and administrative modules
-- that were not covered by the original catalog/order triggers.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'profiles',
    'addresses',
    'cart_items',
    'wishlist_items',
    'support_tickets'
  ]
  loop
    execute format(
      'drop trigger if exists audit_%I on public.%I',
      v_table,
      v_table
    );
    execute format(
      'create trigger audit_%I after insert or update or delete on public.%I for each row execute function private.record_admin_activity()',
      v_table,
      v_table
    );
  end loop;
end
$$;

-- The activity page is realtime, so these source tables should also publish
-- changes to every connected customer/admin screen that subscribes to them.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'profiles',
    'addresses',
    'cart_items',
    'wishlist_items',
    'support_tickets'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        v_table
      );
    end if;
  end loop;
end
$$;

create index if not exists activity_logs_entity_created_idx
  on public.activity_logs (entity_type, created_at desc);

create index if not exists activity_logs_action_created_idx
  on public.activity_logs (action, created_at desc);
