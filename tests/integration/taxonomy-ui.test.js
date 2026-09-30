'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createServer}=require('../../src/api/server');
const {AuthError}=require('../../src/auth/errors');
const {CATEGORY_CODES}=require('../../src/threats/taxonomy');

test('event, alert and incident consoles expose all fifteen taxonomy filter choices',async t=>{
  const config={origin:'http://placeholder.invalid',cookieName:'sentinelx_session',sessionSeconds:3600,idleSeconds:1800,secureCookie:false};
  const auth={
    async login(){throw new AuthError(401,'Authentication required.');},
    async currentUser(){throw new AuthError(401,'Authentication required.');},
    async logout(){throw new AuthError(401,'Authentication required.');},
  };
  const access={async me(){throw new AuthError(401,'Authentication required.');}};
  const server=createServer(auth,config,access);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;config.origin=base;
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
  t.after(()=>browser.close());
  const expected=[...CATEGORY_CODES].sort();
  for(const route of ['/events','/alerts','/incidents']){
    const page=await browser.newPage();
    const response=await page.goto(base+route);assert.equal(response.status(),200);
    const values=await page.locator('#threat-category-codes option').evaluateAll(options=>options.map(option=>option.value).sort());
    assert.deepEqual(values,expected,route);
    assert.equal(await page.locator('#filters [name="categoryCode"][list="threat-category-codes"]').count(),1);
    await page.close();
  }
});
