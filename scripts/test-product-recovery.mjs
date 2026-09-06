import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
try {
  for(const width of [390,1440]) {
    const context=await browser.newContext({viewport:{width,height:900}});
    let failed=true;
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin===base)return route.continue();
      if(!url.hostname.endsWith('supabase.co'))return route.abort();
      const path=url.pathname;
      if(failed&&(path.endsWith('/products')||path.endsWith('/product_availability')))return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Simulated outage"}'});
      const single=(route.request().headers().accept||'').includes('vnd.pgrst.object');
      let body=single?{}:[];
      if(path.endsWith('/products'))body=[{id:'recovery-table',name:'Recovery Table',description:'A dining table for testing recovery.',category:'Dining room',price:1000,stock_quantity:10,status:'active',rating:5,review_count:0,images:[],dimensions:'',material:''}];
      if(path.endsWith('/product_availability'))body=url.searchParams.has('product_id')?{available:true}:[];
      if(path.endsWith('/categories'))body=[{name:'Dining room',active:true}];
      if(path.endsWith('/store_settings'))body={id:true,store_name:'CozyCraft Furnitures'};
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    });
    const page=await context.newPage();
    await page.goto(`${base}/products/recovery-table`);
    await page.getByRole('button',{name:'Try again',exact:true}).waitFor({timeout:11000});
    assert.equal(await page.getByText('Checking this piece…',{exact:true}).isVisible(),false);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:`/tmp/cozy-recovery-${width}.png`});
    failed=false;
    await page.getByRole('button',{name:'Try again',exact:true}).click();
    await page.getByRole('heading',{name:'Recovery Table',exact:true}).waitFor();
    console.log(`PASS ${width}px: bounded failure, responsive retry, successful recovery`);
    await context.close();
  }
} finally { await browser.close(); }
