// Isolated provider-failure fixtures. No live sign-ins, payments or messages.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5173';
const browser=await chromium.launch({headless:true});
try{
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900}});
  await context.routeWebSocket(/supabase\.co/,socket=>socket.close());
  await context.addInitScript(()=>sessionStorage.setItem('cozycraft-welcome-seen','1'));
  let outage=true,reads=0,writes=0;const readPaths=[];
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin===new URL(base).origin)return route.continue();
   if(!url.hostname.endsWith('supabase.co'))return route.abort();
   const method=route.request().method(),path=url.pathname;
   if(path.startsWith('/rest/v1/')&&['GET','HEAD'].includes(method)){reads++;readPaths.push(path);}
   if(path.startsWith('/rest/v1/')&&outage)return route.fulfill({status:402,contentType:'application/json',body:'{"message":"Fixture quota restriction"}'});
   if(path.startsWith('/rest/v1/')&&!['GET','HEAD'].includes(method)&&!path.includes('/rpc/'))writes++;
   const single=route.request().headers().accept?.includes('vnd.pgrst.object');
   let data=single?{}:[];
   if(path.endsWith('/store_settings'))data={id:true,store_name:'CozyCraft Furnitures'};
   if(path.endsWith('/products'))data=[{id:'recovery-table',name:'Recovery Table',category:'Dining room',price:12000,stock_quantity:10,status:'active',images:[],rating:0,review_count:0}];
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install();
  await page.goto(`${base}/home`);
  const banner=page.getByRole('status',{name:'Live service availability'});await banner.waitFor();
  // Settle lazy homepage sections while the cooldown is still active.
  await page.clock.runFor(3_000);
  assert.match(await banner.innerText(),/cannot confirm current stock/);
  assert.equal(await banner.getByRole('button').isDisabled(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const noticeBox=await banner.boundingBox();
  const headerBox=await page.locator('header').first().boundingBox();
  assert.ok(noticeBox.y>=headerBox.y+headerBox.height-1,'Availability notice must not sit behind navigation');
  await page.screenshot({path:`/tmp/cozy-free-availability-${width}.png`});
  await page.waitForLoadState('networkidle');
  const before=reads;
  await page.clock.fastForward(60_100);
  assert.equal(reads,before,`Cooldown must not poll the database: ${readPaths.join(', ')}`);
  outage=false;await banner.getByRole('button',{name:'Try live updates again'}).click();
  await banner.waitFor({state:'hidden'});
  assert.equal(writes,0,'Recovery must never replay a purchase');
  assert.deepEqual(errors,[]);
  console.log(`PASS ${width}px: visible quota warning, no nav overlap or overflow, no polling, manual recovery, no replayed writes`);
  await context.close();
 }
}finally{await browser.close();}
