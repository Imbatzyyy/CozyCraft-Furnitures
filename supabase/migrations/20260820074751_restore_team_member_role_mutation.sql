-- Restore the server-only RPC used by the Team accounts page. The live
-- migration version matches Supabase's recorded migration history. The Edge
-- Function performs the user-facing authorization checks; this function
-- repeats the critical checks so role changes remain safe and atomic.
create or replace function public.mutate_team_member(
  p_actor_id uuid,
  p_target_id uuid,
  p_action text,
  p_role text default null,
  p_active boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_active_superadmins integer;
  v_message text;
begin
  -- This RPC is intentionally restricted to the service-role client used by
  -- the protected manage-team-member Edge Function.
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Service role required';
  end if;

  if p_actor_id is null or p_target_id is null then
    raise exception using
      errcode = '22023',
      message = 'Actor and team member are required';
  end if;

  -- Serialize changes that could remove the final active super administrator.
  perform pg_advisory_xact_lock(hashtext('cozycraft-active-superadmins'));

  select *
  into v_actor
  from public.profiles
  where id = p_actor_id
  for update;

  if not found
     or v_actor.role::text <> 'superadmin'
     or not v_actor.staff_active then
    raise exception using
      errcode = '42501',
      message = 'Active super administrator required';
  end if;

  if p_actor_id = p_target_id then
    raise exception using
      errcode = '22023',
      message = 'You cannot change your own super administrator access';
  end if;

  select *
  into v_target
  from public.profiles
  where id = p_target_id
  for update;

  if not found
     or v_target.role::text not in ('staff', 'admin', 'superadmin') then
    raise exception using
      errcode = 'P0002',
      message = 'Team member not found';
  end if;

  select count(*)
  into v_active_superadmins
  from public.profiles
  where role::text = 'superadmin'
    and staff_active;

  if p_action = 'update-role' then
    if p_role is null
       or p_role not in ('staff', 'admin', 'superadmin') then
      raise exception using
        errcode = '22023',
        message = 'Invalid team role';
    end if;

    if v_target.role::text = 'superadmin'
       and v_target.staff_active
       and p_role <> 'superadmin'
       and v_active_superadmins <= 1 then
      raise exception using
        errcode = '23514',
        message = 'At least one active super administrator must remain';
    end if;

    if v_target.role::text = p_role then
      return jsonb_build_object(
        'success', true,
        'message', 'This team member already has that role.',
        'role', p_role,
        'active', v_target.staff_active
      );
    end if;

    update public.profiles
    set role = p_role::public.user_role,
        updated_at = now()
    where id = v_target.id;

    insert into public.activity_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      details,
      platform,
      actor_role
    )
    values (
      p_actor_id,
      'team_member_role_changed',
      'profile',
      v_target.id::text,
      jsonb_build_object(
        'email', v_target.email,
        'from', v_target.role::text,
        'to', p_role
      ),
      'edge',
      'superadmin'
    );

    v_message := 'Role updated.';

  elsif p_action = 'set-status' then
    if p_active is null then
      raise exception using
        errcode = '22023',
        message = 'Active status is required';
    end if;

    if v_target.role::text = 'superadmin'
       and v_target.staff_active
       and not p_active
       and v_active_superadmins <= 1 then
      raise exception using
        errcode = '23514',
        message = 'At least one active super administrator must remain';
    end if;

    if v_target.staff_active = p_active then
      return jsonb_build_object(
        'success', true,
        'message', case
          when p_active then 'Team member access is already active.'
          else 'Team member access is already suspended.'
        end,
        'role', v_target.role::text,
        'active', p_active
      );
    end if;

    update public.profiles
    set staff_active = p_active,
        updated_at = now()
    where id = v_target.id;

    insert into public.activity_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      details,
      platform,
      actor_role
    )
    values (
      p_actor_id,
      case
        when p_active then 'team_member_reactivated'
        else 'team_member_suspended'
      end,
      'profile',
      v_target.id::text,
      jsonb_build_object(
        'email', v_target.email,
        'role', v_target.role::text
      ),
      'edge',
      'superadmin'
    );

    v_message := case
      when p_active then 'Team member access restored.'
      else 'Team member access suspended.'
    end;

  else
    raise exception using
      errcode = '22023',
      message = 'Unsupported team action';
  end if;

  return jsonb_build_object(
    'success', true,
    'message', v_message,
    'role', case when p_action = 'update-role' then p_role else v_target.role::text end,
    'active', case when p_action = 'set-status' then p_active else v_target.staff_active end
  );
end;
$$;

revoke all on function public.mutate_team_member(uuid, uuid, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.mutate_team_member(uuid, uuid, text, text, boolean)
  to service_role;

-- Prompt PostgREST to pick up the newly restored RPC immediately.
notify pgrst, 'reload schema';
