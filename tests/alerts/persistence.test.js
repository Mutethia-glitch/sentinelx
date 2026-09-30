const test = require('node:test');
const assert = require('node:assert/strict');
const { detectionRepository } = require('../../src/data/detection-repository');

test('alert persistence writes and returns the Task 15 snapshot fields', async () => {
  let insert;
  const client = {
    async query(sql, params) {
      if (sql.startsWith('INSERT INTO alerts')) {
        insert = { sql, params };
        return { rows: [{ id: params[0], created_at: new Date('2026-09-30T01:00:00.000Z') }] };
      }
      if (sql.startsWith('INSERT INTO alert_events')) return { rows: [] };
      throw new Error('Unexpected query in alert persistence test.');
    },
  };
  const repository = detectionRepository({});
  const alert = await repository.createAlert(
    { id: 'rule-1', name: 'Synthetic ransomware rule', categoryCode: 'RANSOMWARE', severity: 'CRITICAL' },
    [{ id: 'event-1' }],
    {
      triggerEventId: 'event-1',
      threshold: 1,
      windowSeconds: 60,
      groupBy: ['host'],
      groupValues: ['server-1'],
      source: 'endpoint-agent',
      affectedEntities: { user: 'alice', host: 'server-1' },
      confidence: null,
    },
    client,
  );

  assert.match(insert.sql, /trigger_event_id/);
  assert.match(insert.sql, /affected_entities/);
  assert.deepEqual(alert, {
    id: alert.id,
    ruleId: 'rule-1',
    triggerEventId: 'event-1',
    threat: 'RANSOMWARE',
    severity: 'CRITICAL',
    source: 'endpoint-agent',
    timestamp: '2026-09-30T01:00:00.000Z',
    affectedEntities: { user: 'alice', host: 'server-1' },
    status: 'NEW',
    confidence: null,
    eventIds: ['event-1'],
  });

  const storedEvidence = JSON.parse(insert.params[10]);
  assert.equal(storedEvidence.triggerEventId, 'event-1');
  assert.equal(storedEvidence.source, undefined);
  assert.equal(storedEvidence.affectedEntities, undefined);
  assert.equal(storedEvidence.confidence, undefined);
});
