const test=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createServer}=require('../../src/api/server');
const {AuthError}=require('../../src/auth/errors');

test('Lovable-derived dark SOC shell renders safely on desktop and mobile',async t=>{
  const config={origin:'http://placeholder.invalid',cookieName:'sentinelx_session',sessionSeconds:3600,idleSeconds:1800,secureCookie:false};
  const user={id:'11111111-1111-4111-8111-111111111111',email:'viewer@example.invalid',displayName:'<b>Viewer</b>'};
  const auth={
    async login(){return {token:'viewer-token',user};},
    async currentUser(token){if(token!=='viewer-token')throw new AuthError(401,'Authentication required.');return user;},
    async logout(token){if(token!=='viewer-token')throw new AuthError(401,'Authentication required.');},
  };
  const access={
    async me(token){if(token!=='viewer-token')throw new AuthError(401,'Authentication required.');return {user,roles:['Viewer/Management'],permissions:['access.read','dashboard.read','events.read','alerts.read','incidents.read','notifications.read']};},
  };
  const dashboard={async snapshot(token){
    if(token!=='viewer-token')throw new AuthError(401,'Authentication required.');
    return {asOf:'2026-09-30T21:00:00.000Z',period:{last24HoursStart:'2026-09-29T21:00:00.000Z',trendStartDay:'2026-09-24'},
      totals:{eventsTotal:12,alertsTotal:4,incidentsTotal:2,activeIncidents:1,newAlerts:1,responseActions:1,reportedSuccessfulActions:1,reportedFailedActions:0,successfulContainments:1,averageIncidentRisk:63},
      last24Hours:{eventsReceived:12,alertsCreated:4,incidentsCreated:2,responsesRecorded:1},
      severity:{alerts:{LOW:1,MEDIUM:1,HIGH:1,CRITICAL:1},incidents:{LOW:0,MEDIUM:1,HIGH:0,CRITICAL:1}},
      status:{alerts:{NEW:1,ACKNOWLEDGED:3},incidents:{NEW:0,INVESTIGATING:1,CONTAINED:0,RESOLVED:1,DISMISSED:0}},
      threats:{alerts:[{code:'BRUTE_FORCE',count:2}],incidents:[{code:'BRUTE_FORCE',count:1}]},
      responses:[{action:'CONTAINMENT',total:1,succeeded:1,failed:0}],
      trend:['24','25','26','27','28','29','30'].map((day,i)=>({day:'2026-09-'+day,events:i+1,alerts:i%3,incidents:i%2,responses:i===6?1:0}))};
  }};
  const server=createServer(auth,config,access,null,null,null,null,null,null,null,null,null,dashboard);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;config.origin=base;
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1365,height:900}});
  const response=await page.goto(base+'/dashboard');
  assert.equal(response.status(),200);
  assert.equal(await page.locator('.sx-app').count(),1);
  assert.equal(await page.locator('.sx-sidebar').count(),1);
  assert.equal(await page.locator('.sx-brand-mark svg').count(),1);
  assert.equal(await page.locator('nav a[aria-current="page"]').getAttribute('href'),'/dashboard');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),'dark');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);

  await page.getByLabel('Email',{exact:true}).fill(user.email);
  await page.getByLabel('Application passphrase').fill('synthetic passphrase');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.locator('#dashboard-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('#identity').textContent(),user.displayName+' · Viewer/Management');
  assert.equal(await page.locator('#identity b').count(),0);
  assert.equal(await page.getByRole('link',{name:'Audit'}).isVisible(),false);
  assert.equal(await page.getByRole('link',{name:'Events'}).isVisible(),true);
  assert.ok(await page.locator('#total-cards .sx-card-icon svg').count()>0);
  assert.ok(await page.locator('.semantic-value.tone-critical').count()>0);

  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.locator('.sx-sidebar').evaluate(el=>getComputedStyle(el).position),'fixed');
  assert.equal(await page.getByRole('button',{name:'Open navigation'}).isVisible(),true);
  await page.getByRole('button',{name:'Open navigation'}).click();
  assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('sx-nav-open')),true);
  assert.equal(await page.getByRole('link',{name:'Dashboard'}).isVisible(),true);
});
