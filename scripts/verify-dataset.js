const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {generateDataset,manifest,jsonl}=require('../src/ml/dataset');
function verifyDataset(){
 const rows=generateDataset(),expectedManifest=manifest(rows);
 const dataPath=path.join(__dirname,'..','fixtures','ml','task29-synthetic-events.jsonl');
 const manifestPath=path.join(__dirname,'..','fixtures','ml','task29-manifest.json');
 const stored=fs.readFileSync(dataPath,'utf8'),storedManifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 // Git for Windows may check out text fixtures with CRLF; compare canonical LF JSONL.
 assert.equal(stored.replace(/\r\n/g,'\n'),jsonl(rows));assert.deepEqual(storedManifest,expectedManifest);
 assert.equal(rows.length,80);assert.equal(rows.filter(r=>r.label===0).length,60);assert.equal(rows.filter(r=>r.label===1).length,20);
 const ids=new Set(),allowed=['LOW','MEDIUM','HIGH','CRITICAL'];
 for(const row of rows){
  assert.equal(Object.keys(row).sort().join(','),[...expectedManifest.schema].sort().join(','));
  assert.ok(!ids.has(row.recordId));ids.add(row.recordId);assert.ok(Date.parse(row.timestamp));assert.equal(row.source,'synthetic-research');
  assert.ok(['192.0.2.','198.51.100.','203.0.113.'].some(prefix=>row.sourceIp.startsWith(prefix)));
  assert.ok(['192.0.2.','198.51.100.','203.0.113.'].some(prefix=>row.destinationIp.startsWith(prefix)));
  if(row.user)assert.match(row.user,/^research-user-\d{2}$/);assert.match(row.host,/^synthetic-/);
  assert.ok(allowed.includes(row.severity));assert.ok(row.label===0||row.label===1);
  assert.ok(!JSON.stringify(row).includes('@'));
 }
 assert.match(expectedManifest.provenance,/no production or personal data/i);
 assert.ok(expectedManifest.assumptions.some(x=>x.includes('not an estimate of real-world prevalence')));
 assert.ok(expectedManifest.assumptions.some(x=>x.includes('Task 30')));
 return true;
}
function main(){try{verifyDataset();console.log('Controlled synthetic dataset schema, provenance, labels, privacy constraints and deterministic reproduction verified.');}catch{console.error('Task 29 dataset verification failed. Regenerate or review the checked-in synthetic fixture.');process.exitCode=1;}}
if(require.main===module)main();
module.exports={verifyDataset};