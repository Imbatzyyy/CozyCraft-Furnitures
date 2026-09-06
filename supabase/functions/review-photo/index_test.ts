import assert from "node:assert/strict";
Deno.test("review photos enforce visibility and owner path without proxying bytes", async () => {
  const serve = Deno.serve, fetcher = globalThis.fetch;
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  let handler: (request: Request) => Promise<Response>;
  const owner = "00000000-0000-4000-8000-000000000001";
  let row: { user_id: string; image_paths: string[] } | null = null;
  try {
    Deno.env.set("SUPABASE_URL", "https://test.invalid");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-only-key");
    Deno.serve = ((callback: typeof handler) => { handler = callback; }) as typeof Deno.serve;
    globalThis.fetch = async input => {
      const target = String(input);
      if (target.includes("/rest/v1/reviews")) {
        assert.ok(target.includes("approved=eq.true"));
        return new Response(JSON.stringify(row), { headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ signedURL: "/object/sign/review-images/test?token=test" }), { headers: { "Content-Type": "application/json" } });
    };
    await import("./index.ts");
    const request = () => new Request(`https://test.invalid/photo?review_id=${owner}&index=0`);
    assert.equal((await handler!(request())).status, 404, "Hidden/missing review denied");
    row = { user_id: owner, image_paths: ["another-owner/photo.jpg"] };
    assert.equal((await handler!(request())).status, 404, "Cross-owner photo denied");
    row.image_paths = [`${owner}/../photo.jpg`];
    assert.equal((await handler!(request())).status, 404, "Traversal denied");
    row.image_paths = [`${owner}/item/photo.jpg`];
    const result = await handler!(request());
    assert.equal(result.status, 302);
    assert.equal(result.headers.get("Cache-Control"), "no-store");
  } finally {
    Deno.serve = serve; globalThis.fetch = fetcher;
    url === undefined ? Deno.env.delete("SUPABASE_URL") : Deno.env.set("SUPABASE_URL", url);
    key === undefined ? Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY") : Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", key);
  }
});
