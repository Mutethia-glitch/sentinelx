const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {markCurrentPage,decorateSemanticValues}=require('../../frontend/shared/sentinelx-ui');

const consoles=['access','events','alerts','incidents','dashboard','notifications','audit'];

test('all consoles use the shared SentinelX design shell',()=>{
  for(const name of consoles){
    const html=fs.readFileSync(path.join(__dirname,'../../frontend',name,'index.html'),'utf8');
    assert.match(html,/href="\/ui\/sentinelx-theme\.css"/);
    assert.match(html,/class="app-shell"/);
    assert.match(html,/class="sidebar"/);
    assert.match(html,/class="app-main"/);
    assert.match(html,/class="page-header"/);
    assert.match(html,/IPHYN Security Operations/);
  }
});

test('shared theme contains the approved SOC tokens and responsive shell',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../../frontend/shared/sentinelx-theme.css'),'utf8');
  for(const token of ['--sx-bg','--sx-sidebar','--sx-primary','--sx-critical','--sx-success','--sx-code'])assert.match(css,new RegExp(token));
  assert.match(css,/grid-template-columns:240px minmax\(0,1fr\)/);
  assert.match(css,/@media\(max-width:900px\)/);
  assert.match(css,/\.semantic-value/);
  assert.match(css,/\.tone-contained/);
  assert.match(css,/\.tone-resolved/);
});

test('current navigation marker and semantic decoration are presentation only',()=>{
  const links=[
    {attrs:{href:'/dashboard'},getAttribute(k){return this.attrs[k]??null;},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}},
    {attrs:{href:'/events'},getAttribute(k){return this.attrs[k]??null;},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}},
  ];
  const doc={querySelectorAll(selector){return selector==='nav a[href]'?links:[];}};
  markCurrentPage(doc,'/events');
  assert.equal(links[0].attrs['aria-current'],undefined);
  assert.equal(links[1].attrs['aria-current'],'page');

  function node(text){
    const classes=new Set();
    return {textContent:text,classList:{add(...v){for(const x of v)classes.add(x);},remove(...v){for(const x of v)classes.delete(x);}},matches(){return true;},querySelectorAll(){return [];},classes};
  }
  const critical=node('CRITICAL');decorateSemanticValues(critical);
  assert.equal(critical.classes.has('semantic-value'),true);
  assert.equal(critical.classes.has('tone-critical'),true);
  const contained=node('CONTAINED');decorateSemanticValues(contained);
  const resolved=node('RESOLVED');decorateSemanticValues(resolved);
  assert.equal(contained.classes.has('tone-contained'),true);
  assert.equal(resolved.classes.has('tone-resolved'),true);
});

test('incident creation success state remains visible and exact',()=>{
  const js=fs.readFileSync(path.join(__dirname,'../../frontend/incidents/incidents.js'),'utf8');
  assert.match(js,/message\('Incident created\.',false,true\);/);
});
