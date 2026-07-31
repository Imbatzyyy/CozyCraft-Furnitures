create or replace function private.record_admin_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.activity_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    details
  ) values (
    (select auth.uid()),
    lower(tg_op) || '_' || tg_table_name,
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'product_id'),
    jsonb_strip_nulls(
      jsonb_build_object(
        'name', coalesce(v_row ->> 'name', v_row ->> 'order_number', v_row ->> 'title'),
        'status', coalesce(v_row ->> 'status', v_row ->> 'payment_status'),
        'approved', v_row -> 'approved'
      )
    )
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'categories',
    'products',
    'orders',
    'reviews',
    'store_settings'
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

create or replace function private.refresh_product_review_summary()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_product_id text := coalesce(new.product_id, old.product_id);
begin
  update public.products
  set
    rating = coalesce(
      (
        select round(avg(rating)::numeric, 1)
        from public.reviews
        where product_id = v_product_id and approved
      ),
      0
    ),
    review_count = (
      select count(*)
      from public.reviews
      where product_id = v_product_id and approved
    )
  where id = v_product_id;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists refresh_product_review_summary on public.reviews;
create trigger refresh_product_review_summary
after insert or update or delete on public.reviews
for each row execute function private.refresh_product_review_summary();

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'categories',
    'reviews',
    'store_settings',
    'activity_logs'
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
