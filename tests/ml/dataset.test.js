const test=require('node:test');
const assert=require('node:assert/strict');
const {generateDataset,manifest,jsonl}=require('../../src/ml/dataset');
const {verifyDataset}=require('../../scripts/verify-dataset');
test('synthetic research dataset is deterministic and labeled',()=>{const a=generateDataset(),b=generateDataset();assert.deepEqual(a,b);assert.equal(a.length,80);assert.equal(a.filter(x=>x.label===1).length,20);assert.equal(jsonl(a),jsonl(b));});
test('manifest states provenance and limitations',()=>{const m=manifest();assert.equal(m.recordCount,80);assert.equal(m.normalCount,60);assert.equal(m.anomalyCount,20);assert.match(m.provenance,/no production or personal data/i);assert.ok(m.assumptions.some(x=>x.includes('not an estimate of real-world prevalence')));assert.ok(m.assumptions.some(x=>x.includes('Task 30')));});
test('records contain only raw normalized-style fields plus research labels',()=>{const m=manifest();for(const row of generateDataset()){assert.deepEqual(Object.keys(row).sort(),[...m.schema].sort());assert.ok(!('password' in row));assert.ok(!('email' in row));assert.ok(!('rawData' in row));}});
test('checked-in research fixture verifies on the current platform',()=>{assert.equal(verifyDataset(),true);});
