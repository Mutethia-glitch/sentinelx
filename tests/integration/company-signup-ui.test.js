'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createPlatformServer}=require('../../src/platform/server');

test('company signup renders on mobile, displays errors and guards verification/resend requests',async t=>{
 const server=createPlatformServer({}, {origin:'http://placeholder.invalid'});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:390,height:844}});await page.clock.install();
 let signupFails=true,verifyFails=true,verifyPending=true,resendCalls=0,release;
 const pending=new Promise(resolve=>{release=resolve;});
 await page.route('**/api/company-signup**',async route=>{
  const path=new URL(route.request().url()).pathname;
  let status=200,body={};
  if(path.endsWith('/resend')){resendCalls++;await pending;body={expiresInSeconds:600};}
  else if(path.endsWith('/verify')){status=verifyFails?503:verifyPending?202:200;body=verifyFails?{error:'Company provisioning is temporarily unavailable.'}:verifyPending?{status:'PROVISIONING'}:{tenant:{name:'Synthetic Company',origin:'https://synthetic.example.com'}};}
  else {status=signupFails?503:201;body=signupFails?{error:'Verification email could not be sent. Try again later.'}:{registrationId:'11111111-1111-4111-8111-111111111111'};}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });
 const base='http://127.0.0.1:'+server.address().port;
 await page.goto(base+'/signup?continue=example');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await page.locator('#verify-form').isVisible(),false);
 await page.locator('#company-name').fill('Synthetic Company');await page.locator('#admin-name').fill('Synthetic Admin');
 await page.locator('#admin-email').fill('admin@example.invalid');await page.locator('#password').fill('Synthetic password 123!');
 await page.locator('#signup-form button').click();
 await page.waitForFunction(()=>document.querySelector('#message').textContent.startsWith('Error:'));
 assert.match(await page.locator('#message').textContent(),/Verification email/);
 assert.equal(await page.locator('#password').inputValue(),'');
 signupFails=false;await page.locator('#password').fill('Synthetic password 123!');await page.locator('#signup-form button').click();
 await page.locator('#verify-form').waitFor({state:'visible'});
 assert.equal(await page.locator('#resend').isDisabled(),true);
 assert.match(await page.locator('#resend-timer').textContent(),/60s/);
 await page.clock.fastForward(60000);
 assert.equal(await page.locator('#resend').isDisabled(),false);
 await page.locator('#resend').click();
 await page.clock.fastForward(65000);
 assert.equal(await page.locator('#resend').isDisabled(),true);
 assert.equal(await page.locator('#verify-form button[type="submit"]').isDisabled(),true);
 assert.equal(resendCalls,1);release();
 await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('A new six-digit code'));
 assert.match(await page.locator('#resend-timer').textContent(),/60s/);
 await page.locator('#code').fill('123456');await page.locator('#verify-form button[type="submit"]').click();
 await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('temporarily unavailable'));
 assert.equal(await page.locator('#code').inputValue(),'123456');
 verifyFails=false;await page.locator('#verify-form button[type="submit"]').click();
 await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('being prepared'));
 assert.equal(await page.locator('#complete').isVisible(),false);assert.equal(await page.locator('#code').isDisabled(),true);
 verifyPending=false;await page.clock.fastForward(60000);
 await page.locator('#complete').waitFor({state:'visible'});
 assert.equal(await page.locator('#tenant-link').getAttribute('href'),'https://synthetic.example.com');
 assert.equal(await page.locator('#code').inputValue(),'');
});
