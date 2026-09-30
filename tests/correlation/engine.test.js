const test = require('node:test');
const assert = require('node:assert/strict');
const { relationship, correlationEngine } = require('../../src/correlation/engine');
const base = patch => ({ id: 'a', threat: 'BRUTE_FORCE', timestamp: '2026-09-30T00:10:00.000Z', affectedEntities: { user: 'alice', sourceIp: '192.0.2.1', host: 'host-a' }, ...patch });

test('correlation requires time plus two explainable signals including an entity', () => {
  assert.deepEqual(relationship(base({}), base({ id: 'b', timestamp: '2026-09-30T00:05:00.000Z' })), { windowSeconds: 900, timeDeltaSeconds: 300, matchedFields: ['user','sourceIp','host','category'] });
  assert.equal(relationship(base({}), base({ id: 'b', timestamp: '2026-09-30T00:05:00.000Z', affectedEntities: { user: 'bob' } })), null);
  assert.equal(relationship(base({}), base({ id: 'b', threat: 'MALWARE', timestamp: '2026-09-30T00:05:00.000Z', affectedEntities: { user: 'alice' } })), null);
  assert.deepEqual(relationship(base({}), base({ id: 'b', threat: 'MALWARE', timestamp: '2026-09-30T00:05:00.000Z', affectedEntities: { user: 'alice', host: 'host-a' } })).matchedFields, ['user','host']);
  assert.equal(relationship(base({}), base({ id: 'b', timestamp: '2026-09-29T23:54:59.000Z' })), null);
  assert.equal(relationship(base({}), base({ id: 'b', timestamp: '2026-09-30T00:11:00.000Z' })).timeDeltaSeconds,60);
  assert.equal(relationship(base({}), base({ id: 'b', timestamp: '2026-09-30T00:25:00.001Z' })),null);
});

test('engine persists each related edge and returns the explainable group', async () => {
  const links = [];
  const repository = {
    withLock: async work => work({}),
    candidates: async () => [base({ id: 'b', timestamp: '2026-09-30T00:09:00.000Z' }), base({ id: 'c', timestamp: '2026-09-30T00:09:30.000Z', threat: 'MALWARE', affectedEntities: { user: 'alice', host: 'host-a' } }), base({ id: 'd', timestamp: '2026-09-30T00:09:30.000Z', affectedEntities: { user: 'bob' } })],
    link: async (alertId, relatedId, evidence) => { links.push([alertId, relatedId, evidence]); return true; },
    group: async () => ['a','b','c'],
  };
  const result = await correlationEngine(repository).evaluate(base({}));
  assert.equal(links.length, 2);
  assert.deepEqual(result.groupAlertIds, ['a','b','c']);
  assert.deepEqual(result.correlations.map(item => item.alertId), ['b','c']);
});

test('correlation time window is symmetric and rejects fractional overflow',()=>{
 const a=base({timestamp:'2026-09-30T00:00:00.000Z'});
 const b=base({id:'b',timestamp:'2026-09-30T00:15:00.000Z'});
 assert.deepEqual(relationship(a,b),relationship(b,a));
 assert.equal(relationship(a,{...b,timestamp:'2026-09-30T00:15:00.001Z'}),null);
});
