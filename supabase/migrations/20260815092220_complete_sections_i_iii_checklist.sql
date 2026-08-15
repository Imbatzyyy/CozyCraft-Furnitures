-- Complete the remaining Sections I-III checklist capabilities without
-- exposing privileged credentials to either storefront or admin clients.

alter table public.profiles
  add column if not exists customer_active boolean not null default true;

alter table public.store_settings
  add column if not exists currency_code text not null default 'PHP';

alter table public.store_settings
  drop constraint if exists store_settings_currency_code_check;
alter table public.store_settings
  add constraint store_settings_currency_code_check
  check (currency_code in ('PHP', 'USD', 'EUR', 'SGD', 'JPY'));

create table if not exists public.billing_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  recipient_name text not null default '',
  company_name text not null default '',
  tax_id text not null default '',
  invoice_email text not null default '',
  address_line text not null default '',
  barangay text not null default '',
  city text not null default '',
  province text not null default '',
  postal_code text not null default '',
  same_as_delivery boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_pages (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  eyebrow text not null default '',
  title text not null,
  summary text not null default '',
  body text not null default '',
  published boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homepage_banners (
  id uuid primary key default gen_random_uuid(),
  eyebrow text not null default '',
  title text not null,
  subtitle text not null default '',
  image_url text not null,
  cta_label text not null default 'Shop collection',
  cta_path text not null default '/new-arrivals',
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer not null default 0,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint homepage_banner_window_valid
    check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint homepage_banner_cta_path_safe
    check (cta_path ~ '^/' or cta_path ~ '^https://')
);

create table if not exists public.email_templates (
  event_type text primary key check (event_type in (
    'order_confirmation', 'payment_received', 'fulfillment_update',
    'delivered', 'cancelled_refunded', 'support_reply'
  )),
  subject_template text not null,
  heading text not null,
  body_template text not null,
  enabled boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.email_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_type text not null,
  entity_id text,
  recipient text not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider_message_id text,
  error_message text,
  sent_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists homepage_banners_publication_idx
  on public.homepage_banners (active, starts_at, ends_at, sort_order);
create index if not exists email_delivery_logs_created_idx
  on public.email_delivery_logs (created_at desc);
create index if not exists email_delivery_logs_entity_idx
  on public.email_delivery_logs (entity_type, entity_id, created_at desc);

drop trigger if exists billing_profiles_set_updated_at on public.billing_profiles;
create trigger billing_profiles_set_updated_at before update on public.billing_profiles
for each row execute function private.set_updated_at();
drop trigger if exists content_pages_set_updated_at on public.content_pages;
create trigger content_pages_set_updated_at before update on public.content_pages
for each row execute function private.set_updated_at();
drop trigger if exists homepage_banners_set_updated_at on public.homepage_banners;
create trigger homepage_banners_set_updated_at before update on public.homepage_banners
for each row execute function private.set_updated_at();
drop trigger if exists email_templates_set_updated_at on public.email_templates;
create trigger email_templates_set_updated_at before update on public.email_templates
for each row execute function private.set_updated_at();

insert into public.content_pages (slug, eyebrow, title, summary, body)
values
  ('about', 'OUR STORY', 'Furniture that makes home feel complete.',
   'CozyCraft Furnitures makes discovering, ordering, and bringing home considered furniture simpler.',
   'Founded in 2026 by Vision Ventures, CozyCraft brings catalog, inventory, secure checkout, delivery tracking, reviews, and customer care into one dependable shopping experience.'),
  ('contact', 'CUSTOMER CARE', 'How can we help?',
   'Our team can help with products, orders, delivery, payments, returns, and account questions.',
   'Use CozyCraft Care inside your account for order-linked support, or contact the store using the verified details shown below.'),
  ('faq', 'HELP CENTER', 'Frequently asked questions.',
   'Straightforward answers for shopping, delivery, payments, returns, and account security.',
   'Orders update in realtime. Delivery estimates are shown before checkout. Card and GCash payments use PayMongo hosted checkout; CozyCraft never stores card credentials. Delivered purchases can be reviewed from your Orders page.'),
  ('privacy', 'PRIVACY', 'Your information, handled carefully.',
   'CozyCraft only uses account and order information to provide the service you request.',
   'Row Level Security keeps customer records private to their owner. Payment credentials remain with PayMongo, server secrets remain in Supabase Edge Function secrets, and staff access is role controlled and audited.')
on conflict (slug) do nothing;

insert into public.homepage_banners
  (eyebrow, title, subtitle, image_url, cta_label, cta_path, sort_order)
values
  ('THE 2026 COLLECTION', 'Furniture that makes home feel complete.',
   'Considered pieces for the rooms that carry your everyday rituals.',
   'https://images.unsplash.com/photo-1724582586529-62622e50c0b3?auto=format&fit=crop&w=1800&q=88',
   'Shop collection', '/new-arrivals', 10),
  ('THE LIVING EDIT', 'Room to settle into.',
   'Soft forms, honest materials, and a slower point of view for the everyday living room.',
   'https://images.unsplash.com/photo-1564078516393-cf04bd966897?auto=format&fit=crop&w=1800&q=88',
   'Explore living room', '/living-room', 20),
  ('NEW ARRIVALS', 'A softer shape of modern.',
   'Discover new pieces made to grow more beautiful with each season at home.',
   'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1800&q=88',
   'Discover the edit', '/new-arrivals', 30)
on conflict do nothing;

insert into public.email_templates
  (event_type, subject_template, heading, body_template)
values
  ('order_confirmation', 'We received order {{order_number}}', 'Your order is confirmed.', 'Thanks for shopping with CozyCraft. We will keep you updated as {{order_number}} moves through fulfillment.'),
  ('payment_received', 'Payment received for {{order_number}}', 'Payment received.', 'Your secure payment for {{order_number}} has been recorded successfully.'),
  ('fulfillment_update', '{{order_number}} is now {{status}}', 'Your order is moving.', 'The latest delivery status for {{order_number}} is {{status}}.'),
  ('delivered', '{{order_number}} has been delivered', 'Welcome home.', 'Your CozyCraft order has been delivered. You can now review each delivered product from your Orders page.'),
  ('cancelled_refunded', 'Refund update for {{order_number}}', 'Your refund update.', 'The refund status for {{order_number}} is {{refund_status}}.'),
  ('support_reply', 'CozyCraft Care replied to {{ticket_number}}', 'You have a new support reply.', 'Open your CozyCraft Support page to read the latest response for {{ticket_number}}.')
on conflict (event_type) do nothing;

alter table public.billing_profiles enable row level security;
alter table public.billing_profiles force row level security;
alter table public.content_pages enable row level security;
alter table public.content_pages force row level security;
alter table public.homepage_banners enable row level security;
alter table public.homepage_banners force row level security;
alter table public.email_templates enable row level security;
alter table public.email_templates force row level security;
alter table public.email_delivery_logs enable row level security;
alter table public.email_delivery_logs force row level security;

revoke all on public.billing_profiles, public.content_pages,
  public.homepage_banners, public.email_templates,
  public.email_delivery_logs from public, anon, authenticated;

grant select on public.content_pages, public.homepage_banners to anon, authenticated;
grant select, insert, update, delete on public.billing_profiles to authenticated;
grant insert, update, delete on public.content_pages, public.homepage_banners to authenticated;
grant select, insert, update on public.email_templates to authenticated;
grant select on public.email_delivery_logs to authenticated;
grant select (customer_active) on public.profiles to authenticated;
grant select (currency_code) on public.store_settings to anon, authenticated;

drop policy if exists billing_profiles_owner_read on public.billing_profiles;
create policy billing_profiles_owner_read on public.billing_profiles for select to authenticated
using ((select auth.uid()) = user_id or (select private.is_admin()));
drop policy if exists billing_profiles_owner_insert on public.billing_profiles;
create policy billing_profiles_owner_insert on public.billing_profiles for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists billing_profiles_owner_update on public.billing_profiles;
create policy billing_profiles_owner_update on public.billing_profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists billing_profiles_owner_delete on public.billing_profiles;
create policy billing_profiles_owner_delete on public.billing_profiles for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists content_pages_public_read on public.content_pages;
create policy content_pages_public_read on public.content_pages for select to anon, authenticated
using (published);
drop policy if exists content_pages_admin_read on public.content_pages;
create policy content_pages_admin_read on public.content_pages for select to authenticated
using ((select private.is_admin()));
drop policy if exists content_pages_admin_insert on public.content_pages;
create policy content_pages_admin_insert on public.content_pages for insert to authenticated
with check ((select private.is_admin()));
drop policy if exists content_pages_admin_update on public.content_pages;
create policy content_pages_admin_update on public.content_pages for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists content_pages_admin_delete on public.content_pages;
create policy content_pages_admin_delete on public.content_pages for delete to authenticated
using ((select private.is_superadmin()));

drop policy if exists homepage_banners_public_read on public.homepage_banners;
create policy homepage_banners_public_read on public.homepage_banners for select to anon, authenticated
using (
  (active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()))
);
drop policy if exists homepage_banners_admin_read on public.homepage_banners;
create policy homepage_banners_admin_read on public.homepage_banners for select to authenticated
using ((select private.is_admin()));
drop policy if exists homepage_banners_admin_insert on public.homepage_banners;
create policy homepage_banners_admin_insert on public.homepage_banners for insert to authenticated
with check ((select private.is_admin()));
drop policy if exists homepage_banners_admin_update on public.homepage_banners;
create policy homepage_banners_admin_update on public.homepage_banners for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists homepage_banners_admin_delete on public.homepage_banners;
create policy homepage_banners_admin_delete on public.homepage_banners for delete to authenticated
using ((select private.is_admin()));

drop policy if exists email_templates_admin_read on public.email_templates;
create policy email_templates_admin_read on public.email_templates for select to authenticated
using ((select private.is_admin()));
drop policy if exists email_templates_admin_insert on public.email_templates;
create policy email_templates_admin_insert on public.email_templates for insert to authenticated
with check ((select private.is_admin()));
drop policy if exists email_templates_admin_update on public.email_templates;
create policy email_templates_admin_update on public.email_templates for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists email_delivery_logs_admin_read on public.email_delivery_logs;
create policy email_delivery_logs_admin_read on public.email_delivery_logs for select to authenticated
using ((select private.is_admin()));

do $realtime$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'billing_profiles'
  ) then alter publication supabase_realtime add table public.billing_profiles; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'content_pages'
  ) then alter publication supabase_realtime add table public.content_pages; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'homepage_banners'
  ) then alter publication supabase_realtime add table public.homepage_banners; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'email_templates'
  ) then alter publication supabase_realtime add table public.email_templates; end if;
end
$realtime$;

-- Extend the existing atomic settings RPC so currency is saved in the same
-- protected transaction as checkout, notification, and security controls.
create or replace function public.save_admin_workspace_settings(p_store jsonb, p_security jsonb)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_store public.store_settings%rowtype;
  v_security public.admin_security_settings%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if not private.is_superadmin() then
    raise exception using errcode = '42501', message = 'Super administrator access required';
  end if;
  if coalesce((select require_admin_mfa from public.admin_security_settings where id = true), true)
     and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception using errcode = '42501', message = 'Complete administrator MFA before changing workspace settings';
  end if;
  select * into v_store from public.store_settings where id = true for update;
  select * into v_security from public.admin_security_settings where id = true for update;
  if v_store.id is null or v_security.id is null then raise exception 'Workspace settings are not initialized'; end if;
  v_store := jsonb_populate_record(v_store, coalesce(p_store, '{}'::jsonb) - array['id', 'updated_at']);
  v_security := jsonb_populate_record(v_security, coalesce(p_security, '{}'::jsonb) - array['id', 'updated_at', 'updated_by', 'integration_status']);
  update public.store_settings set
    store_name=v_store.store_name, store_description=v_store.store_description,
    currency_code=v_store.currency_code, contact_email=v_store.contact_email,
    support_phone=v_store.support_phone, business_address=v_store.business_address,
    delivery_area=v_store.delivery_area, low_stock_threshold=v_store.low_stock_threshold,
    inventory_alerts=v_store.inventory_alerts, weekly_report_enabled=v_store.weekly_report_enabled,
    social_links=v_store.social_links, announcement_enabled=v_store.announcement_enabled,
    announcement_text=v_store.announcement_text, announcement_link=v_store.announcement_link,
    maintenance_mode=v_store.maintenance_mode, checkout_settings=v_store.checkout_settings,
    fulfillment_settings=v_store.fulfillment_settings, review_settings=v_store.review_settings,
    account_settings=v_store.account_settings, email_event_settings=v_store.email_event_settings,
    report_settings=v_store.report_settings, updated_at=v_now
  where id=true;
  update public.admin_security_settings set
    require_admin_mfa=v_security.require_admin_mfa,
    session_timeout_minutes=v_security.session_timeout_minutes,
    maximum_failed_logins=v_security.maximum_failed_logins,
    lockout_minutes=v_security.lockout_minutes,
    security_alerts_enabled=v_security.security_alerts_enabled,
    notification_email=v_security.notification_email,
    updated_at=v_now, updated_by=auth.uid()
  where id=true;
  return jsonb_build_object('saved', true, 'updatedAt', v_now);
end;
$$;
revoke all on function public.save_admin_workspace_settings(jsonb, jsonb) from public, anon;
grant execute on function public.save_admin_workspace_settings(jsonb, jsonb) to authenticated;
