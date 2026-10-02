'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createPlatformServer}=require('../../src/platform/server');
const root=path.join(__dirname,'../..');
const source=file=>fs.readFileSync(path.join(root,file),'utf8');

test('the approved seven-layer shield is referenced on all public and tenant entry pages',()=>{
 const publicPages=[
   'frontend/company-login/index.html','frontend/signup/index.html',
   'frontend/verify/index.html','frontend/activate/index.html',
   'frontend/access/company-signup.html'
 ];
 for(const file of publicPages){
   const html=source(file);
   assert.match(html,/data-icon="shield"/,file);
   assert.match(html,/\/ui\/sentinelx-ui\.js/,file);
 }
 for(const area of ['access','dashboard','events','alerts','incidents','audit','notifications']){
   const html=source('frontend/'+area+'/index.html');
   assert.match(html,/class="sx-brand-mark" data-icon="shield"/,area);
   assert.match(html,/\/ui\/sentinelx-ui\.js/,area);
 }
 const shared=source('frontend/shared/sentinelx-ui.js');
 const styles=source('frontend/shared/sentinelx-theme.css');
 assert.match(shared,/layer<7/);
 assert.match(shared,/sx-shield-layer/);
 assert.match(styles,/sx-shield-turn 8\.73s/);
 assert.match(styles,/@media\(prefers-reduced-motion:reduce\)\{\.sx-shield-rotor\{animation:none\}\}/);
 assert.match(styles,/body\[data-page="company-login"\] \.sx-company-brand-mark > svg/);
});
test('signup redesign preserves every field, API hook and stage container',()=>{
 const html=source('frontend/signup/index.html');
 const ids=['signup-form','company-name','admin-name','admin-email','password',
   'verify-form','code','resend','resend-timer','complete','company-result','tenant-link','message'];
 for(const id of ids)assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 assert.match(html,/id="verify-form"[^>]*hidden/);
 assert.match(html,/id="complete"[^>]*hidden/);
 assert.match(html,/src="\/signup\/signup\.js"/);
 assert.match(html,/href="\/login"/);
 const logic=source('frontend/signup/signup.js');
 assert.match(logic,/\/api\/company-signup\/verify/);
 assert.match(logic,/\/api\/company-signup\/resend/);
 const css=source('frontend/shared/sentinelx-theme.css');
 assert.match(css,/body\[data-page="signup"\] \.sx-signup-layout/);
 assert.match(css,/@media\(max-width:480px\)/);
});
test('onboarding serves the existing shared shield renderer without altering signup APIs',async t=>{
 const server=createPlatformServer({}, {origin:'http://placeholder.invalid'});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const base='http://127.0.0.1:'+server.address().port;
 for(const [uri,kind] of [['/','text/html'],['/signup','text/html'],
  ['/ui/sentinelx-ui.js','text/javascript'],['/ui/sentinelx-theme.css','text/css']]){
   const response=await fetch(base+uri);
   assert.equal(response.status,200,uri);
   assert.match(response.headers.get('content-type')||'',new RegExp(kind),uri);
   const body=await response.text();
   if(uri==='/ui/sentinelx-ui.js')assert.match(body,/sx-shield-rotor/);
   if(uri==='/signup')assert.match(body,/sx-signup-layout/);
   if(uri==='/')assert.match(body,/sx-company-brand-mark/);
 }
 const response=await fetch(base+'/api/company-signup',{method:'GET'});
 assert.equal(response.status,405);
});
