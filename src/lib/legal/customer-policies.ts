export const CUSTOMER_POLICY_VERSION = "2026-08-16";
export const CUSTOMER_POLICY_EFFECTIVE_DATE = "August 16, 2026";
export const COZYCRAFT_PRIVACY_EMAIL = "cozycraftfurnitures2026@gmail.com";

export type CustomerPolicyKind = "terms" | "privacy";

export type CustomerPolicySection = {
  title: string;
  body: string;
};

export const CUSTOMER_TERMS_SECTIONS: CustomerPolicySection[] = [
  {
    title: "Using CozyCraft",
    body:
      "These Terms of Use govern customer access to CozyCraft Furnitures’ website, account features, catalog, checkout, delivery tracking, reviews, support, and related services. By creating an account, you confirm that the information you provide is accurate, that you have legal capacity to enter into a transaction, and that you will use the service only for lawful personal shopping purposes.",
  },
  {
    title: "Your account and security",
    body:
      "You are responsible for keeping your sign-in credentials and verification methods secure and for activity performed through your account. Do not share credentials, attempt to access another person’s data, automate abusive requests, interfere with the service, or misuse discounts, reviews, refunds, or support tools. Notify CozyCraft Care promptly if you believe your account has been compromised.",
  },
  {
    title: "Catalog, pricing, and availability",
    body:
      "CozyCraft aims to keep product descriptions, images, dimensions, prices, availability, and delivery information accurate. Furniture color and finish may vary slightly because of materials, lighting, and display settings. A product placed in a bag is not reserved. Availability is confirmed when an order is accepted, and an obvious pricing or catalog error may be corrected before fulfillment with notice and an appropriate refund when payment was already collected.",
  },
  {
    title: "Orders and payment",
    body:
      "Submitting checkout is an offer to purchase the selected products. An order is accepted when CozyCraft confirms it and can still be reviewed for stock, address, payment, fraud-prevention, and delivery eligibility. Cash on delivery may be offered for eligible orders. Card and GCash checkout are processed through PayMongo; CozyCraft does not receive or store complete card or wallet credentials. Payment and order statuses remain distinct and are shown in your account.",
  },
  {
    title: "Delivery, cancellation, and returns",
    body:
      "Available delivery fees, free-delivery thresholds, service areas, and estimated dates are presented before checkout and may depend on the selected address and order subtotal. Customers may request cancellation or return only while the order is eligible under the policy and status shown in CozyCraft. Approved refunds are returned through the applicable payment workflow. Nothing in these Terms removes remedies or warranties that cannot lawfully be excluded under Philippine consumer law.",
  },
  {
    title: "Reviews and customer content",
    body:
      "Verified purchasers may submit honest reviews and limited product photos after delivery. You retain responsibility for content you upload and confirm that you have the right to share it. Do not upload unlawful, misleading, discriminatory, infringing, private, or unrelated material. CozyCraft may moderate or remove content that violates these rules while preserving legitimate customer feedback.",
  },
  {
    title: "Service availability and responsibility",
    body:
      "CozyCraft uses reasonable safeguards and continuity measures but cannot promise that internet-dependent features will always be uninterrupted. To the extent permitted by law, responsibility is limited to losses directly caused by a proven breach of these Terms. This limitation does not apply where Philippine law prohibits it, and it does not waive mandatory consumer or data-subject rights.",
  },
  {
    title: "Philippine consumer and online-transaction rights",
    body:
      "CozyCraft recognizes the mandatory protections provided by the Consumer Act of the Philippines (Republic Act No. 7394), the Electronic Commerce Act of 2000 (Republic Act No. 8792), the Internet Transactions Act of 2023 (Republic Act No. 11967), and their applicable rules. Product information, prices, fees, payment steps, seller contact channels, and material order conditions are presented so customers can make an informed decision. These Terms must not be interpreted to remove a non-waivable statutory warranty, remedy, disclosure, or complaint right.",
  },
  {
    title: "Changes, law, and contact",
    body:
      `Material changes will be dated and communicated where appropriate. Continued use may require acceptance of a new version. These Terms are governed by the laws of the Republic of the Philippines. Questions, complaints, or account concerns may be sent to ${COZYCRAFT_PRIVACY_EMAIL}.`,
  },
];

export const CUSTOMER_PRIVACY_SECTIONS: CustomerPolicySection[] = [
  {
    title: "Who is responsible for your information",
    body:
      `CozyCraft Furnitures is the personal information controller for customer information processed through this service. Privacy questions, requests, and objections may be sent to ${COZYCRAFT_PRIVACY_EMAIL} from the email associated with your account.`,
  },
  {
    title: "Information we process",
    body:
      "We process account identity and contact details; profile information you choose to provide; authentication and account-security events; saved addresses and preferences; bag and wishlist records; orders, product selections, payment status, delivery events, cancellations, returns, and refunds; reviews and uploaded images; support messages and attachments; and limited device, error, and activity information needed to secure and operate the service. CozyCraft does not store complete card or GCash credentials.",
  },
  {
    title: "Why and how we use it",
    body:
      "We use necessary information to create and secure accounts, perform requested transactions, calculate delivery, fulfill and track orders, provide customer care, manage returns and refunds, display verified reviews, prevent misuse, meet legal obligations, and maintain service reliability. Depending on the activity, processing is based on steps requested before a contract, performance of a contract, legal obligations, legitimate interests that do not override your rights, or specific consent where Philippine law requires it. We do not treat account creation as consent to unrelated marketing.",
  },
  {
    title: "Service providers and disclosures",
    body:
      "Information is shared only as needed with providers performing a defined service: Supabase for authentication, database, protected storage, realtime features, and server functions; PayMongo for hosted online payments; Resend for transactional email; Google when you choose Google sign-in; and Netlify for website delivery. Delivery, professional, fraud-prevention, legal, or government recipients may receive limited information when necessary or lawfully required. Providers are expected to protect information and use it only for their assigned purpose.",
  },
  {
    title: "Storage, cookies, and international processing",
    body:
      "CozyCraft uses essential browser storage and authentication tokens to keep you signed in, preserve selected shopping actions, protect checkout, and maintain recent chatbot context in the current tab. Some providers may process information in infrastructure outside the Philippines. CozyCraft remains accountable for appropriate contractual, technical, and organizational safeguards when personal data is transferred or processed through service providers.",
  },
  {
    title: "Retention",
    body:
      "Account and profile information is retained while the account is active. Following a verified deletion request, eligible profile information is deleted or anonymized within 90 days unless it must be kept for security, an active transaction, a dispute, or law. Order, payment-status, cancellation, refund, and accounting records may be retained for up to five years from the relevant transaction or longer when required by law or a continuing claim. Routine support and security records are ordinarily retained for up to two years unless an active issue requires longer preservation.",
  },
  {
    title: "Security",
    body:
      "CozyCraft uses Supabase Row Level Security, role-based staff permissions, protected server secrets, authenticated storage access, encryption in transit, audit records, and operational monitoring. No internet system can be guaranteed completely secure, so customers should use a unique password, protect verification codes, and report suspicious activity promptly.",
  },
  {
    title: "Your data-subject rights",
    body:
      "Under the Philippine Data Privacy Act, you may have rights to be informed, access personal data, object to certain processing, correct inaccurate information, request erasure or blocking where allowed, obtain data portability where applicable, claim damages, and lodge a complaint with the National Privacy Commission. You may also withdraw consent for processing that relies on consent; withdrawal does not affect prior lawful processing or processing supported by another lawful basis. CozyCraft will verify identity before completing a request.",
  },
  {
    title: "Updates and complaints",
    body:
      `The effective date and version identify this notice. Material changes will be communicated and, where legally required, presented for renewed acknowledgement or consent. Contact ${COZYCRAFT_PRIVACY_EMAIL} first so CozyCraft can investigate; you may also exercise your right to complain directly to the National Privacy Commission.`,
  },
];
