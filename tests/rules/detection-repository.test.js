const test = require('node:test');
const assert = require('node:assert/strict');
const { detectionRepository, deterministicAlertId } = require('../../src/data/detection-repository');

test('deterministic alert ids are stable per rule and trigger', () => {
  const first = deterministicAlertId('rule-1', 'trigger-1');
  assert.equal(first, deterministicAlertId('rule-1', 'trigger-1'));
  assert.notEqual(first, deterministicAlertId('rule-1', 'trigger-2'));
  assert.notEqual(first, deterministicAlertId('rule-2', 'trigger-1'));
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('same rule and trigger cannot create a second alert', async () => {
  const inserted = new Set();
  const linked = [];
  const client = {
    async query(sql, params) {
      if (sql.startsWith('INSERT INTO alerts')) {
        assert.match(sql, /ON CONFLICT \(id\) DO NOTHING/);
        const id = params[0];
        if (inserted.has(id)) return { rows: [] };
        inserted.add(id);
        return { rows: [{ id, created_at: new Date('2026-09-30T00:00:00.000Z') }] };
      }
      if (sql.startsWith('INSERT INTO alert_events')) {
        linked.push(params);
        return { rows: [] };
      }
      throw new Error(`unexpected query: ${sql}`);
    },
  };
  const repository = detectionRepository({});
  const rule = { id: 'rule-1', name: 'Synthetic', severity: 'HIGH', categoryCode: 'BRUTE_FORCE' };
  const events = [{ id: 'event-1' }, { id: 'event-2' }, { id: 'trigger-1' }];
  const evidence = { triggerEventId: 'trigger-1', threshold: 3, windowSeconds: 60, groupBy: [], groupValues: [] };
  const first = await repository.createAlert(rule, events, evidence, client);
  const duplicate = await repository.createAlert(rule, events, evidence, client);
  assert.ok(first);
  assert.equal(duplicate, null);
  assert.equal(inserted.size, 1);
  assert.equal(linked.length, 3);
});

test('different triggers create different alerts', async () => {
  const ids = [];
  const client = {
    async query(sql, params) {
      if (sql.startsWith('INSERT INTO alerts')) {
        ids.push(params[0]);
        return { rows: [{ id: params[0], created_at: new Date('2026-09-30T00:00:00.000Z') }] };
      }
      if (sql.startsWith('INSERT INTO alert_events')) return { rows: [] };
      throw new Error(`unexpected query: ${sql}`);
    },
  };
  const repository = detectionRepository({});
  const rule = { id: 'rule-1', name: 'Synthetic', severity: 'HIGH', categoryCode: 'BRUTE_FORCE' };
  const common = { threshold: 1, windowSeconds: 60, groupBy: [], groupValues: [] };
  await repository.createAlert(rule, [{ id: 'trigger-1' }], { ...common, triggerEventId: 'trigger-1' }, client);
  await repository.createAlert(rule, [{ id: 'trigger-2' }], { ...common, triggerEventId: 'trigger-2' }, client);
  assert.equal(ids.length, 2);
  assert.notEqual(ids[0], ids[1]);
});

test('engine re-evaluation of the same trigger returns no second alert', async () => {
  const { detectionEngine } = require('../../src/detection/engine');
  const inserted = new Set();
  const client = {
    async query(sql, params) {
      if (sql.startsWith('INSERT INTO alerts')) {
        const id = params[0];
        if (inserted.has(id)) return { rows: [] };
        inserted.add(id);
        return { rows: [{ id, created_at: new Date('2026-09-30T00:00:00.000Z') }] };
      }
      if (sql.startsWith('INSERT INTO alert_events')) return { rows: [] };
      throw new Error(`unexpected query: ${sql}`);
    },
  };
  const storage = detectionRepository({});
  const definition = { schemaVersion: 1, conditions: [{ field: 'status', operator: 'equals', value: 'failed' }], threshold: 3, windowSeconds: 60, groupBy: ['sourceIp'] };
  const rule = { id: 'rule-1', name: 'Synthetic', severity: 'HIGH', categoryCode: 'BRUTE_FORCE', definition };
  const repository = {
    enabledRules: async () => [rule],
    matchingEvents: async () => [{ id: 'event-1' }, { id: 'event-2' }, { id: 'trigger-1' }],
    createAlert: storage.createAlert,
  };
  const saved = { id: 'trigger-1', event: { timestamp: '2026-09-30T00:00:00.000Z', source: 'sentinelx-simulated', type: 'authentication', sourceIp: '192.0.2.10', destinationIp: null, user: 'demo', host: 'host', action: 'login', status: 'failed', severity: 'MEDIUM', rawData: {}, metadata: {} } };
  const engine = detectionEngine(repository);
  assert.equal((await engine.evaluate(saved, client)).length, 1);
  assert.equal((await engine.evaluate(saved, client)).length, 0);
  assert.equal(inserted.size, 1);
});
