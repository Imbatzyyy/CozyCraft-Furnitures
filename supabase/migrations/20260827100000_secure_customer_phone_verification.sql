-- Phone numbers become trusted account data only after a server-verified SMS
-- challenge. OTPs and provider credentials are never readable by clients.

alter table public.profiles
  add column if not exists phone_verified_at timestamptz;

create unique index if not exists profiles_verified_phone_unique_idx
  on public.profiles (phone)
  where phone is not null and phone_verified_at is not null;

create table if not exists public.phone_verification_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  phone_e164 text not null check (phone_e164 ~ '^\+639[0-9]{9}$'),
  code_digest text not null,
  provider_reference text,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'verified', 'expired', 'locked')),
  attempts smallint not null default 0 check (attempts between 0 and 5),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  last_error_code text
);

create index if not exists phone_verification_user_created_idx
  on public.phone_verification_challenges (user_id, created_at desc);

create index if not exists phone_verification_phone_created_idx
  on public.phone_verification_challenges (phone_e164, created_at desc);

alter table public.phone_verification_challenges enable row level security;
revoke all on public.phone_verification_challenges from public, anon, authenticated;
grant all on public.phone_verification_challenges to service_role;

-- Existing numbers were entered before OTP verification existed. They remain
-- visible, but are intentionally not marked verified until their owner proves
-- possession through the new flow.
update public.profiles
set phone_verified_at = null
where phone is not null and phone_verified_at is null;

revoke update (phone, phone_verified_at) on public.profiles from authenticated;

create or replace function private.protect_verified_customer_phone()
returns trigger
language plpgsql
security invoker
set search_path = public, private
as $$
begin
  -- Privileged customer-management edits may correct a number, but they must
  -- never carry the previous number's verified state forward.
  if new.phone is distinct from old.phone
     and new.phone_verified_at is not distinct from old.phone_verified_at then
    new.phone_verified_at := null;
  end if;
  if auth.role() = 'authenticated'
     and (new.phone is distinct from old.phone
          or new.phone_verified_at is distinct from old.phone_verified_at) then
    raise exception 'Phone numbers must be changed through SMS verification.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_verified_customer_phone on public.profiles;
create trigger protect_verified_customer_phone
before update of phone, phone_verified_at on public.profiles
for each row execute function private.protect_verified_customer_phone();

revoke all on function private.protect_verified_customer_phone() from public, anon, authenticated;

comment on column public.profiles.phone_verified_at is
  'Timestamp of the latest successful CozyCraft SMS ownership challenge.';
comment on table public.phone_verification_challenges is
  'Short-lived, server-only SMS OTP challenges. Never expose this table through client APIs.';
