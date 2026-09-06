-- Trusted Edge Functions only. Serialize per customer and per destination
-- before purchasing an SMS; failed sends still count toward the hourly cap.
create or replace function public.reserve_phone_challenge(p_user uuid, p_phone text, p_id uuid, p_digest text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare latest timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('otp-user:' || p_user::text,0));
  perform pg_advisory_xact_lock(hashtextextended('otp-phone:' || p_phone,0));
  if not exists(select 1 from public.profiles where id=p_user and role='customer' and customer_active is distinct from false) then
    return jsonb_build_object('error','An active customer account is required.');
  end if;
  if exists(select 1 from public.profiles where phone=p_phone and phone_verified_at is not null and id<>p_user) then
    return jsonb_build_object('error','This number is already verified on another account.');
  end if;
  select max(created_at) into latest from public.phone_verification_challenges where user_id=p_user;
  if latest > now()-interval '60 seconds' then
    return jsonb_build_object('error','Please wait before requesting another code.','retryAfter',ceil(extract(epoch from latest+interval '60 seconds'-now())));
  end if;
  if (select count(*) from public.phone_verification_challenges where user_id=p_user and created_at>now()-interval '1 hour')>=5
    or (select count(*) from public.phone_verification_challenges where phone_e164=p_phone and created_at>now()-interval '1 hour')>=5 then
    return jsonb_build_object('error','Too many verification requests. Please try again in one hour.');
  end if;
  update public.phone_verification_challenges set status='expired' where user_id=p_user and status in ('pending','sent');
  insert into public.phone_verification_challenges(id,user_id,phone_e164,code_digest,expires_at)
    values(p_id,p_user,p_phone,p_digest,now()+interval '5 minutes');
  return jsonb_build_object('reserved',true);
end $$;
revoke all on function public.reserve_phone_challenge(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_phone_challenge(uuid,text,uuid,text) to service_role;

-- The attempt counter, profile update and challenge consumption commit together.
create or replace function public.consume_phone_challenge(p_user uuid,p_id uuid,p_digest text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.phone_verification_challenges%rowtype; verified timestamptz := now(); previous_phone text;
begin
  perform pg_advisory_xact_lock(hashtextextended('otp-user:' || p_user::text,0));
  select * into c from public.phone_verification_challenges where id=p_id and user_id=p_user for update;
  if not found or c.status<>'sent' or c.attempts>=5 or c.expires_at<=now() then
    return jsonb_build_object('error','This code is expired or no longer valid. Request a new code.');
  end if;
  if not exists(select 1 from public.profiles where id=p_user and role='customer' and customer_active is distinct from false) then
    return jsonb_build_object('error','An active customer account is required.');
  end if;
  if exists(select 1 from public.phone_verification_challenges where user_id=p_user and created_at>c.created_at and status in ('pending','sent')) then
    return jsonb_build_object('error','Use the newest verification code.');
  end if;
  if c.code_digest is distinct from p_digest then
    update public.phone_verification_challenges set attempts=attempts+1,
      status=case when attempts+1>=5 then 'locked' else 'sent' end where id=c.id;
    return jsonb_build_object('error','The verification code is incorrect.','attemptsRemaining',4-c.attempts);
  end if;
  select phone into previous_phone from public.profiles where id=p_user and phone_verified_at is not null;
  update public.profiles set phone=c.phone_e164,phone_verified_at=verified where id=p_user;
  update public.phone_verification_challenges set status='verified',verified_at=verified where id=c.id;
  update public.phone_verification_challenges set status='expired' where user_id=p_user and id<>c.id and status in ('pending','sent');
  insert into public.activity_logs(actor_id,action,entity_type,entity_id,details) values(p_user,
    case when previous_phone is not null and previous_phone<>c.phone_e164 then 'customer_phone_changed' else 'customer_phone_verified' end,
    'profile',p_user::text,jsonb_build_object('phone_masked',left(c.phone_e164,5)||'•••'||right(c.phone_e164,4),'provider','unisms'));
  return jsonb_build_object('status','verified','phone',c.phone_e164,'phoneVerifiedAt',verified);
exception when unique_violation then
  return jsonb_build_object('error','This mobile number is already verified on another account.');
end $$;
revoke all on function public.consume_phone_challenge(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.consume_phone_challenge(uuid,uuid,text) to service_role;

create table if not exists private.assistant_request_budgets (
  bucket text primary key, requests integer not null, expires_at timestamptz not null
);
alter table private.assistant_request_budgets enable row level security;
revoke all on private.assistant_request_budgets from public,anon,authenticated;
create index if not exists assistant_budget_expiry on private.assistant_request_budgets(expires_at);
create or replace function public.reserve_assistant_request(p_key text,p_authenticated boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare accepted integer; minute_key text := floor(extract(epoch from now())/60)::text;
begin
  if p_key is null or length(p_key)>150 then return false; end if;
  -- Bounded retention; no messages, addresses, or raw IPs are stored here.
  delete from private.assistant_request_budgets where bucket in
    (select bucket from private.assistant_request_budgets where expires_at<now() limit 100);
  insert into private.assistant_request_budgets as b values('caller:'||p_key||':'||minute_key,1,now()+interval '2 minutes')
    on conflict(bucket) do update set requests=b.requests+1
    where b.requests < case when p_authenticated then 45 else 30 end returning requests into accepted;
  if accepted is null then return false; end if;
  accepted := null;
  -- Shared daily ceiling bounds provider exposure even when guest identities vary.
  insert into private.assistant_request_budgets as b values('global:'||(now() at time zone 'UTC')::date::text,1,now()+interval '2 days')
    on conflict(bucket) do update set requests=b.requests+1 where b.requests<2000 returning requests into accepted;
  return accepted is not null;
end $$;
revoke all on function public.reserve_assistant_request(text,boolean) from public,anon,authenticated;
grant execute on function public.reserve_assistant_request(text,boolean) to service_role;

create or replace function public.admin_customer_page(p_page integer default 1, p_query text default '')
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if not private.is_staff() or not private.customer_mfa_satisfied() or not private.admin_mfa_satisfied() then
    raise exception 'Verified administrator session required' using errcode='42501';
  end if;
  return jsonb_build_object('total',(select count(*) from public.profiles where role='customer' and concat_ws(' ',full_name,username,email,phone) ilike '%'||left(coalesce(p_query,''),150)||'%'),
    'profiles',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object(
      'addresses',coalesce((select jsonb_agg(to_jsonb(a)) from (select * from public.addresses where user_id=p.id order by is_primary desc,id limit 1) a),'[]'::jsonb),
      'orders','[]'::jsonb,'support_tickets','[]'::jsonb,
      'order_count',(select count(*) from public.orders where user_id=p.id),
      'address_count',(select count(*) from public.addresses where user_id=p.id),
      'ticket_count',(select count(*) from public.support_tickets where user_id=p.id),
      'lifetime_value',(select coalesce(sum(total),0) from public.orders where user_id=p.id and payment_status='paid' and status<>'cancelled')
    ) order by p.created_at desc,p.id) from (
      select id,full_name,email,phone,avatar_url,username,gender,date_of_birth,preferred_payment_method,role,staff_active,customer_active,created_at
      from public.profiles where role='customer' and concat_ws(' ',full_name,username,email,phone) ilike '%'||left(coalesce(p_query,''),150)||'%' order by created_at desc,id limit 10 offset (greatest(1,least(coalesce(p_page,1),100000))-1)*10
    ) p),'[]'::jsonb));
end $$;
revoke all on function public.admin_customer_page(integer,text) from public,anon;
grant execute on function public.admin_customer_page(integer,text) to authenticated;
