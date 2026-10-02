'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createPool}=require('../../src/data/pool');
const {executeSql}=require('../../src/data/postgres');
const {migrationSql}=require('../../scripts/migrate');
const {auditRepository}=require('../../src/data/audit-repository');
const {auditQuery}=require('../../src/audit/model');

test('audit text filters are literal, case-insensitive and applied before pagination/export',async t=>{
 assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Use a disposable database only.');
 executeSql(migrationSql());
 const pool=createPool(),ids=[];
 t.after(async()=>{try{if(ids.length)await pool.query('DELETE FROM audit_logs WHERE id=ANY($1::uuid[])',[ids]);}finally{await pool.end();}});
 for(const [action,target,actor] of [
  ['RULE_UPDATED','detection_rule','Synthetic Rules Operator'],
  ['RULE_CREATED','detection_rule','Synthetic Rules Operator'],
  ['AUTH_LOGIN_FAILED','authentication','Synthetic Gateway']
 ]){
  const result=await pool.query(
   "INSERT INTO audit_logs(actor_context,action,target_type,context) VALUES ($1,$2,$3,$4::jsonb) RETURNING id",
   [actor,action,target,JSON.stringify({dataset:'task41-ci-audit-search'})]
  );
  ids.push(result.rows[0].id);
 }
 const repo=auditRepository(pool);
 const query=s=>auditQuery(new URLSearchParams(s));
 const chosen=id=>id===ids[0];
 for(const action of ['RULE_UPDATED','rule_updated','Rule_UpDaTeD','updated']){
  const rows=await repo.list(query('action='+encodeURIComponent(action)));
  assert.equal(rows.entries.filter(e=>chosen(e.id)).length,1,'action '+action);
  assert.ok(rows.entries.every(e=>e.action.toLowerCase().includes(action.toLowerCase())));
 }
 const byType=await repo.list(query('targetType=DETECTION_rule'));
 assert.equal(byType.entries.filter(e=>ids.includes(e.id)).length,2);
 const byQuery=await repo.list(query('q=rules%20operator'));
 assert.equal(byQuery.entries.filter(e=>ids.includes(e.id)).length,2);
 const byAction=await repo.list(query('q=rule_updated'));
 assert.equal(byAction.entries.filter(e=>ids.includes(e.id)).length,1);
 const literal=await repo.list(query('action=%25_%5C'));
 assert.equal(literal.entries.filter(e=>ids.includes(e.id)).length,0,'SQL wildcards must not have wildcard semantics');
 const combination=await repo.list(query('q=updated&targetType=DETECTION_rule'));
 assert.equal(combination.entries.filter(e=>ids.includes(e.id)).length,1);
 for(const invalid of ['q=','q=hello&q=hi','q='+ 'x'.repeat(201)])assert.throws(()=>query(invalid),{status:400});
});
