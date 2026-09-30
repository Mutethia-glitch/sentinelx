const test=require('node:test');
const assert=require('node:assert/strict');
const {EXPECTED,UNMAPPED,TACTICS}=require('../../scripts/verify-mitre-mapping');
test('core ATT&CK coverage is explicitly partial and unique',()=>{assert.equal(EXPECTED.size,8);assert.equal(UNMAPPED.length,7);const names=[...EXPECTED.keys(),...UNMAPPED];assert.equal(new Set(names).size,15);assert.equal(Object.keys(TACTICS).length,7);for(const ids of EXPECTED.values())assert.ok(ids.length>=1);});
test('mapped techniques use ATT&CK identifier shapes',()=>{for(const [technique,tactic] of Object.entries(TACTICS)){assert.match(technique,/^T\d{4}(?:\.\d{3})?$/);assert.match(tactic,/^TA\d{4}$/);}});
