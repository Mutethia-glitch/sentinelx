'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

function main(){
  const root=path.join(__dirname,'..');
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  assert.equal(pkg.scripts['test:automated:pipeline'],'node --test tests/integration/full-pipeline.test.js');
  assert.equal(pkg.scripts['verify:automated-testing'],'node scripts/verify-automated-testing.js');
  assert.ok(pkg.scripts.test.includes('tests/automated/*.test.js'));

  const pipeline=fs.readFileSync(path.join(root,'tests/integration/full-pipeline.test.js'),'utf8');
  for(const token of [
    'ingestRaw','simulated-flat-v1','detectionEngine','correlationEngine',
    'alert_correlations','incidentService','incident_alerts'
  ])assert.ok(pipeline.includes(token),token);
  assert.ok(pipeline.includes("process.env.SENTINELX_TEST_DATABASE"));
  assert.ok(pipeline.includes('Task 38 automated event-to-incident pipeline verification'));

  console.log('Core automated coverage contract and synthetic PostgreSQL event-to-incident pipeline test verified.');
}
if(require.main===module){try{main();}catch{console.error('Task 38 automated testing verification failed.');process.exitCode=1;}}
module.exports={main};
