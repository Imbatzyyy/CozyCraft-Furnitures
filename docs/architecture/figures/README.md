# CozyCraft architecture figures

The complete, ready-to-paste Section 3 narrative and screenshot plan is in
[`../SECTION-3-SYSTEM-ARCHITECTURE.md`](../SECTION-3-SYSTEM-ARCHITECTURE.md).

This folder contains the document-ready system architecture figures for
Section 3.1 of the CozyCraft Furniture project paper. The diagrams are derived
from the current repository architecture, database domain map, routes, Edge
Functions, and documented provider boundaries.

## What CozyCraft is

CozyCraft Furniture is a full-stack, responsive furniture commerce platform
that unifies a public customer storefront and a separately protected
administrative workspace. Customers can discover products by room and
subcategory, search and filter the catalog, view detailed product information,
maintain a cross-device cart and wishlist, check out using cash on delivery or
PayMongo-hosted card and GCash payments, track orders in realtime, submit
verified-purchase reviews, manage their profile and delivery addresses, contact
support, receive notifications, and participate in the Home Circle member-tier
program.

Authorized super administrators, administrators, and staff use the same
protected system of record through a role-controlled operations workspace. The
workspace supports catalog and image management, inventory monitoring, order
fulfillment, payment reconciliation, cancellation and refund workflows,
customer and review management, support tickets, member-tier monitoring,
reports, notifications, team permissions, store settings, and auditable
activity history.

The application is built with React, TypeScript, and Vite. Netlify serves the
versioned web build, while Cloudflare provides production DNS and TLS. Supabase
provides Auth, PostgreSQL, the Data API, protected RPC functions, Realtime,
Storage, and Edge Functions. External integrations include Google OAuth,
PayMongo, Resend, Groq AI, and Philippine address data. PostgreSQL constraints,
grants, row-level security policies, and protected server functions remain the
final authorization boundary.

## Figure index and ready-to-use captions

### Figure 3.1 - High-level system architecture

- SVG: `01-high-level-system-architecture.svg`
- PNG: `01-high-level-system-architecture.png`
- Source: `source/01-high-level-system-architecture.mmd`

**Caption:** Detailed high-level architecture of the CozyCraft Furniture
e-commerce system, showing system users, customer and administrative
experiences, the shared React application, Supabase backend services,
PostgreSQL, and external providers.

### Figure 3.2 - Customer and admin module map

- SVG: `02-customer-admin-module-map.svg`
- PNG: `02-customer-admin-module-map.png`
- Source: `source/02-customer-admin-module-map.mmd`

**Caption:** Functional module map of the CozyCraft customer storefront and
role-protected administrative workspace. Both experiences use the same
protected data services while exposing different actions and permissions.

### Figure 3.3 - Backend services and Edge Functions

- SVG: `03-backend-services-and-edge-functions.svg`
- PNG: `03-backend-services-and-edge-functions.png`
- Source: `source/03-backend-services-and-edge-functions.mmd`

**Caption:** CozyCraft backend service architecture, including Supabase Auth,
Data API, RPC, Realtime, Storage, Edge Function groups, security boundaries,
server-only secrets, and external provider communication.

### Figure 3.4A - Core commerce database

- SVG: `04a-core-commerce-database.svg`
- PNG: `04a-core-commerce-database.png`
- Source: `source/04a-core-commerce-database.mmd`

**Caption:** Core CozyCraft identity, catalog, shopping, order, payment, and
return relationships in the PostgreSQL database.

### Figure 3.4B - Verified-review database

- SVG: `04b-verified-reviews-database.svg`
- PNG: `04b-verified-reviews-database.png`
- Source: `source/04b-verified-reviews-database.mmd`

**Caption:** CozyCraft verified-purchase review relationships, connecting the
reviewer, product, and fulfilled order item to moderated review content.

### Figure 3.4C - Support and notification database

- SVG: `04c-support-notification-database.svg`
- PNG: `04c-support-notification-database.png`
- Source: `source/04c-support-notification-database.mmd`

**Caption:** CozyCraft customer-support, in-app notification, and mobile
push-token relationships scoped to each authenticated customer profile.

### Figure 3.4D - Administration and loyalty database

- SVG: `04d-administration-loyalty-database.svg`
- PNG: `04d-administration-loyalty-database.png`
- Source: `source/04d-administration-loyalty-database.mmd`

**Caption:** CozyCraft administrative audit, notification-read, security,
member-tier, loyalty transaction, and reward-redemption relationships in the
PostgreSQL database.

### Figure 3.5 - External API integrations

- SVG: `05-external-api-integrations.svg`
- PNG: `05-external-api-integrations.png`
- Source: `source/05-external-api-integrations.mmd`

**Caption:** External service integration flows for Google authentication,
PayMongo payments, Resend email, Groq-assisted customer care, and Philippine
delivery address data.

### Figure 3.6A - Realtime order creation and fulfillment

- SVG: `06a-order-creation-and-fulfillment.svg`
- PNG: `06a-order-creation-and-fulfillment.png`
- Source: `source/06a-order-creation-and-fulfillment.mmd`

**Caption:** Realtime order lifecycle from customer checkout through order
creation, administrator fulfillment, customer tracking, delivery, and
verified-purchase review eligibility.

### Figure 3.6B - Cancellation and refund lifecycle

- SVG: `06b-cancellation-and-refund-lifecycle.svg`
- PNG: `06b-cancellation-and-refund-lifecycle.png`
- Source: `source/06b-cancellation-and-refund-lifecycle.mmd`

**Caption:** Protected cancellation and refund lifecycle, showing ownership and
status validation, administrative approval, PayMongo communication, persisted
results, and realtime customer updates.

### Figure 3.7 - Security and deployment topology

- SVG: `07-security-and-deployment-topology.svg`
- PNG: `07-security-and-deployment-topology.png`
- Source: `source/07-security-and-deployment-topology.mmd`

**Caption:** CozyCraft production delivery, browser-safe credentials, Supabase
authorization boundaries, server-only secrets, and controlled web and backend
release flow.

## Document placement

Insert the SVG versions in Word whenever possible because SVG remains sharp at
any zoom level. Center each figure at approximately 6.2 to 6.5 inches wide and
place the caption directly below it. Use one figure per page for Figures 3.1,
3.2, and 3.3. The database figures may appear on consecutive pages. Keep
the Mermaid source files with the project so the figures remain editable.

## Visual legend

- Charcoal: users and actors
- Blue-gray: customer-facing application areas
- Warm beige: administrative areas and release steps
- Sage green: Supabase and internal backend services
- Muted purple: Edge Functions, external providers, or server-only secrets
- Stone: PostgreSQL tables, storage, and protected data resources
