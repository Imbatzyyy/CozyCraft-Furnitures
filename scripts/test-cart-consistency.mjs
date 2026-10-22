// Isolated browser fixtures: no production accounts, database writes or payments.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:5196';
const id='00000000-0000-4000-8000-000000000001',date=new Date().toISOString();
const user={id,email:'fixture@example.invalid',role:'authenticated',aud:'authenticated',created_at:date,app_metadata:{},user_metadata:{}};
const jwt=[{alg:'HS256',typ:'JWT'},{sub:id,role:'authenticated',aud:'authenticated',aal:'aal1',exp:Math.floor(Date.now()/1000)+3600},'fixture'].map(x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url')).join('.');
const session={access_token:jwt,refresh_token:'fixture-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
const products=[['chair','Fixture Chair',20000],['table','Fixture Table',10000]].map(([id,name,price])=>({id,name,price,category:'Living room',subcategory:'Chairs',stock_quantity:50,status:'active',rating:0,review_count:0,color:'Oak',material:'Wood',dimensions:'',description:'Fixture product',images:[],created_at:date,updated_at:date}));
try {
  for(const width of [320,390,768,1440]) {
    const context=await browser.newContext({viewport:{width,height:900}});
    await context.routeWebSocket(/supabase\.co/,socket=>socket.close());
    await context.addInitScript(session=>{localStorage.setItem('cozycraft-customer-auth',JSON.stringify(session));sessionStorage.setItem('cozycraft-welcome-seen','1');},session);
    let cart=[{product_id:'chair',quantity:1,selected_for_checkout:true},{product_id:'table',quantity:2,selected_for_checkout:true}];
    let inFlight=0,maxInFlight=0,writes=0,rejectWrite=false;
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url()),request=route.request();
      if(url.origin===new URL(base).origin)return route.continue();
      if(!url.hostname.endsWith('supabase.co'))return route.abort();
      const path=url.pathname,reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
      if(path.endsWith('/user'))return reply(user);
      if(path.endsWith('/token'))return reply(session);
      if(path.endsWith('/cart_items')){
        if(request.method()==='GET')return reply(structuredClone(cart));
        inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);writes++;
        await new Promise(resolve=>setTimeout(resolve,350));
        inFlight--;
        if(rejectWrite)return reply({message:'Fixture write rejected'},403);
        const body=request.postDataJSON();
        if(request.method()==='POST')for(const line of (Array.isArray(body)?body:[body])){cart=cart.filter(x=>x.product_id!==line.product_id);cart.push(line);}
        return reply(null);
      }
      if(path.endsWith('/profiles'))return reply({id,full_name:'Fixture Customer',username:'fixture_customer',email:user.email,role:'customer',customer_active:true,preferred_payment_method:'card',phone_verified_at:date,created_at:date});
      if(path.endsWith('/products'))return reply(products);
      if(path.endsWith('/categories'))return reply([{name:'Living room',active:true}]);
      if(path.endsWith('/addresses'))return reply([{id:'00000000-0000-4000-8000-000000000002',user_id:id,label:'Home',recipient_name:'Fixture Customer',mobile:'09000000000',email:user.email,address_line:'Test street',barangay:'Test',city:'Quezon City',province:'Metro Manila',postal_code:'1100',is_primary:true}]);
      if(path.endsWith('/store_settings'))return reply({id:true,currency_code:'PHP',checkout_settings:{cod_enabled:true,card_enabled:true,gcash_enabled:true,cod_maximum_order:20000,minimum_order_amount:0,maximum_order_amount:0}});
      if(path.endsWith('/rpc/get_checkout_payment_policy'))return reply({cod_limit:20000,outstanding_cod_total:0,gcash_limit:100000,checkout_total_limit:500000});
      if(path.endsWith('/rpc/customer_order_page'))return reply({orders:[],ids:[],total:0,counts:{}});
      if(path.endsWith('/rpc/catalog_popularity'))return reply([{product_id:'chair',viewers:10,saves:2},{product_id:'table',viewers:2,saves:5}]);
      if(path.endsWith('/functions/v1/create-paymongo-checkout')){
        assert.equal(request.postDataJSON().action,'configuration','Never create a real payment');return reply({testMode:true});
      }
      if(path.includes('/rpc/'))return reply(null);
      return reply([]);
    });
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    page.setDefaultTimeout(15000);
    try {
      await page.goto(base+'/cart');
      const plus=page.getByRole('button',{name:'Increase Fixture Chair quantity',exact:true});await plus.waitFor();
      await plus.evaluate(button=>{for(let n=0;n<20;n++)button.click();});
      await page.getByText('Saving your bag changes…',{exact:true}).waitFor();
      const checkout=page.getByRole('link',{name:/Proceed to checkout/});
      assert.equal(await checkout.getAttribute('aria-disabled'),'true');
      await page.waitForFunction(()=>!document.body.innerText.includes('Saving your bag changes…'));
      assert.equal(cart.find(x=>x.product_id==='chair').quantity,10);
      assert.equal(maxInFlight,1,'Network mutations cannot overlap');assert.ok(writes<=2,'Clicks coalesce');
      await page.getByText('₱220,000',{exact:true}).first().waitFor();
      const badge=page.getByRole('link',{name:'Shopping bag, 2 items'});
      if(width>=1024)assert.equal(await badge.count(),1,'Desktop badge counts two products, not twelve pieces');
      rejectWrite=true;
      await page.getByRole('button',{name:'Decrease Fixture Chair quantity',exact:true}).click();
      await page.getByRole('button',{name:'Retry saving',exact:true}).waitFor();
      assert.equal(await checkout.getAttribute('aria-disabled'),'true');
      rejectWrite=false;await page.getByRole('button',{name:'Retry saving',exact:true}).click();
      await page.waitForFunction(()=>!document.body.innerText.includes('Retry saving')&&!document.body.innerText.includes('Saving your bag changes…'));
      assert.equal(cart.find(x=>x.product_id==='chair').quantity,9);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:`/tmp/cozycraft-cart-consistency-${width}.png`,fullPage:true});
      await page.goto(base+'/checkout?items=chair,table');
      await page.getByRole('button',{name:'Debit or credit card',exact:true}).waitFor();
      await page.getByText('Sandbox card test instructions · no real charge',{exact:true}).click();
      await page.getByText(/4343 4343 4343 4345/).waitFor();
      assert.equal(await page.getByRole('button',{name:'GCash',exact:true}).isDisabled(),true,'Above GCash ceiling');
      assert.equal(await page.getByRole('button',{name:'Debit or credit card',exact:true}).isDisabled(),false);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:`/tmp/cozycraft-checkout-consistency-${width}.png`,fullPage:true});
      assert.deepEqual(errors,[]);
      console.log(`PASS ${width}px: rapid cart clicks, ordered batched writes, exact totals, failed-save retry, product badge, checkout caps and sandbox guidance`);
    } catch(error){console.error((await page.locator('body').innerText()).slice(-4000));throw error;}
    finally{await context.close();}
  }
}finally{await browser.close();}
