'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createServer}=require('../../src/api/server');
const {CATEGORY_CODES}=require('../../src/threats/taxonomy');

async function fixture(t){
  const server=createServer({}, {origin:'http://placeholder.invalid'});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.clock.install();
  const state={version:1,calls:[],expired:false,failure:0,delay:null};
  const user={id:'11111111-1111-4111-8111-111111111111',email:'analyst@example.invalid',displayName:'Synthetic analyst',active:true,roles:['Administrator']};
  const incidentId='22222222-2222-4222-8222-222222222222';
  function data(path){
    const v=state.version,at='2026-10-01T00:00:00.000Z';
    const event={id:incidentId,timestamp:at,source:'Fixture',type:'Synthetic',severity:'HIGH',status:'NEW',receivedAt:at,normalizedAt:null,rawData:{version:v}};
    const incident={id:incidentId,title:'Incident '+v,severity:'HIGH',status:'INVESTIGATING',createdAt:at,updatedAt:at,alerts:[],description:'Synthetic',risk:null,categoryCode:'BRUTE_FORCE'};
    if(path==='/api/access/me')return {user,tenant:{name:'Synthetic tenant',slug:'synthetic'},roles:['Administrator'],permissions:['access.read','dashboard.read','events.read','alerts.read','alerts.manage','incidents.read','incidents.manage','investigations.write','responses.execute','notifications.read','notifications.send','audit.read','users.read','users.roles.manage']};
    if(path==='/api/access/users')return {users:[{...user,displayName:'Employee '+v}]};
    if(path==='/api/access/roles')return {roles:['Administrator','Security Analyst','Viewer/Management'].map(name=>({name}))};
    if(path==='/api/dashboard')return {dashboard:{asOf:at,totals:{eventsTotal:v,alertsTotal:v,incidentsTotal:v,activeIncidents:v,newAlerts:v,responseActions:v,reportedSuccessfulActions:v,reportedFailedActions:0,successfulContainments:v,averageIncidentRisk:25},last24Hours:{eventsReceived:v,alertsCreated:v,incidentsCreated:v,responsesRecorded:v},severity:{alerts:{CRITICAL:v,HIGH:0,MEDIUM:0,LOW:0},incidents:{CRITICAL:0,HIGH:v,MEDIUM:0,LOW:0}},status:{alerts:{NEW:v,ACKNOWLEDGED:0},incidents:{NEW:0,INVESTIGATING:v,CONTAINED:0,RESOLVED:0,DISMISSED:0}},threats:{alerts:CATEGORY_CODES.map(code=>({code,count:v})),incidents:[]},responses:[],trend:Array.from({length:7},(_,i)=>({day:'2026-09-'+(24+i),events:i*v,alerts:i===0?0:v+i,incidents:v,responses:0}))}};
    if(path==='/api/events')return {events:[{...event,source:'Event '+v}],page:1,hasMore:false};
    if(path.startsWith('/api/events/'))return {event};
    if(path==='/api/alerts')return {alerts:[{id:incidentId,timestamp:at,severity:'HIGH',threat:'BRUTE_FORCE',rule:{name:'Rule '+v},source:'Fixture',status:'NEW'}],page:1,hasMore:false};
    if(path.startsWith('/api/alerts/'))return {alert:{id:incidentId,timestamp:at,severity:'HIGH',threat:'BRUTE_FORCE',rule:{name:'Rule '+v,id:incidentId},source:'Fixture',status:'NEW',confidence:null,affectedEntities:{},matchEvidence:{version:v},events:[event]}};
    if(path==='/api/incidents')return {incidents:[incident],page:1,hasMore:false};
    if(path.startsWith('/api/incidents/'))return {incident};
    if(path.startsWith('/api/threat-categories'))return {categories:CATEGORY_CODES.map(code=>({code,name:code}))};
    if(path.startsWith('/api/investigations/'))return {investigation:{affectedEntities:{user:[],host:[],sourceIp:[],destinationIp:[]},events:[],timeline:[{timestamp:at,type:'FINDING',summary:'Timeline '+v}],notes:[]}};
    if(path.startsWith('/api/responses/'))return {actions:[],page:1,hasMore:false};
    if(path==='/api/notifications')return {notifications:[{id:incidentId,severity:'HIGH',state:'UNREAD',message:'Notification '+v,incidentId,deliveredAt:at}],unreadCount:v,page:1,hasMore:false};
    if(path==='/api/audit')return {entries:[{id:incidentId,action:'Audit '+v,occurredAt:at,actor:user,target:{type:'INCIDENT',id:incidentId},context:{version:v}}],page:1,hasMore:false};
    throw new Error('Unexpected fixture path '+path);
  }
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url());state.calls.push(url.pathname+url.search);
    if(url.pathname==='/api/auth/logout'){state.expired=true;return route.fulfill({status:204});}
    if(state.delay&&url.pathname===state.delay.path){const snapshot=data(url.pathname);await state.delay.wait;return route.fulfill({contentType:'application/json',body:JSON.stringify(snapshot)});}
    const status=state.expired?401:state.failure;
    if(status)return route.fulfill({status,contentType:'application/json',headers:status===429?{'Retry-After':'20'}:{},body:JSON.stringify({error:status===401?'Authentication required.':'Temporarily unavailable.'})});
    await route.fulfill({contentType:'application/json',body:JSON.stringify(data(url.pathname))});
  });
  return {page,state,base:'http://127.0.0.1:'+server.address().port};
}
async function poll(page){await page.clock.fastForward(5000);await page.waitForFunction(()=>document.querySelector('.sx-live-status').dataset.state==='live');}

test('all seven consoles refresh existing APIs; graph preserves series, UTC labels and zero values',async t=>{
  const {page,state,base}=await fixture(t);
  const checks={dashboard:['#total-cards .card dd','1'],events:['#rows','Event 1'],alerts:['#rows','Rule 1'],incidents:['#rows','Incident 1'],notifications:['#notification-rows','Notification 1'],audit:['#rows','Audit 1'],access:['#users','Employee 1']};
  for(const [name,[selector,initial]] of Object.entries(checks)){
    state.version=1;await page.goto(base+'/'+name);
    await page.waitForFunction(([sel,text])=>document.querySelector(sel)?.textContent.includes(text),[selector,initial]);
    state.version=2;await poll(page);
    assert.ok((await page.locator(selector).first().textContent()).includes(initial.replace('1','2')),name);
  }
  await page.goto(base+'/events');await page.locator('#events-panel').waitFor({state:'visible'});
  await page.locator('#filters [name="source"]').fill('Fixture');
  await page.locator('#filters button[type="submit"]').click();
  await page.getByRole('button',{name:/Inspect event/}).click();
  await page.locator('#detail-panel').waitFor({state:'visible'});
  state.version=4;await poll(page);
  assert.match(await page.locator('#raw-data').textContent(),/4/);
  assert.ok(state.calls.filter(path=>path.startsWith('/api/events?')).at(-1).includes('source=Fixture'));
  await page.goto(base+'/alerts');await page.getByRole('button',{name:/Inspect alert/}).click();
  await page.getByRole('button',{name:/Inspect source event/}).click();
  await page.locator('#event-detail').waitFor({state:'visible'});
  state.version=5;await poll(page);
  assert.match(await page.locator('#match-evidence').textContent(),/5/);
  assert.match(await page.locator('#raw-event').textContent(),/5/);
  await page.goto(base+'/dashboard');await page.locator('#dashboard-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('#trend-chart .sx-trend-bar').count(),7);
  assert.equal(await page.locator('#trend-chart .sx-trend-bar').first().evaluate(el=>el.getBoundingClientRect().height),0);
  assert.equal(await page.locator('#trend-chart time').first().getAttribute('datetime'),'2026-09-24');
  assert.equal(await page.locator('#alert-threats li').count(),15);
  await page.locator('#trend-series').selectOption('responses');await page.locator('h1').click();
  state.version=3;await poll(page);
  assert.equal(await page.locator('#trend-series').inputValue(),'responses');
  assert.equal(await page.locator('#trend-chart .sx-trend-value').allTextContents().then(v=>v.join(',')),'0,0,0,0,0,0,0');
  await page.locator('#trend-series').selectOption('alerts');await page.locator('h1').click();
  if(process.env.SENTINELX_UI_SCREENSHOT)await page.locator('#trend-chart').screenshot({path:process.env.SENTINELX_UI_SCREENSHOT});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
});

test('refresh retains selected incident and protects drafts, including edits made during a request',async t=>{
  const {page,state,base}=await fixture(t);
  await page.goto(base+'/incidents');await page.getByRole('button',{name:/Inspect incident/}).click();
  await page.locator('#detail-panel').waitFor({state:'visible'});
  state.version=2;await poll(page);
  assert.match(await page.locator('#detail-fields').textContent(),/Incident 2/);
  assert.match(await page.locator('#investigation-timeline').textContent(),/Timeline 2/);
  await page.locator('#create-title').fill('Keep this unsaved draft');await page.locator('h1').click();
  const count=state.calls.length;await page.clock.fastForward(10000);
  assert.equal(state.calls.length,count);assert.equal(await page.locator('#create-title').inputValue(),'Keep this unsaved draft');
  assert.match(await page.locator('.sx-live-status').textContent(),/unsaved edits/);
  await page.goto(base+'/access');await page.locator('#users form').waitFor();
  let release;state.delay={path:'/api/access/users',wait:new Promise(resolve=>{release=resolve;})};
  const before=state.calls.length;await page.clock.fastForward(5000);
  const deadline=Date.now()+3000;
  while(state.calls.length<before+2&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));
  assert.ok(state.calls.length>=before+2,'background user request started');
  await page.locator('#users input[type="checkbox"]').nth(1).check();
  release();state.delay=null;
  await page.waitForFunction(()=>document.querySelector('.sx-live-status').textContent.includes('unsaved edits'));
  await page.clock.fastForward(5000);
  assert.equal(await page.locator('#users input[value="Security Analyst"]').isChecked(),true);
  assert.match(await page.locator('.sx-live-status').textContent(),/unsaved edits/);
});

test('refresh backs off on errors, pauses offline/hidden/inactive, and stops after expired access or logout',async t=>{
  const {page,state,base}=await fixture(t);
  await page.goto(base+'/dashboard');await page.locator('#dashboard-panel').waitFor({state:'visible'});
  state.failure=429;await page.clock.fastForward(5000);
  await page.waitForFunction(()=>document.querySelector('.sx-live-status').dataset.state==='stale');
  const failed=state.calls.length;await page.clock.fastForward(10000);assert.equal(state.calls.length,failed);
  state.failure=0;await page.clock.fastForward(15000);
  await page.waitForFunction(()=>document.querySelector('.sx-live-status').dataset.state==='live');
  await page.context().setOffline(true);const beforeOffline=state.calls.length;await page.clock.fastForward(5000);assert.equal(state.calls.length,beforeOffline);
  await page.context().setOffline(false);await page.waitForFunction(()=>document.querySelector('.sx-live-status').dataset.state==='live');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  const hidden=state.calls.length;await page.clock.fastForward(5000);assert.equal(state.calls.length,hidden);
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>document.querySelector('.sx-live-status').dataset.state==='live');
  await page.clock.fastForward(65000);const inactive=state.calls.length;await page.clock.fastForward(5000);assert.equal(state.calls.length,inactive);
  assert.match(await page.locator('.sx-live-status').textContent(),/inactive tab/);
  await page.locator('h1').click();state.expired=true;await page.clock.fastForward(5000);
  await page.locator('#login-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('#trend-chart').textContent(),'');
  const expired=state.calls.length;await page.clock.fastForward(15000);assert.equal(state.calls.length,expired);
  state.expired=false;await page.goto(base+'/dashboard');await page.locator('#dashboard-panel').waitFor({state:'visible'});
  let release;state.delay={path:'/api/dashboard',wait:new Promise(resolve=>{release=resolve;})};
  const delayed=page.waitForRequest('**/api/dashboard');await page.clock.fastForward(5000);await delayed;
  await page.locator('#logout').click();await page.locator('#login-panel').waitFor({state:'visible'});
  release();state.delay=null;
  const loggedOut=state.calls.length;await page.clock.fastForward(15000);assert.equal(state.calls.length,loggedOut);
  assert.equal(await page.locator('#dashboard-panel').isVisible(),false);assert.equal(await page.locator('#trend-chart').textContent(),'');
});
