// Deno convention intentionally avoids Vitest's `*.test.ts` discovery.
import { reconcileElapsedPaymongoSession } from "./paymongo-expiry.ts";

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const providerPayload = (
  status: string,
  payments: Array<Record<string, unknown>> = [],
) => ({
  data: {
    id: "cs_test",
    attributes: { status, livemode: false, payments },
  },
});

const makeAdmin = () => {
  const rpcCalls: Array<{ name: string; parameters: Record<string, unknown> }> = [];
  const snapshots: Array<Record<string, unknown>> = [];
  const adminClient = {
    from: () => ({
      update: (values: Record<string, unknown>) => {
        snapshots.push(values);
        const terminal = Promise.resolve({ error: null });
        const second = { eq: () => terminal };
        return { eq: () => second };
      },
    }),
    rpc: async (name: string, parameters: Record<string, unknown>) => {
      rpcCalls.push({ name, parameters });
      return { data: name === "expire_paymongo_order" ? true : "settled", error: null };
    },
  };
  return { adminClient: adminClient as any, rpcCalls, snapshots };
};

const withFetch = async (
  responses: Array<{ status: number; body: unknown }>,
  run: (requests: Array<{ url: string; method: string }>) => Promise<void>,
) => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; method: string }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(input), method: init?.method ?? "GET" });
    const response = responses.shift();
    if (!response) throw new Error("Unexpected provider request");
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  try {
    await run(requests);
  } finally {
    globalThis.fetch = originalFetch;
  }
};

Deno.test("settles a paid race before attempting provider expiry", async () => {
  const { adminClient, rpcCalls } = makeAdmin();
  await withFetch([
    {
      status: 200,
      body: providerPayload("active", [{ id: "pay_test", attributes: { status: "paid" } }]),
    },
  ], async (requests) => {
    const result = await reconcileElapsedPaymongoSession({
      adminClient,
      orderId: "order_test",
      transaction: { id: "transaction_test", provider_session_id: "cs_test" },
      secretKey: "sk_test",
    });
    assert(result.outcome === "paid", "paid provider session should settle");
    assert(requests.length === 1, "paid session must not be expired");
    assert(rpcCalls.length === 1 && rpcCalls[0].name === "settle_paymongo_order", "settlement RPC expected");
  });
});

Deno.test("expires at PayMongo before releasing the local order", async () => {
  const { adminClient, rpcCalls, snapshots } = makeAdmin();
  await withFetch([
    { status: 200, body: providerPayload("active") },
    { status: 200, body: providerPayload("expired") },
  ], async (requests) => {
    const result = await reconcileElapsedPaymongoSession({
      adminClient,
      orderId: "order_test",
      transaction: { id: "transaction_test", provider_session_id: "cs_test" },
      secretKey: "sk_test",
    });
    assert(result.outcome === "expired", "verified expired session should finalize");
    assert(requests[1]?.method === "POST" && requests[1]?.url.endsWith("/expire"), "provider expiry POST expected");
    assert(snapshots.some((snapshot) => snapshot.provider_status === "expired"), "expired provider snapshot expected");
    assert(rpcCalls.at(-1)?.name === "expire_paymongo_order", "local expiry RPC must run last");
  });
});

Deno.test("keeps inventory reserved when provider expiry is not confirmed", async () => {
  const { adminClient, rpcCalls } = makeAdmin();
  await withFetch([
    { status: 200, body: providerPayload("active") },
    { status: 500, body: { errors: [{ detail: "temporary failure" }] } },
    { status: 200, body: providerPayload("active") },
  ], async () => {
    const result = await reconcileElapsedPaymongoSession({
      adminClient,
      orderId: "order_test",
      transaction: { id: "transaction_test", provider_session_id: "cs_test" },
      secretKey: "sk_test",
    });
    assert(result.outcome === "retry", "unconfirmed provider expiry must be retried");
    assert(!rpcCalls.some((call) => call.name === "expire_paymongo_order"), "local order must remain active");
  });
});
