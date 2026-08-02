import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY.",
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

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
};

export type DbOrderItem = {
  id: number;
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  image_url: string | null;
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
  cancellation_reason?: string | null;
  cancellation_requested_at?: string | null;
  refund_status?: "processing" | "succeeded" | "failed" | "demo_succeeded" | null;
  provider_refund_id?: string | null;
  refunded_at?: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  shipping_address: Record<string, string>;
  created_at: string;
  order_items: DbOrderItem[];
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

export const isStaffRole = (role: DbRole | null) =>
  role === "staff" || role === "admin" || role === "superadmin";

export const safeFileName = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
