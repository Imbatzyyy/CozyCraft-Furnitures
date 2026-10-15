import assert from "node:assert/strict";
import { handlePaymentSync } from "./index.ts";

Deno.test("payment sync does not report a rejected expiry update as synchronized", async () => {
  Deno.env.set("SUPABASE_URL", "https://fixture.invalid");
  Deno.env.set("SUPABASE_ANON_KEY", "fixture-public");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "fixture-service");
  Deno.env.set("PAYMONGO_SECRET_KEY", "fixture-provider");
  const original = globalThis.fetch;
  let rejectExpiry = true;
  let writes = 0;
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.includes("/auth/v1/user")) return Response.json({ id: "fixture-user" });
    if (url.includes("/rest/v1/orders")) return Response.json([{ id: "fixture-order", payment_transactions: [{ id: "fixture-transaction", provider_session_id: "fixture-session", status: "pending", updated_at: new Date().toISOString() }] }]);
    if (url.includes("api.paymongo.com")) return Response.json({ data: { attributes: { status: "expired" } } });
    assert.ok(url.includes("/rpc/fail_paymongo_order"), "No settlement without a provider-confirmed paid payment");
    writes++;
    return rejectExpiry ? Response.json({ message: "Order transition rejected", code: "23514" }, { status: 409 }) : Response.json(null);
  };
  const request = () => new Request("https://fixture.invalid/sync", { method: "POST", headers: { Authorization: "Bearer fixture-customer" }, body: JSON.stringify({ orderIds: ["fixture-order"] }) });
  try {
    const failed = await handlePaymentSync(request());
    assert.equal(failed.status, 200);
    assert.deepEqual(await failed.json(), { checked: 1, synchronized: 0 });
    rejectExpiry = false;
    assert.deepEqual(await (await handlePaymentSync(request())).json(), { checked: 1, synchronized: 1 });
    assert.equal(writes, 2);
  } finally { globalThis.fetch = original; }
});
