-- Keep older storefront/mobile clients compatible with private image storage.
-- URLs remain displayable, but no longer point at an unprotected public bucket.
alter table public.reviews add column if not exists image_paths text[] not null default '{}';
create or replace function private.secure_review_photo_links()
returns trigger language plpgsql security definer set search_path = '' as $$
declare source text; path text; paths text[] := '{}'; links text[] := '{}'; i integer := 0;
begin
  if array_length(new.image_urls,1)>3 then raise exception 'At most three review photos are allowed.'; end if;
  foreach source in array coalesce(new.image_urls,'{}') loop
    if source like 'https://gwjsivqksyimuabbdyqq.supabase.co/functions/v1/review-photo?%' then
      if tg_op <> 'UPDATE' or new.image_urls is distinct from old.image_urls then
        raise exception 'Upload the review photo before attaching it.';
      end if;
      return new;
    end if;
    path := case when source like 'https://gwjsivqksyimuabbdyqq.supabase.co/storage/v1/object/public/review-images/%'
      then split_part(source,'/storage/v1/object/public/review-images/',2) else source end;
    if split_part(path,'/',1)<>new.user_id::text or path like '%..%' or position(chr(92) in path)>0 then
      raise exception 'Review photos must belong to the reviewer.';
    end if;
    -- Stored paths emitted by the upload SDK are plain owner/item/file paths.
    paths := array_append(paths,path);
    links := array_append(links,'https://gwjsivqksyimuabbdyqq.supabase.co/functions/v1/review-photo?review_id='||new.id::text||'&index='||i::text);
    i := i+1;
  end loop;
  new.image_paths := paths;
  new.image_urls := links;
  return new;
end;
$$;
revoke all on function private.secure_review_photo_links() from public,anon,authenticated;
create trigger secure_review_photo_links before insert or update of image_urls on public.reviews
for each row execute function private.secure_review_photo_links();
update public.reviews set image_urls=image_urls where cardinality(image_urls)>0;
notify pgrst,'reload schema';
