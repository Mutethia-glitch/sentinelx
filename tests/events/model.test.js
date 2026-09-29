const test = require('node:test');
const assert = require('node:assert/strict');
const { securityEvent, EventValidationError } = require('../../src/events/model');
const { eventRepository, EventPersistenceError } = require('../../src/data/event-repository');
const sample = () => ({ timestamp: '2026-09-30T03:00:00+03:00', source: 'synthetic', type: 'authentication', sourceIp: '2001:db8::1', destinationIp: '192.0.2.1', user: 'test user', host: 'test host', action: 'login', status: 'failed', severity: 'HIGH', rawData: { vendorField: [false, 2, null] }, metadata: { fixture: true } });
test('canonical event preserves evidence, UTC timestamp and optional unknown fields', () => {
  const input = sample(); const output = securityEvent(input);
  assert.equal(output.timestamp, '2026-09-30T00:00:00.000Z');
  assert.deepEqual(output.rawData, input.rawData);
  output.rawData.vendorField.push('copy'); assert.equal(input.rawData.vendorField.length, 3);
  const minimal = securityEvent({ timestamp: input.timestamp, source: 'another vendor', type: 'network', rawData: {} });
  assert.equal(minimal.severity, null); assert.equal(minimal.sourceIp, null); assert.deepEqual(minimal.metadata, {});
});
test('invalid fields and lossy evidence are rejected without revealing input', () => {
  for (const patch of [{ timestamp: '2026-09-30T24:00:00Z' }, { timestamp: '2026-02-30T00:00:00Z' }, { timestamp: '2026-09-30' }, { sourceIp: 'bad' }, { severity: 'CLOSED' }, { source: '' }, { rawData: [] }, { rawData: { secret: undefined } }, { metadata: { number: Infinity } }, { rawData: { date: new Date() } }, { extra: 'unsupported' }]) assert.throws(() => securityEvent({ ...sample(), ...patch }), EventValidationError);
  const circular = {}; circular.self = circular;
  assert.throws(() => securityEvent({ ...sample(), rawData: circular }), EventValidationError);
});
test('persistence parameterizes input and sanitizes database failure', async () => {
  let calls = 0;
  const repository = eventRepository({ query: async (sql, parameters) => { calls++; assert.ok(sql.includes('$1')); assert.equal(parameters[0], "synthetic'); DROP TABLE users; --"); throw new Error('private driver detail'); } });
  await assert.rejects(repository.create({ ...sample(), source: "synthetic'); DROP TABLE users; --" }), EventPersistenceError);
  await assert.rejects(repository.getById('invalid'), EventValidationError);
  assert.equal(calls, 1);
});
