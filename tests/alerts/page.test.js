const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const { alertPage }=require('../../src/api/alert-page');

test('alert console serves protected static assets with restrictive browser headers',async t=>{
  const server=http.createServer((req,res)=>{if(!alertPage(req,res)){res.statusCode=404;res.end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base=`http://127.0.0.1:${server.address().port}`;
  const page=await fetch(base+'/alerts');
  assert.equal(page.status,200);
  assert.ok((await page.text()).includes('Detection alerts'));
  assert.ok(page.headers.get('content-security-policy').includes("object-src 'none'"));
  assert.equal((await fetch(base+'/alerts/alerts.js')).status,200);
  assert.equal((await fetch(base+'/alerts/../../.env')).status,404);
});
