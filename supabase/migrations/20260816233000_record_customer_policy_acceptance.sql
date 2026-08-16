-- Versioned evidence that a customer accepted the Terms of Use and
-- acknowledged the Privacy Policy during account creation.
create table if not exists public.customer_policy_acceptances (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('terms', 'privacy')),
  document_version text not null,
  accepted_at timestamptz not null default now(),
  source text not null default 'web_signup',
  acceptance_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, document_type, document_version)
);

create index if not exists customer_policy_acceptances_user_date_idx
  on public.customer_policy_acceptances (user_id, accepted_at desc);

alter table public.customer_policy_acceptances enable row level security;
alter table public.customer_policy_acceptances force row level security;

revoke all on public.customer_policy_acceptances from public, anon, authenticated;
grant select on public.customer_policy_acceptances to authenticated;

drop policy if exists customer_policy_acceptances_owner_read
  on public.customer_policy_acceptances;
create policy customer_policy_acceptances_owner_read
  on public.customer_policy_acceptances
  for select
  to authenticated
  using ((select auth.uid()) = user_id or (select private.is_admin()));

create or replace function public.accept_current_customer_policies(
  p_terms_version text,
  p_privacy_version text,
  p_source text default 'web_signup',
  p_context jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  account_id uuid := auth.uid();
  accepted_source text := left(coalesce(nullif(trim(p_source), ''), 'web_signup'), 80);
  accepted_context jsonb := coalesce(p_context, '{}'::jsonb);
begin
  if account_id is null then
    raise exception 'Authentication required';
  end if;
  if p_terms_version <> '2026-08-16' or p_privacy_version <> '2026-08-16' then
    raise exception 'Unsupported customer policy version';
  end if;

  insert into public.customer_policy_acceptances (
    user_id, document_type, document_version, source, acceptance_context
  ) values
    (account_id, 'terms', p_terms_version, accepted_source, accepted_context),
    (account_id, 'privacy', p_privacy_version, accepted_source, accepted_context)
  on conflict (user_id, document_type, document_version) do nothing;
end;
$$;

revoke all on function public.accept_current_customer_policies(text, text, text, jsonb)
  from public, anon;
grant execute on function public.accept_current_customer_policies(text, text, text, jsonb)
  to authenticated;

create or replace function private.record_signup_policy_acceptance()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  terms_version text := new.raw_user_meta_data ->> 'terms_version';
  privacy_version text := new.raw_user_meta_data ->> 'privacy_version';
  acceptance_source text := left(
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'policy_acceptance_source'), ''), 'web_email_signup'),
    80
  );
begin
  if
    new.raw_user_meta_data ->> 'customer_policy_accepted' = 'true'
    and terms_version = '2026-08-16'
    and privacy_version = '2026-08-16'
  then
    insert into public.customer_policy_acceptances (
      user_id, document_type, document_version, accepted_at, source,
      acceptance_context
    ) values
      (
        new.id, 'terms', terms_version, now(),
        acceptance_source,
        jsonb_build_object(
          'method', 'auth_signup_metadata',
          'client_accepted_at', new.raw_user_meta_data ->> 'policy_accepted_at'
        )
      ),
      (
        new.id, 'privacy', privacy_version, now(),
        acceptance_source,
        jsonb_build_object(
          'method', 'auth_signup_metadata',
          'client_accepted_at', new.raw_user_meta_data ->> 'policy_accepted_at'
        )
      )
    on conflict (user_id, document_type, document_version) do nothing;
  end if;
  return new;
exception
  when others then
    -- Account creation must not fail solely because the acceptance audit is
    -- temporarily unavailable; versioned auth metadata remains as evidence.
    return new;
end;
$$;

revoke all on function private.record_signup_policy_acceptance() from public;

drop trigger if exists record_signup_policy_acceptance on auth.users;
create trigger record_signup_policy_acceptance
  after insert on auth.users
  for each row execute function private.record_signup_policy_acceptance();

insert into public.content_pages (slug, eyebrow, title, summary, body, published)
values
  (
    'terms',
    'CUSTOMER AGREEMENT',
    'Terms designed for straightforward shopping.',
    'The rules for CozyCraft accounts, purchases, delivery, reviews, and support in the Philippines.',
    E'USING COZYCRAFT\nThese Terms govern customer access to CozyCraft Furnitures’ website, account features, catalog, checkout, delivery tracking, reviews, support, and related services. By creating an account, you confirm that your information is accurate, you have legal capacity to transact, and you will use the service lawfully.\n\nYOUR ACCOUNT AND SECURITY\nKeep sign-in credentials and verification methods secure. Do not access another person’s data, interfere with the service, or misuse discounts, reviews, refunds, or support. Report suspected compromise promptly.\n\nCATALOG, PRICING, AND AVAILABILITY\nCozyCraft aims to keep descriptions, images, dimensions, prices, availability, and delivery information accurate. Material, color, and finish may vary slightly. Bag placement does not reserve stock. Obvious errors may be corrected before fulfillment with notice and an appropriate refund when payment was already collected.\n\nORDERS AND PAYMENT\nCheckout is an offer to purchase. Acceptance remains subject to stock, address, payment, fraud-prevention, and delivery checks. Cash on delivery may be available for eligible orders. Card and GCash payments use PayMongo hosted checkout; CozyCraft does not store complete card or wallet credentials.\n\nDELIVERY, CANCELLATION, AND RETURNS\nApplicable delivery charges, thresholds, service areas, and estimates appear before checkout. Cancellation and return requests remain subject to the eligibility and status displayed in CozyCraft. Nothing in these Terms removes mandatory remedies or warranties under Philippine consumer law.\n\nREVIEWS AND CUSTOMER CONTENT\nVerified purchasers may submit honest reviews and limited product photos. Customers remain responsible for uploads and must not submit unlawful, misleading, infringing, private, or unrelated content. CozyCraft may moderate content that violates these rules.\n\nPHILIPPINE CONSUMER AND ONLINE-TRANSACTION RIGHTS\nCozyCraft recognizes mandatory protections under the Consumer Act of the Philippines (Republic Act No. 7394), Electronic Commerce Act of 2000 (Republic Act No. 8792), Internet Transactions Act of 2023 (Republic Act No. 11967), and applicable rules. These Terms do not remove non-waivable warranties, remedies, disclosures, or complaint rights.\n\nCHANGES, LAW, AND CONTACT\nMaterial changes will be dated and communicated where appropriate. These Terms are governed by Philippine law. Questions may be sent to cozycraftfurnitures2026@gmail.com.',
    true
  ),
  (
    'privacy',
    'COZYCRAFT PRIVACY',
    'Your information, handled with purpose.',
    'How CozyCraft processes and protects customer information under the Philippine Data Privacy Act of 2012.',
    E'WHO IS RESPONSIBLE\nCozyCraft Furnitures is the personal information controller. Send privacy questions, access requests, corrections, objections, or deletion requests to cozycraftfurnitures2026@gmail.com from your registered email.\n\nINFORMATION WE PROCESS\nAccount identity and contact details; optional profile information; authentication and security events; saved addresses and preferences; bag and wishlist records; orders, payment status, delivery, cancellation, return and refund details; reviews and photos; support records; and limited device, error, and activity information needed to operate the service. CozyCraft does not store complete card or GCash credentials.\n\nPURPOSES AND LAWFUL BASES\nInformation is used to create and secure accounts, perform requested transactions, calculate delivery, fulfill and track orders, provide support, manage returns and refunds, show verified reviews, prevent misuse, comply with law, and maintain reliability. Processing may rely on a requested contract, legal obligation, legitimate interest, or specific consent where required. Account creation is not consent to unrelated marketing.\n\nSERVICE PROVIDERS\nLimited information is provided as needed to Supabase for authentication, database, protected storage and server functions; PayMongo for hosted payments; Resend for transactional email; Google when Google sign-in is selected; Netlify for website delivery; and necessary delivery, professional, fraud-prevention, legal, or government recipients.\n\nRETENTION\nAccount information is retained while active. Eligible profile information is deleted or anonymized within 90 days after a verified deletion request unless needed for an active transaction, security, dispute, or law. Transaction and accounting records may be retained for up to five years or longer when legally required. Routine support and security records are ordinarily retained for up to two years.\n\nSECURITY\nCozyCraft uses Row Level Security, role-based staff access, protected server secrets, authenticated storage, encryption in transit, audit records, and monitoring. Customers should protect passwords and verification codes.\n\nYOUR RIGHTS\nPhilippine data subjects may have rights to be informed, access data, object, correct inaccuracies, request erasure or blocking, obtain portability where applicable, claim damages, and complain to the National Privacy Commission. Consent may be withdrawn where processing relies on consent. Identity is verified before fulfilling a request.\n\nUPDATES AND COMPLAINTS\nMaterial changes will be communicated and may require renewed acknowledgement or consent. Contact cozycraftfurnitures2026@gmail.com so CozyCraft can investigate, or exercise your right to complain to the National Privacy Commission.',
    true
  )
on conflict (slug) do update
set
  eyebrow = excluded.eyebrow,
  title = excluded.title,
  summary = excluded.summary,
  body = excluded.body,
  published = excluded.published,
  updated_at = now();
