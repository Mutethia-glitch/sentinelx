const test=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createPool}=require('../../src/data/pool');
const {executeSql}=require('../../src/data/postgres');
const {migrationSql}=require('../../scripts/migrate');
const {incidentManagementFixture}=require('../../scripts/verify-incident-management');

test('incident console reconstructs investigation and keeps Viewer findings read-only',async t=>{
  assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Use a disposable database.');
  executeSql(migrationSql());
  const pool=createPool();let f,browser;
  t.after(async()=>{if(browser)await browser.close();if(f)await f.cleanup();await pool.end();});
  f=await incidentManagementFixture(pool);

  async function loginCookie(user){
    const response=await fetch(f.base+'/api/auth/login',{method:'POST',headers:{Origin:f.base,'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:f.password})});
    assert.equal(response.status,200);
    return response.headers.get('set-cookie').split(';')[0];
  }
  const analystCookie=await loginCookie(f.users[1]);
  const createdResponse=await fetch(f.base+'/api/incidents',{method:'POST',headers:{Cookie:analystCookie,Origin:f.base,'Content-Type':'application/json'},body:JSON.stringify({
    title:'Task 21 browser investigation',description:'Evidence workspace',alertIds:f.alertIds,assignedTo:null,reason:'Browser investigation verification'
  })});
  assert.equal(createdResponse.status,201);
  const incident=(await createdResponse.json()).incident;f.incidentIds.push(incident.id);

  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
  const pages=[];
  for(const user of [f.users[1],f.users[2]]){
    const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();pages.push(page);
    await page.goto(f.base+'/incidents');
    await page.getByLabel('Email',{exact:true}).fill(user.email);
    await page.getByLabel('Application passphrase').fill(f.password);
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.locator('#incidents-panel').waitFor({state:'visible'});
    await page.getByRole('button',{name:`Inspect incident ${incident.id}`}).click();
    await page.getByRole('tab',{name:'Investigation'}).click();
    await page.locator('#investigation-workspace').waitFor({state:'visible'});
  }

  const analyst=pages[0],viewer=pages[1];
  assert.equal(await analyst.locator('#investigation-event-rows tr').count(),2);
  assert.ok((await analyst.locator('#affected-entities').textContent()).includes('task18-user'));
  assert.ok((await analyst.locator('#affected-entities').textContent()).includes('task18-host'));
  assert.ok((await analyst.locator('#alert-rows').textContent()).includes('historical'));
  assert.ok(await analyst.locator('#investigation-timeline li').count()>=5);
  assert.equal(await analyst.locator('#investigation-note-form').isVisible(),true);
  assert.equal(await viewer.locator('#investigation-note-form').isVisible(),false);

  const malicious='<img src=x onerror=alert(1)>Evidence reviewed';
  await analyst.locator('#investigation-note-content').fill(malicious);
  await analyst.locator('#investigation-note-alerts').fill(f.alertIds[0]);
  await analyst.locator('#investigation-note-events').fill(f.eventIds.join('\n'));
  await analyst.getByRole('button',{name:'Record finding'}).click();
  await analyst.waitForFunction(()=>document.getElementById('investigation-notes').textContent.includes('Evidence reviewed'));
  assert.equal(await analyst.locator('#investigation-notes img').count(),0);
  assert.ok((await analyst.locator('#investigation-notes').textContent()).includes(malicious));
  assert.ok((await analyst.locator('#investigation-timeline').textContent()).includes('INVESTIGATION_NOTE'));

  await viewer.getByRole('button',{name:`Inspect incident ${incident.id}`}).click();
  await viewer.getByRole('tab',{name:'Investigation'}).click();
  await viewer.locator('#investigation-workspace').waitFor({state:'visible'});
  assert.ok((await viewer.locator('#investigation-notes').textContent()).includes('Evidence reviewed'));
  assert.equal(await viewer.locator('#investigation-note-form').isVisible(),false);

  await viewer.setViewportSize({width:390,height:844});
  assert.equal(await viewer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
});
