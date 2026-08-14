-- A single permissive SELECT policy avoids evaluating two policy branches for
-- every search analytics row while preserving owner and staff visibility.

drop policy if exists search_events_owner_read on public.search_events;
drop policy if exists search_events_staff_read on public.search_events;

create policy search_events_owner_or_staff_read
  on public.search_events for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (select private.is_staff())
  );
