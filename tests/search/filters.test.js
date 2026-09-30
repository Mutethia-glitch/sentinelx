const test=require('node:test');
const assert=require('node:assert/strict');
const {parseFilters}=require('../../src/search/filters');
const {eventQuery}=require('../../src/events/query');
const {alertQuery}=require('../../src/alerts/query');
const {incidentQuery}=require('../../src/incidents/query');
const ID='11111111-1111-4111-8111-111111111111';
function params(o){return new URLSearchParams(o);}
test('common filters share names, normalization and exclusive date bounds',()=>{
  const q=params({severity:'HIGH',categoryCode:'BRUTE_FORCE',sourceIp:'192.0.2.18',
    destinationIp:'2001:db8::1',user:'alice',host:'host-01',source:'sensor',ruleId:ID,
    mitreTechniqueId:'T1110.001',from:'2026-09-30T00:00:00+03:00',to:'2026-09-30T08:00:00+03:00',page:'2'});
  for(const kind of ['event','alert','incident']){
    const result=parseFilters(kind,q);
    assert.equal(result.page,2);
    assert.equal(result.from,'2026-09-29T21:00:00.000Z');
    assert.equal(result.to,'2026-09-30T05:00:00.000Z');
    assert.equal(result.mitreTechniqueId,'T1110.001');
    assert.equal(result.ruleId,ID);
    assert.equal(result.sourceIp,'192.0.2.18');
    assert.equal(result.destinationIp,'2001:db8::1');
  }
});
test('existing domain-specific behavior is retained',()=>{
  assert.deepEqual(alertQuery(params({status:'ACKNOWLEDGED',severity:'HIGH',categoryCode:'BRUTE_FORCE',ruleId:ID,page:2})),
    {page:2,status:'ACKNOWLEDGED',severity:'HIGH',categoryCode:'BRUTE_FORCE',ruleId:ID});
  assert.equal(eventQuery(params({severity:'UNKNOWN',status:'failed',type:'authentication',action:'login'})).severity,'UNKNOWN');
  assert.equal(incidentQuery(params({assignedTo:'UNASSIGNED',categoryCode:'UNCLASSIFIED',status:'CONTAINED'})).categoryCode,'UNCLASSIFIED');
  assert.equal(alertQuery(params({status:'NEW'})).status,'NEW');
});
test('invalid and ambiguous filters fail consistently with 400',()=>{
  for(const kind of ['event','alert','incident']){
    for(const q of ['page=0','page=2001','page=1&page=2','unknown=x','q=a&q=b','q=',
      'sourceIp=not-an-ip','destinationIp=192.0.2.999','ruleId=no','mitreTechniqueId=T000',
      'mitreTechniqueId=T1110.1234','categoryCode=NOT_IN_TAXONOMY',
      'from=invalid','from=2026-10-01T00%3A00%3A00Z&to=2026-09-30T00%3A00%3A00Z']){
      assert.throws(()=>parseFilters(kind,new URLSearchParams(q)),{status:400},kind+': '+q);
    }
  }
  assert.throws(()=>eventQuery(params({categoryCode:'UNCLASSIFIED'})),{status:400});
  assert.throws(()=>alertQuery(params({status:'RESOLVED'})),{status:400});
  assert.throws(()=>incidentQuery(params({status:'ACKNOWLEDGED'})),{status:400});
  assert.throws(()=>alertQuery(params({severity:'UNKNOWN'})),{status:400});
  assert.throws(()=>eventQuery(params({assignedTo:ID})),{status:400});
  assert.throws(()=>incidentQuery(params({type:'authentication'})),{status:400});
});
test('literal text search cannot inject SQL syntax through filter parser',()=>{
  const input="100%_' OR 1=1 --";
  for(const parse of [eventQuery,alertQuery,incidentQuery])assert.equal(parse(params({q:input})).q,input);
});
