const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

function main(){
  const root=path.join(__dirname,'../frontend');
  const consoles=['access','events','alerts','incidents','dashboard','notifications','audit'];
  for(const name of consoles){
    const html=fs.readFileSync(path.join(root,name,'index.html'),'utf8');
    assert.match(html,/\/ui\/sentinelx-theme\.css/);
    assert.match(html,/class="sx-app"/);
    assert.match(html,/class="sx-sidebar"/);
    assert.match(html,/class="sx-topbar"/);
    assert.match(html,/data-icon="layout-dashboard"/);
    assert.match(html,/data-permission="[^"]+"[^>]*hidden/);
    assert.match(html,/data-icon="refresh-cw"/);
    assert.match(html,/data-icon="log-out"/);
    const pageCss=fs.readFileSync(path.join(root,name,name+'.css'),'utf8');
    assert.doesNotMatch(pageCss,/\{/);
  }
  const css=fs.readFileSync(path.join(root,'shared/sentinelx-theme.css'),'utf8');
  for(const token of [
    'color-scheme:dark',
    '--background:oklch(.145 .025 255)',
    '--primary:oklch(.72 .13 225)',
    '--sidebar:oklch(.12 .026 258)',
    '--severity-critical:oklch(.68 .2 25)'
  ])assert.ok(css.includes(token),token);
  assert.ok(css.includes('.sx-incident-layout'));
  assert.ok(css.includes('.sx-notification-layout'));
  assert.ok(css.includes('.sx-audit-layout'));
  assert.ok(css.includes('body[data-page="alerts"] #status-form'));
  assert.ok(css.includes('body[data-page="incidents"] #status-form'));
  assert.ok(!/(?:^|\n)#status-form\{/.test(css));
  assert.ok(css.includes('justify-content:flex-end'));
  const reference=fs.readFileSync(path.join(root,'design-reference/lovable/sentinelx-console.tsx'),'utf8');
  assert.ok(reference.includes('export function SentinelXConsole'));
  assert.ok(reference.includes('PanelLeftClose'));
  const accessHtml=fs.readFileSync(path.join(root,'access/index.html'),'utf8');
  assert.ok(accessHtml.includes('id="login-panel" class="sx-auth-screen"'));
  assert.ok(accessHtml.includes('Self-service sign-up is not enabled.'));
  assert.ok(!/>\s*Sign up\s*</i.test(accessHtml));
  const incident=fs.readFileSync(path.join(root,'incidents/incidents.js'),'utf8');
  assert.ok(incident.includes("message('Incident created.',false,true);"));
  const sourceFiles=[
    path.join(root,'shared/sentinelx-ui.js'),
    ...consoles.map(name=>path.join(root,name,name+'.js'))
  ];
  const combined=sourceFiles.map(file=>fs.readFileSync(file,'utf8')).join('\n');
  for(const pattern of [/\.innerHTML\s*=/,/insertAdjacentHTML\s*\(/,/document\.write\s*\(/,/\beval\s*\(/,/localStorage\b/,/sessionStorage\b/])assert.doesNotMatch(combined,pattern);
  console.log('Lovable dark SOC design, centralized non-overlapping CSS, normalized spacing, top-right session actions, structured sign-in and preserved frontend security verified.');
}
if(require.main===module){try{main();}catch{console.error('Task 37 frontend visual design verification failed.');process.exitCode=1;}}
module.exports={main};
