const test = require('node:test');
const assert = require('node:assert/strict');
const { correlationRepository, pair } = require('../../src/data/correlation-repository');

test('candidate query is time/entity bounded and maps persisted alert snapshots', async () => {
  let query;
  const db = { query: async (sql, params) => { query={sql,params}; return { rows: [{ id:'b', category_code:'BRUTE_FORCE', created_at:new Date('2026-09-30T00:05:00Z'), affected_entities:{user:'alice'} }] }; } };
  const repo=correlationRepository({});
  const result=await repo.candidates({id:'a',timestamp:'2026-09-30T00:10:00.000Z',threat:'BRUTE_FORCE',affectedEntities:{user:'alice',sourceIp:'192.0.2.1',host:null}},900,db);
  assert.match(query.sql,/created_at >=/);
  assert.match(query.sql,/affected_entities->>'user'/);
  assert.deepEqual(query.params,['a','2026-09-30T00:10:00.000Z',900,'BRUTE_FORCE','alice','192.0.2.1',null]);
  assert.deepEqual(result,[{id:'b',threat:'BRUTE_FORCE',timestamp:'2026-09-30T00:05:00.000Z',affectedEntities:{user:'alice'}}]);
});

test('pair normalization prevents reverse-direction duplicates', () => {
  assert.deepEqual(pair('b','a'), ['a','b']);
  assert.deepEqual(pair('a','b'), ['a','b']);
});

test('link uses conflict-safe pair persistence and group uses recursive graph lookup', async () => {
  const calls=[];
  const db={query:async(sql,params)=>{calls.push([sql,params]);if(sql.startsWith('INSERT INTO alert_correlations'))return{rows:[{id:'x'}]};return{rows:[{id:'a'},{id:'b'},{id:'c'}]};}};
  const repo=correlationRepository({});
  assert.equal(await repo.link('b','a',{matchedFields:['user','category'],windowSeconds:900,timeDeltaSeconds:30},db),true);
  assert.deepEqual(calls[0][1].slice(0,2),['a','b']);
  assert.deepEqual(await repo.group('a',db),['a','b','c']);
  assert.match(calls[0][0],/ON CONFLICT DO NOTHING/);
  assert.match(calls[1][0],/WITH RECURSIVE connected/);
});

test('repository sanitizes persistence failures', async () => {
  const repo=correlationRepository({query:async()=>{throw new Error('private database detail');}});
  await assert.rejects(repo.group('a'),{name:'CorrelationPersistenceError',message:'Alert correlation persistence unavailable.'});
});

test('correlation transaction lock is acquired before work and retained by caller transaction',async()=>{
  const calls=[],client={query:async(sql,values)=>{calls.push({sql,values});return{rows:[]};}};
  const repo=correlationRepository({});
  const result=await repo.withLock(async db=>{assert.equal(db,client);calls.push({sql:'work'});return 'done';},client);
  assert.equal(result,'done');assert.match(calls[0].sql,/pg_advisory_xact_lock/);assert.equal(calls[1].sql,'work');
  assert.equal(calls.some(call=>call.sql==='COMMIT'),false);
});

test('standalone evaluation owns a transaction and rolls back a failed evaluation',async()=>{
  const calls=[],client={query:async sql=>{calls.push(sql);return{rows:[]};},release:()=>calls.push('release')};
  const repo=correlationRepository({connect:async()=>client});
  await assert.rejects(repo.withLock(async()=>{throw new Error('private details');}),{name:'CorrelationPersistenceError'});
  assert.equal(calls[0],'BEGIN');assert.match(calls[1],/pg_advisory_xact_lock/);assert.deepEqual(calls.slice(-2),['ROLLBACK','release']);
});
