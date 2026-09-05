create table public.support_internal_notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id),
  body text not null check (length(trim(body)) between 3 and 2000),
  created_at timestamptz not null default now()
);
create index support_internal_notes_ticket_time_idx on public.support_internal_notes(ticket_id,created_at desc);
alter table public.support_internal_notes enable row level security;
revoke all on public.support_internal_notes from anon, authenticated;
grant select, insert on public.support_internal_notes to authenticated;
create policy "Verified staff can read handover notes" on public.support_internal_notes for select to authenticated
  using ((select private.is_staff()) and (select private.admin_mfa_satisfied()) and (select private.customer_mfa_satisfied()));
create policy "Verified staff can add their own handover notes" on public.support_internal_notes for insert to authenticated
  with check (author_id=(select auth.uid()) and (select private.is_staff()) and (select private.admin_mfa_satisfied()) and (select private.customer_mfa_satisfied()) and exists(select 1 from public.support_tickets t where t.id=ticket_id));
comment on table public.support_internal_notes is 'Append-only staff handover notes. Never included in customer ticket responses.';
notify pgrst, 'reload schema';
