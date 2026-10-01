const {equalDigest}=require('../auth/otp');
async function transaction(pool, work) {
  const client = await pool.connect();
  let discard = false;
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { discard = true; }
    throw error;
  } finally { client.release(discard ? new Error('Discard failed database connection.') : undefined); }
}
async function audit(client, userId, action, context={}) {
  await client.query(`INSERT INTO audit_logs(actor_id, actor_context, action, target_type, target_id, context)
    VALUES ($1, $2, $3, 'user', $1, $4::jsonb)`,
    [userId, userId ? 'authenticated user' : 'unauthenticated request', action, JSON.stringify(context)]);
}
function authRepository(pool) {
  return {
    async findUser(email) {
      const result = await pool.query('SELECT id, email, display_name, password_hash, active FROM users WHERE lower(email) = $1', [email]);
      return result.rows[0] || null;
    },
    async failedLogin() { await audit(pool, null, 'AUTH_LOGIN_FAILED'); },
    async createSession(user, tokenHash, seconds) {
      return transaction(pool, async client => {
        const current = await client.query('SELECT id, email, display_name FROM users WHERE id = $1 AND active AND password_hash = $2 FOR SHARE', [user.id, user.password_hash]);
        if (!current.rows[0]) return null;
        await client.query(`INSERT INTO auth_sessions(user_id, token_hash, expires_at)
          VALUES ($1, $2, now() + $3 * interval '1 second')`, [user.id, tokenHash, seconds]);
        await audit(client, user.id, 'AUTH_LOGIN_SUCCEEDED');
        return current.rows[0];
      });
    },
    async createLoginChallenge(user,id,codeDigest,seconds){
      return transaction(pool,async client=>{
        const current=(await client.query('SELECT id,email,display_name FROM users WHERE id=$1 AND active AND password_hash=$2 FOR SHARE',[user.id,user.password_hash])).rows[0];
        if(!current)return null;
        await client.query("UPDATE auth_email_challenges SET revoked_at=clock_timestamp() WHERE user_id=$1 AND purpose='LOGIN' AND consumed_at IS NULL AND revoked_at IS NULL",[user.id]);
        await client.query(`INSERT INTO auth_email_challenges(id,user_id,purpose,code_digest,expires_at)
          VALUES($1,$2,'LOGIN',$3,clock_timestamp()+$4*interval '1 second')`,[id,user.id,codeDigest,seconds]);
        await audit(client,user.id,'AUTH_2FA_CHALLENGE_CREATED',{challengeId:id});
        return current;
      });
    },
    async cancelLoginChallenge(id){
      await pool.query("UPDATE auth_email_challenges SET revoked_at=coalesce(revoked_at,clock_timestamp()) WHERE id=$1 AND purpose='LOGIN' AND consumed_at IS NULL",[id]);
    },
    async resendLoginChallenge(id,codeDigest,seconds,cooldownSeconds){
      return transaction(pool,async client=>{
        const row=(await client.query(`SELECT c.id,c.user_id,c.sent_at,c.consumed_at,c.revoked_at,u.email,u.display_name,u.active
          FROM auth_email_challenges c JOIN users u ON u.id=c.user_id WHERE c.id=$1 AND c.purpose='LOGIN' FOR UPDATE OF c`,[id])).rows[0];
        if(!row||!row.active||row.consumed_at||row.revoked_at) return null;
        const allowed=(await client.query("SELECT $1::timestamptz <= clock_timestamp()-$2*interval '1 second' AS ok",[row.sent_at,cooldownSeconds])).rows[0].ok;
        if(!allowed)return{cooldown:true};
        await client.query(`UPDATE auth_email_challenges SET code_digest=$2,sent_at=clock_timestamp(),
          expires_at=clock_timestamp()+$3*interval '1 second' WHERE id=$1`,[id,codeDigest,seconds]);
        await audit(client,row.user_id,'AUTH_2FA_CHALLENGE_RESENT',{challengeId:id});
        return{id:row.user_id,email:row.email,display_name:row.display_name};
      });
    },
    async completeLoginChallenge(id,codeDigest,tokenHash,sessionSeconds,maxAttempts){
      return transaction(pool,async client=>{
        const row=(await client.query(`SELECT c.*,u.email,u.display_name,u.active FROM auth_email_challenges c
          JOIN users u ON u.id=c.user_id WHERE c.id=$1 AND c.purpose='LOGIN' FOR UPDATE OF c`,[id])).rows[0];
        if(!row||!row.active||row.consumed_at||row.revoked_at||row.expires_at<=new Date()||row.attempts>=maxAttempts)return null;
        if(!equalDigest(row.code_digest,codeDigest)){
          const attempts=row.attempts+1;
          await client.query('UPDATE auth_email_challenges SET attempts=$2,revoked_at=CASE WHEN $2 >= $3 THEN clock_timestamp() ELSE revoked_at END WHERE id=$1',[id,attempts,maxAttempts]);
          await audit(client,row.user_id,'AUTH_2FA_FAILED',{challengeId:id});
          return null;
        }
        await client.query('UPDATE auth_email_challenges SET consumed_at=clock_timestamp() WHERE id=$1',[id]);
        await client.query(`INSERT INTO auth_sessions(user_id,token_hash,expires_at)
          VALUES($1,$2,clock_timestamp()+$3*interval '1 second')`,[row.user_id,tokenHash,sessionSeconds]);
        await audit(client,row.user_id,'AUTH_2FA_VERIFIED',{challengeId:id});
        await audit(client,row.user_id,'AUTH_LOGIN_SUCCEEDED');
        return{id:row.user_id,email:row.email,display_name:row.display_name};
      });
    },
    async findInvitation(email){
      const row=(await pool.query(`SELECT id,email,display_name,role_name,code_digest,attempts,expires_at
        FROM user_invitations WHERE lower(email)=$1 AND consumed_at IS NULL AND revoked_at IS NULL
        ORDER BY created_at DESC,id DESC LIMIT 1`,[email])).rows[0];
      return row||null;
    },
    async failInvitation(id,maxAttempts){
      await transaction(pool,async client=>{
        const invite=(await client.query('SELECT attempts,consumed_at,revoked_at FROM user_invitations WHERE id=$1 FOR UPDATE',[id])).rows[0];
        if(!invite||invite.consumed_at||invite.revoked_at)return;
        const attempts=Math.min(maxAttempts,Number(invite.attempts)+1);
        await client.query('UPDATE user_invitations SET attempts=$2,revoked_at=CASE WHEN $2 >= $3 THEN clock_timestamp() ELSE revoked_at END WHERE id=$1',[id,attempts,maxAttempts]);
      });
    },
    async activateInvitation(id,codeDigest,passwordHash,maxAttempts){
      return transaction(pool,async client=>{
        const invite=(await client.query('SELECT * FROM user_invitations WHERE id=$1 FOR UPDATE',[id])).rows[0];
        if(!invite||invite.consumed_at||invite.revoked_at||invite.expires_at<=new Date()||invite.attempts>=maxAttempts)return null;
        if(!equalDigest(invite.code_digest,codeDigest)){
          const attempts=invite.attempts+1;
          await client.query('UPDATE user_invitations SET attempts=$2,revoked_at=CASE WHEN $2 >= $3 THEN clock_timestamp() ELSE revoked_at END WHERE id=$1',[id,attempts,maxAttempts]);
          return null;
        }
        const existing=(await client.query('SELECT id FROM users WHERE lower(email)=lower($1)',[invite.email])).rows[0];
        if(existing)return null;
        const user=(await client.query(`INSERT INTO users(email,display_name,password_hash,active)
          VALUES(lower($1),$2,$3,true) RETURNING id,email,display_name`,[invite.email,invite.display_name,passwordHash])).rows[0];
        const role=(await client.query('SELECT id FROM roles WHERE name=$1',[invite.role_name])).rows[0];
        if(!role)throw new Error('Approved role is not migrated.');
        await client.query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)',[user.id,role.id]);
        await client.query('UPDATE user_invitations SET consumed_at=clock_timestamp() WHERE id=$1',[id]);
        await client.query(`INSERT INTO audit_logs(actor_id,actor_context,action,target_type,target_id,context)
          VALUES($1,'email-verified invitation','AUTH_USER_ACTIVATED','user',$1,$2::jsonb)`,
          [user.id,JSON.stringify({invitationId:id,role:invite.role_name})]);
        return user;
      });
    },
    async authenticate(tokenHash, idleSeconds) {
      const result = await pool.query(`UPDATE auth_sessions s SET last_seen_at = clock_timestamp()
        FROM users u WHERE u.id = s.user_id AND u.active AND s.token_hash = $1
        AND s.revoked_at IS NULL AND s.expires_at > clock_timestamp()
        AND s.last_seen_at > clock_timestamp() - $2 * interval '1 second'
        RETURNING u.id, u.email, u.display_name`, [tokenHash, idleSeconds]);
      return result.rows[0] || null;
    },
    async logout(tokenHash, idleSeconds) {
      return transaction(pool, async client => {
        const result = await client.query(`UPDATE auth_sessions s SET revoked_at = clock_timestamp()
          FROM users u WHERE u.id = s.user_id AND u.active AND s.token_hash = $1
          AND s.revoked_at IS NULL AND s.expires_at > clock_timestamp()
          AND s.last_seen_at > clock_timestamp() - $2 * interval '1 second'
          RETURNING s.user_id`, [tokenHash, idleSeconds]);
        if (!result.rows[0]) return false;
        await audit(client, result.rows[0].user_id, 'AUTH_LOGOUT');
        return true;
      });
    },
    async createUser(email, displayName, passwordHash, operatorContext) {
      return transaction(pool, async client => {
        const result = await client.query(`INSERT INTO users(email, display_name, password_hash)
          VALUES ($1, $2, $3) RETURNING id`, [email, displayName, passwordHash]);
        const userId = result.rows[0].id;
        await client.query(`INSERT INTO audit_logs(actor_context, action, target_type, target_id)
          VALUES ($2, 'AUTH_USER_PROVISIONED', 'user', $1)`, [userId, operatorContext]);
        return userId;
      });
    },
  };
}
module.exports = { authRepository, transaction };
