-- Keep delivery contact email authoritative and make choosing a default address
-- atomic. Checkout snapshots this value into the order, so it must never be
-- supplied independently from the authenticated account.

create or replace function private.enforce_delivery_address_account_data()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_account_email text;
begin
  select lower(email)
    into v_account_email
  from auth.users
  where id = new.user_id;

  if v_account_email is null or btrim(v_account_email) = '' then
    raise exception 'The account must have an email before saving an address.';
  end if;

  new.email := v_account_email;

  if new.is_primary then
    update public.addresses
       set is_primary = false,
           updated_at = now()
     where user_id = new.user_id
       and id is distinct from new.id
       and is_primary;
  end if;

  return new;
end;
$$;

drop trigger if exists addresses_enforce_account_data on public.addresses;
create trigger addresses_enforce_account_data
before insert or update on public.addresses
for each row execute function private.enforce_delivery_address_account_data();

-- Repair older rows whose copied address email no longer matches the account.
update public.addresses as address
   set email = lower(account.email),
       updated_at = now()
  from auth.users as account
 where account.id = address.user_id
   and account.email is not null
   and address.email is distinct from lower(account.email);

revoke all on function private.enforce_delivery_address_account_data() from public;
