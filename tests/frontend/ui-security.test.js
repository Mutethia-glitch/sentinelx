const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {applyAccess,clearAccess,loading,safeError}=require('../../frontend/shared/sentinelx-ui');
const {frontendShared}=require('../../src/api/frontend-shared');

function fakeDocument(){
  const links=[
    {dataset:{permission:'events.read'},hidden:true},
    {dataset:{permission:'audit.read'},hidden:true},
  ];
  const notice={textContent:'',classList:{states:new Map(),toggle(name,value){this.states.set(name,value);}}};
  return {links,notice,querySelectorAll(){return links;},getElementById(id){return id==='message'?notice:null;}};
}
test('shared UI helper exposes only granted navigation and resets it on sign-out',()=>{
  const doc=fakeDocument();
  applyAccess({permissions:['events.read']},doc);
  assert.equal(doc.links[0].hidden,false);assert.equal(doc.links[1].hidden,true);
  clearAccess(doc);assert.equal(doc.links.every(link=>link.hidden),true);
});
test('shared UI helper provides safe loading and network error text',()=>{
  const doc=fakeDocument();loading('Loading records…',doc);
  assert.equal(doc.notice.textContent,'Loading records…');assert.equal(doc.notice.classList.states.get('error'),false);
  assert.equal(safeError({status:403,message:'Permission denied.'}),'Permission denied.');
  assert.equal(safeError(new Error('private socket detail')),'Unable to reach SentinelX. Try again.');
});
test('frontend source avoids unsafe HTML/script sinks and browser credential storage',()=>{
  const root=path.join(__dirname,'../../frontend');
  const files=[];
  (function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const item=path.join(dir,entry.name);if(entry.isDirectory())walk(item);else if(/\.(?:js|html)$/.test(entry.name))files.push(item);}})(root);
  const forbidden=[/\.innerHTML\s*=/,/insertAdjacentHTML\s*\(/,/document\.write\s*\(/,/\beval\s*\(/,/localStorage\b/,/sessionStorage\b/];
  for(const file of files){
    let source=fs.readFileSync(file,'utf8');
    // Permit only the non-secret resend deadline in these two files.
    const relative=path.relative(root,file).split(path.sep).join('/');
    if(relative==='shared/sentinelx-ui.js')source=source.replace("globalThis.sessionStorage.setItem('sentinelx-resend-after',String(Date.now()+60000))",'');
    if(relative==='verify/verify.js')source=source.replace("sessionStorage.getItem('sentinelx-resend-after')",'').replace("sessionStorage.setItem('sentinelx-resend-after',String(resendAfter))",'');
    for(const pattern of forbidden)assert.doesNotMatch(source,pattern,relative+' uses unsafe frontend API');
  }
});
test('all consoles load the shared helper, permission links start hidden and password fields are protected',()=>{
  const consoles=['access','events','alerts','incidents','dashboard','notifications','audit'];
  for(const name of consoles){
    const html=fs.readFileSync(path.join(__dirname,'../../frontend/'+name+'/index.html'),'utf8');
    assert.match(html,/\/ui\/sentinelx-ui\.js/);
    assert.match(html,/data-permission="[^"]+" hidden/);
    assert.match(html,/type="password"[^>]*autocomplete="current-password"/);
  }
});
test('shared helper asset is no-store, same-origin and GET-only',()=>{
  const headers={};const res={setHeader(k,v){headers[k.toLowerCase()]=String(v);},end(body){this.body=body;}};
  assert.equal(frontendShared({url:'/ui/sentinelx-ui.js',method:'GET'},res),true);
  assert.equal(headers['cache-control'],'no-store');assert.equal(headers['cross-origin-resource-policy'],'same-origin');assert.match(String(res.body),/SentinelXUi/);
  const post={setHeader(){},end(){}};assert.equal(frontendShared({url:'/ui/sentinelx-ui.js',method:'POST'},post),true);assert.equal(post.statusCode,405);
});
