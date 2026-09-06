import assert from "node:assert/strict";
import { serveProtected } from "./security-boundary.ts";

Deno.test("privileged handlers fail closed and preserve preflight", async () => {
  const originalServe = Deno.serve;
  const originalFetch = globalThis.fetch;
  const originalUrl = Deno.env.get("SUPABASE_URL");
  const originalKey = Deno.env.get("SUPABASE_ANON_KEY");
  let callback: (request: Request) => Promise<Response>;
  let allowed: boolean | "error" = false;
  let calls = 0;
  try {
    Deno.env.set("SUPABASE_URL", "https://test.invalid");
    Deno.env.set("SUPABASE_ANON_KEY", "test-public-key");
    Deno.serve = ((handler: typeof callback) => { callback = handler; }) as typeof Deno.serve;
    globalThis.fetch = async (_input, init) => {
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer caller-token");
      return new Response(JSON.stringify(allowed === "error" ? { message: "Unavailable" } : allowed),
        { status: allowed === "error" ? 503 : 200, headers: { "Content-Type": "application/json" } });
    };
    serveProtected(request => {
      if (request.method !== "OPTIONS") calls++;
      return new Response("ok", { headers: { "Access-Control-Allow-Origin": "https://store.invalid" } });
    });
    const request = () => new Request("https://test.invalid/function", { method: "POST", headers: { Authorization: "Bearer caller-token" } });
    assert.equal((await callback!(request())).status, 403);
    allowed = "error";
    assert.equal((await callback!(request())).status, 403);
    assert.equal(calls, 0);
    allowed = true;
    assert.equal((await callback!(request())).status, 200);
    assert.equal(calls, 1);
    assert.equal((await callback!(new Request("https://test.invalid", { method: "OPTIONS" }))).status, 200);
    assert.equal((await callback!(new Request("https://test.invalid", { method: "POST" }))).status, 403);
    assert.equal(calls, 1);
  } finally {
    Deno.serve = originalServe;
    globalThis.fetch = originalFetch;
    originalUrl === undefined ? Deno.env.delete("SUPABASE_URL") : Deno.env.set("SUPABASE_URL", originalUrl);
    originalKey === undefined ? Deno.env.delete("SUPABASE_ANON_KEY") : Deno.env.set("SUPABASE_ANON_KEY", originalKey);
  }
});
