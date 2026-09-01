create table if not exists public.mobile_loyalty_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  points_balance integer not null default 0 check (points_balance >= 0),
  lifetime_eligible_spend numeric(14,2) not null default 0 check (lifetime_eligible_spend >= 0),
  tier text not null default 'member' check (tier in ('member', 'plus', 'premium', 'elite')),
  tier_valid_until timestamptz,
  last_activity_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.mobile_loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  review_id uuid references public.reviews(id) on delete set null,
  event_key text not null unique,
  kind text not null check (kind in ('order_reward', 'first_app_order', 'review_bonus', 'profile_bonus', 'birthday_bonus', 'referral_bonus', 'redemption', 'reversal', 'adjustment')),
  points integer not null check (points <> 0),
  description text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.mobile_loyalty_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  points_cost integer not null check (points_cost in (100, 250, 500)),
  discount_amount numeric(12,2) not null check (discount_amount in (100, 300, 700)),
  status text not null default 'available' check (status in ('available', 'applied', 'used', 'cancelled', 'expired')),
  code text not null unique default ('HC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  used_at timestamptz
);

alter table public.orders add column if not exists mobile_app_order boolean not null default false;

alter table public.mobile_loyalty_accounts enable row level security;
alter table public.mobile_loyalty_transactions enable row level security;
alter table public.mobile_loyalty_redemptions enable row level security;

create policy "mobile_loyalty_accounts_select_own" on public.mobile_loyalty_accounts
for select to authenticated using (user_id = (select auth.uid()));
create policy "mobile_loyalty_transactions_select_own" on public.mobile_loyalty_transactions
for select to authenticated using (user_id = (select auth.uid()));
create policy "mobile_loyalty_redemptions_select_own" on public.mobile_loyalty_redemptions
for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.mobile_loyalty_accounts, public.mobile_loyalty_transactions, public.mobile_loyalty_redemptions from public, anon, authenticated;
grant select on public.mobile_loyalty_accounts, public.mobile_loyalty_transactions, public.mobile_loyalty_redemptions to authenticated;

create or replace function private.mobile_loyalty_tier(p_spend numeric)
returns text language sql immutable as $$
  select case when p_spend >= 120000 then 'elite' when p_spend >= 50000 then 'premium' when p_spend >= 15000 then 'plus' else 'member' end
$$;

create or replace function private.refresh_mobile_loyalty_account(p_user_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare
  v_spend numeric(14,2);
  v_points integer;
  v_last timestamptz;
begin
  select coalesce(sum(total), 0), max(updated_at)
    into v_spend, v_last
  from public.orders
  where user_id = p_user_id
    and status = 'delivered'
    and payment_status not in ('failed', 'refunded');

  select greatest(coalesce(sum(points), 0), 0)
    into v_points
  from public.mobile_loyalty_transactions
  where user_id = p_user_id
    and (expires_at is null or expires_at > now());

  insert into public.mobile_loyalty_accounts(user_id, points_balance, lifetime_eligible_spend, tier, tier_valid_until, last_activity_at, updated_at)
  values (p_user_id, v_points, v_spend, private.mobile_loyalty_tier(v_spend), coalesce(v_last, now()) + interval '12 months', v_last, now())
  on conflict (user_id) do update set
    points_balance = excluded.points_balance,
    lifetime_eligible_spend = excluded.lifetime_eligible_spend,
    tier = excluded.tier,
    tier_valid_until = excluded.tier_valid_until,
    last_activity_at = excluded.last_activity_at,
    updated_at = now();
end;
$$;

create or replace function private.award_mobile_order_points()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare
  v_spend_before numeric(14,2);
  v_multiplier numeric := 1;
  v_points integer;
begin
  if new.status = 'delivered' and new.payment_status not in ('failed', 'refunded') then
    select coalesce(sum(total), 0) into v_spend_before from public.orders
      where user_id = new.user_id and id <> new.id and status = 'delivered' and payment_status not in ('failed', 'refunded');
    if v_spend_before >= 120000 then v_multiplier := 2;
    elsif v_spend_before >= 50000 then v_multiplier := 1.5;
    end if;
    v_points := floor((new.total / 100) * v_multiplier);
    if v_points > 0 then
      insert into public.mobile_loyalty_transactions(user_id, order_id, event_key, kind, points, description, expires_at)
      values (new.user_id, new.id, 'order:' || new.id, 'order_reward', v_points, 'Points from delivered order ' || new.order_number, now() + interval '24 months')
      on conflict (event_key) do nothing;
    end if;
    if new.mobile_app_order then
      insert into public.mobile_loyalty_transactions(user_id, order_id, event_key, kind, points, description, expires_at)
      select new.user_id, new.id, 'first-app-order:' || new.user_id, 'first_app_order', 30, 'First CozyCraft mobile order bonus', now() + interval '24 months'
      where not exists (select 1 from public.mobile_loyalty_transactions where event_key = 'first-app-order:' || new.user_id)
      on conflict (event_key) do nothing;
    end if;
  elsif new.status in ('cancelled') or new.payment_status in ('failed', 'refunded') then
    insert into public.mobile_loyalty_transactions(user_id, order_id, event_key, kind, points, description)
    select new.user_id, new.id, 'reversal:' || new.id, 'reversal', -sum(points), 'Reversal for cancelled or refunded order ' || new.order_number
    from public.mobile_loyalty_transactions where order_id = new.id and points > 0
    having coalesce(sum(points), 0) > 0
    on conflict (event_key) do nothing;
  end if;
  perform private.refresh_mobile_loyalty_account(new.user_id);
  return new;
end;
$$;

drop trigger if exists award_mobile_order_points on public.orders;
create trigger award_mobile_order_points after insert or update on public.orders
for each row execute function private.award_mobile_order_points();

create or replace function private.award_mobile_review_points()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, private as $$
begin
  if new.approved then
    insert into public.mobile_loyalty_transactions(user_id, review_id, event_key, kind, points, description, expires_at)
    values (new.user_id, new.id, 'review:' || new.id, 'review_bonus', 10, 'Verified product review bonus', now() + interval '24 months')
    on conflict (event_key) do nothing;
    perform private.refresh_mobile_loyalty_account(new.user_id);
  end if;
  return new;
end;
$$;
drop trigger if exists award_mobile_review_points on public.reviews;
create trigger award_mobile_review_points after insert or update of approved on public.reviews
for each row execute function private.award_mobile_review_points();

create or replace function public.get_mobile_loyalty()
returns public.mobile_loyalty_accounts language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare v_user uuid := auth.uid(); v_result public.mobile_loyalty_accounts;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  perform private.refresh_mobile_loyalty_account(v_user);
  select * into v_result from public.mobile_loyalty_accounts where user_id = v_user;
  return v_result;
end;
$$;

create or replace function public.mark_mobile_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  update public.orders set mobile_app_order = true where id = p_order_id and user_id = auth.uid();
  if not found then raise exception 'Order not found'; end if;
end;
$$;

create or replace function public.redeem_mobile_points(p_points integer)
returns public.mobile_loyalty_redemptions language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare v_user uuid := auth.uid(); v_discount numeric; v_balance integer; v_row public.mobile_loyalty_redemptions;
begin
  if p_points not in (100,250,500) then raise exception 'Choose a valid reward'; end if;
  perform private.refresh_mobile_loyalty_account(v_user);
  select points_balance into v_balance from public.mobile_loyalty_accounts where user_id = v_user for update;
  if v_balance < p_points then raise exception 'Not enough points'; end if;
  v_discount := case p_points when 100 then 100 when 250 then 300 else 700 end;
  insert into public.mobile_loyalty_redemptions(user_id, points_cost, discount_amount) values (v_user, p_points, v_discount) returning * into v_row;
  insert into public.mobile_loyalty_transactions(user_id, event_key, kind, points, description)
  values (v_user, 'redemption:' || v_row.id, 'redemption', -p_points, 'Redeemed ' || p_points || ' points for ₱' || v_discount || ' reward');
  perform private.refresh_mobile_loyalty_account(v_user);
  return v_row;
end;
$$;

revoke all on function public.get_mobile_loyalty(), public.mark_mobile_order(uuid), public.redeem_mobile_points(integer) from public, anon;
grant execute on function public.get_mobile_loyalty(), public.mark_mobile_order(uuid), public.redeem_mobile_points(integer) to authenticated;

insert into public.mobile_loyalty_transactions(user_id, order_id, event_key, kind, points, description, expires_at)
select o.user_id, o.id, 'order:' || o.id, 'order_reward', floor(o.total / 100)::integer,
       'Points from delivered order ' || o.order_number, now() + interval '24 months'
from public.orders o
where o.status = 'delivered' and o.payment_status not in ('failed', 'refunded') and floor(o.total / 100) > 0
on conflict (event_key) do nothing;

insert into public.mobile_loyalty_accounts(user_id)
select id from public.profiles on conflict (user_id) do nothing;

do $$ declare r record; begin for r in select id from public.profiles loop perform private.refresh_mobile_loyalty_account(r.id); end loop; end $$;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='mobile_loyalty_accounts') then
    alter publication supabase_realtime add table public.mobile_loyalty_accounts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='mobile_loyalty_transactions') then
    alter publication supabase_realtime add table public.mobile_loyalty_transactions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='mobile_loyalty_redemptions') then
    alter publication supabase_realtime add table public.mobile_loyalty_redemptions;
  end if;
end $$;
