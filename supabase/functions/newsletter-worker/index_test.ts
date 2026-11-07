import assert from "node:assert/strict";
import { handleNewsletterWorker } from "./index.ts";

Deno.test("newsletter worker authorizes claims, bounds batches and preserves unfinished work", async () => {
  Deno.env.set("SUPABASE_URL", "https://fixture.invalid");
  Deno.env.set("RESEND_API_KEY", "fixture-provider");
  const originalFetch = globalThis.fetch, originalNow = Date.now;
  let scenario = "denied", elapsed = 0;
  const sent: string[] = [], patches: Array<{ table: string; body: any }> = [];
  const request = () => new Request("https://fixture.invalid", { method: "POST", headers: { apikey: "fixture-key" } });
  const deliveries = ["delivery-a", "delivery-b"].map(id => ({ id, subscriber_id: 1, attempt_count: 0, newsletter_subscribers: { email: "fixture@example.invalid", unsubscribe_token: "fixture-unsubscribe", status: "active" } }));
  Date.now = () => originalNow() + elapsed;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("claim_newsletter_campaign")) {
      if (scenario === "denied") return Response.json({ message: "Denied" }, { status: 403 });
      return Response.json(scenario === "idle" ? null : "campaign-fixture");
    }
    if (url.hostname === "api.resend.com") {
      sent.push(new Headers(init?.headers).get("Idempotency-Key")!);
      if (scenario === "budget") elapsed = 71_000;
      return Response.json({ id: "provider-fixture" });
    }
    const table = url.pathname.split("/").at(-1)!;
    if (init?.method === "PATCH") {
      const body = JSON.parse(String(init.body)); patches.push({ table, body });
      if (scenario === "claim-failed" && body.status === "sending") return Response.json({ message: "Unavailable" }, { status: 503 });
      if (scenario === "ack-failed" && body.status === "sent" && table === "newsletter_deliveries") return Response.json({ message: "Unavailable" }, { status: 503 });
      return new Response(null, { status: 204 });
    }
    if (table === "newsletter_campaigns") return Response.json({ id: "campaign-fixture", subject: "Fixture", heading: "Fixture", body: "Fixture", cta_label: "Browse", cta_path: "/new-arrivals", preheader: "Fixture", recipient_count: 2, product_snapshot: [] });
    if (url.searchParams.get("select")?.includes("newsletter_subscribers!inner")) {
      assert.equal(url.searchParams.get("limit"), "10");
      return Response.json(scenario === "budget" ? deliveries : deliveries.slice(0, 1));
    }
    if (init?.method === "HEAD") {
      if (scenario === "summary-failed") return new Response(null, { status: 503 });
      const remaining = url.searchParams.get("status")?.startsWith("in.") ? (scenario === "budget" ? 1 : 0) : 1;
      return new Response(null, { headers: { "Content-Range": `0-0/${remaining}` } });
    }
    if (table === "newsletter_deliveries") return Response.json([]);
    throw Error("Unexpected fixture request");
  };
  try {
    assert.equal((await handleNewsletterWorker(request())).status, 401); assert.equal(sent.length, 0);
    scenario = "idle"; assert.equal((await handleNewsletterWorker(request())).status, 200); assert.equal(sent.length, 0);
    scenario = "claim-failed"; assert.equal((await handleNewsletterWorker(request())).status, 503); assert.equal(sent.length, 0);
    scenario = "budget"; patches.length = 0;
    const result = await (await handleNewsletterWorker(request())).json();
    assert.equal(result.sent, 1); assert.equal(result.complete, false);
    assert.equal(sent.length, 1); assert.ok(patches.some(p => p.body.status === "queued"));
    assert.equal(patches.at(-1)?.body.worker_locked_at, null);
    elapsed = 0; scenario = "ack-failed"; patches.length = 0;
    assert.equal((await handleNewsletterWorker(request())).status, 503);
    assert.ok(!patches.some(p => p.table === "newsletter_campaigns"));
    assert.deepEqual(sent, ["newsletter-delivery-delivery-a", "newsletter-delivery-delivery-a"]);
    scenario = "summary-failed"; patches.length = 0;
    assert.equal((await handleNewsletterWorker(request())).status, 503);
    assert.ok(!patches.some(p => p.table === "newsletter_campaigns"));
  } finally { globalThis.fetch = originalFetch; Date.now = originalNow; }
});
