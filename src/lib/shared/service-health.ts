/** In-memory only: no customer data, polling, telemetry or persistent lockout. */
export type ServiceHealth = { reason: "quota" | "unavailable"; retryAt: number } | null;
export const SERVICE_HEALTH_EVENT = "cozycraft:service-health";
let health: ServiceHealth = null;
let generation = 0;
let recoveryProbe = false;
export const getServiceHealth = () => health;
const notify = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(SERVICE_HEALTH_EVENT)); };
export const isDatabaseRequest = (input: RequestInfo | URL) => {
  try { return new URL(input instanceof Request ? input.url : String(input)).pathname.startsWith("/rest/v1/"); }
  catch { return false; }
};
export function beginDatabaseRead() {
  if (health && (Date.now() < health.retryAt || recoveryProbe)) return null;
  if (health) recoveryProbe = true;
  return generation;
}
export function finishDatabaseRequest(start: number, status?: number, unavailable = false) {
  // An older successful request must not conceal a newer outage.
  if (unavailable || status === 402 || status === 503) {
    generation++;
    health = { reason: status === 402 ? "quota" : "unavailable", retryAt: Date.now() + (status === 402 ? 60_000 : 30_000) };
    recoveryProbe = false;
    notify();
  } else if (start === generation) {
    recoveryProbe = false;
    if (status && status >= 200 && status < 300 && health) { health = null; notify(); }
  }
}
export const databaseGeneration = () => generation;
export const unavailableReadResponse = () => new Response(JSON.stringify({
  code: "COZY_SERVICE_UNAVAILABLE",
  message: "Live services are temporarily unavailable. Saved information may be out of date. Please wait before trying again.",
}), { status: 503, headers: { "Content-Type": "application/json", "Retry-After": "30" } });
