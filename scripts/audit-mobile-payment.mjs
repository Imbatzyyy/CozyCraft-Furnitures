// Run after npm run build. Set PLAYWRIGHT_MODULE to an existing Playwright
// installation when it is provided by the local QA runtime.
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const output = process.env.QA_OUTPUT || '/tmp/cozycraft-payment-return-qa';
await mkdir(output, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer(async (request, response) => {
  try {
    const requested = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname);
    if (!requested.startsWith(root + path.sep)) throw Error('Invalid path');
    const file = await stat(requested).then(s => s.isFile() ? requested : path.join(root, 'index.html')).catch(() => path.join(root, 'index.html'));
    response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co");
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const order = '11111111-1111-4111-8111-111111111111';
let checks = 0;
try {
  for (const [name, engine] of Object.entries({ chromium, webkit })) {
    const browser = await engine.launch({ headless: true });
    try {
      for (const viewport of [{ width: 320, height: 568 }, { width: 393, height: 852 }, { width: 844, height: 390 }]) {
        const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
        const page = await context.newPage();
        const backendRequests = [];
        await page.route('**/*.supabase.co/**', route => { backendRequests.push(route.request().url()); return route.abort(); });
        for (const payment of ['success', 'cancelled']) {
          // No installed application in a headless browser: this exercises the
          // genuine blocked-protocol fallback, without replacing location APIs.
          await page.goto(`${base}/mobile-payment.html?payment=${payment}&order=${order}`, { waitUntil: 'commit' }).catch(error => {
            if (!String(error).includes('interrupted') && !String(error).includes('ERR_ABORTED')) throw error;
          });
          const action = page.locator('#continue');
          await action.waitFor({ state: 'visible' });
          assert.equal(await action.getAttribute('href'), `com.cozycraft.furniture://payment/return?payment=${payment}&order=${order}`);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          await action.scrollIntoViewIfNeeded();
          const box = await action.boundingBox();
          assert.ok(box.height >= 48 && box.x >= 0 && box.x + box.width <= viewport.width);
          if (payment === 'success') await page.screenshot({ path: `${output}/${name}-${viewport.width}.png`, fullPage: true });
          checks++;
        }
        if (viewport.width === 393) {
          for (const payment of ['success', 'cancelled']) {
            await page.route('https://checkout.paymongo.com/**', route => route.fulfill({ contentType: 'text/html', body: `<h1>Hosted checkout fixture</h1><a href="${base}/payment-return?payment=${payment}&order=${order}">Return to merchant</a>` }));
            const checkout = 'https://checkout.paymongo.com/cs_existing#provider_fragment=fixture';
            const fragment = new URLSearchParams({ order, checkout });
            await page.goto(`${base}/mobile-payment.html#${fragment}`, { waitUntil: 'commit' }).catch(error => {
              if (!String(error).includes('interrupted') && !String(error).includes('ERR_ABORTED')) throw error;
            });
            await page.getByRole('heading', { name: 'Hosted checkout fixture' }).waitFor();
            assert.equal(page.url(), checkout);
            await page.getByRole('link', { name: 'Return to merchant' }).click({ noWaitAfter: true });
            await page.waitForURL(`**/mobile-payment.html?payment=${payment}&order=${order}`, { waitUntil: 'commit' });
            await page.locator('#continue').waitFor({ state: 'visible' });
            assert.equal(await page.locator('#continue').getAttribute('href'), `com.cozycraft.furniture://payment/return?payment=${payment}&order=${order}`);
            assert.equal(backendRequests.length, 0, 'The legacy return must not mount website auth or fetch payment data.');
            checks++;
            await page.unroute('https://checkout.paymongo.com/**');
          }
        }
        await context.close();
      }
    } finally { await browser.close(); }
  }
  console.log(`PASS: ${checks} Chromium/WebKit responsive and legacy/new handoff checks. Screenshots: ${output}`);
} finally { server.close(); }
