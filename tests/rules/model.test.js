const test = require('node:test');
const assert = require('node:assert/strict');
const { ruleInput, ruleId } = require('../../src/rules/model');
const { ruleService } = require('../../src/rules/service');
const { createServer } = require('../../src/api/server');
const { configFromEnv } = require('../../src/auth/config');
const { AuthError } = require('../../src/auth/errors');
const fixture = require('../../fixtures/rules/simulated-authentication.json');
test('rule model retains declarative conditions, count/window, grouping and optional MITRE IDs', () => {
  const rule = ruleInput(fixture); assert.equal(rule.enabled,false); assert.equal(rule.definition.schemaVersion,1); assert.equal(rule.definition.threshold,5); assert.deepEqual(rule.definition.conditions,fixture.conditions);
  rule.definition.conditions[0].value='copied'; assert.equal(fixture.conditions[0].value,'sentinelx-simulated');
  for (const condition of [{field:'sourceIp',operator:'equals',value:null},{field:'severity',operator:'in',value:['LOW','HIGH']},{field:'host',operator:'exists',value:true},{field:'user',operator:'notEquals',value:'synthetic'}]) assert.doesNotThrow(() => ruleInput({...fixture,conditions:[condition],mitreTechniqueIds:[]}));
  assert.equal(ruleInput({...fixture,version:2},true).version,2);
});
test('rule model rejects executable expressions, malformed fields and unsupported references', () => {
  for (const patch of [{conditions:[]},{conditions:[{field:'rawData.password',operator:'equals',value:'secret'}]},{conditions:[{field:'user',operator:'regex',value:'.*'}]},{conditions:[{field:'host',operator:'exists',value:'true'}]},{conditions:[{field:'sourceIp',operator:'equals',value:'invalid'}]},{conditions:[{field:'severity',operator:'in',value:['LOW','LOW']}]},{threshold:0},{threshold:1.2},{windowSeconds:86401},{groupBy:['user','user']},{mitreTechniqueIds:['T1110','T1110']},{mitreTechniqueIds:['invalid']},{enabled:'true'},{severity:'CLOSED'},{categoryCode:'ARBITRARY'},{reason:''},{extra:true}]) assert.throws(() => ruleInput({...fixture,...patch}),{status:400});
  assert.throws(() => ruleInput({...fixture,version:0},true),{status:400});
  assert.throws(() => ruleId('1 OR 1=1'),{status:400});
});
test('rule APIs enforce Analyst/Admin management and deny Viewer including forged role headers', async t => {
  let writes=0;
  const repository={ list:async page=>({rules:[],page,pageSize:50,hasMore:false}), get:async()=>null, mitre:async()=>[{techniqueId:'T1110',techniqueName:'Brute Force'}], validate:async data=>data, create:async(actor,data)=>{writes++; if(data.name==='fail') throw new Error('private SQL detail'); return {id:'synthetic',enabled:data.enabled,definition:data.definition};}, update:async()=>({version:2}) };
  const service=ruleService(repository,{me:async token=>{if(!token)throw new AuthError(401,'Authentication required.');return {user:{id:'actor'},roles:[token]};}}); const config=configFromEnv({});
  const server=createServer({},config,null,null,null,null,service); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const url=`http://127.0.0.1:${server.address().port}/api/rules`;const headers=role=>({Cookie:`${config.cookieName}=${role}`,Origin:config.origin,'Content-Type':'application/json','X-Role':'Administrator'});
  const post=(body=fixture,role='Security Analyst',path=url,patch={})=>fetch(path,{method:'POST',headers:{...headers(role),...patch},body:JSON.stringify(body)});
  assert.equal((await fetch(url)).status,401);
  for(const role of ['Viewer/Management','Owner']){assert.equal((await fetch(url,{headers:headers(role)})).status,403);assert.equal((await post(fixture,role)).status,403);}
  for(const role of ['Administrator','Security Analyst']){assert.equal((await fetch(url,{headers:headers(role)})).status,200);assert.equal((await post(fixture,role)).status,201);}
  assert.equal((await post(fixture,'Security Analyst',url,{Origin:''})).status,403);
  assert.equal((await post({...fixture,threshold:0})).status,400);
  const validated=await post(fixture,'Security Analyst',`${url}/validate`);assert.equal(validated.status,200);assert.equal((await validated.json()).executionImplemented,false);
  assert.equal((await fetch(`${url}?page=0`,{headers:headers('Administrator')})).status,400);
  assert.equal((await fetch(`${url}/mitre-mappings`,{headers:headers('Administrator')})).status,200);
  assert.equal((await fetch(`${url}/11111111-1111-4111-8111-111111111111`,{headers:headers('Administrator')})).status,404);
  const fail=await post({...fixture,name:'fail'});assert.equal(fail.status,503);assert.deepEqual(await fail.json(),{error:'Rule management temporarily unavailable.'});assert.equal(writes,3);
});
