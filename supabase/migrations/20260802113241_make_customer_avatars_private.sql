update storage.buckets
set public = false
where id = 'avatars';

drop policy if exists "avatars_public_read" on storage.objects;
drop policy if exists "avatars_owner_or_staff_read" on storage.objects;

create policy "avatars_owner_or_staff_read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.is_staff())
  )
);

-- Store object paths instead of permanent public URLs. The application turns
-- these paths into short-lived signed URLs after RLS authorizes the request.
update public.profiles
set avatar_url = split_part(
  avatar_url,
  '/storage/v1/object/public/avatars/',
  2
)
where avatar_url like '%/storage/v1/object/public/avatars/%';
