import { beginDatabaseRead, databaseGeneration, finishDatabaseRequest, isDatabaseRequest, unavailableReadResponse } from "./service-health";

export const OFFLINE_MESSAGE = "You're offline. Reconnect before saving changes or checking out.";
export const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

/** Read deadlines only: never abort an in-progress payment or other write. */
export async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (isOffline()) throw new Error(OFFLINE_MESSAGE);
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const database = isDatabaseRequest(input);
  // Mutations are never retried, short-circuited or given an artificial timeout.
  if (method !== "GET" && method !== "HEAD") {
    const start = databaseGeneration();
    const response = await fetch(input, init);
    if (database) finishDatabaseRequest(start, response.status);
    return response;
  }
  const start = database ? beginDatabaseRead() : databaseGeneration();
  if (start === null) return unavailableReadResponse();
  const controller = new AbortController();
  const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort(); else signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 12_000);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    if (database) finishDatabaseRequest(start, response.status);
    return response;
  }
  catch (error) {
    if (database) finishDatabaseRequest(start, undefined, !signal?.aborted && !isOffline());
    throw error;
  }
  finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}
