// Browser regression with simulated Supabase responses; no production data or credentials.
// PLAYWRIGHT_MODULE may point to an installed Playwright module when it is not local.
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:5173";
const adminId = "00000000-0000-4000-8000-000000000001";
const customerId = "00000000-0000-4000-8000-000000000002";
const date = new Date().toISOString();

async function runScenario(mfa, width, requireMfa = true) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const requests = [];
  const user = { id: adminId, email: "admin@example.test", role: "authenticated", aud: "authenticated",
    created_at: date, app_metadata: {}, user_metadata: {},
    factors: mfa ? [{ id: "test-factor", factor_type: "totp", status: "verified", friendly_name: "Test" }] : [] };
  const token = (aal) => `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: adminId, role: "authenticated", aud: "authenticated", aal, session_id: "test-login", exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000), amr: [] })).toString("base64url")}.${Buffer.from("test-signature").toString("base64url")}`;
  const session = (aal) => ({ access_token: token(aal), refresh_token: "test-refresh", token_type: "bearer", expires_in: 3600, user });
  const profile = { id: adminId, full_name: "Test Admin", email: user.email, role: "superadmin", staff_active: true, avatar_url: null };
  const order = { id: "test-order", order_number: "CC-TEST", user_id: customerId, status: "delivered", payment_status: "paid", payment_method: "cod", total: 12500, subtotal: 12000, delivery_fee: 500, created_at: date, shipping_address: { name: "Test Customer" }, order_items: [], order_status_history: [], payment_transactions: [] };
  await context.addInitScript(() => sessionStorage.setItem("cozycraft-welcome-seen", "1"));
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(baseUrl).origin) return route.continue();
    if (!url.hostname.endsWith("supabase.co")) return route.abort();
    const path = url.pathname;
    const headers = route.request().headers();
    let aal = null;
    try { aal = JSON.parse(Buffer.from((headers.authorization || "").split(".")[1], "base64url").toString()).aal; } catch {}
    requests.push({ path, aal });
    const reply = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (path.endsWith("/token")) return reply(session("aal1"));
    if (path.endsWith("/user")) return reply(user);
    if (path.endsWith("/challenge")) return reply({ id: "test-challenge", type: "totp", expires_at: Math.floor(Date.now() / 1000) + 300 });
    if (path.endsWith("/verify")) return reply(session("aal2"));
    if (path.includes("/rpc/")) return reply(null);
    const single = (headers.accept || "").includes("vnd.pgrst.object");
    if (path.endsWith("/profiles")) return reply(url.searchParams.has("id") ? (single ? profile : [profile]) : []);
    if (path.endsWith("/admin_security_settings")) return reply({ require_admin_mfa: requireMfa, session_timeout_minutes: 30 });
    if (path.endsWith("/store_settings")) return reply({ id: true, store_name: "CozyCraft Furnitures" });
    if (path.endsWith("/products")) return reply([{ id: "test-product", name: "Test Table", category: "Dining room", price: 12000, stock_quantity: 20, status: "active", rating: 5, review_count: 1, images: [], created_at: date }]);
    if (path.endsWith("/categories")) return reply([{ name: "Dining room", active: true }]);
    if (path.endsWith("/orders")) return reply(mfa && aal !== "aal2" ? [] : [order]);
    return reply(single ? {} : []);
  });
  try {
    await page.goto(`${baseUrl}/admin/login`);
    await page.getByLabel("Work email").fill(user.email);
    await page.locator('input[type="password"]').fill("Test-password-only");
    await page.getByRole("button", { name: "Enter operations" }).click();
    if (mfa) {
      await page.getByLabel("Authenticator code").waitFor();
      assert.equal(requests.filter((r) => r.path.endsWith("/orders")).length, 0, "Must not load RLS-filtered orders before MFA");
      await page.getByLabel("Authenticator code").fill("123456");
      await page.getByRole("button", { name: "Verify and enter" }).click();
    }
    await page.getByText("Total sales", { exact: true }).waitFor();
    const sales = page.getByText("Total sales", { exact: true }).locator("..");
    await sales.getByText(/12,500/).waitFor({ timeout: 10000 });
    const month = page.getByText("Orders this month", { exact: true }).locator("..");
    assert.match(await month.innerText(), /\b1\b/);
    assert.equal(requests.filter((r) => r.path.endsWith("/orders")).length, 1, "One order hydration per verified login");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "No horizontal overflow");
    assert.deepEqual(errors, []);
    console.log(`PASS fresh ${mfa ? "MFA" : "password-only"} login at ${width}px (store MFA policy ${requireMfa}): populated Overview without reload, one order request`);
  } catch (error) {
    console.error((await page.locator("body").innerText()).slice(0, 1800));
    console.error("Request summary:", requests.filter((r) => !r.path.includes("realtime")));
    console.error("Browser errors:", errors);
    throw error;
  } finally { await context.close(); }
}

try {
  await runScenario(true, 1440);
  await runScenario(true, 390);
  await runScenario(false, 1440);
  await runScenario(true, 1440, false);
} finally { await browser.close(); }
