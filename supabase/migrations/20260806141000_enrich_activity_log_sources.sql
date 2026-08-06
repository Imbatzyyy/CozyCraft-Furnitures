-- Attribute each audited mutation to its client surface and staff role so the
-- operations workspace can distinguish website, mobile-app, and system work.
alter table public.activity_logs
  add column if not exists platform text not null default 'system',
  add column if not exists actor_role text;

alter table public.activity_logs
  drop constraint if exists activity_logs_platform_check;

alter table public.activity_logs
  add constraint activity_logs_platform_check
  check (platform in ('web', 'mobile', 'edge', 'system'));

create index if not exists activity_logs_platform_created_idx
  on public.activity_logs (platform, created_at desc);

create or replace function private.record_admin_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_actor_id uuid := auth.uid();
  v_headers jsonb := coalesce(
    nullif(current_setting('request.headers', true), '')::jsonb,
    '{}'::jsonb
  );
  v_platform text := lower(coalesce(v_headers ->> 'x-cozycraft-platform', ''));
  v_user_agent text := lower(coalesce(v_headers ->> 'user-agent', ''));
  v_actor_role text;
begin
  select p.role::text
  into v_actor_role
  from public.profiles p
  where p.id = v_actor_id;

  if v_platform not in ('web', 'mobile', 'edge', 'system') then
    v_platform := '';
  end if;

  if v_platform = '' then
    v_platform := case
      when v_user_agent ~ '(capacitor|cordova|android|iphone|ipad|mobile)' then 'mobile'
      when v_actor_id is not null then 'web'
      when v_user_agent ~ '(deno|supabase-edge)' then 'edge'
      else 'system'
    end;
  end if;

  insert into public.activity_logs (
    actor_id,
    actor_role,
    platform,
    action,
    entity_type,
    entity_id,
    details
  ) values (
    v_actor_id,
    v_actor_role,
    v_platform,
    lower(tg_op) || '_' || tg_table_name,
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'product_id'),
    jsonb_strip_nulls(
      jsonb_build_object(
        'name', coalesce(v_row ->> 'name', v_row ->> 'order_number', v_row ->> 'title'),
        'status', coalesce(v_row ->> 'status', v_row ->> 'payment_status'),
        'approved', v_row -> 'approved',
        'platform', v_platform,
        'actor_role', v_actor_role
      )
    )
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

