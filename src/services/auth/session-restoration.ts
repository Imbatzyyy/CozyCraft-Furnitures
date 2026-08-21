export type CustomerAuthEventAction = "restore" | "clear" | "ignore";

const customerSessionRetryBaseMs = 400;
const customerSessionRetryMaxMs = 8_000;

/**
 * Auth events can report a null INITIAL_SESSION before a concurrent getSession
 * call has finished reading browser storage. Only an explicit SIGNED_OUT event
 * may clear a hydrated customer; getSession remains the initial guest authority.
 */
export function customerAuthEventAction(
  event: string,
  hasSessionUser: boolean,
): CustomerAuthEventAction {
  if (event === "SIGNED_OUT") return "clear";
  if (hasSessionUser) return "restore";
  return "ignore";
}

/**
 * Keep retrying transient session/profile failures without hammering Supabase.
 * The exponential delay is capped so a restored browser can recover promptly.
 */
export function customerSessionRetryDelay(attempt: number) {
  const safeAttempt = Math.max(0, Math.min(20, Math.floor(attempt)));
  return Math.min(
    customerSessionRetryBaseMs * 2 ** safeAttempt,
    customerSessionRetryMaxMs,
  );
}
