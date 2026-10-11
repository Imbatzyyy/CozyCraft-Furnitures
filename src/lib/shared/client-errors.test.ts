import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { reportClientError, scrubDiagnostic } from "./client-errors";

describe("executed, sanitized diagnostics", () => {
  it("actually sends the lazy RPC and strips personal data and query tokens", async () => {
    const requests: Record<string, string>[] = [];
    const client = createClient("https://fixture.supabase.co", "fixture", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (_input, init) => {
        requests.push(JSON.parse(String(init?.body)));
        return new Response("null", { headers: { "content-type": "application/json" } });
      } },
    });
    expect(await reportClientError(client, new Error("Failed for test@example.com at https://site.test/checkout?token=secret"), "checkout_boundary", "/checkout?token=private#secret")).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0].p_path).toBe("/checkout");
    expect(JSON.stringify(requests)).not.toMatch(/test@example|token=secret|token=private/);
  });
  it("does not break recovery when transport fails", async () => {
    const client = createClient("https://fixture.supabase.co", "fixture", { auth: { persistSession: false }, global: { fetch: async () => { throw new Error("offline"); } } });
    expect(await reportClientError(client, new Error("broken"), "route", "/admin")).toBe(false);
    expect(scrubDiagnostic("otp=123456 password:secret")).not.toMatch(/123456|secret/);
  });
});
