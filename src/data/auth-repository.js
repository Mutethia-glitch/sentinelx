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
async function audit(client, userId, action) {
  await client.query(`INSERT INTO audit_logs(actor_id, actor_context, action, target_type, target_id)
    VALUES ($1, $2, $3, 'user', $1)`, [userId, userId ? 'authenticated user' : 'unauthenticated request', action]);
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
