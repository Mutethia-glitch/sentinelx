const test=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createServer}=require('../../src/api/server');
const {AuthError}=require('../../src/auth/errors');

test('frontend navigation follows live grants, renders identity literally and clears protected UI on sign-out',async t=>{
  const config={origin:'http://placeholder.invalid',cookieName:'sentinelx_session',sessionSeconds:3600,idleSeconds:1800,secureCookie:false};
  const user={id:'11111111-1111-4111-8111-111111111111',email:'viewer@example.invalid',displayName:'<img src=x onerror=alert(1)>'};
  const auth={
    async login(){return {token:'viewer-token',user};},
    async currentUser(token){if(token!=='viewer-token')throw new AuthError(401,'Authentication required.');return user;},
    async logout(token){if(token!=='viewer-token')throw new AuthError(401,'Authentication required.');},
  };
  const access={
    async me(token){if(token!=='viewer-token')throw new AuthError(401,'Authentication required.');return {user,roles:['Viewer/Management'],permissions:['access.read','dashboard.read','events.read','alerts.read','incidents.read','investigations.read','responses.read','notifications.read','reports.read','categories.read']};},
  };
  const dashboard={async snapshot(token){
    if(token!=='viewer-token')throw new AuthError(401,'Authentication required.');
    return {asOf:'2026-09-30T20:00:00.000Z',period:{last24HoursStart:'2026-09-29T20:00:00.000Z',trendStartDay:'2026-09-24'},
      totals:{eventsTotal:0,alertsTotal:0,incidentsTotal:0,activeIncidents:0,newAlerts:0,responseActions:0,reportedSuccessfulActions:0,reportedFailedActions:0,successfulContainments:0,averageIncidentRisk:null},
      last24Hours:{eventsReceived:0,alertsCreated:0,incidentsCreated:0,responsesRecorded:0},
      severity:{alerts:{LOW:0,MEDIUM:0,HIGH:0,CRITICAL:0},incidents:{LOW:0,MEDIUM:0,HIGH:0,CRITICAL:0}},
      status:{alerts:{NEW:0,ACKNOWLEDGED:0},incidents:{NEW:0,INVESTIGATING:0,CONTAINED:0,RESOLVED:0,DISMISSED:0}},
      threats:{alerts:[],incidents:[]},responses:[],
      trend:['24','25','26','27','28','29','30'].map(day=>({day:'2026-09-'+day,events:0,alerts:0,incidents:0,responses:0}))};
  }};
  const server=createServer(auth,config,access,null,null,null,null,null,null,null,null,null,dashboard);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;config.origin=base;
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
  t.after(()=>browser.close());
  const page=await browser.newPage();
  const response=await page.goto(base+'/dashboard');assert.equal(response.status(),200);
  assert.match(response.headers()['content-security-policy'],/script-src 'self'/);
  assert.equal(response.headers()['cache-control'],'no-store');
  for(const link of await page.locator('nav a[data-permission]').all())assert.equal(await link.isVisible(),false);
  await page.getByLabel('Email',{exact:true}).fill(user.email);
  await page.getByLabel('Application passphrase').fill('synthetic passphrase');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.locator('#dashboard-panel').waitFor({state:'visible'});
  assert.equal(await page.getByRole('link',{name:'Dashboard'}).isVisible(),true);
  assert.equal(await page.getByRole('link',{name:'Events'}).isVisible(),true);
  assert.equal(await page.getByRole('link',{name:'Audit'}).isVisible(),false);
  assert.equal(await page.getByRole('link',{name:'Access'}).isVisible(),true);
  assert.equal(await page.locator('#identity').textContent(),user.displayName+' · Viewer/Management');
  assert.equal(await page.locator('#identity img').count(),0);
  assert.equal(await page.getByLabel('Application passphrase').inputValue(),'');
  await page.getByRole('button',{name:'Sign out'}).click();
  await page.locator('#login-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('#dashboard-panel').isVisible(),false);
  for(const link of await page.locator('nav a[data-permission]').all())assert.equal(await link.isVisible(),false);
});
