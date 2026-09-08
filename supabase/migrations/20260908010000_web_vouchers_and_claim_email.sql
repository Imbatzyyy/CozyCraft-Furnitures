-- Shared vouchers: retry-safe claims, atomic checkout and durable email delivery.
create index if not exists mobile_voucher_wallet_available on public.mobile_loyalty_redemptions(user_id,expires_at,id) where status='available';
create table public.home_circle_claim_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_key uuid not null,
  points integer not null,
  redemption_id uuid not null references public.mobile_loyalty_redemptions(id),
  created_at timestamptz not null default now(),
  primary key (user_id, request_key)
);
alter table public.home_circle_claim_requests enable row level security;
revoke all on public.home_circle_claim_requests from anon, authenticated;

create or replace function public.claim_home_circle_reward(p_points integer, p_request_key uuid)
returns public.mobile_loyalty_redemptions language plpgsql security definer
set search_path = pg_catalog, public, private as $$
declare v_user uuid := auth.uid(); v_request public.home_circle_claim_requests; v_reward public.mobile_loyalty_redemptions;
begin
  if v_user is null or not coalesce(public.security_action_allowed(), false) then raise exception 'Please sign in and complete account verification'; end if;
  if p_request_key is null or p_points is null or p_points not in (100,250,500) then raise exception 'Choose a valid reward'; end if;
  perform pg_advisory_xact_lock(hashtextextended('circle-claim:' || v_user::text, 0));
  select * into v_request from public.home_circle_claim_requests where user_id=v_user and request_key=p_request_key;
  if found then
    if v_request.points <> p_points then raise exception 'This claim key belongs to a different reward'; end if;
    select * into v_reward from public.mobile_loyalty_redemptions where id=v_request.redemption_id and user_id=v_user;
    return v_reward;
  end if;
  if not exists(select 1 from auth.users where id=v_user and email is not null and email_confirmed_at is not null) then raise exception 'Verify your account email before claiming a voucher'; end if;
  select * into v_reward from public.redeem_mobile_points(p_points);
  insert into public.home_circle_claim_requests(user_id,request_key,points,redemption_id) values(v_user,p_request_key,p_points,v_reward.id);
  return v_reward;
end; $$;
revoke all on function public.claim_home_circle_reward(integer,uuid) from public, anon;
grant execute on function public.claim_home_circle_reward(integer,uuid) to authenticated;

create table private.web_reward_checkout_intents (
  user_id uuid not null references auth.users(id) on delete cascade,
  checkout_key uuid not null,
  intent jsonb not null,
  primary key(user_id,checkout_key)
);
alter table private.web_reward_checkout_intents enable row level security;
revoke all on private.web_reward_checkout_intents from public,anon,authenticated;

create or replace function public.place_order_with_reward(p_address_id uuid, p_payment_method text, p_items jsonb, p_checkout_key uuid, p_redemption_id uuid default null)
returns uuid language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare v_user uuid := auth.uid(); v_id uuid; v_order public.orders; v_existing jsonb;
  v_intent jsonb := jsonb_build_object('address',p_address_id,'payment',p_payment_method,'items',p_items,'voucher',p_redemption_id);
begin
  if v_user is null or not coalesce(public.security_action_allowed(), false) then raise exception 'Please sign in and complete account verification'; end if;
  if p_checkout_key is null then raise exception 'Checkout key is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('circle-checkout:' || v_user::text || ':' || p_checkout_key::text,0));
  select intent into v_existing from private.web_reward_checkout_intents where user_id=v_user and checkout_key=p_checkout_key;
  if found and v_existing is distinct from v_intent then raise exception 'This checkout key belongs to a different order'; end if;
  insert into private.web_reward_checkout_intents(user_id,checkout_key,intent) values(v_user,p_checkout_key,v_intent) on conflict do nothing;
  v_id := public.place_order(p_address_id,p_payment_method,p_items,p_checkout_key);
  select * into v_order from public.orders where id=v_id and user_id=v_user for update;
  if v_order.home_circle_redemption_id is not null and v_order.home_circle_redemption_id is distinct from p_redemption_id then raise exception 'This checkout already uses a different voucher'; end if;
  if p_redemption_id is not null then
    if v_order.home_circle_redemption_id is null and exists(select 1 from public.payment_transactions where order_id=v_id) then raise exception 'Payment has already started for this order'; end if;
    -- An invalid/expired/foreign/used voucher raises: the entire order, stock
    -- reservation and cart removal roll back together in this transaction.
    perform public.apply_mobile_reward_to_order(v_id,p_redemption_id);
  end if;
  return v_id;
end; $$;
revoke all on function public.place_order_with_reward(uuid,text,jsonb,uuid,uuid) from public, anon;
grant execute on function public.place_order_with_reward(uuid,text,jsonb,uuid,uuid) to authenticated;

create table public.voucher_claim_emails (
  redemption_id uuid primary key references public.mobile_loyalty_redemptions(id) on delete cascade,
  recipient text not null,
  discount_amount numeric not null,
  points_cost integer not null,
  minimum_order_amount numeric not null,
  expires_at timestamptz not null,
  status text not null default 'queued' check(status in ('queued','sending','sent','failed')),
  attempts integer not null default 0,
  lease_id uuid,
  next_attempt_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  locked_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now()
);
alter table public.voucher_claim_emails enable row level security;
revoke all on public.voucher_claim_emails from anon, authenticated;
grant all on public.voucher_claim_emails to service_role;
create index voucher_claim_emails_pending on public.voucher_claim_emails(next_attempt_at) where status in ('queued','sending');

create or replace function private.queue_voucher_claim_email() returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.reward_source='points' and new.points_cost > 0 then
    insert into public.voucher_claim_emails(redemption_id,recipient,discount_amount,points_cost,minimum_order_amount,expires_at)
    select new.id,coalesce(email,''),new.discount_amount,new.points_cost,new.minimum_order_amount,new.expires_at from auth.users where id=new.user_id
    on conflict do nothing;
  end if;
  return new;
end; $$;
revoke all on function private.queue_voucher_claim_email() from public,anon,authenticated;
create trigger queue_voucher_claim_email after insert on public.mobile_loyalty_redemptions for each row execute function private.queue_voucher_claim_email();

create or replace function public.claim_voucher_emails() returns setof public.voucher_claim_emails language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  -- Never retry outside the provider's 24-hour deduplication window.
  update public.voucher_claim_emails set status='failed',error_message='Automatic retry window ended; delivery needs review'
  where status in ('queued','sending') and (attempts>=6 or first_attempt_at < now()-interval '23 hours')
    and (status='queued' or locked_at < now()-interval '10 minutes');
  return query
  update public.voucher_claim_emails q set status='sending',attempts=q.attempts+1,lease_id=gen_random_uuid(),locked_at=now(),first_attempt_at=coalesce(q.first_attempt_at,now())
  where q.redemption_id in (
    select redemption_id from public.voucher_claim_emails
    where attempts<6 and (first_attempt_at is null or first_attempt_at>=now()-interval '23 hours')
    and ((status='queued' and next_attempt_at<=now()) or (status='sending' and locked_at<now()-interval '10 minutes'))
    order by next_attempt_at for update skip locked limit 5
  ) returning q.*;
end; $$;
revoke all on function public.claim_voucher_emails() from public,anon,authenticated;
grant execute on function public.claim_voucher_emails() to service_role;

create or replace function private.invoke_voucher_email_worker() returns bigint language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_url text; v_key text; v_request bigint;
begin
  if not exists(select 1 from public.voucher_claim_emails where
    (status='queued' and next_attempt_at<=now()) or (status='sending' and locked_at<now()-interval '10 minutes')) then return null; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name in ('cozycraft_project_url','supabase_url') order by case name when 'cozycraft_project_url' then 0 else 1 end limit 1;
  select decrypted_secret into v_key from vault.decrypted_secrets where name in ('cozycraft_service_role_key','service_role_key') order by case name when 'cozycraft_service_role_key' then 0 else 1 end limit 1;
  if v_url is null or v_key is null then raise warning 'Voucher email worker credentials are unavailable'; return null; end if;
  select net.http_post(url:=rtrim(v_url,'/')||'/functions/v1/voucher-email-worker',headers:=jsonb_build_object('Content-Type','application/json','apikey',v_key),body:='{}'::jsonb,timeout_milliseconds:=45000) into v_request;
  return v_request;
end; $$;
revoke all on function private.invoke_voucher_email_worker() from public,anon,authenticated;
select cron.schedule('cozycraft-voucher-claim-emails','* * * * *','select private.invoke_voucher_email_worker()');
