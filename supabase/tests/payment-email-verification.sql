-- No emails or orders are sent; all fixture changes are rolled back.
begin;
do $$
declare u uuid; c uuid:=gen_random_uuid(); k uuid:=gen_random_uuid(); r jsonb;
begin
  select id into u from auth.users where email_confirmed_at is not null limit 1;
  if u is null then raise exception 'No test account available'; end if;
  perform set_config('request.jwt.claim.sub',u::text,true);
  update public.mobile_payment_email_challenges set status='expired' where user_id=u and status in ('sent','pending','verified');
  insert into public.mobile_payment_email_challenges(id,user_id,email,checkout_key,payment_method,intent_digest,code_digest,status,expires_at)
  values(c,u,'qa@example.invalid',k,'gcash',repeat('a',64),repeat('b',64),'sent',now()+interval '5 minutes');
  if public.mobile_payment_authorization_valid(c,k,'gcash',repeat('a',64)) then raise exception 'Unverified code accepted'; end if;
  r:=public.verify_mobile_payment_code(c,u,repeat('c',64));
  if r->>'outcome'<>'incorrect' or (r->>'attempts_remaining')::int<>4 then raise exception 'Wrong code attempt limit failed'; end if;
  r:=public.verify_mobile_payment_code(c,u,repeat('b',64));
  if r->>'outcome'<>'verified' then raise exception 'Correct code failed'; end if;
  if not public.mobile_payment_authorization_valid(c,k,'gcash',repeat('a',64)) then raise exception 'Verified code rejected'; end if;
  if public.mobile_payment_authorization_valid(c,k,'card',repeat('a',64)) or public.mobile_payment_authorization_valid(c,k,'gcash',repeat('d',64)) or public.mobile_payment_authorization_valid(c,gen_random_uuid(),'gcash',repeat('a',64)) then raise exception 'Changed checkout accepted'; end if;
  update public.mobile_payment_email_challenges set expires_at=now()-interval '1 second' where id=c;
  if public.mobile_payment_authorization_valid(c,k,'gcash',repeat('a',64)) then raise exception 'Expired authorization accepted'; end if;
  if has_table_privilege('authenticated','public.mobile_payment_email_challenges','select') or has_function_privilege('authenticated','public.verify_mobile_payment_code(uuid,uuid,text)','execute') then raise exception 'OTP secrets exposed'; end if;
end; $$;
select 'OTP verification, attempts, intent binding, expiry and grants passed; fixtures rolled back' as result;
rollback;
