-- Small, service-only retry queue. One due product per minute; no work when empty.
create table private.furniture_photo_index_queue (
  product_id text primary key references public.products(id) on delete cascade,
  image_key jsonb not null,
  attempts integer not null default 0,
  next_at timestamptz not null default now()
);
revoke all on private.furniture_photo_index_queue from public,anon,authenticated;
create index furniture_photo_index_due on private.furniture_photo_index_queue(next_at) where attempts<6;

create function private.furniture_photo_key(images jsonb, main integer) returns jsonb language sql immutable set search_path='' as $$
  with primary_image as (select images -> greatest(0,least(coalesce(main,0),jsonb_array_length(images)-1)) as photo),
  chosen as (select photo,0 as position from primary_image where photo is not null
    union all select e.value,e.ordinality::integer from jsonb_array_elements(images) with ordinality e,primary_image p where e.value<>p.photo),
  first_two as (select photo from chosen order by position limit 2)
  select coalesce(jsonb_agg(photo),'[]'::jsonb) from first_two
$$;
revoke all on function private.furniture_photo_key(jsonb,integer) from public,anon,authenticated;

create function private.enqueue_furniture_photos() returns trigger language plpgsql security definer set search_path='' as $$
declare k jsonb;
begin
  if new.status<>'active' then delete from private.furniture_photo_index_queue where product_id=new.id; return new; end if;
  k:=private.furniture_photo_key(coalesce(to_jsonb(new.images),'[]'),new.main_image_index);
  if jsonb_array_length(k)=0 then return new; end if;
  if exists(select 1 from public.product_visual_profiles where product_id=new.id and version=2 and image_key::jsonb=k) then return new; end if;
  insert into private.furniture_photo_index_queue(product_id,image_key) values(new.id,k)
  on conflict(product_id) do update set image_key=excluded.image_key,attempts=0,next_at=now();
  return new;
end $$;
revoke all on function private.enqueue_furniture_photos() from public,anon,authenticated;
create trigger enqueue_furniture_photos after insert or update of images,main_image_index,status on public.products for each row execute function private.enqueue_furniture_photos();

create function public.finish_furniture_photo_index(p_product text,p_image_key text,p_success boolean,p_retry_seconds integer default 600)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_success then
    delete from private.furniture_photo_index_queue where product_id=p_product and image_key=p_image_key::jsonb;
  else
    update private.furniture_photo_index_queue set next_at=now()+make_interval(secs=>greatest(60,least(coalesce(p_retry_seconds,600),21600))) where product_id=p_product and image_key=p_image_key::jsonb;
  end if;
end $$;
revoke all on function public.finish_furniture_photo_index(text,text,boolean,integer) from public,anon,authenticated;
grant execute on function public.finish_furniture_photo_index(text,text,boolean,integer) to service_role;

create function private.invoke_furniture_photo_index() returns bigint language plpgsql security definer set search_path='' as $$
declare selected text; project_url text; service_key text; request_id bigint;
begin
  -- Failed provider attempts cannot keep retrying indefinitely or exceed the daily guard.
  if exists(select 1 from private.discovery_request_budgets where bucket='index:'||(now() at time zone 'UTC')::date::text and requests>=115) then return null; end if;
  select product_id into selected from private.furniture_photo_index_queue where attempts<6 and next_at<=now() order by next_at,product_id for update skip locked limit 1;
  if selected is null then return null; end if;
  select decrypted_secret into project_url from vault.decrypted_secrets where name in ('cozycraft_project_url','supabase_url') order by case name when 'cozycraft_project_url' then 0 else 1 end limit 1;
  select decrypted_secret into service_key from vault.decrypted_secrets where name in ('cozycraft_service_role_key','service_role_key') order by case name when 'cozycraft_service_role_key' then 0 else 1 end limit 1;
  if project_url is null or service_key is null then return null; end if;
  update private.furniture_photo_index_queue set attempts=attempts+1,next_at=now()+interval '10 minutes' where product_id=selected;
  select net.http_post(url:=rtrim(project_url,'/')||'/functions/v1/furniture-discovery',headers:=jsonb_build_object('Content-Type','application/json','apikey',service_key),body:=jsonb_build_object('action','index','productId',selected),timeout_milliseconds:=55000) into request_id;
  return request_id;
end $$;
revoke all on function private.invoke_furniture_photo_index() from public,anon,authenticated;

insert into private.furniture_photo_index_queue(product_id,image_key)
select p.id,private.furniture_photo_key(coalesce(to_jsonb(p.images),'[]'),p.main_image_index) from public.products p
where p.status='active' and jsonb_array_length(coalesce(to_jsonb(p.images),'[]'))>0
and not exists(select 1 from public.product_visual_profiles v where v.product_id=p.id and v.version=2 and v.image_key::jsonb=private.furniture_photo_key(coalesce(to_jsonb(p.images),'[]'),p.main_image_index));
select cron.schedule('cozycraft-furniture-photo-index','* * * * *','select private.invoke_furniture_photo_index()');
