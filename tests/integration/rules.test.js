const test=require('node:test');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
const {createPool}=require('../../src/data/pool');const {ruleRepository}=require('../../src/data/rule-repository');const {ruleInput}=require('../../src/rules/model');
const {executeSql}=require('../../src/data/postgres');const {migrationSql}=require('../../scripts/migrate');const fixture=require('../../fixtures/rules/simulated-authentication.json');
test('PostgreSQL rule create/edit/toggle, references, version conflicts and audited rollback',async t=>{
  assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Use a disposable database.');executeSql(migrationSql());executeSql(migrationSql());
  const pool=createPool();const repository=ruleRepository(pool);let actorId;const ids=[];const trigger=`rule_test_${randomUUID().replaceAll('-','')}`;const category=(await pool.query("SELECT * FROM threat_categories WHERE code='BRUTE_FORCE'")).rows[0];
  t.after(async()=>{
    await pool.query(`DROP TRIGGER IF EXISTS ${trigger} ON audit_logs`);await pool.query(`DROP FUNCTION IF EXISTS ${trigger}()`);
    await pool.query('DELETE FROM rule_mitre_mappings WHERE rule_id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM detection_rules WHERE id=ANY($1::uuid[])',[ids]);
    if(actorId){await pool.query('DELETE FROM audit_logs WHERE actor_id=$1',[actorId]);await pool.query('DELETE FROM user_roles WHERE user_id=$1',[actorId]);await pool.query('DELETE FROM users WHERE id=$1',[actorId]);}
    await pool.query('UPDATE threat_categories SET enabled=$1 WHERE code=$2',[category.enabled,category.code]);await pool.end();
  });
  actorId=(await pool.query('INSERT INTO users(email,display_name,password_hash) VALUES($1,$2,$3) RETURNING id',[`${randomUUID()}@example.invalid`,'Synthetic rule manager','not a usable hash'])).rows[0].id;
  await pool.query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name='Security Analyst'",[actorId]);
  await pool.query("UPDATE threat_categories SET enabled=true WHERE code='BRUTE_FORCE'");
  const input={...fixture,name:`Synthetic rule ${randomUUID()}`};
  await repository.validate(ruleInput(input));
  let created=await repository.create(actorId,ruleInput(input));ids.push(created.id);assert.equal(created.enabled,false);assert.equal(created.version,1);assert.deepEqual(created.definition.conditions,input.conditions);assert.deepEqual(created.mitreTechniqueIds,['T1110']);
  await assert.rejects(repository.create(actorId,ruleInput(input)),{status:409});
  await assert.rejects(repository.validate(ruleInput({...input,mitreTechniqueIds:['T9998']})),{status:400});
  created=await repository.update(actorId,created.id,ruleInput({...input,threshold:7,enabled:true,version:1,mitreTechniqueIds:['T1078','T1110']},true));assert.equal(created.enabled,true);assert.equal(created.version,2);assert.equal(created.definition.threshold,7);assert.deepEqual(created.mitreTechniqueIds,['T1078','T1110']);
  await assert.rejects(repository.update(actorId,created.id,ruleInput({...input,version:1},true)),{status:409});
  // Concurrent edits with one version cannot overwrite each other silently.
  const edits=await Promise.allSettled([8,9].map(threshold=>repository.update(actorId,created.id,ruleInput({...input,threshold,version:2,enabled:true},true))));assert.equal(edits.filter(result=>result.status==='fulfilled').length,1);assert.equal(edits.find(result=>result.status==='rejected').reason.status,409);
  created=await repository.get(created.id);assert.equal(created.version,3);
  await pool.query("UPDATE threat_categories SET enabled=false WHERE code='BRUTE_FORCE'");
  created=await repository.update(actorId,created.id,ruleInput({...input,enabled:false,version:created.version},true));assert.equal(created.enabled,false);
  await assert.rejects(repository.update(actorId,created.id,ruleInput({...input,enabled:true,version:created.version},true)),{status:400});
  // Invalid new selection rejects creation even for a disabled rule.
  await assert.rejects(repository.create(actorId,ruleInput({...input,name:`Rejected ${randomUUID()}`})),{status:400});
  const before=await repository.get(created.id);
  await pool.query(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action IN ('RULE_CREATED','RULE_UPDATED') AND NEW.actor_id='${actorId}'::uuid THEN RAISE EXCEPTION 'synthetic rule audit failure'; END IF; RETURN NEW; END $$`);
  await pool.query(`CREATE TRIGGER ${trigger} BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION ${trigger}()`);
  await assert.rejects(repository.update(actorId,created.id,ruleInput({...input,version:before.version,threshold:11,mitreTechniqueIds:[]},true)),{message:'Detection rule persistence unavailable.'});assert.deepEqual(await repository.get(created.id),before);
  await pool.query(`DROP TRIGGER ${trigger} ON audit_logs`);await pool.query(`DROP FUNCTION ${trigger}()`);
  const audits=(await pool.query("SELECT action,context FROM audit_logs WHERE target_id=$1 ORDER BY occurred_at",[created.id])).rows;assert.equal(audits.length,4);assert.equal(audits[0].action,'RULE_CREATED');assert.equal(audits[3].context.next.enabled,false);
  await pool.query('DELETE FROM user_roles WHERE user_id=$1',[actorId]);await assert.rejects(repository.update(actorId,created.id,ruleInput({...input,version:before.version},true)),{status:403});
});

test('real sessions reach rule APIs and Viewer cannot read or mutate persisted rules',async t=>{
  assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Use a disposable database.');executeSql(migrationSql());
  const {authRepository}=require('../../src/data/auth-repository');const {authService}=require('../../src/auth/service');const {accessRepository}=require('../../src/data/access-repository');const {accessService}=require('../../src/access/service');const {ruleService}=require('../../src/rules/service');const {hashPassword}=require('../../src/auth/passwords');const {configFromEnv}=require('../../src/auth/config');const {createServer}=require('../../src/api/server');
  const pool=createPool();const users=[];const rules=[];let server;
  t.after(async()=>{
    if(server)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
    await pool.query('DELETE FROM rule_mitre_mappings WHERE rule_id=ANY($1::uuid[])',[rules]);await pool.query('DELETE FROM detection_rules WHERE id=ANY($1::uuid[])',[rules]);
    const ids=users.map(user=>user.id);await pool.query('DELETE FROM audit_logs WHERE actor_id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM auth_sessions WHERE user_id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM user_roles WHERE user_id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[ids]);await pool.end();
  });
  const password='Synthetic rule API passphrase';const hash=await hashPassword(password);const repo=authRepository(pool);const config=configFromEnv({});const auth=authService(repo,config);const access=accessService(accessRepository(pool),auth);const service=ruleService(ruleRepository(pool),access);
  for(const role of ['Security Analyst','Viewer/Management']){const email=`${randomUUID()}@example.invalid`;const id=await repo.createUser(email,'Synthetic rule API tester',hash,'synthetic test operator');users.push({id,email});await pool.query('INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name=$2',[id,role]);}
  server=createServer(auth,config,access,null,null,null,service);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;const cookies=[];
  for(const user of users){const login=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{Origin:config.origin,'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password})});assert.equal(login.status,200);cookies.push(login.headers.get('set-cookie').split(';')[0]);}
  const input={...fixture,name:`Synthetic API rule ${randomUUID()}`};
  const request=(path,method='GET',body,cookie=cookies[0])=>fetch(`${base}${path}`,{method,headers:{Cookie:cookie,Origin:config.origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await request('/api/rules/validate','POST',input)).status,200);
  const response=await request('/api/rules','POST',input);assert.equal(response.status,201);let saved=(await response.json()).rule;rules.push(saved.id);
  assert.equal((await request(`/api/rules/${saved.id}`)).status,200);
  const update={...input,version:saved.version,enabled:true,threshold:7};const enabled=await request(`/api/rules/${saved.id}`,'PUT',update);assert.equal(enabled.status,200);saved=(await enabled.json()).rule;assert.equal(saved.enabled,true);
  assert.equal((await request(`/api/rules/${saved.id}`,'PUT',update)).status,409);
  const disabled=await request(`/api/rules/${saved.id}`,'PUT',{...update,version:saved.version,enabled:false});assert.equal(disabled.status,200);assert.equal((await disabled.json()).rule.enabled,false);
  assert.equal((await request('/api/rules','GET',null,cookies[1])).status,403);
  assert.equal((await request(`/api/rules/${saved.id}`,'GET',null,cookies[1])).status,403);
  assert.equal((await request('/api/rules','POST',input,cookies[1])).status,403);
});
