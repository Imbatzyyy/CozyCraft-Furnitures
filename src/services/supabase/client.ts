import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const cozyCraftPlatform =
  typeof window !== "undefined" && window.self !== window.top ? "mobile" : "web";
const isAdminAuthRoute =
  typeof window !== "undefined" &&
  window.location.pathname.startsWith("/admin");

export const customerAuthStorageKey = "cozycraft-customer-auth";
export const adminAuthStorageKey = "cozycraft-admin-auth";

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY.",
  );
}

const sharedOptions = {
  global: {
    headers: { "x-cozycraft-platform": cozyCraftPlatform },
  },
} as const;

/**
 * Storefront and operations intentionally use different GoTrue storage keys.
 * This lets a customer and an administrator use the same browser without one
 * portal overwriting—or exposing—the other portal's authenticated session.
 */
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  ...sharedOptions,
  auth: {
    storageKey: customerAuthStorageKey,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: !isAdminAuthRoute,
  },
});

export const adminSupabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    ...sharedOptions,
    auth: {
      storageKey: adminAuthStorageKey,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: isAdminAuthRoute,
    },
  },
);

export type DbRole = "customer" | "staff" | "admin" | "superadmin";

export type DbProfile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  username: string;
  gender: string;
  date_of_birth: string | null;
  preferred_payment_method: "cod";
  role: DbRole;
  staff_active: boolean;
  customer_active: boolean;
  created_at: string;
};

export type DbAddress = {
  id: string;
  user_id: string;
  label: string;
  recipient_name: string;
  mobile: string;
  email: string;
  address_line: string;
  barangay: string;
  city: string;
  province: string;
  postal_code: string;
  delivery_note: string;
  is_primary: boolean;
};

export type DbSupportTicket = {
  id: string;
  ticket_number: string;
  user_id: string;
  order_id: string | null;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  category: "order" | "delivery" | "payment" | "product" | "return" | "account" | "general";
  priority: "low" | "normal" | "high" | "urgent";
  assigned_to: string | null;
  attachment_paths: string[];
  admin_reply: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string;
    email: string | null;
  } | null;
};

export type DbProduct = {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  stock_quantity: number;
  status: "draft" | "active" | "inactive";
  color: string;
  material: string;
  dimensions: string;
  description: string;
  images: string[];
  main_image_index: number;
  rating: number;
  review_count: number;
  created_at: string;
};

export type DbOrderItem = {
  id: number;
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  image_url: string | null;
};

export type DbOrderStatusHistory = {
  id: number;
  order_id: string;
  status: DbOrder["status"];
  changed_at: string;
  changed_by: string | null;
};

export type DbPaymentTransaction = {
  id: string;
  order_id: string;
  provider: "paymongo";
  provider_session_id: string | null;
  provider_payment_id: string | null;
  status: "pending" | "paid" | "failed" | "expired" | "refunded";
  amount: number;
  currency: "PHP";
  livemode: boolean;
  failure_reason: string | null;
  paid_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DbCustomerNotification = {
  id: number;
  user_id: string;
  kind: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type DbOrder = {
  id: string;
  order_number: string;
  user_id: string;
  status:
    | "pending"
    | "processing"
    | "packed"
    | "shipped"
    | "delivered"
    | "cancelled";
  payment_method: string;
  payment_status: "pending" | "paid" | "failed" | "refunded";
  payment_expires_at?: string | null;
  cancellation_reason?: string | null;
  cancellation_requested_at?: string | null;
  cancellation_status?: "pending" | "approved" | "rejected" | null;
  cancellation_reviewed_at?: string | null;
  cancellation_reviewed_by?: string | null;
  cancellation_decision_note?: string | null;
  refund_status?: "processing" | "succeeded" | "failed" | "demo_succeeded" | null;
  provider_refund_id?: string | null;
  refunded_at?: string | null;
  refund_email_sent_at?: string | null;
  refund_email_id?: string | null;
  refund_email_error?: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  shipping_address: Record<string, string>;
  created_at: string;
  order_items: DbOrderItem[];
  order_status_history: DbOrderStatusHistory[];
  payment_transactions?: DbPaymentTransaction[];
  profiles?: {
    full_name: string;
    email: string | null;
    phone: string | null;
  } | null;
};

export type DbCustomerProfile = DbProfile & {
  addresses: DbAddress[];
  orders: Array<{
    id: string;
    order_number: string;
    status: DbOrder["status"];
    payment_status: DbOrder["payment_status"];
    total: number;
    created_at: string;
  }>;
  support_tickets: Array<{
    id: string;
    ticket_number: string;
    status: DbSupportTicket["status"];
    created_at: string;
  }>;
};

export type DbBillingProfile = {
  user_id: string;
  recipient_name: string;
  company_name: string;
  tax_id: string;
  invoice_email: string;
  address_line: string;
  barangay: string;
  city: string;
  province: string;
  postal_code: string;
  same_as_delivery: boolean;
  created_at?: string;
  updated_at?: string;
};

export const isStaffRole = (role: DbRole | null) =>
  role === "staff" || role === "admin" || role === "superadmin";

export const safeFileName = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
