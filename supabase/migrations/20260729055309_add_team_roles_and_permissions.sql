alter type public.user_role add value if not exists 'superadmin';

alter table public.profiles
  add column if not exists email text;

update public.profiles as profiles
set email = users.email
from auth.users as users
where profiles.id = users.id
  and profiles.email is null;

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email))
  where email is not null;

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
  );
$$;

revoke all on function private.is_staff() from public;
revoke all on function private.is_admin() from public;
revoke all on function private.is_superadmin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_superadmin() to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')),
    new.email
  );
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

drop policy if exists "profiles_select_own_or_staff" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles for select
to authenticated
using (
  (select auth.uid()) = id
  or (select private.is_admin())
);

drop policy if exists "settings_staff_update" on public.store_settings;
create policy "settings_superadmin_update"
on public.store_settings for update
to authenticated
using ((select private.is_superadmin()))
with check ((select private.is_superadmin()));

drop policy if exists "activity_staff_read" on public.activity_logs;
create policy "activity_admin_read"
on public.activity_logs for select
to authenticated
using ((select private.is_admin()));
