// Isolated storefront journeys. All external APIs are mocked; no live count inflation.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:5196';
const date=new Date().toISOString(),id='00000000-0000-4000-8000-000000000001';
const user={id,email:'fixture@example.invalid',role:'authenticated',aud:'authenticated',created_at:date,app_metadata:{},user_metadata:{}};
const jwt=[{alg:'HS256',typ:'JWT'},{sub:id,role:'authenticated',aud:'authenticated',aal:'aal1',exp:Math.floor(Date.now()/1000)+3600},'fixture'].map(x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url')).join('.');
const session={access_token:jwt,refresh_token:'fixture-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
const products=[['chair','Amber Chair','Living room'],['sofa','Cloud Sofa','Living room'],['bed','Dawn Bed','Bedroom']].map(([id,name,category])=>({id,name,category,subcategory:id==='chair'?'Chairs':id==='sofa'?'Sofas':'Beds',price:10000,stock_quantity:50,status:'active',rating:4,review_count:0,color:'Oak',material:'Wood',dimensions:'',description:'Fixture furniture',images:[],created_at:date,updated_at:date}));
try {
  for(const [width,signedIn] of [[320,false],[390,true],[768,false],[1440,true]]) {
    const context=await browser.newContext({viewport:{width,height:900}});
    await context.routeWebSocket(/supabase\.co/,socket=>socket.close());
    await context.addInitScript(({session,signedIn})=>{
      sessionStorage.setItem('cozycraft-welcome-seen','1');
      localStorage.setItem('cozycraft-cookie-choice',JSON.stringify({version:1,choice:'essential-only',savedAt:Date.now()}));
      if(signedIn)localStorage.setItem('cozycraft-customer-auth',JSON.stringify(session));
    },{session,signedIn});
    let visits=0,reads=0,sofaVisits=4;
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.origin===new URL(base).origin)return route.continue();
      if(!url.hostname.endsWith('supabase.co'))return route.abort();
      const path=url.pathname,reply=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
      if(path.endsWith('/user'))return reply(user);
      if(path.endsWith('/token'))return reply(session);
      if(path.endsWith('/profiles'))return reply({id,full_name:'Fixture Customer',username:'fixture_customer',email:user.email,role:'customer',customer_active:true,created_at:date});
      if(path.endsWith('/products'))return reply(products);
      if(path.endsWith('/categories'))return reply([{name:'Living room',active:true},{name:'Bedroom',active:true}]);
      if(path.endsWith('/product_availability'))return reply(url.searchParams.has('product_id')?{available:true}:[]);
      if(path.endsWith('/store_settings'))return reply({id:true,store_name:'CozyCraft Furnitures'});
      if(path.endsWith('/rpc/catalog_visit_counts')){reads++;return reply([{product_id:'chair',visits:8,saves:0},{product_id:'sofa',visits:sofaVisits,saves:999},{product_id:'bed',visits:20,saves:0}]);}
      if(path.endsWith('/functions/v1/record-product-visit')){
        assert.equal(request.headers().authorization,undefined,'No customer token in visit requests');
        assert.equal(request.postDataJSON().productId,'sofa'); visits++; sofaVisits=30;
        return reply({accepted:true,visits:sofaVisits});
      }
      if(path.endsWith('/rpc/customer_order_page'))return reply({orders:[],ids:[],total:0,counts:{}});
      if(path.includes('/rpc/'))return reply(null);
      return reply((request.headers().accept||'').includes('vnd.pgrst.object')?{}:[]);
    });
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(30000);
    await page.goto(`${base}/shop?sort=liked`);
    const sort=page.getByLabel('Sort products');
    await sort.waitFor();
    assert.equal(await sort.inputValue(),'clicked','Legacy links use click ranking');
    assert.equal(await sort.locator('option').filter({hasText:'Most liked'}).count(),0);
    await page.getByText('Most visited first, across guests and signed-in customers. Rapid repeat visits are limited.',{exact:true}).waitFor();
    const names=()=>page.locator('article[data-fly-source] a[aria-label]').evaluateAll(els=>els.map(el=>el.getAttribute('aria-label')));
    assert.deepEqual(await names(),['Dawn Bed','Amber Chair','Cloud Sofa'],'Global visits, not saves');
    assert.equal(visits,0,'Rendering cards never records a visit');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.waitForTimeout(1000); // Let the existing page-entry animation settle for visual QA.
    await page.screenshot({path:`/tmp/cozy-most-clicked-${width}.png`});
    await page.getByRole('link',{name:'Cloud Sofa',exact:true}).first().click();
    await page.getByRole('heading',{name:'Cloud Sofa',exact:true}).waitFor();
    await page.waitForFunction(()=>location.pathname==='/products/sofa');
    await page.waitForTimeout(200);
    assert.equal(visits,1,`${signedIn?'Account':'Guest'} product opening is recorded once`);
    await page.goBack(); await sort.waitFor();
    await page.waitForFunction(()=>document.querySelector('article[data-fly-source] a[aria-label]')?.getAttribute('aria-label')==='Cloud Sofa');
    assert.deepEqual(await names(),['Cloud Sofa','Dawn Bed','Amber Chair'],'Accepted visit updates catalog rank');
    await page.getByRole('link',{name:'Cloud Sofa',exact:true}).first().click();
    await page.getByRole('heading',{name:'Cloud Sofa',exact:true}).waitFor(); await page.waitForTimeout(200);
    assert.equal(visits,1,'Rapid repeat navigation does not inflate counts');
    await page.goto(`${base}/living-room?sort=popular`); await sort.waitFor();
    await page.getByText('Most visited first, across guests and signed-in customers. Rapid repeat visits are limited.',{exact:true}).waitFor();
    assert.deepEqual(await names(),['Cloud Sofa','Amber Chair'],'Room-filtered visits remain highest first');
    assert.ok(reads<=4,'No continuous polling or per-card count reads');
    assert.deepEqual(errors,[]);
    console.log(`PASS ${width}px ${signedIn?'account':'guest'}: global clicks, aliases, room filters, repeat protection and responsive layout`);
    await context.close();
  }
} finally { await browser.close(); }
