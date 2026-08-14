export type CheckoutSettings = {
  standard_delivery_fee: number;
  free_delivery_minimum: number;
  minimum_order_amount: number;
  maximum_order_amount: number;
  cod_enabled: boolean;
  card_enabled: boolean;
  gcash_enabled: boolean;
  cod_maximum_order: number;
};

export type FulfillmentSettings = {
  estimated_delivery_days_min: number;
  estimated_delivery_days_max: number;
  cancellation_window_hours: number;
  return_window_days: number;
  order_number_prefix: string;
  stock_reservation_minutes: number;
  out_of_stock_behavior: "hide" | "show_unavailable";
  auto_archive_discontinued: boolean;
};

export type ReviewSettings = {
  approval_required: boolean;
  verified_purchases_only: boolean;
  minimum_length: number;
  maximum_length: number;
  photos_enabled: boolean;
};

export type AccountSettings = {
  username_required: boolean;
  google_auth_enabled: boolean;
  email_verification_required: boolean;
  password_minimum_length: number;
  customer_mfa_available: boolean;
};

export type EmailEventSettings = {
  account_confirmation: boolean;
  order_confirmation: boolean;
  payment_received: boolean;
  fulfillment_updates: boolean;
  delivered: boolean;
  cancelled_refunded: boolean;
  support_replies: boolean;
};

export type ReportSettings = {
  timezone: string;
  frequency: "weekly" | "monthly";
  default_range: "This week" | "This month" | "Quarter";
  recipients: string[];
  data_retention_days: number;
};

export type PublicStoreSettings = {
  id: boolean;
  store_name: string;
  store_description: string;
  contact_email: string;
  support_phone: string;
  business_address: string;
  delivery_area: string;
  low_stock_threshold: number;
  inventory_alerts: boolean;
  weekly_report_enabled: boolean;
  social_links: Record<string, string>;
  announcement_enabled: boolean;
  announcement_text: string;
  announcement_link: string;
  maintenance_mode: boolean;
  checkout_settings: CheckoutSettings;
  fulfillment_settings: FulfillmentSettings;
  review_settings: ReviewSettings;
  account_settings: AccountSettings;
  email_event_settings: EmailEventSettings;
  report_settings: ReportSettings;
  updated_at: string | null;
};

export type AdminSecuritySettings = {
  id: boolean;
  require_admin_mfa: boolean;
  session_timeout_minutes: number;
  maximum_failed_logins: number;
  lockout_minutes: number;
  security_alerts_enabled: boolean;
  notification_email: string;
  integration_status: Record<string, boolean>;
  updated_at: string | null;
  updated_by: string | null;
};

export const defaultStoreSettings: PublicStoreSettings = {
  id: true,
  store_name: "CozyCraft Furnitures",
  store_description: "Designed for a slower, warmer life at home.",
  contact_email: "hello@cozycraftfurnitures.com",
  support_phone: "",
  business_address: "",
  delivery_area: "Metro Manila",
  low_stock_threshold: 8,
  inventory_alerts: true,
  weekly_report_enabled: false,
  social_links: { facebook: "", instagram: "", tiktok: "" },
  announcement_enabled: false,
  announcement_text: "",
  announcement_link: "",
  maintenance_mode: false,
  checkout_settings: {
    standard_delivery_fee: 650,
    free_delivery_minimum: 50_000,
    minimum_order_amount: 0,
    maximum_order_amount: 0,
    cod_enabled: true,
    card_enabled: true,
    gcash_enabled: true,
    cod_maximum_order: 0,
  },
  fulfillment_settings: {
    estimated_delivery_days_min: 5,
    estimated_delivery_days_max: 7,
    cancellation_window_hours: 24,
    return_window_days: 7,
    order_number_prefix: "CC",
    stock_reservation_minutes: 15,
    out_of_stock_behavior: "show_unavailable",
    auto_archive_discontinued: false,
  },
  review_settings: {
    approval_required: false,
    verified_purchases_only: true,
    minimum_length: 5,
    maximum_length: 2000,
    photos_enabled: false,
  },
  account_settings: {
    username_required: true,
    google_auth_enabled: true,
    email_verification_required: true,
    password_minimum_length: 8,
    customer_mfa_available: true,
  },
  email_event_settings: {
    account_confirmation: true,
    order_confirmation: true,
    payment_received: true,
    fulfillment_updates: true,
    delivered: true,
    cancelled_refunded: true,
    support_replies: true,
  },
  report_settings: {
    timezone: "Asia/Manila",
    frequency: "weekly",
    default_range: "This month",
    recipients: [],
    data_retention_days: 90,
  },
  updated_at: null,
};

export const defaultAdminSecuritySettings: AdminSecuritySettings = {
  id: true,
  require_admin_mfa: true,
  session_timeout_minutes: 480,
  maximum_failed_logins: 5,
  lockout_minutes: 15,
  security_alerts_enabled: true,
  notification_email: "",
  integration_status: {
    supabase: true,
    paymongo: true,
    resend: true,
    google_oauth: true,
    chatbot: true,
  },
  updated_at: null,
  updated_by: null,
};

const objectValue = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const normalizeStoreSettings = (
  value: Partial<PublicStoreSettings> | null | undefined,
): PublicStoreSettings => {
  const source = value ?? {};
  return {
    ...defaultStoreSettings,
    ...source,
    social_links: {
      ...defaultStoreSettings.social_links,
      ...objectValue(source.social_links),
    } as Record<string, string>,
    checkout_settings: {
      ...defaultStoreSettings.checkout_settings,
      ...objectValue(source.checkout_settings),
    } as CheckoutSettings,
    fulfillment_settings: {
      ...defaultStoreSettings.fulfillment_settings,
      ...objectValue(source.fulfillment_settings),
    } as FulfillmentSettings,
    review_settings: {
      ...defaultStoreSettings.review_settings,
      ...objectValue(source.review_settings),
    } as ReviewSettings,
    account_settings: {
      ...defaultStoreSettings.account_settings,
      ...objectValue(source.account_settings),
    } as AccountSettings,
    email_event_settings: {
      ...defaultStoreSettings.email_event_settings,
      ...objectValue(source.email_event_settings),
    } as EmailEventSettings,
    report_settings: {
      ...defaultStoreSettings.report_settings,
      ...objectValue(source.report_settings),
    } as ReportSettings,
  };
};

export const calculateDeliveryFee = (
  subtotal: number,
  settings: CheckoutSettings,
) => {
  const standardFee = Math.max(0, Number(settings.standard_delivery_fee) || 0);
  const freeMinimum = Math.max(0, Number(settings.free_delivery_minimum) || 0);
  return freeMinimum > 0 && subtotal >= freeMinimum ? 0 : standardFee;
};

export const isPaymentMethodAvailable = (
  method: string,
  subtotal: number,
  settings: CheckoutSettings,
) => {
  if (method === "cod") {
    const maximum = Math.max(0, Number(settings.cod_maximum_order) || 0);
    return settings.cod_enabled && (maximum === 0 || subtotal <= maximum);
  }
  if (method === "card") return settings.card_enabled;
  if (method === "gcash") return settings.gcash_enabled;
  return false;
};

export const validateCheckoutAmount = (
  subtotal: number,
  settings: CheckoutSettings,
) => {
  const minimum = Math.max(0, Number(settings.minimum_order_amount) || 0);
  const maximum = Math.max(0, Number(settings.maximum_order_amount) || 0);
  if (subtotal < minimum) return `A minimum merchandise total of ₱${minimum.toLocaleString("en-PH")} is required.`;
  if (maximum > 0 && subtotal > maximum) return `The maximum merchandise total per order is ₱${maximum.toLocaleString("en-PH")}.`;
  return "";
};
