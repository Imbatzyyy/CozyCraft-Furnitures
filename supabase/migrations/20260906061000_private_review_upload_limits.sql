-- Image bytes stay in Storage; public readers receive visibility-checked links.
update storage.buckets set public=false where id='review-images';
drop policy if exists review_images_public_read on storage.objects;
create policy review_images_private_read on storage.objects for select to authenticated
using (bucket_id='review-images' and (select public.security_action_allowed()) and
  ((storage.foldername(name))[1]=(select auth.uid())::text or (select private.is_staff())));

-- Serialize a user's uploads so parallel requests cannot bypass count limits.
-- Existing apps upload before creating the ticket/return, so those buckets use
-- a conservative per-account ceiling until a reservation-based upload flow is used.
create or replace function private.upload_allowed(p_bucket text,p_name text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_count integer;
begin
  if not public.security_action_allowed() or v_uid is null
    or split_part(p_name,'/',1) <> v_uid::text then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('upload:'||v_uid::text,0));
  select count(*) into v_count from storage.objects
    where bucket_id in ('review-images','support-attachments','return-evidence','avatars')
      and split_part(name,'/',1)=v_uid::text;
  if v_count>=200 then return false; end if;
  select count(*) into v_count from storage.objects
    where bucket_id=p_bucket and split_part(name,'/',1)=v_uid::text
      and created_at>now()-interval '1 day';
  if v_count>=20 then return false; end if;
  if p_bucket='review-images' then
    if not exists(select 1 from public.order_items oi join public.orders o on o.id=oi.order_id
      where oi.id::text=split_part(p_name,'/',2) and o.user_id=v_uid and o.status::text='delivered')
      then return false; end if;
    select count(*) into v_count from storage.objects where bucket_id=p_bucket
      and split_part(name,'/',1)=v_uid::text and split_part(name,'/',2)=split_part(p_name,'/',2);
    if v_count>=3 then return false; end if;
  end if;
  return true;
end;
$$;
revoke all on function private.upload_allowed(text,text) from public,anon;
grant execute on function private.upload_allowed(text,text) to authenticated;
create policy customer_upload_limits on storage.objects as restrictive for insert to authenticated
with check (bucket_id not in ('review-images','support-attachments','return-evidence','avatars')
  or private.upload_allowed(bucket_id,name));
create policy private_storage_security_select on storage.objects as restrictive for select to authenticated
using (bucket_id not in ('review-images','support-attachments','return-evidence','avatars')
  or (select public.security_action_allowed()));
create policy private_storage_security_update on storage.objects as restrictive for update to authenticated
using (bucket_id not in ('review-images','support-attachments','return-evidence','avatars')
  or (select public.security_action_allowed()))
with check (bucket_id not in ('review-images','support-attachments','return-evidence','avatars')
  or (select public.security_action_allowed()));

notify pgrst,'reload schema';
