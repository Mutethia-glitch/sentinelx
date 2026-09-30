const test = require('node:test');
const assert = require('node:assert/strict');
const { ALERT_STATUS, affectedEntities, generatedAlert } = require('../../src/alerts/model');

test('affected entities keep only populated canonical entity fields', () => {
  assert.deepEqual(affectedEntities({
    sourceIp: '192.0.2.10', destinationIp: null, user: 'alice', host: 'workstation',
    action: 'login', status: 'failed',
  }), { sourceIp: '192.0.2.10', user: 'alice', host: 'workstation' });
});

test('generated alert model contains required Task 15 signal fields', () => {
  const alert = generatedAlert(
    { id: 'rule-1', categoryCode: 'BRUTE_FORCE', severity: 'HIGH' },
    { source: 'sensor-a', sourceIp: '192.0.2.10', destinationIp: '198.51.100.8', user: 'alice', host: 'workstation' },
    'event-1',
  );
  assert.deepEqual(alert, {
    ruleId: 'rule-1',
    triggerEventId: 'event-1',
    threat: 'BRUTE_FORCE',
    severity: 'HIGH',
    source: 'sensor-a',
    affectedEntities: {
      sourceIp: '192.0.2.10',
      destinationIp: '198.51.100.8',
      user: 'alice',
      host: 'workstation',
    },
    status: 'NEW',
    confidence: null,
  });
  assert.equal(ALERT_STATUS, 'NEW');
});

test('deterministic rule alerts do not invent confidence when no calibration exists', () => {
  const alert = generatedAlert(
    { id: 'rule-2', categoryCode: 'MALWARE', severity: 'HIGH' },
    { source: 'sensor-b', sourceIp: null, destinationIp: null, user: null, host: 'host-1' },
    'event-2',
  );
  assert.equal(alert.confidence, null);
  assert.deepEqual(alert.affectedEntities, { host: 'host-1' });
});
