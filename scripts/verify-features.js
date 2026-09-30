const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { generateFeatures, FEATURE_NAMES } = require('../src/ml/features');
const { verifyDataset } = require('./verify-dataset');

function verifyFeatures() {
  verifyDataset();
  const records = fs.readFileSync(path.join(__dirname, '../fixtures/ml/task29-synthetic-events.jsonl'), 'utf8')
    .trim().split(/\r?\n/).map(line => JSON.parse(line));
  const output = generateFeatures(records);
  assert.equal(output.rows.length, 80);
  assert.deepEqual(output, generateFeatures([...records].reverse()));
  // Independent, deliberately simple oracle checks every fixture row.
  const byId = new Map(records.map(record => [record.recordId, record]));
  for (const row of output.rows) {
    const record = byId.get(row.recordId), now = Date.parse(record.timestamp);
    const prior = records.filter(event => Date.parse(event.timestamp) >= now - 900000 &&
      Date.parse(event.timestamp) < now);
    const login = prior.filter(event => record.user !== null && event.user === record.user &&
      event.type === 'authentication' && event.action === 'login');
    assert.deepEqual(row.features, {
      userLoginCount: login.length,
      userFailedLoginCount: login.filter(event => event.status === 'failed').length,
      sourceIpEventCount: prior.filter(event => record.sourceIp !== null && event.sourceIp === record.sourceIp).length,
      hostEventCount: prior.filter(event => record.host !== null && event.host === record.host).length,
      eventCount: prior.length,
      utcHour: new Date(now).getUTCHours(), utcDayOfWeek: new Date(now).getUTCDay()
    });
    assert.deepEqual(Object.keys(row.features), FEATURE_NAMES);
    assert.ok(Object.values(row.features).every(Number.isFinite));
  }
  return true;
}

if (require.main === module) {
  verifyFeatures();
  console.log('Reproducible behavioral features, prior-only windows, numeric schema and synthetic dataset compatibility verified.');
}
module.exports = { verifyFeatures };
