import { supabase } from "@/services/supabase/client";

export type NewsletterSubscriptionResult =
  | { ok: true; status: "confirmation_sent" | "already_subscribed" }
  | { ok: false; message: string };

export const normalizeNewsletterEmail = (value: string) =>
  value.trim().toLowerCase();

export const isValidNewsletterEmail = (value: string) => {
  const email = normalizeNewsletterEmail(value);
  return (
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email) &&
    !email.includes("..") &&
    !email.startsWith(".") &&
    !email.endsWith(".")
  );
};

const functionMessage = async (error: unknown) => {
  const context = (error as { context?: Response } | null)?.context;
  if (!(context instanceof Response)) return null;
  const payload = await context.clone().json().catch(() => null);
  return typeof payload?.error === "string" ? payload.error : null;
};

export async function subscribeToNewsletter(
  value: string,
): Promise<NewsletterSubscriptionResult> {
  const email = normalizeNewsletterEmail(value);
  if (!isValidNewsletterEmail(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const { data, error } = await supabase.functions.invoke(
    "newsletter-subscribe",
    { body: { email } },
  );
  if (error) {
    return {
      ok: false,
      message:
        (await functionMessage(error)) ??
        "We could not add you just now. Please try again.",
    };
  }

  if (data?.status === "confirmation_sent" || data?.status === "already_subscribed") {
    return { ok: true, status: data.status };
  }
  return { ok: false, message: "We could not add you just now. Please try again." };
}
