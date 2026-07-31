alter table public.profiles
  add column if not exists staff_active boolean not null default true;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role::text in ('staff', 'admin', 'superadmin')
      and staff_active
  );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role::text in ('admin', 'superadmin')
      and staff_active
  );
$$;

create or replace function private.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role::text = 'superadmin'
      and staff_active
  );
$$;

revoke all on function private.is_staff() from public;
revoke all on function private.is_admin() from public;
revoke all on function private.is_superadmin() from public;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_superadmin() to authenticated;

create index if not exists profiles_team_access_idx
  on public.profiles (role, staff_active);

create or replace function private.protect_team_access_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if (select auth.uid()) is not null
     and not (select private.is_superadmin())
     and (
       new.role is distinct from old.role
       or new.staff_active is distinct from old.staff_active
     ) then
    raise exception 'Only a super administrator can change team access.';
  end if;
  return new;
end;
$$;

revoke all on function private.protect_team_access_fields() from public;

drop trigger if exists protect_team_access_fields on public.profiles;
create trigger protect_team_access_fields
before update on public.profiles
for each row execute function private.protect_team_access_fields();
