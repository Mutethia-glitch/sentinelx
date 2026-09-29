const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeRawEvent, NormalizationError } = require('../../src/normalization/service');
const flat = require('../../fixtures/events/raw-flat.json');
const nested = require('../../fixtures/events/raw-nested.json');
test('supported raw formats normalize consistently without altering or losing evidence', () => {
  const a = normalizeRawEvent(flat), b = normalizeRawEvent(nested);
  for (const key of ['timestamp', 'source', 'type', 'sourceIp', 'destinationIp', 'user', 'host', 'action', 'status', 'severity']) assert.deepEqual(a[key], b[key]);
  assert.deepEqual(a.rawData, flat.rawData); assert.deepEqual(b.rawData, nested.rawData);
  assert.deepEqual(normalizeRawEvent(flat), a);
  a.rawData.unmapped_evidence.sequence.push('copy'); assert.equal(flat.rawData.unmapped_evidence.sequence.length, 3);
  assert.equal(a.metadata.normalization.format, flat.format);
  const minimal = normalizeRawEvent({ ...flat, rawData: { time: flat.rawData.time, event_type: 'network', extra: 'preserved' } });
  for (const key of ['sourceIp', 'destinationIp', 'user', 'host', 'action', 'status', 'severity']) assert.equal(minimal[key], null);
  assert.equal(minimal.rawData.extra, 'preserved');
});
test('malformed and unsupported raw formats fail safely without guessed values', () => {
  for (const input of [null, [], {}, { ...flat, format: 'unknown' }, { ...flat, extra: true }, { ...flat, rawData: [] }, { ...flat, rawData: { ...flat.rawData, level: 3 } }, { ...flat, rawData: { ...flat.rawData, time: 'yesterday' } }, { ...flat, rawData: { ...flat.rawData, src_ip: 'not an IP' } }, { ...flat, rawData: { ...flat.rawData, level: 'warning' } }, { ...nested, rawData: { ...nested.rawData, network: [] } }, { ...nested, rawData: { event: { type: 'authentication' } } }]) {
    assert.throws(() => normalizeRawEvent(input), error => error instanceof NormalizationError && error.message === 'Unsupported or malformed raw event.');
  }
});
