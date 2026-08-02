update public.profiles set username = ''
where username <> ''
  and (
    username <> trim(username)
    or not (
    length(trim(username)) between 3 and 24
    and trim(username) ~ '^[A-Za-z0-9._-]+$'
    )
  );

alter table public.profiles drop constraint if exists profiles_username_format_check;
alter table public.profiles add constraint profiles_username_format_check
check (
  username = ''
  or (
    length(username) between 3 and 24
    and username ~ '^[A-Za-z0-9._-]+$'
  )
);

create or replace function private.normalize_profile_username()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.username := trim(new.username);
  return new;
end;
$$;

drop trigger if exists normalize_profile_username on public.profiles;
create trigger normalize_profile_username
before insert or update of username on public.profiles
for each row execute function private.normalize_profile_username();
