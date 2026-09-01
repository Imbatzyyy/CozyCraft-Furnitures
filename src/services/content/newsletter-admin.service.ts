import { adminSupabase } from "@/services/supabase/client";

export type NewsletterProductChoice = {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  image_url: string;
};

export type NewsletterCampaign = {
  id: string;
  internal_name: string;
  subject: string;
  preheader: string;
  heading: string;
  body: string;
  cta_label: string;
  cta_path: string;
  product_ids: string[];
  product_snapshot: NewsletterProductChoice[];
  status: "draft" | "scheduled" | "sending" | "sent" | "cancelled" | "failed";
  scheduled_at: string | null;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NewsletterOverview = {
  counts: Record<"active" | "pending" | "unsubscribed" | "bounced", number>;
  campaigns: NewsletterCampaign[];
  products: NewsletterProductChoice[];
  adminEmail: string;
};

export type NewsletterDraft = Pick<NewsletterCampaign,
  "internal_name" | "subject" | "preheader" | "heading" | "body" |
  "cta_label" | "cta_path" | "product_ids"
> & { id?: string };

export const blankNewsletterDraft = (): NewsletterDraft => ({
  internal_name: "",
  subject: "",
  preheader: "",
  heading: "",
  body: "",
  cta_label: "Explore the collection",
  cta_path: "/new-arrivals",
  product_ids: [],
});

export function validateNewsletterDraft(draft: NewsletterDraft) {
  if (!draft.internal_name.trim()) return "Add an internal campaign name.";
  if (!draft.subject.trim() || draft.subject.trim().length > 120) return "Add a subject of 120 characters or fewer.";
  if (!draft.heading.trim() || !draft.body.trim()) return "Add the customer-facing heading and message.";
  if (!draft.cta_path.startsWith("/") || draft.cta_path.startsWith("//")) return "The action must use a safe CozyCraft path beginning with /.";
  if (draft.product_ids.length > 4) return "Choose no more than four featured products.";
  return null;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await adminSupabase.functions.invoke("newsletter-admin", { body });
  if (!error) return data as T;
  const context = (error as { context?: Response }).context;
  const payload = context instanceof Response
    ? await context.clone().json().catch(() => null)
    : null;
  throw new Error(payload?.error ?? error.message ?? "Newsletter service unavailable.");
}

export const loadNewsletterWorkspace = () => invoke<NewsletterOverview>({ action: "overview" });
export const saveNewsletterCampaign = (campaign: NewsletterDraft) =>
  invoke<{ campaign: NewsletterCampaign }>({ action: "save", campaign });
export const sendNewsletterTest = (campaignId: string, email: string) =>
  invoke<{ message: string }>({ action: "test", campaignId, email });
export const scheduleNewsletterCampaign = (campaignId: string, scheduledAt: string) =>
  invoke<{ message: string }>({ action: "schedule", campaignId, scheduledAt });
export const cancelNewsletterCampaign = (campaignId: string) =>
  invoke<{ message: string }>({ action: "cancel", campaignId });
