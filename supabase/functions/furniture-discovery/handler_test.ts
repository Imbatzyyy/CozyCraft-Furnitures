import { strict as assert } from "node:assert";
import { handleDiscovery } from "./index.ts";
import { imageFormat, visionImage } from "./images.ts";
const base = "https://catalog.test";
Deno.env.set("SUPABASE_URL", base);
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "server-key");
Deno.env.set("SUPABASE_ANON_KEY", "anon-key");
Deno.env.set("GROQ_API_KEY", "provider-test-key");
const req = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
async function mocked(run: () => Promise<void>, fetcher: typeof fetch) {
  const original = globalThis.fetch;
  globalThis.fetch = fetcher;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
}
Deno.test("method, preflight, malformed JSON and size guards", async () => {
  assert.equal((await handleDiscovery(new Request(base))).status, 405);
  assert.equal(
    (await handleDiscovery(new Request(base, { method: "OPTIONS" }))).status,
    204,
  );
  assert.equal((await handleDiscovery(req(null))).status, 400);
  assert.equal(
    (await handleDiscovery(new Request(base, { method: "POST", body: "{" })))
      .status,
    400,
  );
  assert.equal(
    (await handleDiscovery(req({ text: "x".repeat(3001) }))).status,
    413,
  );
});
Deno.test(
  "personal details are rejected before provider or budget access",
  async () => {
    await mocked(
      async () => {
        assert.equal(
          (
            await handleDiscovery(
              req({ action: "interpret", text: "my password is 123" }),
            )
          ).status,
          400,
        );
      },
      () => {
        throw new Error("Network must not be called");
      },
    );
  },
);
Deno.test(
  "public indexing denied and verified admin MFA gate fails closed",
  async () => {
    for (const authenticated of [false, true])
      await mocked(
        async () => {
          const response = await handleDiscovery(
            req(
              { action: "index", productId: "test" },
              { apikey: "anon-key", Authorization: "Bearer test" },
            ),
          );
          assert.equal(response.status, authenticated ? 403 : 401);
        },
        async (input) => {
          const url = String(input);
          if (url.includes("reserve_discovery_request"))
            return json({ message: "permission denied" }, 403);
          if (url.includes("/auth/v1/user"))
            return authenticated
              ? json({ id: "test-user" })
              : json({ message: "invalid user" }, 401);
          if (url.includes("security_action_allowed")) return json(false);
          if (url.includes("profiles"))
            return json({ role: "admin", staff_active: true });
          throw new Error("Unexpected call");
        },
      );
  },
);
Deno.test("search rate exhaustion never calls the provider", async () => {
  await mocked(
    async () => {
      assert.equal(
        (
          await handleDiscovery(
            req({ action: "interpret", text: "white bed rate test" }),
          )
        ).status,
        429,
      );
    },
    async (input) => {
      assert.ok(String(input).includes("reserve_discovery_request"));
      return json(false);
    },
  );
});
Deno.test(
  "provider output is validated and unknown requirements require clarification",
  async () => {
    await mocked(
      async () => {
        const response = await handleDiscovery(
          req({ action: "interpret", text: "purple spaceship test" }),
        );
        const data = await response.json();
        assert.equal(response.status, 200);
        assert.ok(data.intent.clarification);
        assert.deepEqual(data.intent.features, []);
      },
      async (input) =>
        String(input).includes("reserve_discovery_request")
          ? json(true)
          : json({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      type: "Sofa",
                      features: ["teleportation"],
                    }),
                  },
                },
              ],
            }),
    );
  },
);
Deno.test(
  "provider error does not leak upstream body, credentials or prompt",
  async () => {
    await mocked(
      async () => {
        const response = await handleDiscovery(
          req({ action: "interpret", text: "green table failure test" }),
        );
        assert.equal(response.status, 503);
        assert.ok(!(await response.text()).includes("SECRET"));
      },
      async (input) =>
        String(input).includes("reserve_discovery_request")
          ? json(true)
          : json(
              { error: { message: "SECRET prompt provider-test-key" } },
              400,
            ),
    );
  },
);
Deno.test("unchanged catalog profile skips images and model", async () => {
  const images = [base + "/storage/v1/object/public/product-images/a.jpg"];
  await mocked(
    async () => {
      const response = await handleDiscovery(
        req({ action: "index", productId: "test" }, { apikey: "service-key" }),
      );
      assert.deepEqual(await response.json(), { cached: true });
    },
    async (input) => {
      const url = String(input);
      if (url.includes("reserve_discovery_request")) return json(false);
      if (url.includes("finish_furniture_photo_index")) return json(null);
      if (url.includes("product_visual_profiles"))
        return json({ version: 2, image_key: JSON.stringify(images) });
      if (url.includes("products?"))
        return json({ id: "test", name: "Test", images, main_image_index: 0 });
      throw new Error("Unexpected costly request");
    },
  );
});
Deno.test(
  "photo fetch rejects unowned URLs and unsupported bytes",
  async () => {
    await assert.rejects(() =>
      visionImage("https://attacker.test/picture.jpg", base),
    );
    assert.equal(imageFormat(new Uint8Array([255, 216, 255])), "jpeg");
    assert.equal(
      imageFormat(
        new Uint8Array([82, 73, 70, 70, 212, 176, 0, 0, 87, 69, 66, 80]),
      ),
      "webp",
    );
    assert.equal(
      imageFormat(new TextEncoder().encode("\0\0\0\x18ftypavif\0\0\0\0mif1")),
      "avif",
    );
    assert.throws(() => imageFormat(new TextEncoder().encode("not an image")));
  },
);
