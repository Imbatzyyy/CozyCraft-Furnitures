import { afterEach, beforeEach, expect, it, vi } from "vitest";
beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); vi.stubGlobal("navigator", { onLine: true }); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const url = "https://fixture.supabase.co/rest/v1/products";
it("bounds quota retries and recovers without polling", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response("quota", { status: 402 })).mockResolvedValue(new Response("[]"));
  vi.stubGlobal("fetch", fetcher);
  const { resilientFetch } = await import("./network"); const health = await import("./service-health");
  expect((await resilientFetch(url)).status).toBe(402);
  for (let i = 0; i < 20; i++) expect((await resilientFetch(url)).status).toBe(503);
  expect(fetcher).toHaveBeenCalledTimes(1); expect(health.getServiceHealth()?.reason).toBe("quota");
  await vi.advanceTimersByTimeAsync(60_001); expect(fetcher).toHaveBeenCalledTimes(1);
  expect((await resilientFetch(url)).status).toBe(200); expect(health.getServiceHealth()).toBeNull();
});
it("does not replay or abort writes, including during an outage", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));vi.stubGlobal("fetch", fetcher);
  const { resilientFetch } = await import("./network"); const signal = new AbortController().signal;
  await resilientFetch(url);
  await resilientFetch(url, { method: "POST", signal });
  expect(fetcher).toHaveBeenCalledTimes(2);expect(fetcher.mock.calls[1][1].signal).toBe(signal);
});
it("does not treat authentication/validation errors as platform outages", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("denied", { status: 401 })));
  const { resilientFetch } = await import("./network");const health = await import("./service-health");
  await resilientFetch(url);expect(health.getServiceHealth()).toBeNull();
});
it("older in-flight successes cannot hide newer outages; one recovery read is allowed", async () => {
  const h = await import("./service-health");const old = h.databaseGeneration();
  h.finishDatabaseRequest(old, 503);h.finishDatabaseRequest(old, 200);expect(h.getServiceHealth()).not.toBeNull();
  await vi.advanceTimersByTimeAsync(30_001);
  const probe = h.beginDatabaseRead();expect(probe).not.toBeNull();expect(h.beginDatabaseRead()).toBeNull();
  h.finishDatabaseRequest(probe!, 200);expect(h.getServiceHealth()).toBeNull();
});
it("a cancelled read is not mistaken for an outage", async () => {
  const controller = new AbortController();controller.abort();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError")));
  const { resilientFetch } = await import("./network");const h = await import("./service-health");
  await expect(resilientFetch(url,{signal:controller.signal})).rejects.toThrow();expect(h.getServiceHealth()).toBeNull();
});
it("the installed Supabase SDK does not retry reads behind the application's cooldown", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{"message":"Unavailable"}', { status: 503, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetcher);
  const { supabase } = await import("@/services/supabase/client");
  const result = await supabase.from("products").select("id");
  expect(result.error).not.toBeNull();
  await vi.advanceTimersByTimeAsync(120_000);
  expect(fetcher).toHaveBeenCalledOnce();
});
