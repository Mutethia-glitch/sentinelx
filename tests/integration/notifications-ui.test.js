const test=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createPool}=require('../../src/data/pool');
const {executeSql}=require('../../src/data/postgres');
const {migrationSql}=require('../../scripts/migrate');
const {incidentManagementFixture}=require('../../scripts/verify-incident-management');
test('private in-app inbox, severity display, safe rendering and recipient read control',async t=>{
 assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Use a disposable database.');
 executeSql(migrationSql());const pool=createPool();let f,browser;
 t.after(async()=>{if(browser)await browser.close();if(f)await f.cleanup();await pool.end();});
 f=await incidentManagementFixture(pool);
 async function loginCookie(user){
  const response=await fetch(f.base+'/api/auth/login',{method:'POST',headers:{Origin:f.base,'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:f.password})});
  assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];
 }
 const analystCookie=await loginCookie(f.users[1]);
 const created=await fetch(f.base+'/api/incidents',{method:'POST',headers:{Cookie:analystCookie,Origin:f.base,'Content-Type':'application/json'},
  body:JSON.stringify({title:'Task 23 browser inbox',description:'Synthetic only',alertIds:f.alertIds,assignedTo:f.users[1].id,reason:'Notification browser verification'})});
 assert.equal(created.status,201);const incident=(await created.json()).incident;f.incidentIds.push(incident.id);
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 const pages=[];
 for(const user of [f.users[1],f.users[2]]){
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();pages.push(page);
  await page.goto(f.base+'/notifications');
  await page.getByLabel('Email',{exact:true}).fill(user.email);
  await page.getByLabel('Application passphrase').fill(f.password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.locator('#inbox-panel').waitFor({state:'visible'});
 }
 const analyst=pages[0],viewer=pages[1];
 assert.equal(await analyst.locator('#send-panel').isVisible(),true);
 assert.equal(await viewer.locator('#send-panel').isVisible(),false);
 await analyst.locator('#send-self').uncheck();
 await analyst.locator('#recipient-id').fill(f.users[2].id);
 await analyst.locator('#target-kind').selectOption('INCIDENT');
 await analyst.locator('#target-id').fill(incident.id);
 await analyst.locator('#send-reason').fill('Task 23 explicit user notification');
 await analyst.getByRole('button',{name:'Deliver in-app notification'}).click();
 await analyst.waitForFunction(()=>document.getElementById('message').textContent.includes('delivered'));
 assert.ok((await analyst.locator('#notification-rows').textContent()).includes('No notifications'));
 await viewer.reload();await viewer.locator('#inbox-panel').waitFor({state:'visible'});
 assert.ok((await viewer.locator('#notification-rows').textContent()).includes('CRITICAL incident requires timely review.'));
 assert.equal(await viewer.locator('.notification.urgent').count(),1);
 assert.ok((await viewer.locator('#unread-count').textContent()).includes('1'));
 await viewer.getByRole('button',{name:'Mark as read'}).click();
 await viewer.waitForFunction(()=>document.getElementById('unread-count').textContent.includes('0'));
 assert.equal(await viewer.locator('.notification.read').count(),1);
 const injection='<img src=x onerror=alert(1)>Synthetic legacy notification';
 await pool.query('INSERT INTO notifications(recipient_id,incident_id,message,severity) VALUES($1,$2,$3,$4)',[f.users[2].id,incident.id,injection,'LOW']);
 await viewer.reload();await viewer.locator('#inbox-panel').waitFor({state:'visible'});
 assert.ok((await viewer.locator('#notification-rows').textContent()).includes(injection));
 assert.equal(await viewer.locator('#notification-rows img').count(),0);
 await viewer.setViewportSize({width:390,height:844});
 assert.equal(await viewer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await viewer.getByRole('button',{name:'Sign out'}).click();
 await viewer.locator('#login-panel').waitFor({state:'visible'});
});
