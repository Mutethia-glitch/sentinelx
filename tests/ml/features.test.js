const test = require('node:test');
const assert = require('node:assert/strict');
const { generateFeatures, FEATURE_NAMES } = require('../../src/ml/features');
const { generateDataset } = require('../../src/ml/dataset');
const { verifyFeatures } = require('../../scripts/verify-features');

function event(id, seconds, overrides = {}) {
  return { recordId: id, timestamp: new Date(Date.UTC(2026, 0, 1) + seconds * 1000).toISOString(),
    type: 'authentication', action: 'login', status: 'success',
    user: 'user-a', sourceIp: '192.0.2.1', host: 'host-a', ...overrides };
}
test('15-minute lower boundary is inclusive; current, tied and future events are excluded', () => {
  const rows = [event('old', 0), event('failed', 1, { status: 'failed' }),
    event('a', 900), event('b', 900), event('last', 901), event('future', 902)];
  const output = generateFeatures(rows).rows;
  assert.deepEqual(output.find(row => row.recordId === 'a').features,
    { userLoginCount: 2, userFailedLoginCount: 1, sourceIpEventCount: 2,
      hostEventCount: 2, eventCount: 2, utcHour: 0, utcDayOfWeek: 4 });
  assert.deepEqual(output.find(row => row.recordId === 'b').features, output.find(row => row.recordId === 'a').features);
  assert.equal(output.find(row => row.recordId === 'last').features.userLoginCount, 3);
  assert.equal(output[0].features.eventCount, 0);
});
test('counts separate identities, authentication semantics and explicit missing identities', () => {
  const rows = [event('login', 0), event('failed', 1, { status: 'failed' }),
    event('other-user', 2, { user: 'user-b' }),
    event('network', 3, { type: 'network', action: 'connection', status: 'failed' }),
    event('missing', 4, { user: null, host: null, sourceIp: null }),
    event('missing-again', 5, { user: null, host: null, sourceIp: null }),
    event('target', 6, { host: 'host-b', sourceIp: '192.0.2.2' })];
  const output = generateFeatures(rows).rows;
  assert.deepEqual(output.at(-1).features, { userLoginCount: 2, userFailedLoginCount: 1,
    sourceIpEventCount: 0, hostEventCount: 0, eventCount: 6, utcHour: 0, utcDayOfWeek: 4 });
  assert.deepEqual(output[5].features, { userLoginCount: 0, userFailedLoginCount: 0,
    sourceIpEventCount: 0, hostEventCount: 0, eventCount: 5, utcHour: 0, utcDayOfWeek: 4 });
});
test('features are reproducible, input-order independent and do not mutate records', () => {
  const records = generateDataset(), snapshot = structuredClone(records);
  records.forEach(Object.freeze);
  const output = generateFeatures(Object.freeze(records));
  assert.deepEqual(output, generateFeatures([...records].reverse()));
  assert.deepEqual(records, snapshot);
  assert.deepEqual(output.featureNames, FEATURE_NAMES);
});
test('labels, scenarios, severity and unused fields never affect vectors', () => {
  const rows = generateDataset();
  assert.deepEqual(generateFeatures(rows), generateFeatures(rows.map(row => ({ ...row,
    label: 1 - row.label, scenario: 'changed', severity: 'CRITICAL', modelScore: 100 }))));
  for (const row of generateFeatures(rows).rows) {
    assert.deepEqual(Object.keys(row), ['recordId', 'timestamp', 'features']);
    assert.ok(Object.values(row.features).every(Number.isFinite));
  }
});
test('custom window and UTC day/hour transitions are deterministic', () => {
  const rows = [event('a', 86399), event('b', 86400), event('c', 86401)];
  const output = generateFeatures(rows, { windowSeconds: 1 });
  assert.equal(output.rows[1].features.eventCount, 1);
  assert.equal(output.rows[2].features.eventCount, 1);
  assert.equal(output.rows[0].features.utcHour, 23);
  assert.equal(output.rows[1].features.utcHour, 0);
  assert.equal(output.rows[1].features.utcDayOfWeek, 5);
  assert.equal(output.windowSeconds, 1);
});
test('empty input is valid; invalid records/windows fail without echoing payloads', () => {
  assert.deepEqual(generateFeatures([]).rows, []);
  for (const input of [null, {}, [null], [event('a', 0), event('a', 1)],
    [event('a', 0, { timestamp: '2026-02-30T00:00:00.000Z' })],
    [event('a', 0, { timestamp: '2026-01-01' })],
    [event('a', 0, { user: undefined })], [event('a', 0, { host: '' })],
    [event('a', 0, { sourceIp: 123 })], [event('', 0)], [event('a', 0, { type: '' })]]) {
    assert.throws(() => generateFeatures(input), TypeError);
  }
  for (const windowSeconds of [0, -1, 1.5, NaN, Infinity, '900', Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => generateFeatures([], { windowSeconds }), TypeError);
  }
});
test('checked-in Task 29 fixture passes the independent feature oracle', () => {
  assert.equal(verifyFeatures(), true);
});
