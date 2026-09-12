export const OFFLINE_MESSAGE = "You're offline. Reconnect before saving changes or checking out.";
export const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

/** Read deadlines only: never abort an in-progress payment or other write. */
export async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (isOffline()) throw new Error(OFFLINE_MESSAGE);
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method !== "GET" && method !== "HEAD") return fetch(input, init);
  const controller = new AbortController();
  const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort(); else signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 12_000);
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}
