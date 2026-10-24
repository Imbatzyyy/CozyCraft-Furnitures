// Navigation-only browser checks. All backend responses are isolated fixtures.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5196';
const groups = [
  ['Daily tasks', [['Dashboard','/admin'],['Orders','/admin/orders'],['Payments','/admin/payments'],['Reports','/admin/reports']]],
  ['Products & stock', [['Products','/admin/products'],['Stock levels','/admin/inventory'],['Product categories','/admin/categories']]],
  ['Customers & help', [['Customers','/admin/customers'],['Customer messages','/admin/support'],['Customer reviews','/admin/reviews'],['Member rewards','/admin/member-tiers']]],
  ['Website', [['Pages & emails','/admin/content'],['Shopping experience','/admin/experience']]],
  ['Settings & team', [['Store settings','/admin/settings'],['Staff & permissions','/admin/team'],['Website status','/admin/system-health'],['Change history','/admin/activity-logs']]],
];
const staffPaths = ['/admin','/admin/orders','/admin/products','/admin/inventory','/admin/categories','/admin/support','/admin/reviews'];
await mkdir('tmp/admin-navigation', {recursive:true});

async function check(width, height, role='superadmin', visitEveryPage=false) {
  const context=await browser.newContext({viewport:{width,height}});
  await context.routeWebSocket(/supabase\.co/,socket=>socket.close());
  const id='00000000-0000-4000-8000-000000000001', date=new Date().toISOString();
  const user={id,email:'navigation@example.test',role:'authenticated',aud:'authenticated',created_at:date,app_metadata:{},user_metadata:{},factors:[]};
  const token=[{alg:'HS256',typ:'JWT'},{sub:id,role:'authenticated',aud:'authenticated',aal:'aal1',session_id:'navigation-fixture',exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000),amr:[]}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.')+'.'+Buffer.from('test-signature').toString('base64url');
  const requests=[];
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin===new URL(base).origin)return route.continue();
    if(!url.hostname.endsWith('supabase.co'))return route.abort();
    requests.push(url.pathname);
    const path=url.pathname, single=(route.request().headers().accept||'').includes('vnd.pgrst.object');
    const reply=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
    if(path.endsWith('/token'))return reply({access_token:token,refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user});
    if(path.endsWith('/user'))return reply(user);
    if(path.endsWith('/profiles'))return reply(url.searchParams.has('id') ? (single?{id,full_name:'Navigation Admin',role,staff_active:true,email:user.email}:[{id,role,staff_active:true}]) : []);
    if(path.endsWith('/admin_security_settings'))return reply({require_admin_mfa:false,session_timeout_minutes:30});
    if(path.endsWith('/store_settings'))return reply({id:true,store_name:'CozyCraft Furnitures'});
    if(path.endsWith('/rpc/admin_overview_snapshot'))return reply({sales:0,monthCount:0,pending:0,lowStock:2,fulfillment:3,cancellations:1,refunds:0,support:2,statuses:{},salesData:[],recent:[]});
    if(path.endsWith('/rpc/admin_order_queue'))return reply({orders:[],total:0,allCount:0,today:0,fulfillment:0,awaiting:0,attention:0,paymentMethods:[]});
    if(path.endsWith('/rpc/admin_customer_page'))return reply({profiles:[],total:0});
    if(path.includes('/rpc/')||path.includes('/functions/'))return reply(null);
    return reply(single?{}:[]);
  });
  const page=await context.newPage(); page.setDefaultTimeout(12000);
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  const mobile=width<1024;
  const permitted=path=>role==='staff'?staffPaths.includes(path):role==='admin'?!['/admin/team','/admin/settings'].includes(path):true;
  const visibleGroups=groups.map(([label,items])=>[label,items.filter(([,path])=>permitted(path))]).filter(([,items])=>items.length);
  const openMenu=async()=>{
    if(mobile) {
      await page.getByRole('button',{name:'Open admin navigation'}).click();
      await page.getByRole('dialog',{name:'Admin navigation',exact:true}).evaluate(async el=>{
        await Promise.all(el.getAnimations().map(animation=>animation.finished.catch(()=>{})));
      });
    }
    return page.getByRole('navigation',{name:'Admin navigation',exact:true}).filter({visible:true});
  };
  try {
    await page.goto(`${base}/admin/login`);
    await page.getByLabel('Work email').fill(user.email);
    const consent=page.getByRole('button',{name:'Keep essential only',exact:true});
    if(await consent.isVisible())await consent.click();
    await page.locator('input[type="password"]').fill('Navigation-fixture-only');
    await page.getByRole('button',{name:'Enter operations'}).click();
    await page.getByText('Total sales',{exact:true}).waitFor();
    await page.waitForLoadState('networkidle');
    let nav=await openMenu();
    await nav.locator('a[href="/admin/orders"]').getByText('4',{exact:true}).waitFor();
    await page.waitForLoadState('networkidle');
    const before=requests.length;
    assert.deepEqual(await nav.getByRole('link').allTextContents(),visibleGroups[0][1].map(([label])=>label==='Orders'?'Orders4':label));
    for(const [label,items] of visibleGroups.slice(1)) {
      const toggle=nav.getByRole('button',{name:new RegExp('^'+label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))});
      await toggle.click();
      assert.equal(await toggle.getAttribute('aria-expanded'),'true');
      const panel=page.locator(`[id="${await toggle.getAttribute('aria-controls')}"]`);
      assert.deepEqual(await panel.getByRole('link').evaluateAll(links=>links.map(link=>link.getAttribute('href'))),items.map(([,path])=>path));
      for(const link of await panel.getByRole('link').all())assert.ok((await link.boundingBox()).height>=44,'Touch target is at least 44px');
      await toggle.focus(); await page.keyboard.press('Enter');
      assert.equal(await toggle.getAttribute('aria-expanded'),'false');
      assert.equal(await panel.isVisible(),false,'Closed group is hidden from keyboard and screen reader');
    }
    // The existing shell may finish its initial notification/summary refresh or
    // touch the security-session heartbeat. Expanding a group must not fetch
    // any of its destination pages or introduce other requests.
    const shellRequests=['/touch_admin_security_session','/admin_notifications','/admin_overview_snapshot'];
    assert.deepEqual(requests.slice(before).filter(path=>!shellRequests.some(suffix=>path.endsWith(suffix))),[],'Opening groups does not fetch destination-page data');
    assert.equal(await nav.evaluate(el=>el.scrollWidth>el.clientWidth),false,'Menu has no horizontal overflow');
    await page.screenshot({path:`tmp/admin-navigation/${role}-${width}x${height}.png`});
    if(mobile) {
      const drawer=page.getByRole('dialog',{name:'Admin navigation',exact:true});
      const first=drawer.getByRole('link',{name:'Store dashboard'}), last=drawer.getByRole('button',{name:'Log out'});
      await last.focus();await page.keyboard.press('Tab');
      assert.equal(await first.evaluate(el=>el===document.activeElement),true,'Focus wraps inside mobile menu');
      await page.keyboard.press('Escape');await drawer.waitFor({state:'hidden'});
      assert.equal(await page.getByRole('button',{name:'Open admin navigation'}).evaluate(el=>el===document.activeElement),true,'Closing returns focus to menu button');
    } else {
      await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();
      const rail=page.getByRole('navigation',{name:'Admin navigation',exact:true}).filter({visible:true});
      assert.deepEqual(await rail.getByRole('link').evaluateAll(links=>links.map(link=>link.getAttribute('href'))),visibleGroups.flatMap(([,items])=>items.map(([,path])=>path)));
      await page.reload();await page.getByRole('button',{name:'Expand sidebar',exact:true}).waitFor();
      await page.getByRole('button',{name:'Expand sidebar',exact:true}).click();
    }
    if(visitEveryPage)for(const [group,items] of visibleGroups)for(const [label,path] of items) {
      nav=await openMenu();
      if(group!=='Daily tasks') {
        const toggle=nav.getByRole('button',{name:new RegExp('^'+group.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))});
        if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
      }
      await nav.locator(`a[href="${path}"]`).click();
      await page.waitForURL(url=>url.pathname===path);
      if(mobile)await page.getByRole('dialog',{name:'Admin navigation',exact:true}).waitFor({state:'hidden'});
      await page.locator('[data-admin-shell] header').first().getByText(label,{exact:true}).waitFor();
      assert.equal(await page.title(),`${label} · CozyCraft Admin`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${path} fits ${width}px`);
    }
    await page.getByRole('button',{name:'Search and jump',exact:true}).filter({visible:true}).click();
    const search=page.getByRole('dialog',{name:'Search and jump',exact:true});
    await search.getByRole('combobox').fill('inventory');
    const result=search.getByRole('option').filter({hasText:/^Stock levels/});
    await result.click();await page.waitForURL(url=>url.pathname==='/admin/inventory');
    await search.waitFor({state:'hidden'});
    nav=await openMenu();
    assert.equal(await nav.locator('a[href="/admin/inventory"]').getAttribute('aria-current'),'page','Active page auto-expands after search');
    await page.screenshot({path:`tmp/admin-navigation/active-${role}-${width}x${height}.png`});
    assert.deepEqual(errors,[]);
    console.log(`PASS navigation ${role} ${width}x${height}: page order, labels, permissions, keyboard, badges, no extra page-data requests, search aliases${visitEveryPage?', all allowed page links':''}.`);
  } catch(error) { console.error(await page.locator('body').innerText(),errors);throw error; }
  finally {await context.close();}
}
try {
  await check(1440,900,'superadmin',true);
  await check(390,844,'superadmin',true);
  await check(320,568);
  await check(768,1024);
  await check(844,390);
  await check(1024,768,'admin');
  await check(390,844,'staff',true);
} finally {await browser.close();}
