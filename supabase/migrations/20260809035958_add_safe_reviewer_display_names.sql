alter table public.reviews
  add column reviewer_display_name text;

update public.reviews as review
set reviewer_display_name = coalesce(
  nullif(btrim(profile.username), ''),
  nullif(split_part(btrim(profile.full_name), ' ', 1), ''),
  'CozyCraft customer'
)
from public.profiles as profile
where profile.id = review.user_id;

update public.reviews
set reviewer_display_name = 'CozyCraft customer'
where reviewer_display_name is null or btrim(reviewer_display_name) = '';

alter table public.reviews
  alter column reviewer_display_name set default 'CozyCraft customer',
  alter column reviewer_display_name set not null,
  add constraint reviews_reviewer_display_name_length
    check (char_length(reviewer_display_name) between 1 and 60);

create or replace function private.set_review_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select coalesce(
    nullif(btrim(profile.username), ''),
    nullif(split_part(btrim(profile.full_name), ' ', 1), ''),
    'CozyCraft customer'
  )
  into new.reviewer_display_name
  from public.profiles as profile
  where profile.id = new.user_id;

  new.reviewer_display_name := coalesce(
    nullif(btrim(new.reviewer_display_name), ''),
    'CozyCraft customer'
  );
  return new;
end;
$$;

revoke all on function private.set_review_display_name() from public, anon, authenticated;

create trigger set_review_display_name_before_write
before insert or update of user_id on public.reviews
for each row execute function private.set_review_display_name();

comment on column public.reviews.reviewer_display_name is
  'Public-safe reviewer label copied from username, or first name when no username exists.';
