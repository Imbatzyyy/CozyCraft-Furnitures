create table public.return_requests (
  id uuid primary key default gen_random_uuid(),
  return_number text not null unique default ('RT-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  reason text not null,
  details text not null,
  evidence_paths text[] not null default '{}',
  status text not null default 'requested' check (status in ('requested','approved','rejected','item_received','refund_processing','refunded','closed')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index return_requests_user_created_idx on public.return_requests(user_id, created_at desc);
create index return_requests_status_created_idx on public.return_requests(status, created_at desc);
create trigger return_requests_updated_at before update on public.return_requests
for each row execute function private.set_updated_at();

alter table public.return_requests enable row level security;
create policy "returns_own_or_staff_select" on public.return_requests for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_staff()));
create policy "returns_delivered_order_insert" on public.return_requests for insert to authenticated
with check (
  user_id = (select auth.uid()) and
  exists (select 1 from public.orders where orders.id = order_id and orders.user_id = (select auth.uid()) and orders.status = 'delivered')
);
create policy "returns_staff_update" on public.return_requests for update to authenticated
using ((select private.is_staff())) with check ((select private.is_staff()));

grant select, insert, update on public.return_requests to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('return-evidence', 'return-evidence', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "return_evidence_owner_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'return-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "return_evidence_owner_or_staff_read" on storage.objects for select to authenticated
using (bucket_id = 'return-evidence' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_staff())));

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='return_requests') then
    alter publication supabase_realtime add table public.return_requests;
  end if;
end $$;

create or replace function private.notify_return_change()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if tg_op='INSERT' then
    insert into public.customer_notifications(user_id,kind,title,message,entity_type,entity_id)
    values(new.user_id,'return_requested','Return request '||new.return_number||' received','We received your return request and will review it.','returns',new.id::text);
  elsif old.status is distinct from new.status then
    insert into public.customer_notifications(user_id,kind,title,message,entity_type,entity_id)
    values(new.user_id,'return_updated','Return '||new.return_number||' updated','Status: '||replace(new.status,'_',' ')||coalesce('. '||new.admin_note,''),'returns',new.id::text);
  end if;
  return new;
end $$;
create trigger notify_return_change after insert or update of status on public.return_requests
for each row execute function private.notify_return_change();
