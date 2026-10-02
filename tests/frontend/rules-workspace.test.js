'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createServer}=require('../../src/api/server');
const {configFromEnv}=require('../../src/auth/config');
const {rulePage}=require('../../src/api/rule-page');
const ROOT=path.join(__dirname,'../../frontend');
const shell=fs.readFileSync(path.join(ROOT,'rules/index.html'),'utf8');
test('Rules UI is real tenant page, reachable by navigation and covered by 2FA destination allowlist',()=>{
 const server=fs.readFileSync(path.join(__dirname,'../../src/api/server.js'),'utf8');
 const helper=fs.readFileSync(path.join(ROOT,'shared/sentinelx-ui.js'),'utf8');
 const verify=fs.readFileSync(path.join(ROOT,'verify/verify.js'),'utf8');
 assert.match(server,/if \(rulePage\(req, res\)\) return;/);
 assert.match(helper,/events\|rules\|alerts/);
 assert.match(verify,/events\|rules\|alerts/);
 assert.match(shell,/data-page="rules"/);
 assert.match(shell,/data-permission="rules.read" hidden/);
 assert.match(shell,/id="rule-state-form"/);
 assert.match(shell,/id="rule-reason"/);
 assert.match(shell,/id="rule-confirm"/);
 for(const name of ['access','events','alerts','incidents','dashboard','notifications','audit']){
  const html=fs.readFileSync(path.join(ROOT,name,'index.html'),'utf8');
  assert.match(html,/href="\/rules" data-permission="rules.read" hidden/);
 }
});
test('Access is an expandable, spaced administrator workspace with no form or connection deletion',()=>{
 const html=fs.readFileSync(path.join(ROOT,'access/index.html'),'utf8');
 for(const id of ['users-panel','site-workspace','managed-feed-panel','integration-details']){
  assert.match(html,new RegExp('<details id="'+id+'"'));
  assert.match(html,new RegExp('data-open-workspace="'+id+'"'));
 }
 assert.equal((html.match(/<details\b/g)||[]).length,(html.match(/<\/details>/g)||[]).length);
 for(const id of ['invite-form','site-form','managed-feed-form','integration-rows','site-secret','managed-feed-secret'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/href="\/rules" data-permission="rules.read" hidden/);
 const theme=fs.readFileSync(path.join(ROOT,'shared/sentinelx-theme.css'),'utf8');
 assert.match(theme,/\.sx-access-shortcuts/);assert.match(theme,/\.sx-access-fold/);assert.match(theme,/\.sx-rule-tools/);
 for(const name of ['access','rules']){
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT,name,name+'.css'),'utf8'),/\{/);
 }
});
test('Rules assets use fixed-path GET-only CSP, refuse mutation and do not call rule APIs anonymously',async t=>{
 const config=configFromEnv({});
 const server=createServer({},config);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const origin='http://127.0.0.1:'+server.address().port;
 for(const asset of ['/rules','/rules/rules.js','/rules/rules.css']){
  const response=await fetch(origin+asset);
  assert.equal(response.status,200,asset);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  assert.equal((await fetch(origin+asset,{method:'POST'})).status,405);
 }
 assert.equal((await fetch(origin+'/api/rules')).status,404,'API not mounted in fake unauthenticated server');
 assert.equal(rulePage({url:'/rules/unknown',method:'GET'},{}),false);
 const javascript=fs.readFileSync(path.join(ROOT,'rules/rules.js'),'utf8');
 assert.match(javascript,/request\('\/api\/access\/me'\)/);
 assert.match(javascript,/request\('\/api\/rules\/'\+encodeURIComponent\(rule\.id\)/);
 assert.match(javascript,/reason,version:rule.version/);
 assert.match(javascript,/enabled:!rule.enabled/);
 assert.match(javascript,/ui\.beginTwoFactor\(result,'\/rules'\)/);
 assert.doesNotMatch(javascript,/innerHTML\s*=|localStorage|sessionStorage|\beval\(/);
});
