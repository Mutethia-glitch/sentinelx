const test=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createPool}=require('../../src/data/pool');
const {executeSql}=require('../../src/data/postgres');
const {migrationSql}=require('../../scripts/migrate');
const {incidentManagementFixture}=require('../../scripts/verify-incident-management');

test('incident browser displays and controls taxonomy/severity while Viewer stays read-only',async t=>{
  assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Use a disposable database.');
  executeSql(migrationSql());
  const pool=createPool();let f,browser;
  t.after(async()=>{if(browser)await browser.close();if(f)await f.cleanup();await pool.end();});
  f=await incidentManagementFixture(pool);
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
  const pages=[];
  for(const user of [f.users[1],f.users[2]]){
    const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();pages.push(page);
    await page.goto(f.base+'/incidents');await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Application passphrase').fill(f.password);
    await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.locator('#incidents-panel').waitFor({state:'visible'});
  }
  const analyst=pages[0],viewer=pages[1],title='Task 19 browser assessment';
  await analyst.locator('#create-title').fill(title);await analyst.locator('#create-description').fill('Classification and severity display verification');
  await analyst.locator('#create-alerts').fill(f.alertIds.join('\n'));await analyst.locator('#create-reason').fill('Create Task 19 browser incident');
  await analyst.getByRole('button',{name:'Create incident'}).click();await analyst.waitForFunction(()=>document.querySelectorAll('#rows tr').length===1);
  const incidentId=(await pool.query('SELECT id FROM incidents WHERE title=$1',[title])).rows[0].id;f.incidentIds.push(incidentId);
  await analyst.getByRole('button',{name:`Inspect incident ${incidentId}`}).click();await analyst.locator('#detail-panel').waitFor({state:'visible'});
  assert.equal(await analyst.locator('#assessment-form').isVisible(),true);
  assert.equal(await analyst.locator('#assessment-severity').inputValue(),'CRITICAL');
  await analyst.locator('#assessment-category').selectOption('');await analyst.locator('#assessment-severity').selectOption('MEDIUM');
  await analyst.locator('#assessment-reason').fill('Browser evidence remains mixed');
  await analyst.getByRole('button',{name:'Update classification and severity'}).click();
  await analyst.waitForFunction(()=>{const t=document.getElementById('detail-fields').textContent;return t.includes('MEDIUM')&&t.includes('Unclassified');});
  const row=(await pool.query('SELECT threat_level,category_code FROM incidents WHERE id=$1',[incidentId])).rows[0];
  assert.deepEqual(row,{threat_level:'MEDIUM',category_code:null});

  await viewer.reload();await viewer.locator('#incidents-panel').waitFor({state:'visible'});
  await viewer.getByRole('button',{name:`Inspect incident ${incidentId}`}).click();await viewer.locator('#detail-panel').waitFor({state:'visible'});
  assert.equal(await viewer.locator('#assessment-form').isVisible(),false);
  assert.ok((await viewer.locator('#detail-fields').textContent()).includes('MEDIUM'));
});
