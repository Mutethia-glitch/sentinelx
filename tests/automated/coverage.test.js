'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'../..');

test('quality suite retains automated coverage for core SentinelX service domains',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  const command=pkg.scripts.test;
  for(const directory of [
    'tests/auth/*.test.js','tests/access/*.test.js','tests/events/*.test.js','tests/rules/*.test.js',
    'tests/alerts/*.test.js','tests/correlation/*.test.js','tests/incidents/*.test.js',
    'tests/investigations/*.test.js','tests/responses/*.test.js','tests/reports/*.test.js',
    'tests/security/*.test.js','tests/frontend/*.test.js','tests/automated/*.test.js'
  ])assert.ok(command.includes(directory),`quality suite must include ${directory}`);
});

test('dedicated automated pipeline integration preserves every event-to-incident stage',()=>{
  const source=fs.readFileSync(path.join(root,'tests/integration/full-pipeline.test.js'),'utf8');
  for(const token of [
    'SENTINELX_TEST_DATABASE','ingestRaw','simulated-flat-v1','detectionEngine',
    'correlationEngine','alert_correlations','incidentService','incident_alerts',
    'EVENT_INGESTED','INCIDENT_CREATED'
  ])assert.ok(source.includes(token),`pipeline integration must retain ${token}`);
  assert.ok(source.includes('DELETE FROM security_events'));
  assert.ok(source.includes('DELETE FROM alerts'));
  assert.ok(source.includes('DELETE FROM incidents'));
});
