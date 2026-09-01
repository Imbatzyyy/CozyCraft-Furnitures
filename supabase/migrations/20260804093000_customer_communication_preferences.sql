create table if not exists public.customer_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  delivery_updates boolean not null default true,
  home_circle_notes boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.customer_preferences enable row level security;

revoke all on table public.customer_preferences from anon;
grant select, insert, update on table public.customer_preferences to authenticated;

drop policy if exists "Customers can read their communication preferences" on public.customer_preferences;
create policy "Customers can read their communication preferences"
on public.customer_preferences for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Customers can create their communication preferences" on public.customer_preferences;
create policy "Customers can create their communication preferences"
on public.customer_preferences for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Customers can update their communication preferences" on public.customer_preferences;
create policy "Customers can update their communication preferences"
on public.customer_preferences for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

do $$
begin
  alter publication supabase_realtime add table public.customer_preferences;
exception
  when duplicate_object then null;
end $$;
