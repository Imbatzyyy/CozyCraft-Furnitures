-- Record authentication events without exposing direct activity-log inserts.
create or replace function public.record_auth_activity(
  p_action text,
  p_platform text default 'web',
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_action text := lower(coalesce(p_action, ''));
  v_platform text := lower(coalesce(p_platform, 'web'));
  v_is_staff boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select role::text into v_role from public.profiles where id = v_user_id;
  if v_role is null then raise exception 'Profile unavailable'; end if;
  v_is_staff := v_role in ('staff', 'admin', 'superadmin');

  if v_action not in (
    'customer_sign_in', 'customer_sign_out',
    'admin_sign_in', 'admin_sign_out', 'admin_idle_logout'
  ) then raise exception 'Unsupported authentication event'; end if;
  if v_action like 'admin_%' and not v_is_staff then
    raise exception 'Administrator event requires staff access';
  end if;
  if v_action like 'customer_%' and v_role <> 'customer' then
    raise exception 'Customer event requires customer access';
  end if;
  if v_platform not in ('web', 'mobile', 'edge', 'system') then v_platform := 'web'; end if;

  insert into public.activity_logs (
    actor_id, actor_role, platform, action, entity_type, entity_id, details
  ) values (
    v_user_id, v_role, v_platform, v_action, 'authentication', v_user_id::text,
    jsonb_strip_nulls(coalesce(p_details, '{}'::jsonb) || jsonb_build_object(
      'actor_role', v_role, 'platform', v_platform
    ))
  );
end;
$$;

revoke all on function public.record_auth_activity(text, text, jsonb) from public;
grant execute on function public.record_auth_activity(text, text, jsonb) to authenticated;

-- Account creation must be logged by the database because email-confirmation
-- signups do not yet have an authenticated browser session.
create or replace function private.record_profile_account_created()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_staff boolean := new.role::text in ('staff', 'admin', 'superadmin');
begin
  insert into public.activity_logs (
    actor_id, actor_role, platform, action, entity_type, entity_id, details
  ) values (
    new.id,
    new.role::text,
    'system',
    case when v_staff then 'admin_account_created' else 'customer_account_created' end,
    'authentication',
    new.id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'name', case when v_staff then 'Administrator account created' else 'Customer account created' end,
      'email', new.email,
      'actor_role', new.role::text,
      'platform', 'system'
    ))
  );
  return new;
end;
$$;

drop trigger if exists record_profile_account_created on public.profiles;
create trigger record_profile_account_created
after insert on public.profiles
for each row execute function private.record_profile_account_created();

-- A safer default. Super administrators can still change this in Settings.
update public.admin_security_settings
set session_timeout_minutes = 30,
    updated_at = now()
where id = true and session_timeout_minutes = 480;
