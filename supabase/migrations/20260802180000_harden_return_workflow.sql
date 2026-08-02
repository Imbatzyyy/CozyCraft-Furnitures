drop policy if exists "returns_delivered_order_insert" on public.return_requests;
create policy "returns_eligible_order_insert"
on public.return_requests for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'requested'
  and reviewed_by is null
  and reviewed_at is null
  and admin_note is null
  and provider_refund_id is null
  and refunded_at is null
  and inventory_restored_at is null
  and exists (
    select 1
    from public.orders
    where orders.id = order_id
      and orders.user_id = (select auth.uid())
      and orders.status = 'delivered'
      and exists (
        select 1 from public.order_status_history history
        where history.order_id = orders.id
          and history.status = 'delivered'
          and history.changed_at >= now() - interval '30 days'
      )
  )
);

create or replace function private.enforce_return_status_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status = old.status then return new; end if;
  if not (
    (old.status = 'requested' and new.status in ('approved','rejected')) or
    (old.status = 'approved' and new.status in ('item_received','rejected')) or
    (old.status = 'rejected' and new.status = 'closed') or
    (old.status = 'item_received' and new.status in ('refund_processing','closed')) or
    (old.status = 'refund_processing' and new.status in ('item_received','refunded')) or
    (old.status = 'refunded' and new.status = 'closed')
  ) then
    raise exception 'Invalid return status transition from % to %', old.status, new.status;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_return_status_transition on public.return_requests;
create trigger enforce_return_status_transition
before update of status on public.return_requests
for each row execute function private.enforce_return_status_transition();

create or replace function public.begin_return_refund(
  p_return_id uuid,
  p_reviewer uuid
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_status text;
begin
  select status into current_status
  from public.return_requests
  where id = p_return_id
  for update;
  if not found then raise exception 'Return request not found'; end if;
  if current_status = 'refunded' then return 'already_refunded'; end if;
  if current_status = 'refund_processing' then return 'already_processing'; end if;
  if current_status <> 'item_received' then raise exception 'Returned item must be received before refunding'; end if;

  update public.return_requests
  set status='refund_processing', reviewed_by=p_reviewer, reviewed_at=now()
  where id=p_return_id;
  return 'claimed';
end;
$$;

revoke all on function public.begin_return_refund(uuid, uuid) from public, anon, authenticated;
grant execute on function public.begin_return_refund(uuid, uuid) to service_role;
