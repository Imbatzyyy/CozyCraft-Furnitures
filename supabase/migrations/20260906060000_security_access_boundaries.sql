-- Authorization is enforced at the database boundary, not only in the UI.
create or replace function private.customer_session_allowed()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.sessions s
    where s.id::text = (select auth.jwt()->>'session_id')
      and s.user_id = (select auth.uid())
      and (s.not_after is null or s.not_after > now())
      and exists(select 1 from public.profiles p where p.id=s.user_id and
        case when p.role::text in ('staff','admin','superadmin') then p.staff_active
          else coalesce(p.customer_active,true) end)
      and not exists (
        select 1 from public.customer_device_sessions d
        where d.session_id = s.id and d.user_id = s.user_id and d.revoked_at is not null
      )
  );
$$;

-- A genuine Auth session may predate device registration. A missing Auth
-- session, however, is never accepted. This avoids a login-registration race.
create table private.admin_session_activity(session_id uuid primary key,last_active timestamptz not null);
-- Existing sessions get one transition window at release, not a permanent bypass.
insert into private.admin_session_activity select s.id,now() from auth.sessions s
join public.profiles p on p.id=s.user_id where p.role::text in ('staff','admin','superadmin');
revoke all on private.admin_session_activity from public,anon,authenticated;
create or replace function private.admin_session_recent()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.sessions s left join private.admin_session_activity a on a.session_id=s.id
    where s.id::text=auth.jwt()->>'session_id' and s.user_id=auth.uid()
    and coalesce(a.last_active,s.created_at)>now()-make_interval(mins=>coalesce(
      (select session_timeout_minutes from public.admin_security_settings where id=true),30)));
$$;
revoke all on function private.admin_session_recent() from public,anon;
grant execute on function private.admin_session_recent() to authenticated;
create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.customer_session_allowed() and private.admin_mfa_satisfied() and private.admin_session_recent()
    and exists(select 1 from public.profiles where id=auth.uid()
      and role::text in ('staff','admin','superadmin') and staff_active);
$$;
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.customer_session_allowed() and private.admin_mfa_satisfied() and private.admin_session_recent()
    and exists(select 1 from public.profiles where id=auth.uid()
      and role::text in ('admin','superadmin') and staff_active);
$$;
create or replace function private.is_superadmin()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.customer_session_allowed() and private.admin_mfa_satisfied() and private.admin_session_recent()
    and exists(select 1 from public.profiles where id=auth.uid()
      and role::text='superadmin' and staff_active);
$$;

-- Called with the caller's bearer token by elevated Edge Functions before
-- any service-role operation. Never accepts a user ID supplied in the body.
create or replace function public.security_action_allowed()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.customer_session_allowed() and exists (
    select 1 from public.profiles p where p.id=auth.uid() and
      case when p.role::text in ('staff','admin','superadmin')
        then p.staff_active and private.admin_mfa_satisfied() and private.admin_session_recent()
        else coalesce(p.customer_active,true) and private.customer_mfa_satisfied() end
  );
$$;
revoke all on function public.security_action_allowed() from public,anon;
grant execute on function public.security_action_allowed() to authenticated;

create or replace function public.touch_admin_security_session()
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then return false; end if;
  insert into private.admin_session_activity values ((auth.jwt()->>'session_id')::uuid,now())
  on conflict(session_id) do update set last_active=now()
  where admin_session_activity.last_active<now()-interval '1 minute';
  return true;
end;
$$;
revoke all on function public.touch_admin_security_session() from public,anon;
grant execute on function public.touch_admin_security_session() to authenticated;

-- Device management must not be usable by an already-revoked bearer token.
do $migration$
declare signature text; definition text; protected text;
begin
  foreach signature in array array[
    'public.touch_customer_device_session(uuid,text,text)',
    'public.revoke_customer_device_session(uuid)',
    'public.revoke_other_customer_sessions()'
  ] loop
    if to_regprocedure(signature) is null then continue; end if;
    definition := pg_get_functiondef(to_regprocedure(signature));
    protected := regexp_replace(definition, '(?in)^begin\s*$',
      'begin
      if not private.customer_session_allowed() then
        raise exception ''The session has expired.'' using errcode = ''42501'';
      end if;');
    if protected=definition then raise exception 'Could not guard %',signature; end if;
    execute protected;
  end loop;
  if to_regprocedure('public.list_customer_device_sessions()') is not null then
    definition := pg_get_functiondef('public.list_customer_device_sessions()'::regprocedure);
    protected := replace(definition,'where sessions.user_id',
      'where public.security_action_allowed() and sessions.user_id');
    if protected=definition then raise exception 'Could not guard device listing'; end if;
    execute protected;
  end if;
end;
$migration$;

-- Own profile reads remain available to complete MFA. Mutations do not.
create policy profiles_security_read on public.profiles as restrictive
  for select to authenticated using ((select private.customer_session_allowed()));
create policy profiles_security_update on public.profiles as restrictive
  for update to authenticated using ((select public.security_action_allowed()))
  with check ((select public.security_action_allowed()));

-- Close the smaller account-scoped tables that predate the shared MFA policy.
do $$ declare t text; begin
  foreach t in array array['admin_notification_reads','mobile_assistant_feedback','product_views','search_events'] loop
    if to_regclass('public.'||t) is not null then
      execute format('create policy account_security_boundary on public.%I as restrictive for all to authenticated using ((select public.security_action_allowed())) with check ((select public.security_action_allowed()))',t);
    end if;
  end loop;
end $$;

-- Compact, serialized abuse budgets. Service-only; no IPs/emails are stored.
create table private.security_request_budgets (
  key text primary key, window_start timestamptz not null, uses integer not null
);
revoke all on private.security_request_budgets from public,anon,authenticated;
create or replace function public.reserve_security_budget(p_key text,p_limit integer,p_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uses integer;
begin
  if p_limit not between 1 and 10000 or p_seconds not between 1 and 86400
    or length(p_key) not between 1 and 180 then return false; end if;
  insert into private.security_request_budgets as b(key,window_start,uses)
  values(p_key,now(),1)
  on conflict(key) do update set
    uses=case when b.window_start <= now()-make_interval(secs=>p_seconds) then 1 else b.uses+1 end,
    window_start=case when b.window_start <= now()-make_interval(secs=>p_seconds) then now() else b.window_start end
  where b.window_start <= now()-make_interval(secs=>p_seconds) or b.uses<p_limit
  returning uses into v_uses;
  return v_uses is not null;
end;
$$;
revoke all on function public.reserve_security_budget(text,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_security_budget(text,integer,integer) to service_role;

notify pgrst,'reload schema';
