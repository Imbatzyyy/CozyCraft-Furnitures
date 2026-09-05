// Isolated browser checks. External APIs are stubbed; no messages or payments.
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({headless:true,channel:"chrome"});
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5173";
const product = {id:"quality-table",name:"Quality Test Table",category:"Dining room",subcategory:"Dining Tables",price:12000,stock_quantity:20,status:"active",rating:5,review_count:0,color:"Oak",description:"A test dining table with verified overall measurements.",images:[],material:'[{"type":"Top","description":"Oak"}]',dimensions:'[{"label":"Width","value":"1.2","unit":"m"},{"label":"Depth","value":"800","unit":"mm"},{"label":"Height","value":"75","unit":"cm"}]'};
try {
  for (const width of [360,390,768,1440]) {
    const context=await browser.newContext({viewport:{width,height:900}});
    await context.addInitScript(()=>sessionStorage.setItem("cozycraft-welcome-seen","1"));
    await context.route("**/*",async route=>{
      const url=new URL(route.request().url());
      if(url.origin===new URL(base).origin)return route.continue();
      if(!url.hostname.endsWith("supabase.co"))return route.abort();
      const path=url.pathname;
      const single=(route.request().headers().accept||"").includes("vnd.pgrst.object");
      const reply=data=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
      if(path.endsWith("/products"))return reply([product]);
      if(path.endsWith("/categories"))return reply([{name:"Dining room",active:true}]);
      if(path.endsWith("/product_availability"))return reply(url.searchParams.has("product_id") ? {available:true} : []);
      if(path.endsWith("/store_settings"))return reply({id:true,store_name:"CozyCraft Furnitures"});
      return reply(single?{}:[]);
    });
    const page=await context.newPage();
    const errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    await page.goto(`${base}/products/quality-table`);
    await page.getByRole("img",{name:/Overall measurements: width 120 cm, depth 80 cm, height 75 cm/}).waitFor();
    await page.getByLabel("ROOM WIDTH (CM)").fill("150");
    await page.getByLabel("ROOM DEPTH (CM)").fill("100");
    await page.getByText(/30 cm width and 20 cm depth clearance/).waitFor();
    await page.getByLabel("ROOM WIDTH (CM)").fill("100");
    await page.getByText(/needs at least 120 × 80 cm/).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,"Product fits viewport");
    if(width<768)assert.equal(await page.getByLabel("ROOM WIDTH (CM)").evaluate(el=>getComputedStyle(el).fontSize),"16px","Mobile inputs prevent focus zoom");
    await page.getByRole("img",{name:/Overall measurements/}).scrollIntoViewIfNeeded();
    await page.screenshot({path:`/tmp/cozycraft-product-qa-${width}.png`});
    assert.deepEqual(errors,[]);
    console.log(`PASS ${width}px storefront: measurement diagram, metric conversion, room comparison and responsive layout`);
    await context.close();
  }
} finally { await browser.close(); }
