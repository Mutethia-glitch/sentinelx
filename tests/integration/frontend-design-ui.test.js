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
  const accessPage=await browser.newPage({viewport:{width:1365,height:900}});
  assert.equal((await accessPage.goto(base+'/access')).status(),200);
  assert.equal(await accessPage.locator('.sx-auth-screen').count(),1);
  assert.equal(await accessPage.getByRole('button',{name:'Sign in',exact:true}).count(),1);
  assert.equal(await accessPage.getByRole('button',{name:'Sign up',exact:true}).count(),0);
  assert.equal(await accessPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await accessPage.close();

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

  const metricColors=await page.evaluate(()=>{
    const colorFor=label=>{
      const card=[...document.querySelectorAll('#total-cards .card')].find(item=>item.querySelector('dt')?.textContent===label);
      return card?getComputedStyle(card.querySelector('.sx-card-icon')).color:null;
    };
    return {
      events:colorFor('Security events'),
      alerts:colorFor('Alerts'),
      incidents:colorFor('Incidents'),
      success:colorFor('Reported successful'),
      failure:colorFor('Reported unsuccessful')
    };
  });
  assert.ok(metricColors.events&&metricColors.alerts&&metricColors.incidents&&metricColors.success&&metricColors.failure);
  assert.notEqual(metricColors.events,metricColors.alerts);
  assert.notEqual(metricColors.alerts,metricColors.incidents);
  assert.notEqual(metricColors.success,metricColors.failure);

  const badgeLayout=await page.evaluate(()=>{
    const table=document.createElement('table');
    const tbody=document.createElement('tbody');
    const tr=document.createElement('tr');
    const high=document.createElement('td');
    const fresh=document.createElement('td');
    high.textContent='HIGH';fresh.textContent='NEW';
    tr.append(high,fresh);tbody.append(tr);table.append(tbody);document.body.append(table);
    window.SentinelXUi.decorateSemanticValues(table);
    const result={
      highCellDisplay:getComputedStyle(high).display,
      newCellDisplay:getComputedStyle(fresh).display,
      highBadge:high.querySelector('.semantic-value.tone-high')?.textContent||null,
      newBadge:fresh.querySelector('.semantic-value.tone-new')?.textContent||null
    };
    table.remove();
    return result;
  });
  assert.equal(badgeLayout.highCellDisplay,'table-cell');
  assert.equal(badgeLayout.newCellDisplay,'table-cell');
  assert.equal(badgeLayout.highBadge,'HIGH');
  assert.equal(badgeLayout.newBadge,'NEW');

  assert.equal(await page.locator('.sx-topbar-actions #refresh').count(),1);
  assert.equal(await page.locator('.sx-topbar-actions #logout').count(),1);
  assert.equal(await page.locator('#logout').getAttribute('data-icon'),'log-out');
  assert.equal(await page.locator('#logout svg').count(),1);
  const topbarBox=await page.locator('.sx-topbar').boundingBox();
  const actions=page.locator('.sx-topbar-actions');
  const refreshBox=await page.locator('.sx-topbar-actions #refresh').boundingBox();
  const logoutBox=await page.locator('.sx-topbar-actions #logout').boundingBox();
  assert.ok(topbarBox&&refreshBox&&logoutBox,'topbar session controls must have measurable layout boxes');
  assert.equal(await actions.evaluate(el=>getComputedStyle(el).justifyContent),'flex-end');
  const rightGap=(topbarBox.x+topbarBox.width)-(logoutBox.x+logoutBox.width);
  assert.ok(rightGap>=0&&rightGap<=40,'Sign out should remain anchored near the top bar right edge');
  const actionGap=logoutBox.x-(refreshBox.x+refreshBox.width);
  assert.ok(actionGap>=0&&actionGap<=16,'Refresh must remain immediately left of Sign out');

  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.locator('.sx-sidebar').evaluate(el=>getComputedStyle(el).position),'fixed');
  assert.equal(await page.getByRole('button',{name:'Open navigation'}).isVisible(),true);
  await page.getByRole('button',{name:'Open navigation'}).click();
  assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('sx-nav-open')),true);
  assert.equal(await page.getByRole('link',{name:'Dashboard'}).isVisible(),true);
});
