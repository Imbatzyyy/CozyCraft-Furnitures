-- Fill the public business identity and customer-facing policy copy with
-- demo-ready CozyCraft information. Operational amounts and feature toggles
-- are deliberately preserved; this migration only supplies missing details.

update public.store_settings
set
  store_name = 'CozyCraft Furnitures',
  store_description = 'Thoughtful furniture for comfortable Philippine homes, with one connected experience for discovery, secure checkout, delivery tracking, reviews, and customer care.',
  currency_code = 'PHP',
  contact_email = 'cozycraftfurnitures2026@gmail.com',
  business_address = 'Metro Manila, Philippines · Online furniture store',
  delivery_area = 'Philippines',
  report_settings = case
    when jsonb_array_length(coalesce(report_settings -> 'recipients', '[]'::jsonb)) = 0
      then jsonb_set(report_settings, '{recipients}', '["cozycraftfurnitures2026@gmail.com"]'::jsonb, true)
    else report_settings
  end,
  updated_at = now()
where id = true;

update public.admin_security_settings
set
  notification_email = 'cozycraftfurnitures2026@gmail.com',
  updated_at = now()
where id = true
  and coalesce(trim(notification_email), '') = '';

insert into public.content_pages (slug, eyebrow, title, summary, body, published)
values
  (
    'about',
    'COZYCRAFT FURNITURES · EST. 2026',
    'Your home starts with the perfect furniture.',
    'CozyCraft Furnitures brings thoughtful pieces, dependable service, and a simpler shopping journey to homes across the Philippines.',
    E'CozyCraft Furnitures was founded in 2026 by Vision Ventures: Prince Balane, Joylyn Campuso, Jacob Christopher Cañete, Angela Faith Suba, and Hydee Mae Sumalinog, with the project led by Prince Balane.\n\nBuilt in Metro Manila for Philippine homes, CozyCraft connects product discovery, live inventory, secure checkout, delivery tracking, verified reviews, and customer care in one dependable experience. Our goal is simple: help every customer choose furniture with confidence and follow every order with clarity.',
    true
  ),
  (
    'contact',
    'COZYCRAFT CUSTOMER CARE',
    'We are here to help.',
    'Get support for products, orders, delivery, payments, returns, refunds, and your CozyCraft account.',
    E'BUSINESS EMAIL\ncozycraftfurnitures2026@gmail.com\n\nORDER-SPECIFIC SUPPORT\nSign in, open Account, and choose Support to create a ticket connected to your order. Replies and ticket-status changes appear in realtime.\n\nCUSTOMER CARE HOURS\nMonday to Saturday · 9:00 AM–6:00 PM Philippine Time\nMessages may be sent anytime.\n\nSERVICE AREA\nPhilippines. Delivery fees, free-delivery thresholds, and estimated dates are calculated from the selected delivery address and shown before an order is placed.',
    true
  ),
  (
    'faq',
    'COZYCRAFT HELP CENTER',
    'Frequently asked questions.',
    'Quick answers about products, availability, checkout, delivery, cancellations, returns, reviews, and account security.',
    E'HOW DO I KNOW IF A PRODUCT IS AVAILABLE?\nEach product page reads current catalog and stock information from CozyCraft. Out-of-stock pieces remain viewable but cannot be added beyond their available quantity.\n\nWHAT PAYMENT METHODS ARE AVAILABLE?\nEligible orders can use cash on delivery, card, or GCash. Card and GCash payments use PayMongo hosted checkout; CozyCraft does not store card or wallet credentials.\n\nHOW MUCH IS DELIVERY?\nThe exact fee and free-delivery threshold depend on the delivery area and selected subtotal. They are displayed in the bag and confirmed again at checkout.\n\nHOW LONG DOES DELIVERY TAKE?\nThe current estimate for the selected address appears before checkout. Order progress and status timestamps are available from Account > Orders.\n\nCAN I CANCEL OR RETURN AN ORDER?\nCustomer cancellation is available within the configured cancellation window when the order is still eligible. Return requests for eligible delivered items can be submitted within the configured return period and remain subject to review.\n\nHOW DO REVIEWS WORK?\nCustomers can review delivered products from their Orders page. Reviews are linked to verified purchases and may be moderated before publication.\n\nHOW DO I GET HELP?\nOpen Account > Support for an order-linked ticket, or email cozycraftfurnitures2026@gmail.com.',
    true
  ),
  (
    'privacy',
    'COZYCRAFT PRIVACY',
    'Your information, handled carefully.',
    'CozyCraft uses the minimum account, shopping, order, delivery, and support information needed to operate your shopping experience.',
    E'INFORMATION WE USE\nAccount identity and profile details; saved addresses and preferences; bag and wishlist items; order, payment-status, delivery, review, and support records; and limited security and activity records needed to protect the service.\n\nWHY WE USE IT\nTo authenticate your account, show your saved shopping data, process and track orders, provide customer care, prevent misuse, and improve the storefront and operations workspace.\n\nPAYMENTS AND SERVICE PROVIDERS\nOnline payment details are handled through PayMongo hosted checkout. Transactional messages are delivered through Resend. Authentication, application data, realtime updates, and protected storage use Supabase. These providers receive only the information required for their role.\n\nACCESS AND SECURITY\nRow Level Security limits customer records to their owner. Staff access is role-based and audited. Server credentials remain in protected Edge Function secrets and are not delivered to the browser.\n\nYOUR CHOICES\nYou may update eligible profile information and communication preferences from your account. For privacy questions or an account-data request, email cozycraftfurnitures2026@gmail.com from the email registered to your CozyCraft account.\n\nRETENTION\nRecords are kept only as long as needed for active service, security, support, reporting, and applicable business obligations, then removed or anonymized according to CozyCraft operations policy.',
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

insert into public.email_templates
  (event_type, subject_template, heading, body_template, enabled)
values
  ('order_confirmation', 'CozyCraft order {{order_number}} is confirmed', 'Your order is confirmed.', 'Thank you for choosing CozyCraft. We received {{order_number}} and will email you again as it moves through preparation and delivery. You can see the latest details anytime from Account > Orders.', true),
  ('payment_received', 'Payment received for {{order_number}}', 'Your payment is secure and recorded.', 'We successfully recorded the payment for {{order_number}}. Your order remains available in Account > Orders, where its payment and delivery status will continue to update.', true),
  ('fulfillment_update', '{{order_number}} is now {{status}}', 'Your order is moving.', 'The latest fulfillment status for {{order_number}} is {{status}}. Sign in to CozyCraft and open Account > Orders for the complete tracking timeline.', true),
  ('delivered', '{{order_number}} has been delivered', 'Welcome home.', 'Your CozyCraft order {{order_number}} has been marked delivered. You may now open Account > Orders to review each delivered product and share your experience.', true),
  ('cancelled_refunded', 'Cancellation and refund update for {{order_number}}', 'Your order update is ready.', 'Order {{order_number}} is cancelled and its current refund status is {{refund_status}}. Open Account > Orders for the recorded status, or contact cozycraftfurnitures2026@gmail.com if you need help.', true),
  ('support_reply', 'CozyCraft Care replied to {{ticket_number}}', 'You have a new customer-care reply.', 'The CozyCraft team posted a new response to {{ticket_number}}. Sign in and open Account > Support to read the reply and see the ticket status.', true)
on conflict (event_type) do update
set
  subject_template = excluded.subject_template,
  heading = excluded.heading,
  body_template = excluded.body_template,
  enabled = excluded.enabled,
  updated_at = now();
;
