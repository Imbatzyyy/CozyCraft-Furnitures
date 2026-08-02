alter table public.support_tickets
  add column category text not null default 'general',
  add column priority text not null default 'normal',
  add column assigned_to uuid references public.profiles(id) on delete set null,
  add column attachment_paths text[] not null default '{}'::text[];

alter table public.support_tickets
  add constraint support_tickets_category_check check (category in ('order','delivery','payment','product','return','account','general')),
  add constraint support_tickets_priority_check check (priority in ('low','normal','high','urgent'));

create index support_tickets_status_priority_created_idx
  on public.support_tickets(status, priority, created_at desc);
create index support_tickets_assigned_to_idx
  on public.support_tickets(assigned_to) where assigned_to is not null;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('support-attachments','support-attachments',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;

create policy "support_attachments_customer_insert" on storage.objects for insert to authenticated
with check (bucket_id='support-attachments' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "support_attachments_owner_or_staff_read" on storage.objects for select to authenticated
using (bucket_id='support-attachments' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select private.is_staff())));

create or replace function private.notify_support_ticket_change()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if old.status is distinct from new.status or old.admin_reply is distinct from new.admin_reply then
    insert into public.customer_notifications(user_id,kind,title,message,entity_type,entity_id)
    values (new.user_id,'support','Support ticket updated',format('%s is now %s%s.',new.ticket_number,replace(new.status,'_',' '),case when new.admin_reply is distinct from old.admin_reply then ' with a new reply' else '' end),'support_tickets',new.id::text);
  end if;
  return new;
end $$;
create trigger notify_support_ticket_change after update on public.support_tickets
for each row execute function private.notify_support_ticket_change();
