alter table public.profiles
  add column if not exists username text not null default '',
  add column if not exists gender text not null default '',
  add column if not exists date_of_birth date,
  add column if not exists preferred_payment_method text not null default 'cod';

alter table public.profiles
  drop constraint if exists profiles_gender_check,
  add constraint profiles_gender_check
    check (gender in ('', 'Male', 'Female', 'Other')),
  drop constraint if exists profiles_preferred_payment_method_check,
  add constraint profiles_preferred_payment_method_check
    check (preferred_payment_method = 'cod');

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username <> '';

update public.profiles as profiles
set
  username = coalesce(users.raw_user_meta_data ->> 'username', profiles.username),
  gender = case
    when users.raw_user_meta_data ->> 'gender' in ('Male', 'Female', 'Other')
      then users.raw_user_meta_data ->> 'gender'
    else profiles.gender
  end,
  date_of_birth = case
    when coalesce(users.raw_user_meta_data ->> 'date_of_birth', '') ~ '^\d{4}-\d{2}-\d{2}$'
      then (users.raw_user_meta_data ->> 'date_of_birth')::date
    else profiles.date_of_birth
  end
from auth.users as users
where profiles.id = users.id;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    email,
    username,
    gender,
    date_of_birth,
    preferred_payment_method
  )
  values (
    new.id,
    trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')),
    new.email,
    trim(coalesce(new.raw_user_meta_data ->> 'username', '')),
    case
      when new.raw_user_meta_data ->> 'gender' in ('Male', 'Female', 'Other')
        then new.raw_user_meta_data ->> 'gender'
      else ''
    end,
    case
      when coalesce(new.raw_user_meta_data ->> 'date_of_birth', '') ~ '^\d{4}-\d{2}-\d{2}$'
        then (new.raw_user_meta_data ->> 'date_of_birth')::date
      else null
    end,
    'cod'
  );
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

grant update (
  full_name,
  phone,
  avatar_url,
  username,
  gender,
  date_of_birth,
  preferred_payment_method
) on public.profiles to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'addresses'
  ) then
    alter publication supabase_realtime add table public.addresses;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'support_tickets'
  ) then
    alter publication supabase_realtime add table public.support_tickets;
  end if;
end
$$;
