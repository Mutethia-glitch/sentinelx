const test = require('node:test');
const assert = require('node:assert/strict');
const { detectionRepository } = require('../../src/data/detection-repository');

test('duplicate suppression keys directly on rule and persisted triggerEventId', async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [{}] };
      if (sql.includes("match_evidence->>'triggerEventId'")) return { rows: [{ id: 'existing-alert' }] };
      if (sql.startsWith('INSERT INTO alerts')) throw new Error('duplicate path must not insert');
      return { rows: [] };
    },
  };
  const repository = detectionRepository({});
  const result = await repository.createAlert(
    { id: 'rule-1', name: 'Synthetic', severity: 'HIGH', categoryCode: 'BRUTE_FORCE' },
    [{ id: 'event-1' }],
    { triggerEventId: 'trigger-1', threshold: 1, windowSeconds: 60, groupBy: [], groupValues: [] },
    client,
  );
  assert.equal(result, null);
  const duplicateCall = calls.find(call => call.sql.includes("match_evidence->>'triggerEventId'"));
  assert.deepEqual(duplicateCall.params, ['rule-1', 'trigger-1']);
  assert.equal(calls.some(call => call.sql.startsWith('INSERT INTO alerts')), false);
});
