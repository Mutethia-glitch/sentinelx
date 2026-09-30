const test=require('node:test');const assert=require('node:assert/strict');const {reportQuery,reportCsv}=require('../../src/reports/model');
test('report query validates bounded ranges and formats',()=>{assert.deepEqual(reportQuery(new URLSearchParams('format=csv')), {format:'csv'});assert.equal(reportQuery(new URLSearchParams('from=2026-09-30T00%3A00%3A00Z')).from,'2026-09-30T00:00:00.000Z');for(const q of ['format=pdf','x=1','from=bad','from=2026-10-02T00%3A00%3A00Z&to=2026-10-01T00%3A00%3A00Z'])assert.throws(()=>reportQuery(new URLSearchParams(q)),{status:400});assert.throws(()=>reportQuery(new URLSearchParams('from=2026-09-30T00%3A00%3A00Z'),{allowDates:false}),{status:400});});
test('CSV export quotes nested and comma-bearing values deterministically',()=>{const csv=reportCsv({type:'SECURITY_SUMMARY',nested:{value:'a,b',count:2}});assert.ok(csv.startsWith('section,key,value\r\n'));assert.ok(csv.includes('"a,b"'));assert.ok(csv.includes('nested,count,2'));});
test('CSV treats untrusted formula-like strings as text while preserving numbers',()=>{
 for(const value of ['=1+1','+1+1','-1+1','@SUM(A1:A2)',' \t=1+1','\r\n=1+1']){
  const csv=reportCsv({incident:{title:value}});
  assert.ok(csv.includes("'"+value.replaceAll('"','""')),value);
 }
 assert.ok(reportCsv({metrics:{negative:-2}}).includes('metrics,negative,-2\r\n'));
 assert.ok(reportCsv({incident:{title:'Ordinary title'}}).includes('incident,title,Ordinary title\r\n'));
});
