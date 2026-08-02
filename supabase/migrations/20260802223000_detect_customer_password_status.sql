create or replace function private.current_user_has_password()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users
    where id = (select auth.uid())
      and encrypted_password is not null
      and encrypted_password <> ''
  );
$$;

revoke all on function private.current_user_has_password() from public, anon;
grant execute on function private.current_user_has_password() to authenticated;

create or replace function public.current_user_has_password()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.current_user_has_password();
$$;

revoke all on function public.current_user_has_password() from public, anon;
grant execute on function public.current_user_has_password() to authenticated;
