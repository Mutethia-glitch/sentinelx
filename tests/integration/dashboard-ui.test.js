const test=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createPool}=require('../../src/data/pool');
const {executeSql}=require('../../src/data/postgres');
const {migrationSql}=require('../../scripts/migrate');
const {incidentManagementFixture}=require('../../scripts/verify-incident-management');
test('dashboard shows persisted metrics and refresh updates after incident creation for analyst and Viewer',async t=>{
 assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Use a disposable database.');
 executeSql(migrationSql());const pool=createPool();let fixture,browser;
 t.after(async()=>{if(browser)await browser.close();if(fixture)await fixture.cleanup();await pool.end();});
 fixture=await incidentManagementFixture(pool);
 async function loginCookie(user){
  const response=await fetch(fixture.base+'/api/auth/login',{method:'POST',headers:{Origin:fixture.base,'Content-Type':'application/json'},
   body:JSON.stringify({email:user.email,password:fixture.password})});
  assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];
 }
 const analystCookie=await loginCookie(fixture.users[1]);
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?
  {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 const pages=[];
 for(const user of [fixture.users[1],fixture.users[2]]){
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();pages.push(page);
  await page.goto(fixture.base+'/dashboard');
  await page.getByLabel('Email',{exact:true}).fill(user.email);
  await page.getByLabel('Application passphrase').fill(fixture.password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.locator('#dashboard-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('#trend-rows tr').count(),7);
  assert.ok((await page.locator('#as-of').textContent()).includes('Snapshot captured:'));
 }
 const analyst=pages[0],viewer=pages[1];
 async function count(page,label){
  return page.evaluate(name=>{
   const card=[...document.querySelectorAll('#total-cards .card')].find(item=>item.querySelector('dt')?.textContent===name);
   return Number(card.querySelector('dd').textContent.replaceAll(',',''));
  },label);
 }
 const baseline=await count(analyst,'Incidents');
 assert.equal(await count(viewer,'Incidents'),baseline);
 const created=await fetch(fixture.base+'/api/incidents',{method:'POST',headers:{
  Cookie:analystCookie,Origin:fixture.base,'Content-Type':'application/json'},
  body:JSON.stringify({title:'Task 24 dashboard browser incident',description:'Synthetic UI regression',
   alertIds:fixture.alertIds,assignedTo:null,reason:'Verify live dashboard refresh'})});
 assert.equal(created.status,201);const incident=(await created.json()).incident;fixture.incidentIds.push(incident.id);
 await analyst.getByRole('button',{name:'Refresh metrics'}).click();
 await analyst.waitForFunction(previous=>{
  const item=[...document.querySelectorAll('#total-cards .card')].find(row=>row.querySelector('dt')?.textContent==='Incidents');
  return Number(item?.querySelector('dd')?.textContent.replaceAll(',',''))===previous+1;
 },baseline);
 assert.equal(await count(analyst,'Incidents'),baseline+1);
 await viewer.getByRole('button',{name:'Refresh metrics'}).click();
 await viewer.waitForFunction(previous=>{
  const item=[...document.querySelectorAll('#total-cards .card')].find(row=>row.querySelector('dt')?.textContent==='Incidents');
  return Number(item?.querySelector('dd')?.textContent.replaceAll(',',''))===previous+1;
 },baseline);
 assert.equal(await count(viewer,'Incidents'),baseline+1);
 assert.ok((await analyst.locator('#incident-severity').textContent()).includes('Critical'));
 await viewer.setViewportSize({width:390,height:844});
 assert.equal(await viewer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await viewer.getByRole('button',{name:'Sign out'}).click();
 await viewer.locator('#login-panel').waitFor({state:'visible'});
 assert.equal(await viewer.locator('#dashboard-panel').isVisible(),false);
});
