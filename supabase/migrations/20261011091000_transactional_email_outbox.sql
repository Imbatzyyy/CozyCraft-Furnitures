-- Durable event snapshots: committed business changes enqueue exactly once.
-- No historical notifications are backfilled by this migration.
alter table public.email_delivery_logs drop constraint email_delivery_logs_status_check;
alter table public.email_delivery_logs add constraint email_delivery_logs_status_check
  check(status in ('queued','sending','sent','failed','skipped'));
create table private.transactional_email_jobs (
  id uuid primary key references public.email_delivery_logs(id) on delete cascade,
  event_key text not null unique,
  payload jsonb not null,
  attempts integer not null default 0,
  first_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  locked_at timestamptz
);
create table private.transactional_email_worker_lease (
  id boolean primary key default true check(id), lease_id uuid, locked_until timestamptz
);
create index transactional_email_due_idx on private.transactional_email_jobs(next_attempt_at,id);
create index email_delivery_pending_idx on public.email_delivery_logs(status,id) where status in ('queued','sending');
insert into private.transactional_email_worker_lease(id) values(true);
revoke all on private.transactional_email_jobs,private.transactional_email_worker_lease from public,anon,authenticated;

create or replace function private.invoke_transactional_email_worker() returns bigint
language plpgsql security definer set search_path='' as $$
declare target text; secret text; request_id bigint;
begin
  if not exists(select 1 from private.transactional_email_jobs q join public.email_delivery_logs l on l.id=q.id
    where l.status='queued' and q.next_attempt_at<=now() or l.status='sending' and q.locked_at<now()-interval '3 minutes') then return null; end if;
  if not public.reserve_security_budget('transactional:dispatch',1,3) then return null; end if;
  select decrypted_secret into target from vault.decrypted_secrets where name in ('cozycraft_project_url','supabase_url') order by name limit 1;
  select decrypted_secret into secret from vault.decrypted_secrets where name in ('cozycraft_service_role_key','service_role_key') order by name limit 1;
  if target is null or secret is null then return null; end if;
  select net.http_post(url:=rtrim(target,'/')||'/functions/v1/transactional-email-worker',
    headers:=jsonb_build_object('Content-Type','application/json','apikey',secret),body:='{}'::jsonb,timeout_milliseconds:=100000) into request_id;
  return request_id;
end $$;
revoke all on function private.invoke_transactional_email_worker() from public,anon,authenticated;

create or replace function private.enqueue_transactional_email(p_event text,p_entity uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  o public.orders%rowtype; t public.support_tickets%rowtype; customer public.profiles%rowtype;
  template public.email_templates%rowtype; settings public.store_settings%rowtype;
  vars jsonb; setting_key text; entity_type text:='order'; version text; v_event_key text;
  log_id uuid; delivery_status text; disabled boolean;
begin
  if p_event not in ('order_confirmation','payment_received','fulfillment_update','delivered','cancelled_refunded','support_reply') then raise exception 'Unsupported email event'; end if;
  if p_event='support_reply' then
    select * into t from public.support_tickets where id=p_entity;
    if not found or nullif(trim(t.admin_reply),'') is null then raise exception 'Save a support reply first'; end if;
    select * into customer from public.profiles where id=t.user_id;
    entity_type:='support_ticket'; version:=md5(t.admin_reply);
    vars:=jsonb_build_object('ticket_number',t.ticket_number);
  else
    select * into o from public.orders where id=p_entity;
    if not found then raise exception 'Order not found'; end if;
    if p_event='payment_received' and o.payment_status<>'paid' then raise exception 'Payment not confirmed'; end if;
    if p_event='delivered' and o.status<>'delivered' then raise exception 'Order not delivered'; end if;
    if p_event='cancelled_refunded' and o.status<>'cancelled' then raise exception 'Order not cancelled'; end if;
    if p_event='fulfillment_update' and o.status not in ('processing','packed','shipped') then raise exception 'No fulfillment update'; end if;
    select * into customer from public.profiles where id=o.user_id;
    version:=case when p_event='fulfillment_update' then o.status::text when p_event='cancelled_refunded' then coalesce(o.refund_status,'cancelled') else 'once' end;
    vars:=jsonb_build_object('order_number',o.order_number,'status',replace(o.status::text,'_',' '),'refund_status',replace(coalesce(o.refund_status,o.payment_status::text),'_',' '));
  end if;
  v_event_key:=p_event||':'||p_entity::text||':'||version;
  -- Serializes duplicate browser calls and transaction-trigger retries.
  perform pg_advisory_xact_lock(hashtextextended(v_event_key,0));
  select id into log_id from private.transactional_email_jobs q where q.event_key=v_event_key;
  if found then return log_id; end if;
  select * into settings from public.store_settings where id=true;
  select * into template from public.email_templates where event_type=p_event;
  setting_key:=case p_event when 'fulfillment_update' then 'fulfillment_updates' when 'support_reply' then 'support_replies' else p_event end;
  disabled:=coalesce(settings.email_event_settings->>setting_key,'true')='false' or template.enabled=false;
  delivery_status:=case when disabled then 'skipped' when template.event_type is null or coalesce(customer.email,'') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then 'failed' else 'queued' end;
  insert into public.email_delivery_logs(event_type,entity_type,entity_id,recipient,status,error_message,sent_by)
  values(p_event,entity_type,p_entity::text,coalesce(customer.email,''),delivery_status,
    case when disabled then 'Disabled in administrator settings' when delivery_status='failed' then 'Email address or template unavailable; review required' end,auth.uid()) returning id into log_id;
  insert into private.transactional_email_jobs(id,event_key,payload) values(log_id,v_event_key,jsonb_build_object(
    'recipient',customer.email,'recipientName',coalesce(nullif(customer.full_name,''),'there'),'eventType',p_event,
    'subject',template.subject_template,'heading',template.heading,'body',template.body_template,'variables',vars,
    'storeName',coalesce(settings.store_name,'CozyCraft Furnitures'),'replyTo',settings.contact_email));
  return log_id;
end $$;
revoke all on function private.enqueue_transactional_email(text,uuid) from public,anon,authenticated;

create or replace function private.queue_order_transactional_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then perform private.enqueue_transactional_email('order_confirmation',new.id);
  else
    if new.payment_status='paid' and old.payment_status is distinct from new.payment_status
      and not(lower(new.payment_method)='cod' and new.status='delivered') then
      perform private.enqueue_transactional_email('payment_received',new.id);
    end if;
    if new.status is distinct from old.status then
      if new.status='delivered' then perform private.enqueue_transactional_email('delivered',new.id);
      elsif new.status='cancelled' then perform private.enqueue_transactional_email('cancelled_refunded',new.id);
      elsif new.status in ('processing','packed','shipped') and not(new.payment_status='paid' and old.payment_status is distinct from new.payment_status) then
        perform private.enqueue_transactional_email('fulfillment_update',new.id);
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger queue_order_transactional_email after insert or update of status,payment_status on public.orders
for each row execute function private.queue_order_transactional_email();
create or replace function private.queue_support_transactional_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if nullif(trim(new.admin_reply),'') is not null and new.admin_reply is distinct from old.admin_reply then
    perform private.enqueue_transactional_email('support_reply',new.id);
  end if;
  return new;
end $$;
create trigger queue_support_transactional_email after update of admin_reply on public.support_tickets
for each row execute function private.queue_support_transactional_email();
revoke all on function private.queue_order_transactional_email(),private.queue_support_transactional_email() from public,anon,authenticated;

-- Compatibility for existing website/mobile callers. Database events, not the
-- caller, decide recipient, content, and the idempotency key.
create or replace function public.request_transactional_email(p_event text,p_entity uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job uuid;
begin
  if not public.security_action_allowed() then raise exception 'Verified session required' using errcode='42501'; end if;
  if not private.is_staff() then
    if p_event not in ('order_confirmation','payment_received') or not exists(select 1 from public.orders where id=p_entity and user_id=auth.uid()) then
      raise exception 'Access denied' using errcode='42501';
    end if;
  end if;
  job:=private.enqueue_transactional_email(p_event,p_entity);
  return (select jsonb_build_object('id',id,'status',status,'queued',status in ('queued','sending'),'sent',status='sent','skipped',status='skipped') from public.email_delivery_logs where id=job);
end $$;
revoke all on function public.request_transactional_email(text,uuid) from public,anon;
grant execute on function public.request_transactional_email(text,uuid) to authenticated;

create or replace function public.claim_transactional_emails() returns jsonb
language plpgsql security definer set search_path='' as $$
declare batch uuid:=gen_random_uuid(); job record; jobs jsonb:='[]';
begin
  update private.transactional_email_worker_lease set lease_id=batch,locked_until=now()+interval '3 minutes'
  where id and (locked_until is null or locked_until<now());
  if not found then return jsonb_build_object('jobs','[]'::jsonb); end if;
  update public.email_delivery_logs l set status='failed',error_message='Retry window ended; review delivery before resending'
  from private.transactional_email_jobs q where l.id=q.id and l.status in ('queued','sending')
    and (q.attempts>=8 or q.first_attempt_at<now()-interval '23 hours')
    and (l.status='queued' or q.locked_at<now()-interval '3 minutes');
  for job in select q.* from private.transactional_email_jobs q join public.email_delivery_logs l on l.id=q.id
    where (l.status='queued' and q.next_attempt_at<=now()) or (l.status='sending' and q.locked_at<now()-interval '3 minutes')
    order by q.next_attempt_at,q.id for update of q skip locked limit 5
  loop
    if not public.reserve_security_budget('transactional:global',1000,86400) then exit; end if;
    update private.transactional_email_jobs set attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),lease_id=batch,locked_at=now() where id=job.id;
    update public.email_delivery_logs set status='sending',error_message=null where id=job.id;
    jobs:=jobs||jsonb_build_array(jsonb_build_object('id',job.id,'payload',job.payload,'attempts',job.attempts+1));
  end loop;
  return jsonb_build_object('lease',batch,'jobs',jobs);
end $$;
create or replace function public.finish_transactional_email(p_id uuid,p_lease uuid,p_provider text default null,p_error text default null,p_permanent boolean default false) returns boolean
language plpgsql security definer set search_path='' as $$
declare attempt integer;
begin
  select attempts into attempt from private.transactional_email_jobs where id=p_id and lease_id=p_lease for update;
  if not found then return false; end if;
  update public.email_delivery_logs set status=case when p_provider is not null then 'sent' when p_permanent or attempt>=8 then 'failed' else 'queued' end,
    provider_message_id=p_provider,error_message=left(p_error,300) where id=p_id and status='sending';
  if not found then return false; end if;
  update private.transactional_email_jobs set next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,attempt)::integer)),locked_at=null where id=p_id;
  return true;
end $$;
create or replace function public.finish_transactional_email_batch(p_lease uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  update private.transactional_email_worker_lease set locked_until=null where id and lease_id=p_lease;
  perform private.invoke_transactional_email_worker();
end $$;
revoke all on function public.claim_transactional_emails(),public.finish_transactional_email(uuid,uuid,text,text,boolean),public.finish_transactional_email_batch(uuid) from public,anon,authenticated;
grant execute on function public.claim_transactional_emails(),public.finish_transactional_email(uuid,uuid,text,text,boolean),public.finish_transactional_email_batch(uuid) to service_role;

create or replace function private.dispatch_transactional_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform private.invoke_transactional_email_worker();
  return new;
exception when others then
  raise warning 'Immediate email dispatch unavailable; durable queue retained for cron';
  return new;
end $$;
revoke all on function private.dispatch_transactional_email() from public,anon,authenticated;
create trigger dispatch_transactional_email after insert on private.transactional_email_jobs
for each statement execute function private.dispatch_transactional_email();
select cron.schedule('cozycraft-transactional-emails','* * * * *','select private.invoke_transactional_email_worker()');
notify pgrst,'reload schema';
