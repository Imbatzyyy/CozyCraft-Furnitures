// Authenticated admin UI fixtures. All backend requests are intercepted locally.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true});
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:5196';
const id='00000000-0000-4000-8000-000000000001';
const date=new Date().toISOString();
const user={id,email:'admin@example.test',role:'authenticated',aud:'authenticated',created_at:date,app_metadata:{},user_metadata:{},factors:[]};
const token=[{alg:'HS256',typ:'JWT'},{sub:id,role:'authenticated',aud:'authenticated',aal:'aal1',session_id:'report-fixture',exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000),amr:[]}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.')+'.'+Buffer.from('test-signature').toString('base64url');
const session={access_token:token,refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user};
const order={id:'00000000-0000-4000-8000-000000000002',order_number:'CC-EXPORT',user_id:id,created_at:date,status:'processing',payment_status:'pending',payment_method:'gcash',total:12500,subtotal:12000,delivery_fee:500,discount:0,shipping_address:{name:'Fixture Customer'},environment:'test',payment_reference:'cs_fixture',paid_at:null,order_items:[],order_status_history:[]};
const report={rows:[order],total:1,hasMore:false,nextCursor:null,asOf:date,snapshotKey:'fixture',summary:{totalValue:12500,settledValue:0,settledCount:0,pendingValue:12500,refundedValue:0,cancelledCount:0}};
await mkdir('tmp/report-browser',{recursive:true});
try {
  for(const width of [320,390,1440]) {
    const context=await browser.newContext({viewport:{width,height:900}});
    await context.routeWebSocket(/supabase\.co/,socket=>socket.close());
    const calls=[];
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url()); if(url.origin===new URL(base).origin)return route.continue();
      if(!url.hostname.endsWith('supabase.co'))return route.abort();
      const path=url.pathname, headers=route.request().headers();
      const reply=(data)=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
      if(path.endsWith('/token'))return reply(session);
      if(path.endsWith('/user'))return reply(user);
      if(path.endsWith('/profiles')) {
        const profile={id,full_name:'Fixture Admin',role:'superadmin',staff_active:true,email:user.email};
        return reply(url.searchParams.has('id') ? ((headers.accept||'').includes('vnd.pgrst.object') ? profile : [profile]) : []);
      }
      if(path.endsWith('/admin_security_settings'))return reply({require_admin_mfa:false,session_timeout_minutes:30});
      if(path.endsWith('/store_settings'))return reply({id:true,store_name:'CozyCraft Furnitures'});
      if(path.endsWith('/rpc/admin_overview_snapshot'))return reply({sales:0,monthCount:1,pending:1,lowStock:0,fulfillment:0,cancellations:0,refunds:0,support:0,statuses:{},salesData:[],recent:[order]});
      if(path.endsWith('/rpc/admin_order_queue'))return reply({orders:[order],total:1,allCount:1,today:1,fulfillment:0,awaiting:1,attention:0,paymentMethods:['gcash']});
      if(path.endsWith('/rpc/admin_commerce_report_page')){calls.push(route.request().postDataJSON());return reply(report);}
      if(path.includes('/rpc/'))return reply(null);
      return reply((headers.accept||'').includes('vnd.pgrst.object')?{}:[]);
    });
    const page=await context.newPage(); page.setDefaultTimeout(15000); const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/admin/login`); await page.getByLabel('Work email').fill(user.email);await page.locator('input[type="password"]').fill('Fixture-password');await page.getByRole('button',{name:'Enter operations'}).click();
    try { await page.getByText('Total sales',{exact:true}).waitFor(); }
    catch(error){console.error((await page.locator('body').innerText()).slice(0,1800));throw error;}
    for(const kind of ['orders','payments']) {
      await page.goto(`${base}/admin/${kind}`);
      await page.getByRole('button',{name:'Export report',exact:true}).click();
      const dialog=page.getByRole('dialog',{name:`Export ${kind}`,exact:true});await dialog.waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Dialog fits viewport');
      assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth),false,'No horizontal dialog overflow');
      await dialog.getByLabel('Payment method',{exact:true}).selectOption('gcash');
      await dialog.getByLabel('Payment status',{exact:true}).selectOption('pending');
      await dialog.getByLabel('Order status',{exact:true}).selectOption('processing');
      await dialog.getByLabel('Date placed',{exact:true}).selectOption('custom');
      await dialog.getByLabel('From',{exact:true}).fill('2026-01-01');await dialog.getByLabel('Through',{exact:true}).fill('2026-12-31');
      await page.screenshot({path:`tmp/report-browser/${kind}-${width}.png`,animations:'disabled'});
      const format=kind==='orders'?'csv':'pdf';await dialog.locator(`input[name="report-format"][value="${format}"]`).check();
      const downloadEvent=page.waitForEvent('download');await dialog.getByRole('button',{name:`Download ${format.toUpperCase()}`,exact:true}).click();const download=await downloadEvent;
      const bytes=await readFile(await download.path());
      if(format==='csv'){assert.match(bytes.toString(),/CC-EXPORT/);assert.match(bytes.toString(),/12500/);}else assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
      assert.match(download.suggestedFilename(),new RegExp(`CozyCraft-${kind}-processing-pending-gcash-.*\\.${format}$`));
      const request=calls.findLast(c=>c.p_kind===kind&&c.p_size===250);
      assert.equal(request.p_filters.paymentMethod,'gcash');assert.equal(request.p_filters.paymentStatus,'pending');assert.equal(request.p_filters.status,'processing');assert.equal(request.p_filters.from,'2026-01-01');
      await dialog.waitFor({state:'hidden'});
    }
    assert.deepEqual(errors,[]);console.log(`PASS ${width}px: authenticated Orders CSV and Payments PDF downloads, filters, branded renderer and responsive dialogs.`);await context.close();
  }
} finally {await browser.close();}
