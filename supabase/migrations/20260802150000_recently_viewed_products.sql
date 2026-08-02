create table public.product_views (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id,product_id)
);
create index product_views_user_viewed_idx on public.product_views(user_id,viewed_at desc);
alter table public.product_views enable row level security;
create policy "product_views_own_select" on public.product_views for select to authenticated using ((select auth.uid())=user_id);
create policy "product_views_own_insert" on public.product_views for insert to authenticated with check ((select auth.uid())=user_id);
create policy "product_views_own_update" on public.product_views for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "product_views_own_delete" on public.product_views for delete to authenticated using ((select auth.uid())=user_id);
revoke all on public.product_views from public,anon,authenticated;
grant select,insert,update,delete on public.product_views to authenticated;
