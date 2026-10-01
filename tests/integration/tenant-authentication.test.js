const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createPool}=require('../../src/data/pool');
const {executeSql}=require('../../src/data/postgres');
const {migrationSql}=require('../../scripts/migrate');
const {hashPassword}=require('../../src/auth/passwords');
const {authRepository}=require('../../src/data/auth-repository');
const {accessRepository}=require('../../src/data/access-repository');
const {authService}=require('../../src/auth/service');
const {accessService}=require('../../src/access/service');
const {configFromEnv}=require('../../src/auth/config');

test('isolated tenant supports email-2FA login, Administrator invitations, role activation and user disablement',async t=>{
 assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Use a disposable database.');
 executeSql(migrationSql());
 const pool=createPool(),suffix=randomUUID().slice(0,8),started=new Date();t.after(()=>pool.end());
 const adminEmail='task41-admin-'+suffix+'@example.invalid',userEmail='task41-user-'+suffix+'@example.invalid';
 const adminPassword='Synthetic Task 41 administrator password!',userPassword='Synthetic Task 41 employee password!';
 const authRepo=authRepository(pool),accessRepo=accessRepository(pool),createdUsers=[],invitationIds=[];
 try{
  const adminId=await authRepo.createUser(adminEmail,'Task 41 Admin',await hashPassword(adminPassword),'Task 41 isolated tenant integration');createdUsers.push(adminId);
  const adminRole=(await pool.query("SELECT id FROM roles WHERE name='Administrator'")).rows[0];assert.ok(adminRole);
  await pool.query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)',[adminId,adminRole.id]);
  const codes=new Map(),mailer={async sendCode(m){codes.set(m.purpose+':'+m.to,m.code);}};
  const config=configFromEnv({APP_ORIGIN:'http://localhost:3000',AUTH_EMAIL_2FA:'1',AUTH_OTP_SECRET:'x'.repeat(32)});
  const auth=authService(authRepo,config,mailer);
  const access=accessService(accessRepo,auth,{tenant:{id:randomUUID(),name:'Task 41 Company',slug:'task41-company'},mailer,otpSecret:config.otpSecret,otpSeconds:config.otpSeconds});

  const pending=await auth.login({email:adminEmail,password:adminPassword});assert.equal(pending.requiresTwoFactor,true);assert.equal(pending.token,undefined);
  const adminCode=codes.get('LOGIN:'+adminEmail);assert.match(adminCode,/^\d{6}$/);
  const signed=await auth.verifyTwoFactor(pending.challengeId,{code:adminCode});assert.equal((await auth.currentUser(signed.token)).email,adminEmail);

  const invite=await access.inviteUser(signed.token,{email:userEmail,displayName:'Task 41 Analyst',role:'Security Analyst',reason:'Controlled Task 41 company user'});
  invitationIds.push(invite.id);assert.equal(invite.status,'PENDING_ACTIVATION');
  const activationCode=codes.get('USER_INVITATION:'+userEmail);assert.match(activationCode,/^\d{6}$/);
  const activated=await auth.activate({email:userEmail,code:activationCode,password:userPassword});createdUsers.push(activated.user.id);
  assert.deepEqual(await accessRepo.rolesForUser(activated.user.id),['Security Analyst']);

  const employeePending=await auth.login({email:userEmail,password:userPassword});const employeeCode=codes.get('LOGIN:'+userEmail);
  const employee=await auth.verifyTwoFactor(employeePending.challengeId,{code:employeeCode});assert.equal((await auth.currentUser(employee.token)).email,userEmail);

  const disabled=await access.setActive(signed.token,activated.user.id,{active:false,reason:'Task 41 disable regression'});
  assert.equal(disabled.active,false);await assert.rejects(auth.currentUser(employee.token),{status:401});
  await assert.rejects(auth.login({email:userEmail,password:userPassword}),{status:401});
 }finally{
  const ids=createdUsers;
  if(ids.length){
   await pool.query('DELETE FROM auth_email_challenges WHERE user_id=ANY($1::uuid[])',[ids]);
   await pool.query('DELETE FROM auth_sessions WHERE user_id=ANY($1::uuid[])',[ids]);
  }
  if(invitationIds.length)await pool.query('DELETE FROM user_invitations WHERE id=ANY($1::uuid[])',[invitationIds]);
  if(ids.length){
   await pool.query('DELETE FROM audit_logs WHERE actor_id=ANY($1::uuid[]) OR target_id=ANY($1::uuid[])',[ids]);
   await pool.query("DELETE FROM audit_logs WHERE actor_id IS NULL AND action='AUTH_LOGIN_FAILED' AND occurred_at >= $1",[started]);
   await pool.query('DELETE FROM user_roles WHERE user_id=ANY($1::uuid[])',[ids]);
   await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[ids]);
  }
 }
});
