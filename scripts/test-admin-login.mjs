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
  const notes = [];
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
    requests.push({ path, aal, method:route.request().method(), search:url.search });
    const reply = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (path.endsWith("/token")) return reply(session("aal1"));
    if (path.endsWith("/user")) return reply(user);
    if (path.endsWith("/challenge")) return reply({ id: "test-challenge", type: "totp", expires_at: Math.floor(Date.now() / 1000) + 300 });
    if (path.endsWith("/verify")) return reply(session("aal2"));
    if (path.endsWith("/rpc/admin_overview_snapshot")) return reply({sales:12500,monthCount:1,pending:0,lowStock:0,fulfillment:0,cancellations:0,refunds:0,support:0,statuses:{delivered:1,processing:0,pending:0,cancelled:0},salesData:[{m:"Sep",v:12500}],recent:[order]});
    if (path.endsWith("/rpc/admin_order_queue")) {
      const {p_page=1}=route.request().postDataJSON();
      return reply({orders:Array.from({length:p_page===1?5:3},(_,index)=>({...order,status:p_page===2&&index===0?"processing":"delivered",id:`test-order-${(p_page-1)*5+index+1}`,order_number:`CC-TEST-${(p_page-1)*5+index+1}`})),total:8,allCount:8,today:8,fulfillment:1,awaiting:0,attention:0,paymentMethods:["cod"]});
    }
    if (path.includes("/rpc/")) return reply(null);
    const single = (headers.accept || "").includes("vnd.pgrst.object");
    if (path.endsWith("/profiles")) return reply(url.searchParams.has("id") ? (single ? profile : [profile]) : []);
    if (path.endsWith("/admin_security_settings")) return reply({ require_admin_mfa: requireMfa, session_timeout_minutes: 30 });
    if (path.endsWith("/store_settings")) return reply({ id: true, store_name: "CozyCraft Furnitures" });
    if (path.endsWith("/products")) return reply([{ id: "test-product", name: "Test Table", category: "Dining room", price: 12000, stock_quantity: 20, status: "active", rating: 5, review_count: 1, images: [], created_at: date }]);
    if (path.endsWith("/categories")) return reply([{ name: "Dining room", active: true }]);
    if (path.endsWith("/orders")) return reply(route.request().method()==="PATCH" || (mfa && aal !== "aal2") ? [] : [order]);
    if (path.endsWith("/support_tickets")) return reply([{id:"test-ticket",ticket_number:"T-TEST",user_id:customerId,order_id:order.id,subject:"Delivery question",message:"Please check the delivery date.",status:"open",category:"delivery",priority:"normal",assigned_to:null,attachment_paths:[],admin_reply:null,created_at:date,updated_at:date}]);
    if (path.endsWith("/support_internal_notes")) {
      if(route.request().method()==="POST")notes.unshift({...route.request().postDataJSON(),id:"test-note",created_at:date});
      return reply(notes);
    }
    return reply(single ? {} : []);
  });
  try {
    await page.goto(`${baseUrl}/admin/login`);
    await page.getByLabel("Work email").fill(user.email);
    await page.locator('input[type="password"]').fill("Test-password-only");
    await page.getByRole("button", { name: "Enter operations" }).click();
    if (mfa) {
      await page.getByLabel("Authenticator code").waitFor();
      assert.equal(requests.filter((r) => r.path.endsWith("/orders") || r.path.endsWith("/admin_overview_snapshot")).length, 0, "Must not load RLS-filtered orders before MFA");
      await page.getByLabel("Authenticator code").fill("123456");
      await page.getByRole("button", { name: "Verify and enter" }).click();
    }
    await page.getByText("Total sales", { exact: true }).waitFor();
    const sales = page.getByText("Total sales", { exact: true }).locator("..");
    await sales.getByText(/12,500/).waitFor({ timeout: 10000 });
    const month = page.getByText("Orders this month", { exact: true }).locator("..");
    assert.match(await month.innerText(), /\b1\b/);
    assert.equal(requests.filter((r) => r.path.endsWith("/orders")).length, 0, "Overview must not download full order graphs");
    assert.equal(requests.filter((r) => r.path.endsWith("/admin_overview_snapshot")).length, 1, "One compact summary per verified login");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "No horizontal overflow");
    assert.deepEqual(errors, []);
    await page.getByRole("link",{name:"View all",exact:true}).click();
    await page.getByText("CC-TEST-1",{exact:false}).first().waitFor();
    assert.equal(await page.getByRole("button",{name:/Queue position/}).count(),5,"Five orders per page");
    await page.getByRole("button",{name:"Next",exact:true}).click();
    await page.getByText("CC-TEST-6",{exact:false}).first().waitFor();
    assert.equal(await page.getByRole("button",{name:/Queue position/}).count(),3,"Remaining orders on page two");
    await page.evaluate(()=>window.dispatchEvent(new Event("cozycraft:admin-data-changed")));
    await page.waitForTimeout(900);
    assert.equal(new URL(page.url()).searchParams.get("range"),null,"Realtime must not switch Today to All");
    assert.match(await page.locator("body").innerText(),/Page 2 of 2/);
    await page.getByRole("button",{name:"Mark as packed",exact:true}).click();
    await page.getByText(/Another administrator updated this order/).waitFor();
    const change=requests.find(r=>r.path.endsWith("/orders")&&r.method==="PATCH");
    assert.match(change?.search||"",/status=eq.processing/,"Status writes must guard the version the admin saw");
    assert.equal(requests.filter(r=>r.path.includes("send-transactional-email")).length,0,"Conflicting status must not send an email");
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,"Order desk fits viewport");
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:`/tmp/cozycraft-admin-qa-${width}.png`,fullPage:true});
    if(width===1440 && mfa && requireMfa) {
      await page.goto(`${baseUrl}/admin/support`);
      await page.getByText("Staff handover · internal only").click();
      const draft=page.getByLabel("Add a handover note");
      await draft.fill("Checked delivery. Next shift should confirm the customer time.");
      await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
      assert.match(await draft.inputValue(),/Next shift/);
      await page.getByRole("button",{name:"Save internal note"}).click();
      await page.getByText("Checked delivery. Next shift should confirm the customer time.",{exact:true}).waitFor();
      assert.equal(notes.length,1);
      assert.equal(notes[0].author_id,adminId);
      assert.equal(notes[0].ticket_id,"test-ticket");
      await page.screenshot({path:"/tmp/cozycraft-support-qa.png",fullPage:true});
    }
    assert.deepEqual(errors,[]);
    console.log(`PASS fresh ${mfa ? "MFA" : "password-only"} login at ${width}px (store MFA policy ${requireMfa}): compact overview, database pages and stable Today view`);
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
  await runScenario(false, 1440, false);
  await runScenario(true, 1440, false);
} finally { await browser.close(); }
