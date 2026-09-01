# 3. SYSTEM ARCHITECTURE AND OVERVIEW

CozyCraft Furniture is a full-stack, responsive furniture commerce platform
designed for two primary user groups: customers who shop through the public
storefront and authorized personnel who manage operations through a protected
administrative workspace. Both sides use one controlled system of record, but
they expose different functions according to the user's role. The application
combines a React and TypeScript web interface with Supabase authentication,
PostgreSQL, Realtime, Storage, protected database functions, and Edge
Functions. It also integrates Google authentication, PayMongo payments,
Resend transactional email, Groq-assisted customer care, and Philippine
address data. Netlify delivers the web build, while Cloudflare provides the
production domain and TLS layer.

The architecture follows a modular, service-oriented design. Storefront,
administration, authentication, catalog, commerce, fulfillment, engagement,
and reporting responsibilities are separated into modules with explicit
dependencies. Security is enforced at more than one layer: the interface
restricts routes and actions by role, while PostgreSQL constraints, grants,
row-level security policies, and protected server functions remain the final
authorization boundary. Realtime subscriptions notify the appropriate pages
when important database records change, reducing unnecessary repeated reads
while keeping customer and administrative views synchronized.

## 3.1. High-Level System Diagram

Figure 3.1 presents the recommended primary diagram for CozyCraft. It is the
best single-page summary because it shows the actors, the customer and admin
experiences, the shared application, the Supabase backend, the database, and
the external providers without turning the page into a dense network of
crossing lines.

**Insert:** `figures/01-high-level-system-architecture.svg`

**Figure 3.1 caption:** Detailed high-level architecture of the CozyCraft
Furniture e-commerce system, showing system users, customer and administrative
experiences, the shared React application, Supabase backend services,
PostgreSQL, and external providers.

### Diagram reading guide

1. **System actors.** Customers use the public shopping experience, while the
   super administrator, administrator, and staff use the protected operations
   workspace according to assigned permissions.
2. **Presentation layer.** A responsive React and TypeScript application
   provides separate customer and administrator routes while reusing shared UI,
   domain types, validation, and service clients.
3. **Application and service layer.** Supabase Auth manages identity; the Data
   API and protected RPC functions handle business data; Realtime distributes
   relevant changes; Storage manages protected images and attachments; and
   Edge Functions execute operations that require secrets or trusted server
   logic.
4. **Data layer.** PostgreSQL stores identity, catalog, inventory, cart,
   wishlist, orders, payments, reviews, support, notifications, audit records,
   store settings, and loyalty data. Row-level security and database
   constraints enforce ownership, roles, and valid relationships.
5. **External services.** Google provides OAuth identity, PayMongo handles
   hosted card and GCash payment flows, Resend delivers transactional email,
   Groq supports the customer-care assistant, and the Philippine address
   service supplies dependent location selections.
6. **Deployment layer.** Netlify serves the versioned frontend build through
   the Cloudflare-managed production domain. Supabase independently hosts the
   database, authentication, storage, realtime channels, and server functions.

### Supporting architecture figures

Use Figure 3.1 as the main answer for Section 3.1. Add the following figures on
subsequent pages when the panel needs a more detailed explanation:

| Figure | Purpose | Recommended use |
| --- | --- | --- |
| 3.2 Customer and admin module map | Shows functional separation and shared protected services | Explain modular design and role separation |
| 3.3 Backend services and Edge Functions | Shows trusted backend responsibilities and secrets | Explain API communication and server-side processing |
| 3.4A-D Database relationship diagrams | Shows primary keys, foreign keys, and business relationships by domain | Explain database design without one unreadable mega-ERD |
| 3.5 External API integrations | Shows information exchanged with external providers | Explain integration points and trust boundaries |
| 3.6A Order lifecycle | Shows checkout through delivery and review eligibility | Explain normal transaction flow |
| 3.6B Cancellation and refund lifecycle | Shows validation, approval, payment refund, email, and realtime updates | Explain exception handling |
| 3.7 Security and deployment topology | Shows browser-safe configuration, server secrets, authorization, and releases | Explain deployment and security strategy |

## 3.2. Core Application Description

CozyCraft Furniture is an integrated e-commerce and operations application for
discovering, purchasing, fulfilling, and supporting furniture orders. On the
customer side, it allows users to browse products by room and subcategory,
search and filter the live catalog, compare and save products, maintain a
cross-device bag and wishlist, submit a delivery address, pay through cash on
delivery or PayMongo-supported methods, track order progress in realtime,
request eligible cancellations or returns, submit verified-purchase reviews,
manage account information, receive notifications, contact support, and
participate in the Home Circle member-tier program. On the administrative side,
authorized personnel can manage products, categories, images, inventory,
orders, payments, refunds, customers, reviews, support tickets, notifications,
member tiers, reports, team permissions, store settings, and audit logs. All
modules operate through the same protected Supabase backend so that permitted
updates made by customers, staff, administrators, webhooks, or scheduled
operations are reflected consistently across the system.

## 3.3. Detailed Module & Functionality Breakdown

For each module below, the documentation identifies its purpose, primary
functions, and dependencies. Screenshots should use real demonstration data,
hide personal or secret information, and show the complete page title and the
feature being discussed.

### 3.3.1. Customer/Buyer Site (User-Facing) Modules and Functions

#### 3.3.1.1. Home Page and Discovery Module

**Purpose:** Introduces the CozyCraft brand and helps customers discover
relevant furniture and current storefront content.

**Key functions:**

- Displays the hero section, announcement, featured collections, product
  recommendations, service promises, and primary navigation.
- Provides responsive desktop and mobile navigation, global search,
  notifications, wishlist, bag, account, and customer-care access.
- Uses active store settings and merchandising content supplied by the backend.

**Dependencies:** Product Catalog, Content and Store Settings, Authentication,
Customer Notifications, and AI Customer Care modules.

**Screenshot:** Capture the `/home` page with the hero, navigation, featured
products, and floating customer-care control visible.

**What to say:** "The Home and Discovery module presents live catalog and
merchandising content while giving customers direct access to search, saved
items, their bag, account features, notifications, and assistance. Its layout
adapts to desktop and mobile screens."

#### 3.3.1.2. User Management and Account Module

**Purpose:** Manages customer registration, sign-in, identity, profile data,
delivery addresses, security, preferences, sessions, and consent.

**Key functions:**

- Supports email/password registration, email confirmation, Google OAuth,
  password recovery, and session restoration.
- Requires acceptance of the Terms of Use and Privacy Policy before account
  creation and records the accepted policy versions.
- Stores the customer's username, name, phone, date of birth, gender, private
  profile image, preferences, and saved addresses.
- Separates customer accounts from staff and administrator access.
- Supports account-security controls, notification preferences, other-session
  sign-out, and role or account-status enforcement.

**Dependencies:** Supabase Auth, Profiles, Addresses, Customer Preferences,
Storage, Resend email, Google OAuth, RLS policies, and protected profile RPCs.

**Screenshots:** Capture the `/signup` page with the required agreement directly
above **Create account**, then the `/profile` page in view mode.

**What to say:** "The User Management module combines Supabase authentication
with a profile record protected by row-level security. It supports both native
and Google sign-in while keeping the customer session separate from the admin
workspace."

#### 3.3.1.3. Product Catalog, Search, and Discovery Module

**Purpose:** Presents every active, in-stock or viewable catalog product in its
correct room and subcategory, with efficient discovery controls.

**Key functions:**

- Displays Living Room, Bedroom, Dining Room, and New Arrivals collections.
- Supports text search, price range up to PHP 500,000, category filters,
  availability filters, sorting, comparison, and recently viewed products.
- Opens detailed product pages with multiple images, current price, stock,
  description, material bullets, dimension bullets, and approved reviews.
- Blocks adding an out-of-stock item while keeping its information viewable.
- Receives product, price, image, category, and stock changes from the shared
  backend.

**Dependencies:** Products, Categories, Product Views, Inventory Movements,
Storage product images, Reviews, and Store Settings.

**Screenshots:** Capture `/living-room` or another room page with search and
filters open, followed by `/products/{product-id}` showing product details and
approved reviews.

**What to say:** "The Catalog module reads the shared database source of truth,
so the room collections, search results, product page, stock controls, and
mobile experience resolve the same product identity and category placement."

#### 3.3.1.4. Shopping Bag and Wishlist Module

**Purpose:** Allows authenticated customers to save products and prepare a
specific set of items for checkout across sessions and devices.

**Key functions:**

- Adds and removes wishlist and bag items, updates quantity, and enforces the
  current database stock limit.
- Persists selected-for-checkout state, including partial selections and
  select-all or unselect-all actions.
- Synchronizes customer-owned cart and wishlist changes through Realtime and
  refresh-on-focus safeguards.
- Calculates the selected subtotal, delivery fee, free-delivery threshold, and
  order total using active store settings.

**Dependencies:** Cart Items, Wishlist Items, Products, Inventory, Auth,
Realtime, Checkout Settings, and the delivery-pricing utility.

**Screenshots:** Capture `/cart` with several products, only some selected, the
quantity controls, delivery line, and order summary; capture `/wishlist` with
saved products.

**What to say:** "The Bag and Wishlist module stores selections by authenticated
user instead of only in the browser. This preserves quantity and selection
state after refresh, sign-out, or use on another device."

#### 3.3.1.5. Checkout and Payment Module

**Purpose:** Validates selected items, delivery details, pricing, and payment
choice before securely creating an order.

**Key functions:**

- Uses only selected bag items and revalidates price, stock, delivery fee, and
  checkout eligibility on the protected backend.
- Lets the customer choose a saved Philippine delivery address or create a new
  dependent region/province, city/municipality, and barangay address.
- Supports cash on delivery and PayMongo-hosted card or GCash payments according
  to active store settings.
- Uses an idempotent checkout key to prevent accidental duplicate orders.
- Separates order status from payment status and restores the customer session
  after returning from the payment provider.

**Dependencies:** Cart Items, Products, Addresses, Orders, Order Items, Payment
Transactions, protected `place_order` RPC, PayMongo Edge Functions, webhooks,
Store Settings, and Customer Notifications.

**Screenshots:** Capture `/checkout` with address, order lines, subtotal,
delivery fee, total, and available payment methods; do not show full personal
address details in the report.

**What to say:** "Checkout performs authoritative validation on the backend and
uses idempotency to avoid duplicate submissions. PayMongo credentials remain
inside Edge Function secrets, while the customer is redirected only to the
provider's hosted payment page."

#### 3.3.1.6. Order History, Tracking, Cancellation, Return, and Review Module

**Purpose:** Gives each customer a complete, private post-purchase experience
for their own orders and products.

**Key functions:**

- Lists the customer's orders and item details with distinct fulfillment and
  payment statuses.
- Displays a responsive progress timeline with date and time for Pending,
  Processing, Packed, Shipped, and Delivered events.
- Receives status, payment, cancellation, return, and refund updates in realtime.
- Allows eligible customer cancellation or return requests and exposes the
  resulting status without permitting unauthorized changes.
- Enables a delivered product to receive one verified-purchase review with a
  rating, text, and up to two images; approved content appears on its product
  page with username and date.

**Dependencies:** Orders, Order Items, Order Status History, Payment
Transactions, Return Requests, Reviews, Storage, Notifications, Realtime,
PayMongo refund processing, and transactional email.

**Screenshots:** Capture `/orders` or `/profile?tab=orders` with the order cards,
expanded delivery timeline, and **Write a review** action for a delivered item.
Capture the review dialog separately.

**What to say:** "The post-purchase module keeps payment and delivery status
independent, records each fulfillment milestone, and limits reviews to products
linked to a delivered order item. Customer ownership is enforced by RLS."

#### 3.3.1.7. Customer Support, Notifications, and AI Care Module

**Purpose:** Provides multiple connected channels for guidance, transactional
updates, and human support.

**Key functions:**

- Shows customer notifications for orders, payments, returns, reviews,
  announcements, and support tickets.
- Creates support tickets with category, priority, message, optional order, and
  attachments; displays replies and ticket status in realtime.
- Offers a persistent, polite AI shopping and customer-care assistant with
  catalog, policy, delivery, payment, and support guidance while directing
  account-specific concerns to protected flows.
- Stores only limited recent chatbot context and applies rate and token controls
  to manage operating cost.

**Dependencies:** Customer Notifications, Support Tickets, Storage, Realtime,
Store Settings, `cozycraft-assistant` Edge Function, Groq, and the authenticated
customer context supplied by protected backend queries.

**Screenshots:** Capture `/profile?tab=support` with a ticket and status, the
notification panel, and the open CozyCraft Care assistant.

**What to say:** "Support tickets and notifications use the same protected
database as operations, allowing the customer and staff to see permitted
updates without exposing another user's data. The AI assistant handles general
guidance and escalates protected account actions."

#### 3.3.1.8. Member Tier and Loyalty Module

**Purpose:** Records customer points, tier progress, transactions, and eligible
reward redemptions.

**Key functions:**

- Displays the customer's current points, tier, progress, and applicable
  benefits.
- Records points earned or adjusted through traceable loyalty transactions.
- Supports controlled reward redemption and prevents negative or unauthorized
  balances.

**Dependencies:** Loyalty Accounts, Loyalty Transactions, Loyalty Redemptions,
Profiles, Orders, RLS, and the Admin Member Tier module.

**Screenshot:** Capture the member-tier section in the customer profile with
demonstration values only.

**What to say:** "The loyalty module links one member account to each customer
profile and keeps every points change auditable through a transaction record."

#### 3.3.1.9. Information, Policies, and Developer Profiles Module

**Purpose:** Gives customers the business, legal, contact, help, and project-team
information required to understand and trust the service.

**Key functions:**

- Presents the About Us story and project team profiles.
- Provides Contact, FAQ, Terms of Use, and Privacy Policy pages with responsive,
  readable layouts.
- Connects legal-policy links to the registration agreement and provides the
  CozyCraft business contact channel.

**Dependencies:** Store Settings, Content Management, Customer Policy versions,
and public routes.

**Screenshots:** Capture `/about` at the team section and one composite or two
small captures of `/faq` and `/privacy`.

**What to say:** "The Information and Policies module makes business identity,
customer guidance, legal terms, privacy practices, and team information
available from the storefront and registration experience."

### 3.3.2. Admin Site (Backend Management) Modules and Functions

#### 3.3.2.1. Admin Login, Session, and Role Access Module

**Purpose:** Provides a separate, protected administrative sign-in experience
for active super administrator, administrator, and staff accounts.

**Key functions:**

- Authenticates approved personnel without exposing admin entry through the
  customer sign-in flow.
- Loads the database role and active status before allowing an admin route.
- Applies route and action permissions for super administrator, administrator,
  and staff responsibilities.
- Supports concurrent authorized sessions, idle timeout, explicit logout, and
  sign-in/sign-out activity logging.

**Dependencies:** Separate admin Supabase client storage, Auth, Profiles, Admin
Security Settings, Activity Logs, RLS, and admin access-control utilities.

**Screenshot:** Capture `/admin/login` and the signed-in admin account menu with
the role displayed.

**What to say:** "Administrative authentication has a separate interface and
session namespace. Permission checks are repeated at the database or trusted
function layer, so hiding a button is not the only protection."

#### 3.3.2.2. Overview and Workspace Navigation Module

**Purpose:** Summarizes current operations and provides fast, role-aware access
to administrative tools.

**Key functions:**

- Displays sales, order, customer, inventory, review, and activity summaries
  derived from current database records.
- Provides grouped, responsive navigation and command search across accessible
  admin pages.
- Shows realtime notifications for operational events and links each
  notification to its relevant record or workspace.

**Dependencies:** Orders, Payments, Products, Inventory, Customers, Reviews,
Admin Notifications, Reports, Realtime, and Role Access.

**Screenshot:** Capture `/admin` with summary cards, a data visualization,
grouped navigation, search control, notification indicator, and signed-in role.

**What to say:** "The Overview module turns live operational data into concise
indicators and routes each role to the tools it is allowed to use."

#### 3.3.2.3. Product, Category, Content, and Merchandising Module

**Purpose:** Controls the catalog and presentation customers see across all
storefront collections and product pages.

**Key functions:**

- Creates, edits, publishes, drafts, and deactivates products.
- Stores description, category, subcategory, price, stock, reorder point,
  status, structured materials, structured dimensions, and exactly four product
  images with one explicit main image.
- Prevents duplicate names within the same category and subcategory while
  allowing legitimate reuse in a different placement.
- Manages categories, storefront content, merchandising, New Arrivals, and
  customer experience settings.
- Propagates permitted product and image updates to the web storefront and
  mobile client through the shared database.

**Dependencies:** Products, Categories, Product Views, Product Images in
Storage, Inventory Movements, Content services, Store Settings, Realtime, and
Activity Logs.

**Screenshots:** Capture `/admin/products` and `/admin/products/new`, showing the
description, material rows, dimension rows, four-image limit, main-image
selector, category placement, stock, and publishing status.

**What to say:** "Product management writes structured catalog data to the
shared source of truth. A product's category identity and main image—not only
its display name—determine where and how it appears."

#### 3.3.2.4. Inventory Management Module

**Purpose:** Maintains accurate product availability and a traceable history of
stock movements.

**Key functions:**

- Shows current stock, low-stock status, reorder point, and availability.
- Records manual adjustments and order-related inventory movements.
- Prevents customer bag quantities and checkout quantities from exceeding
  authoritative stock.
- Generates low-stock admin notifications according to active settings.

**Dependencies:** Products, Inventory Movements, Order placement RPCs, Store
Settings, Admin Notifications, Realtime, and Activity Logs.

**Screenshot:** Capture `/admin/inventory` with stock, reorder point, low-stock
indicator, and adjustment control.

**What to say:** "Inventory combines the current product stock value with an
auditable movement ledger. Checkout revalidates stock on the server to prevent
overselling during concurrent orders."

#### 3.3.2.5. Order, Fulfillment, Cancellation, and Return Management Module

**Purpose:** Gives authorized personnel a realtime order desk from order receipt
through delivery, cancellation, return, or refund completion.

**Key functions:**

- Lists web and mobile orders with customer, address, products, totals, payment
  status, delivery status, and pagination.
- Updates valid fulfillment transitions and records a timestamped status
  history for Pending, Processing, Packed, Shipped, and Delivered.
- Handles eligible cancellation and return requests with protected validation.
- Keeps order, customer profile, notifications, reports, and mobile views
  synchronized through Realtime plus bounded fallback refreshes.
- Produces printable packing-list data.

**Dependencies:** Orders, Order Items, Status History, Profiles, Addresses,
Payment Transactions, Return Requests, Notifications, Realtime, protected
order RPCs, and Activity Logs.

**Screenshot:** Capture `/admin/orders` with the order list, selected order,
status control, timestamped progress, products, customer summary, and the live
updates indicator.

**What to say:** "The Order Desk is the operational source for fulfillment.
Each accepted status transition is persisted with a time and actor, then the
customer and administrative views receive the same permitted update."

#### 3.3.2.6. Payment and Refund Management Module

**Purpose:** Reconciles payment-provider results with CozyCraft orders and
provides a controlled refund workflow.

**Key functions:**

- Displays transaction reference, method, amount, provider status, and linked
  order without storing complete card or wallet credentials.
- Uses verified PayMongo webhooks and synchronization functions to update
  payment state independently from fulfillment state.
- Validates refundable states, submits provider refund operations, persists the
  result, updates the order, notifies the customer, and sends or resends the
  refund email.
- Makes first-send and resend actions explicit and auditable.

**Dependencies:** Payment Transactions, Orders, Return Requests, PayMongo Edge
Functions, PayMongo webhooks, server secrets, Resend, Customer Notifications,
Realtime, and Activity Logs.

**Screenshot:** Capture `/admin/payments` and an order's refund section using
test-mode data, with all provider secrets and sensitive references concealed.

**What to say:** "Payment status is updated by trusted backend calls and
verified provider events, not by customer-controlled browser values. Refunds
follow a recorded workflow and remain distinct from delivery status."

#### 3.3.2.7. Customer, Member Tier, and Loyalty Management Module

**Purpose:** Gives authorized roles a limited operational view of customers and
their Home Circle membership without exposing unrelated private data.

**Key functions:**

- Lists customer identity and operational summary data permitted to the signed-
  in role.
- Supports account-status administration through protected functions.
- Monitors loyalty points, member tier, progress, transactions, and reward
  redemptions.
- Records administrative loyalty adjustments and resulting audit activity.

**Dependencies:** Profiles, Orders, Customer Preferences, Loyalty Accounts,
Loyalty Transactions, Loyalty Redemptions, protected customer-management Edge
Function, RLS, Realtime, and Activity Logs.

**Screenshots:** Capture `/admin/customers` and `/admin/member-tiers`, ensuring
private data not needed for evaluation is hidden.

**What to say:** "Customer and loyalty management expose only the fields and
actions needed for operations. Points changes are recorded as transactions
rather than silently replacing a balance."

#### 3.3.2.8. Review Moderation Module

**Purpose:** Allows authorized personnel to evaluate verified-purchase reviews
before approved content becomes public.

**Key functions:**

- Displays the linked customer, product, order item, rating, review text, date,
  and up to two protected review images.
- Supports responsive image preview and approve or reject actions.
- Publishes only approved reviews to the corresponding customer product page.
- Sends relevant customer and admin notifications and records moderation in the
  activity log.

**Dependencies:** Reviews, Profiles, Products, Order Items, Storage signed URLs,
Notifications, Realtime, RLS, and Activity Logs.

**Screenshot:** Capture `/admin/reviews` with a pending review, its image
preview, verified-purchase context, and moderation actions.

**What to say:** "Review moderation checks the content and uploaded images while
preserving the review's verified link to a delivered product. Approved content
then appears on that specific product page."

#### 3.3.2.9. Support Inbox and Notification Module

**Purpose:** Connects customer support conversations and operational alerts to
the administrative workspace in realtime.

**Key functions:**

- Lists support tickets with customer, subject, priority, category, timestamps,
  attachments, replies, and Open, In Progress, or Resolved status.
- Lets authorized personnel reply and update ticket status; the customer sees
  permitted changes in the profile support page.
- Aggregates order, payment, inventory, review, support, customer, content, and
  store-setting events in the admin notification panel.
- Tracks per-admin read state instead of marking a notification read for every
  team member.

**Dependencies:** Support Tickets, Admin Notifications, Notification Reads,
Customer Notifications, Profiles, Storage, Realtime, RLS, and Activity Logs.

**Screenshot:** Capture `/admin/support` with the inbox, selected ticket,
conversation, status control, and reply form; also capture the admin
notification panel.

**What to say:** "The support and notification modules use database events to
coordinate customer and administrative views. Per-user read records prevent
one administrator from clearing another administrator's alerts."

#### 3.3.2.10. Reports and Analytics Module

**Purpose:** Converts current commerce and operational records into decision-
support summaries.

**Key functions:**

- Calculates sales trend, order counts, payment summaries, best-selling
  categories, strongest channel, customer totals, and low-stock products.
- Excludes or separates cancelled, failed, pending, and refunded amounts where
  appropriate instead of treating all orders as settled revenue.
- Supports bounded date ranges and action-report generation to reduce database
  egress.
- Updates relevant visualizations when source records change.

**Dependencies:** Orders, Order Items, Payment Transactions, Products,
Categories, Profiles, Returns, database views or RPC summaries, Realtime, and
Report Settings.

**Screenshot:** Capture `/admin/reports` with the sales trend, date range,
best-selling category, channel summary, analyst note, and action-report control.

**What to say:** "Reports derive business indicators from the same transaction
records used by checkout and fulfillment. Aggregated, date-bounded queries keep
the page accurate without repeatedly downloading entire tables."

#### 3.3.2.11. Activity Logs and Audit Module

**Purpose:** Provides an append-oriented audit trail of important customer,
administrator, web, mobile, and trusted-system actions.

**Key functions:**

- Records actor, role, action, entity type, entity identifier, channel, summary,
  metadata, and timestamp for important events.
- Includes account creation, sign-in, sign-out, product and inventory changes,
  order status changes, payment/refund actions, review moderation, support
  activity, team management, and store-setting changes.
- Provides filters, search, date controls, and pagination to avoid an excessively
  long page or unbounded database reads.

**Dependencies:** Activity Logs, Auth events, protected RPCs and Edge Functions,
Admin Roles, Web and Mobile channels, RLS, and indexed queries.

**Screenshot:** Capture `/admin/activity-logs` with filters, channel, actor,
action summary, timestamp, and pagination visible.

**What to say:** "The audit module creates traceability across web, mobile, and
admin operations. Pagination and indexed filters improve usability and control
database egress."

#### 3.3.2.12. Team Access and Store Settings Module

**Purpose:** Controls administrative membership, permissions, security policy,
and customer-facing business configuration.

**Key functions:**

- Invites a team member through a secure email flow, assigns a role, changes a
  role, and suspends or restores access through protected server operations.
- Configures store identity, contact information, announcement, maintenance
  mode, catalog experience, checkout methods, delivery fee and free-delivery
  threshold, fulfillment, reviews, accounts, notifications, email events,
  reports, and security controls.
- Applies validated settings to both the admin workspace and customer
  storefront through one database record and realtime subscription.
- Prevents ordinary roles from changing super-administrator-only controls.

**Dependencies:** Profiles, Store Settings, Admin Security Settings, secure team
management Edge Function, Resend, Auth Admin API, Realtime, RLS, and Activity
Logs.

**Screenshots:** Capture `/admin/team` with the invite form and active team list;
capture `/admin/settings` with delivery, checkout, announcement, and security
settings visible.

**What to say:** "Team and Settings operations require server-side authority.
Validated store settings form a shared configuration source, so an approved
change—such as the free-delivery threshold or announcement—appears consistently
in the customer experience."

## Recommended screenshot set for the paper

Use 12 to 14 screenshots rather than one screenshot for every small function.
This keeps Section 3.3 comprehensive without making the document repetitive.

| No. | Screenshot | What must be visible | Modules covered |
| --- | --- | --- | --- |
| 1 | Customer home | Hero, navigation, featured discovery, care control | Home and Discovery |
| 2 | Room collection | Search, category, price slider, product cards, stock states | Catalog and Search |
| 3 | Product details | Images, description, materials, dimensions, stock, approved reviews | Product Details and Reviews |
| 4 | Customer account | Profile identity, addresses or security controls, member tier | User Management and Loyalty |
| 5 | Bag | Partial selection, quantities, selected subtotal, delivery fee, total | Bag and Wishlist |
| 6 | Checkout | Address, order lines, delivery, total, COD/card/GCash choices | Checkout and Payment |
| 7 | Customer order | Order items, payment label, timeline timestamps, review action | Order History and Tracking |
| 8 | Customer support | Ticket conversation/status or AI Care and notifications | Support and Notifications |
| 9 | Admin overview | Metrics, visualization, grouped navigation, live notification | Overview and Reports |
| 10 | Product editor | Description, structured materials/dimensions, four images, main image, stock | Product and Inventory |
| 11 | Admin order desk | Orders, selected order, status history, payment/refund section | Fulfillment and Payments |
| 12 | Reviews/support | Review images and moderation or support ticket status/reply | Engagement Operations |
| 13 | Customers/member tiers | Customer summary and loyalty monitoring | Customer and Loyalty |
| 14 | Team/settings/audit | Role assignment, important store setting, or activity-log pagination | Governance and Audit |

### Screenshot presentation rules

- Use the same browser size and zoom throughout the paper.
- Crop to the application page, not the browser tabs or personal desktop.
- Mask personal addresses, private email addresses, access tokens, provider
  references, and all secret values.
- Use demonstration customer and order data where possible.
- Place a numbered caption below every screenshot and refer to the figure number
  in the explanatory paragraph.
- Do not repeat a full-page screenshot if a carefully cropped section explains
  the function more clearly.

## Architecture qualities demonstrated by the design

- **Modularity:** Storefront, admin, authentication, catalog, commerce,
  fulfillment, engagement, reporting, settings, and loyalty responsibilities
  are separated while sharing typed services.
- **API communication:** Browser-safe Data API and Realtime communication are
  separated from trusted Edge Function calls for payments, email, AI, team
  management, refunds, and other secret-bearing operations.
- **Database design:** Primary and foreign keys preserve entity relationships;
  domain-focused tables avoid mixing unrelated concerns; and RLS enforces
  ownership and roles.
- **Realtime behavior:** Targeted subscriptions synchronize important changes,
  with bounded refresh and focus recovery instead of constant full-table
  polling.
- **Security:** Secrets remain on the server, sensitive images use protected
  storage and signed URLs, and authorization is enforced in the database and
  trusted backend—not only in the UI.
- **Reliability:** Idempotent checkout, status history, webhook reconciliation,
  database constraints, error handling, and audit records support consistent
  outcomes.
- **Scalability and egress control:** Paginated reads, selected columns,
  aggregated reports, indexed filters, private signed assets, and scoped
  realtime channels reduce unnecessary data transfer.
- **Maintainability:** Editable Mermaid sources, clear module boundaries,
  migrations, documented functions, and deployable versioned builds support
  future changes.
