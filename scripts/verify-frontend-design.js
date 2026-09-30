const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

function main(){
  const root=path.join(__dirname,'../frontend');
  const consoles=['access','events','alerts','incidents','dashboard','notifications','audit'];
  for(const name of consoles){
    const html=fs.readFileSync(path.join(root,name,'index.html'),'utf8');
    assert.match(html,/\/ui\/sentinelx-theme\.css/);
    assert.match(html,/class="app-shell"/);
    assert.match(html,/class="sidebar"/);
    assert.match(html,/class="page-header"/);
    assert.match(html,/data-permission="[^"]+" hidden/);
  }
  const css=fs.readFileSync(path.join(root,'shared/sentinelx-theme.css'),'utf8');
  for(const token of ['--sx-bg','--sx-sidebar','--sx-primary','--sx-critical','--sx-success'])assert.ok(css.includes(token));
  assert.ok(css.includes('@media(max-width:900px)'));
  assert.ok(css.includes('.tone-contained'));
  assert.ok(css.includes('.tone-resolved'));
  const incident=fs.readFileSync(path.join(root,'incidents/incidents.js'),'utf8');
  assert.ok(incident.includes("message('Incident created.',false,true);"));
  const combined=consoles.map(name=>fs.readFileSync(path.join(root,name,name+'.js'),'utf8')).join('\n')+'\n'+fs.readFileSync(path.join(root,'shared/sentinelx-ui.js'),'utf8');
  for(const pattern of [/\.innerHTML\s*=/,/insertAdjacentHTML\s*\(/,/document\.write\s*\(/,/\beval\s*\(/,/localStorage\b/,/sessionStorage\b/])assert.doesNotMatch(combined,pattern);
  console.log('Shared SOC design system, seven-console shell, responsive styling, semantic state treatment and preserved frontend security verified.');
}
if(require.main===module){try{main();}catch{console.error('Task 37 frontend visual design verification failed.');process.exitCode=1;}}
module.exports={main};
