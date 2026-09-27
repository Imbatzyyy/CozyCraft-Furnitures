export type SettingChange = { path: string; label: string; before: unknown; after: unknown };

const ignored = new Set(["id", "updated_at", "updated_by"]);

const labels: Record<string, string> = {
  store_name: "Store name",
  store_description: "Store description",
  currency_code: "Store currency",
  contact_email: "Customer contact email",
  support_phone: "Support phone",
  business_address: "Business address",
  delivery_area: "Default delivery area",
  low_stock_threshold: "Low-stock threshold",
  inventory_alerts: "Inventory alerts",
  weekly_report_enabled: "Scheduled report briefing",
  announcement_enabled: "Announcement banner",
  announcement_text: "Announcement text",
  announcement_link: "Announcement link",
  maintenance_mode: "Maintenance mode",
  "social_links.facebook": "Facebook URL",
  "social_links.instagram": "Instagram URL",
  "social_links.tiktok": "TikTok URL",
  "checkout_settings.standard_delivery_fee": "Standard delivery fee",
  "checkout_settings.free_delivery_minimum": "Free delivery minimum",
  "checkout_settings.minimum_order_amount": "Minimum order",
  "checkout_settings.maximum_order_amount": "Maximum order",
  "checkout_settings.cod_enabled": "Cash on delivery",
  "checkout_settings.card_enabled": "Cards via PayMongo",
  "checkout_settings.gcash_enabled": "GCash via PayMongo",
  "checkout_settings.cod_maximum_order": "COD maximum order",
  "fulfillment_settings.order_number_prefix": "Order number prefix",
  "fulfillment_settings.estimated_delivery_days_min": "Estimated delivery minimum",
  "fulfillment_settings.estimated_delivery_days_max": "Estimated delivery maximum",
  "fulfillment_settings.cancellation_window_hours": "Customer cancellation window",
  "fulfillment_settings.return_window_days": "Return window",
  "fulfillment_settings.out_of_stock_behavior": "Out-of-stock products",
  "review_settings.verified_purchases_only": "Verified purchases only",
  "review_settings.minimum_length": "Minimum review length",
  "review_settings.maximum_length": "Maximum review length",
  "account_settings.username_required": "Require username",
  "account_settings.google_auth_enabled": "Google sign-in",
  "account_settings.customer_mfa_available": "Customer MFA",
  "account_settings.password_minimum_length": "Password minimum length",
  "report_settings.frequency": "Report frequency",
  "report_settings.default_range": "Default analytics range",
  "report_settings.timezone": "Reporting timezone",
  "report_settings.data_retention_days": "Telemetry retention",
  require_admin_mfa: "Require administrator MFA",
  security_alerts_enabled: "Security alerts",
  session_timeout_minutes: "Admin session timeout",
};

function flatten(value: unknown, prefix = "", out = new Map<string, unknown>()) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (!prefix && ignored.has(key)) continue;
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
  } else if (prefix) {
    out.set(prefix, value);
  }
  return out;
}

const labelFor = (path: string) =>
  labels[path] ??
  path
    .split(".")
    .pop()!
    .replace(/_/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());

/** Field-level changes between two settings objects, with readable labels. */
export function diffSettings(before: unknown, after: unknown): SettingChange[] {
  const previous = flatten(before);
  const next = flatten(after);
  const paths = new Set([...previous.keys(), ...next.keys()]);
  const changes: SettingChange[] = [];
  paths.forEach((path) => {
    const a = previous.get(path);
    const b = next.get(path);
    if (JSON.stringify(a) !== JSON.stringify(b)) changes.push({ path, label: labelFor(path), before: a, after: b });
  });
  return changes;
}

export function describeSettingValue(value: unknown) {
  if (value === true) return "On";
  if (value === false) return "Off";
  if (value === null || value === undefined || value === "") return "Empty";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None";
  return String(value);
}
