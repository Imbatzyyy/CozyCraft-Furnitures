-- Customer support intake must not trust fields supplied by the browser.
-- Enforce ownership, safe initial state, bounded content, and abuse limits in
-- Postgres so alternate clients receive the same protection as the website.

alter table public.support_tickets
  add constraint support_tickets_subject_length_check
    check (char_length(btrim(subject)) between 3 and 160) not valid,
  add constraint support_tickets_message_length_check
    check (char_length(btrim(message)) between 10 and 4000) not valid,
  add constraint support_tickets_attachment_count_check
    check (cardinality(attachment_paths) <= 3) not valid;

create or replace function private.secure_customer_support_intake()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Authentication required.';
  end if;

  if private.is_staff() then
    return new;
  end if;

  new.user_id := v_actor;
  new.status := 'open';
  new.admin_reply := null;
  new.assigned_to := null;

  if new.order_id is not null and not exists (
    select 1 from public.orders
    where id = new.order_id and user_id = v_actor
  ) then
    raise exception 'The selected order does not belong to this account.';
  end if;

  if exists (
    select 1
    from unnest(new.attachment_paths) as path
    where split_part(path, '/', 1) <> v_actor::text
  ) then
    raise exception 'One or more support attachments are invalid.';
  end if;

  if (
    select count(*) from public.support_tickets
    where user_id = v_actor and created_at >= now() - interval '1 hour'
  ) >= 5 then
    raise exception 'Too many support requests. Please wait before submitting another ticket.';
  end if;

  return new;
end;
$$;

drop trigger if exists secure_customer_support_intake on public.support_tickets;
create trigger secure_customer_support_intake
before insert on public.support_tickets
for each row execute function private.secure_customer_support_intake();

drop policy if exists "tickets_customer_insert" on public.support_tickets;
create policy "tickets_customer_insert"
on public.support_tickets for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'open'
  and admin_reply is null
  and assigned_to is null
  and (
    order_id is null
    or exists (
      select 1 from public.orders
      where orders.id = support_tickets.order_id
        and orders.user_id = (select auth.uid())
    )
  )
);

revoke all on function private.secure_customer_support_intake() from public;
