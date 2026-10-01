const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {markCurrentPage}=require('../../frontend/shared/sentinelx-ui');

const consoles=['access','events','alerts','incidents','dashboard','notifications','audit'];

test('all consoles use the imported Lovable shell and protected navigation',()=>{
  for(const name of consoles){
    const html=fs.readFileSync(path.join(__dirname,'../../frontend',name,'index.html'),'utf8');
    assert.match(html,/href="\/ui\/sentinelx-theme\.css"/);
    assert.match(html,/class="sx-app"/);
    assert.match(html,/class="sx-sidebar"/);
    assert.match(html,/class="sx-topbar"/);
    assert.match(html,/class="sx-content"/);
    assert.match(html,/data-icon="shield"/);
    assert.match(html,/data-icon="layout-dashboard"/);
    assert.match(html,/data-permission="[^"]+"[^>]*hidden/);
    assert.match(html,/data-icon="refresh-cw"/);
    assert.match(html,/data-icon="log-out"/);
  }
});

test('runtime theme uses readable light tokens and preserves layouts',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../../frontend/shared/sentinelx-theme.css'),'utf8');
  assert.match(css,/color-scheme:light/);
  assert.match(css,/--background:#f5f7fb/);
  assert.match(css,/--foreground:#182638/);
  assert.match(css,/--primary:#075985/);
  assert.match(css,/--sidebar:#eef2f7/);
  assert.match(css,/--surface-subtle:#f0f3f8/);
  assert.match(css,/--severity-critical:#b42332/);
  assert.match(css,/@media\(max-width:767px\)/);
  assert.match(css,/\.sx-incident-layout/);
  assert.match(css,/\.sx-notification-layout/);
  assert.match(css,/\.sx-audit-layout/);
  assert.match(css,/body\[data-page="alerts"\] #status-form/);
  assert.match(css,/body\[data-page="incidents"\] #status-form/);
  assert.doesNotMatch(css,/(?:^|\n)#status-form\{/);
  assert.match(css,/\.sx-topbar-actions\{[^}]*justify-content:flex-end/);
  assert.match(css,/\.sx-card-icon\.tone-high\{color:var\(--severity-high\)/);
  assert.match(css,/\.sx-card-icon\.tone-critical\{color:var\(--severity-critical\)/);
  assert.match(css,/\.sx-card-icon\.tone-success\{color:var\(--success\)/);
  assert.match(css,/td>\.semantic-value/);
});

test('semantic badges stay inside table cells instead of changing table-cell display',()=>{
  const ui=fs.readFileSync(path.join(__dirname,'../../frontend/shared/sentinelx-ui.js'),'utf8');
  assert.match(ui,/data-sx-semantic-value/);
  assert.match(ui,/node\.replaceChildren\(badge\)/);
});

test('page styles do not compete with the shared stylesheet',()=>{
  for(const name of consoles){
    const css=fs.readFileSync(path.join(__dirname,'../../frontend',name,name+'.css'),'utf8');
    assert.doesNotMatch(css,/\{/);
    assert.match(css,/centralizes runtime layout and spacing/);
  }
});

test('Access uses a structured sign-in flow without fabricated registration',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../../frontend/access/index.html'),'utf8');
  assert.match(html,/id="login-panel" hidden class="sx-auth-screen"/);
  assert.match(html,/Secure access to SentinelX/);
  assert.match(html,/href="\/company-signup">Create a company account/);
  assert.doesNotMatch(html,/>\s*Sign up\s*</i);
  assert.match(html,/id="refresh"[^>]*aria-label="Refresh access"/);
  assert.match(html,/id="logout"[^>]*data-icon="log-out"/);
});

test('approved Lovable source is imported verbatim as design reference',()=>{
  const component=fs.readFileSync(path.join(__dirname,'../../frontend/design-reference/lovable/sentinelx-console.tsx'),'utf8');
  const styles=fs.readFileSync(path.join(__dirname,'../../frontend/design-reference/lovable/styles.css'),'utf8');
  const note=fs.readFileSync(path.join(__dirname,'../../frontend/design-reference/lovable/README.md'),'utf8');
  assert.match(component,/export function SentinelXConsole/);
  assert.match(component,/LayoutDashboard/);
  assert.match(component,/ShieldAlert/);
  assert.match(component,/PanelLeftClose/);
  assert.match(component,/function Incidents\(\)/);
  assert.match(styles,/--background: oklch\(0\.145 0\.025 255\)/);
  assert.match(styles,/--sidebar: oklch\(0\.12 0\.026 258\)/);
  assert.match(note,/5514aa322c48e6c21cea1518a5b98e946fc4bc11/);
});

test('current navigation marker remains presentation only',()=>{
  const links=[
    {attrs:{href:'/dashboard'},getAttribute(k){return this.attrs[k]??null;},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}},
    {attrs:{href:'/events'},getAttribute(k){return this.attrs[k]??null;},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}},
  ];
  const doc={querySelectorAll(selector){return selector==='nav a[href]'?links:[];}};
  markCurrentPage(doc,'/events');
  assert.equal(links[0].attrs['aria-current'],undefined);
  assert.equal(links[1].attrs['aria-current'],'page');
});

test('incident workspace keeps Lovable tabs and exact creation success behavior',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../../frontend/incidents/index.html'),'utf8');
  const js=fs.readFileSync(path.join(__dirname,'../../frontend/incidents/incidents.js'),'utf8');
  assert.match(html,/data-sx-tab="evidence"/);
  assert.match(html,/data-sx-tab="investigation"/);
  assert.match(html,/data-sx-tab="response"/);
  assert.match(html,/data-icon="shield-alert"/);
  assert.match(html,/data-icon="book-open-check"/);
  assert.match(js,/message\('Incident created\.',false,true\);/);
});
