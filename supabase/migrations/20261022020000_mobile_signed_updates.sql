-- Public, cacheable release artifacts; NEVER customer data or private signing keys.
-- Publishing is restricted to the backend/service role. App users (including
-- staff sessions) cannot alter packages, metadata, or channel pointers.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mobile-updates', 'mobile-updates', true, 67108864, array['application/zip', 'application/json'])
on conflict (id) do nothing;

create policy mobile_updates_no_client_insert on storage.objects
as restrictive for insert to anon, authenticated
with check (bucket_id <> 'mobile-updates');
create policy mobile_updates_no_client_update on storage.objects
as restrictive for update to anon, authenticated
using (bucket_id <> 'mobile-updates') with check (bucket_id <> 'mobile-updates');
create policy mobile_updates_no_client_delete on storage.objects
as restrictive for delete to anon, authenticated
using (bucket_id <> 'mobile-updates');
