const test=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createPool}=require('../../src/data/pool');
const {executeSql}=require('../../src/data/postgres');
const {migrationSql}=require('../../scripts/migrate');
const {incidentManagementFixture}=require('../../scripts/verify-incident-management');
test('incident response UI supports safe manual records, containment confirmation and Viewer read-only behavior',async t=>{
 assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Use a disposable database.');
 executeSql(migrationSql());const pool=createPool();let f,browser;
 t.after(async()=>{if(browser)await browser.close();if(f)await f.cleanup();await pool.end();});
 f=await incidentManagementFixture(pool);
 async function loginCookie(user){
  const r=await fetch(f.base+'/api/auth/login',{method:'POST',headers:{Origin:f.base,'Content-Type':'application/json'},
   body:JSON.stringify({email:user.email,password:f.password})});
  assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];
 }
 const cookie=await loginCookie(f.users[1]);
 const created=await fetch(f.base+'/api/incidents',{method:'POST',
  headers:{Cookie:cookie,Origin:f.base,'Content-Type':'application/json'},
  body:JSON.stringify({title:'Task 22 browser response',description:'Manual response verification',
   alertIds:f.alertIds,assignedTo:f.users[1].id,reason:'Task 22 browser test'})});
 assert.equal(created.status,201);const incident=(await created.json()).incident;f.incidentIds.push(incident.id);
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?
  {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 const pages=[];
 for(const user of [f.users[1],f.users[2]]){
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();pages.push(page);
  await page.goto(f.base+'/incidents');
  await page.getByLabel('Email',{exact:true}).fill(user.email);
  await page.getByLabel('Application passphrase').fill(f.password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.locator('#incidents-panel').waitFor({state:'visible'});
  await page.getByRole('button',{name:'Inspect incident '+incident.id}).click();
  await page.locator('#response-workflow').waitFor({state:'visible'});
 }
 const analyst=pages[0],viewer=pages[1];
 assert.equal(await analyst.locator('#response-form').isVisible(),true);
 assert.equal(await viewer.locator('#response-form').isVisible(),false);
 assert.equal(await analyst.locator('#response-confirmation').isDisabled(),true);
 await analyst.locator('#response-reason').fill('Attempted manual containment');
 await analyst.locator('#response-details').fill('Manual attempt failed; affected session remains active.');
 await analyst.getByRole('button',{name:'Record manual response'}).click();
 await analyst.waitForFunction(()=>document.getElementById('response-action-rows').textContent.includes('Reported unsuccessful'));
 assert.ok((await analyst.locator('#detail-fields').textContent()).includes('NEW'));
 const malicious='<img src=x onerror=alert(1)>Manually contained.';
 await analyst.locator('#response-action').selectOption('CONTAINMENT');
 await analyst.locator('#response-succeeded').check();
 assert.equal(await analyst.locator('#response-confirmation').isDisabled(),false);
 await analyst.locator('#response-confirmation').check();
 await analyst.locator('#response-reason').fill('Approved successful containment recorded');
 await analyst.locator('#response-details').fill(malicious);
 await analyst.getByRole('button',{name:'Record manual response'}).click();
 await analyst.waitForFunction(()=>document.getElementById('detail-fields').textContent.includes('CONTAINED'));
 assert.ok((await analyst.locator('#response-action-rows').textContent()).includes(malicious));
 assert.equal(await analyst.locator('#response-action-rows img').count(),0);
 assert.equal((await pool.query('SELECT status FROM incidents WHERE id=$1',[incident.id])).rows[0].status,'CONTAINED');
 await viewer.getByRole('button',{name:'Inspect incident '+incident.id}).click();
 await viewer.locator('#response-workflow').waitFor({state:'visible'});
 assert.equal(await viewer.locator('#response-form').isVisible(),false);
 assert.ok((await viewer.locator('#response-action-rows').textContent()).includes(malicious));
 await viewer.setViewportSize({width:390,height:844});
 assert.equal(await viewer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
});
