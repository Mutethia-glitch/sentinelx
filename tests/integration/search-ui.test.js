const test=require('node:test');
const assert=require('node:assert/strict');
const {randomInt}=require('node:crypto');
const {chromium}=require('playwright');
const {createPool}=require('../../src/data/pool');
const {executeSql}=require('../../src/data/postgres');
const {migrationSql}=require('../../scripts/migrate');
const {incidentManagementFixture}=require('../../scripts/verify-incident-management');

test('event/alert/incident consoles share evidence and MITRE search controls',async t=>{
  assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Use a disposable database.');
  executeSql(migrationSql());
  const pool=createPool();let fixture,browser,mappingId,ruleId;
  t.after(async()=>{
    if(browser)await browser.close();
    if(mappingId){
      await pool.query('DELETE FROM rule_mitre_mappings WHERE rule_id=$1 AND mapping_id=$2',[ruleId,mappingId]);
      await pool.query('DELETE FROM mitre_mappings WHERE id=$1',[mappingId]);
    }
    if(fixture)await fixture.cleanup();
    await pool.end();
  });
  fixture=await incidentManagementFixture(pool);
  async function loginCookie(user){
    const res=await fetch(fixture.base+'/api/auth/login',{method:'POST',
      headers:{Origin:fixture.base,'Content-Type':'application/json'},
      body:JSON.stringify({email:user.email,password:fixture.password})});
    assert.equal(res.status,200);return res.headers.get('set-cookie').split(';')[0];
  }
  const cookie=await loginCookie(fixture.users[1]);
  ruleId=(await pool.query('SELECT rule_id FROM alerts WHERE id=$1',[fixture.alertIds[0]])).rows[0].rule_id;
  let technique;
  for(let n=0;n<20;n++){
    technique='T'+String(randomInt(8000,9999))+'.'+String(randomInt(1000)).padStart(3,'0');
    const added=await pool.query("INSERT INTO mitre_mappings(technique_id,technique_name) VALUES($1,'Task 25 UI synthetic technique') ON CONFLICT DO NOTHING RETURNING id",[technique]);
    if(added.rows[0]){mappingId=added.rows[0].id;break;}
  }
  assert.ok(mappingId);
  await pool.query('INSERT INTO rule_mitre_mappings(rule_id,mapping_id) VALUES($1,$2)',[ruleId,mappingId]);
  const created=await fetch(fixture.base+'/api/incidents',{method:'POST',
    headers:{Cookie:cookie,Origin:fixture.base,'Content-Type':'application/json'},
    body:JSON.stringify({title:'Search browser test',description:'Synthetic cross-resource search',
      alertIds:fixture.alertIds,assignedTo:null,reason:'Test cross-resource search UI'})});
  assert.equal(created.status,201);
  fixture.incidentIds.push((await created.json()).incident.id);
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?
    {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
  const cases=[['events','#events-panel',fixture.eventIds[0]],['alerts','#alerts-panel',fixture.alertIds[0]],
    ['incidents','#incidents-panel',fixture.incidentIds[0]]];
  for(const [resource,panel,expected] of cases){
    const ctx=await browser.newContext({viewport:{width:1280,height:900}}),page=await ctx.newPage();
    await page.goto(fixture.base+'/'+resource);
    await page.getByLabel('Email',{exact:true}).fill(fixture.users[2].email);
    await page.getByLabel('Application passphrase').fill(fixture.password);
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.locator(panel).waitFor({state:'visible'});
    assert.equal(await page.locator('#filters [name="ruleId"]').count(),1);
    assert.equal(await page.locator('#filters [name="mitreTechniqueId"]').count(),1);
    assert.equal(await page.locator('#filters [name="sourceIp"]').count(),1);
    await page.locator('#filters [name="sourceIp"]').fill('192.0.2.18');
    await page.locator('#filters [name="user"]').fill('task18-user');
    await page.locator('#filters [name="host"]').fill('task18-host');
    await page.locator('#filters [name="ruleId"]').fill(ruleId);
    await page.locator('#filters [name="mitreTechniqueId"]').fill(technique);
    await page.getByRole('button',{name:'Apply filters'}).click();
    await page.waitForFunction(()=>document.querySelectorAll('#rows tr').length===1);
    assert.ok((await page.locator('#rows').textContent()).length>0);
    const inspect=await page.locator('#rows button').first().getAttribute('aria-label');
    assert.ok(inspect.includes(expected));
    await page.getByRole('button',{name:'Clear filters'}).click();
    await page.waitForFunction(()=>document.getElementById('page').textContent==='Page 1');
    await ctx.close();
  }
});
