const test=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createPool}=require('../../src/data/pool');
const {executeSql}=require('../../src/data/postgres');
const {migrationSql}=require('../../scripts/migrate');
const {incidentManagementFixture}=require('../../scripts/verify-incident-management');

test('incident console displays deterministic risk and updates it after severity reassessment',async t=>{
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
    title:'Task 20 browser risk',description:'Two evidence events',alertIds:f.alertIds,assignedTo:null,reason:'Browser risk verification'
  })});
  assert.equal(createdResponse.status,201);
  const incident=(await createdResponse.json()).incident;f.incidentIds.push(incident.id);
  assert.equal(incident.risk.score,82);

  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.goto(f.base+'/incidents');
  await page.getByLabel('Email',{exact:true}).fill(f.users[1].email);
  await page.getByLabel('Application passphrase').fill(f.password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.locator('#incidents-panel').waitFor({state:'visible'});
  assert.ok((await page.locator('#rows').textContent()).includes('82/100'));

  await page.getByRole('button',{name:`Inspect incident ${incident.id}`}).click();
  await page.locator('#detail-panel').waitFor({state:'visible'});
  assert.ok((await page.locator('#detail-fields').textContent()).includes('82 / 100'));
  assert.ok((await page.locator('#detail-fields').textContent()).includes('2'));

  await page.locator('#assessment-severity').selectOption('MEDIUM');
  await page.locator('#assessment-reason').fill('Verify deterministic risk recalculation');
  await page.getByRole('button',{name:'Update classification and severity'}).click();
  await page.waitForFunction(()=>document.getElementById('detail-fields').textContent.includes('42 / 100'));
  assert.ok((await page.locator('#rows').textContent()).includes('42/100'));
});
