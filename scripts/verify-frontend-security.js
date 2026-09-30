const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {applyAccess,clearAccess,safeError}=require('../frontend/shared/sentinelx-ui');

function main(){
  const links=[{dataset:{permission:'events.read'},hidden:true},{dataset:{permission:'audit.read'},hidden:true}];
  const doc={querySelectorAll(){return links;}};
  applyAccess({permissions:['events.read']},doc);assert.equal(links[0].hidden,false);assert.equal(links[1].hidden,true);clearAccess(doc);assert.equal(links.every(link=>link.hidden),true);
  assert.equal(safeError(new Error('private network detail')),'Unable to reach SentinelX. Try again.');
  const consoles=['access','events','alerts','incidents','dashboard','notifications','audit'];
  for(const name of consoles){
    const html=fs.readFileSync(path.join(__dirname,'../frontend/'+name+'/index.html'),'utf8');
    assert.match(html,/\/ui\/sentinelx-ui\.js/);assert.match(html,/data-permission="[^"]+" hidden/);assert.match(html,/autocomplete="current-password"/);
    const js=fs.readFileSync(path.join(__dirname,'../frontend/'+name+'/'+name+'.js'),'utf8');
    for(const pattern of [/\.innerHTML\s*=/,/insertAdjacentHTML\s*\(/,/document\.write\s*\(/,/\beval\s*\(/,/localStorage\b/,/sessionStorage\b/])assert.doesNotMatch(js,pattern);
  }
  console.log('Permission-aware navigation, loading/error helper, safe DOM rendering and credential-storage protections verified.');
}
if(require.main===module){try{main();}catch{console.error('Task 36 frontend security verification failed.');process.exitCode=1;}}
module.exports={main};
