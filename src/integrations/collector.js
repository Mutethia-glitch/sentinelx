const { createHash, timingSafeEqual } = require('node:crypto');
const { isIP } = require('node:net');
const { AuthError } = require('../auth/errors');
const { readJson } = require('../api/auth-handler');
const { timestamp } = require('../events/model');
const { canonicalIp } = require('./login-containment');
const CONNECTOR_SEVERITY = Object.freeze({
  login_failed: {severity:'LOW',reason:'An individual password sign-in failed; repetition is evaluated by detection rules.'},
  access_denied: {severity:'MEDIUM',reason:'The application rejected access to a protected operation.'},
  rate_limit_blocked: {severity:'MEDIUM',reason:'The application rejected a request after its rate limit was exceeded; this alone does not establish DoS.'},
  login_containment_blocked: {severity:'HIGH',reason:'A sign-in was blocked under a verified repeated-login containment decision.'},
  privileged_access_denied: {severity:'HIGH',reason:'A signed-in non-administrator was denied an administrator-only operation; no privilege gain is established.'}
});
function collectorConfig(env, tenant) {
  if (env.CONNECTOR_LOGIN_CONTAINMENT !== undefined && !['0','1'].includes(env.CONNECTOR_LOGIN_CONTAINMENT)) throw new Error('Invalid login containment policy.');
  if (!env.CONNECTOR_TOKEN && !env.CONNECTOR_SOURCE && !env.CONNECTOR_HOST) return null;
  if (!tenant || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(env.CONNECTOR_SOURCE || '') ||
      !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(env.CONNECTOR_HOST || '') ||
      !/^[a-f0-9]{64}$/.test(env.CONNECTOR_TOKEN || '')) throw new Error('Invalid connector configuration.');
  return { tenantId: tenant.id, source: env.CONNECTOR_SOURCE, host: env.CONNECTOR_HOST, containLogin:env.CONNECTOR_LOGIN_CONTAINMENT==='1',
    tokenHash: createHash('sha256').update(env.CONNECTOR_TOKEN).digest() };
}
function connectorEvent(body, config, now = Date.now()) {
  const fail = () => { throw new AuthError(400, 'Invalid connector event.'); };
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(k => !['eventId','timestamp','kind','sourceIp','subject','containmentId'].includes(k)) ||
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.eventId || '') ||
      (typeof body.kind!=='string'||!Object.hasOwn(CONNECTOR_SEVERITY,body.kind)) ||
      (body.sourceIp !== null && (typeof body.sourceIp !== 'string' || !isIP(body.sourceIp) || body.sourceIp.includes('%'))) ||
      (body.subject !== undefined && (typeof body.subject !== 'string' || !/^[0-9a-f]{64}$/.test(body.subject)))) fail();
  let occurred; try { occurred = timestamp(body.timestamp); } catch { fail(); }
  if (Math.abs(now - Date.parse(occurred)) > 10 * 60 * 1000) fail();
  const contained=body.kind==='login_containment_blocked';
  if (contained ? (!body.sourceIp || !body.subject || typeof body.containmentId!=='string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.containmentId)) : body.containmentId!==undefined) fail();
  const login = body.kind === 'login_failed', privileged=body.kind==='privileged_access_denied', denied=body.kind==='access_denied';
  const classification=CONNECTOR_SEVERITY[body.kind];
  return { timestamp: occurred, source: config.source, host: config.host,
    type: login || contained ? 'authentication' : privileged ? 'authorization' : denied ? 'access' : 'application', action: login ? 'login' : contained ? 'login_throttled' : body.kind,
    status: login ? 'failed' : privileged || denied ? 'denied' : 'blocked', sourceIp: body.sourceIp===null?null:canonicalIp(body.sourceIp),
    user: body.subject || null, severity: classification.severity, rawData: { kind: body.kind },
    metadata: { severityPolicy:'connector-v1',severityReason:classification.reason,connector: config.source, tenantId: config.tenantId, externalId: body.eventId,...(contained?{containmentId:body.containmentId}:{}) } };
}
function collectorHandler(config, repository, detector, containment = null) {
  return async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    try {
      if (!config || !['/api/connectors/events','/api/connectors/login-check'].includes(req.url)) { req.resume(); return send(404, {error:'Not found.'}); }
      if (req.method !== 'POST') { req.resume(); res.setHeader('Allow','POST'); return send(405,{error:'Method not allowed.'}); }
      const supplied = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
      const digest = createHash('sha256').update(supplied.startsWith('Bearer ') ? supplied.slice(7) : '').digest();
      if (req.headers.origin || !timingSafeEqual(digest, config.tokenHash)) throw new AuthError(401, 'Connector authentication failed.');
      const body = await readJson(req);
      if(req.url==='/api/connectors/login-check') return send(200,await containment.check(config,body));
      const event = connectorEvent(body, config);
      if(body.kind==='login_containment_blocked' && !config.containLogin) throw new AuthError(409,'Login containment is disabled.');
      const saved = await repository.create(event, null, async (persisted, client) => {
        if(containment && config.containLogin) {
          await client.query('SAVEPOINT sentinelx_login_containment');
          try { await containment.afterEvent(config,persisted,client); }
          catch(error) {
            await client.query('ROLLBACK TO SAVEPOINT sentinelx_login_containment');
            if(error instanceof AuthError) throw error;
            await client.query(`INSERT INTO audit_logs(actor_context,action,target_type,target_id,context)
              VALUES ('authorized connector policy','LOGIN_CONTAINMENT_FAILED','security_event',$1,$2::jsonb)`,
            [persisted.id,JSON.stringify({source:config.source,outcome:'CONTROL_UNAVAILABLE',alertDelivery:'CONTINUES'})]);
          }
          await client.query('RELEASE SAVEPOINT sentinelx_login_containment');
        }
        await detector.evaluate(persisted, client);
      }, {source: config.source, externalId: body.eventId});
      return send(200, {eventId:saved.id, accepted:true});
    } catch (error) {
      req.resume(); return send(error instanceof AuthError ? error.status : 503,
        {error:error instanceof AuthError ? error.message : 'Connector ingestion temporarily unavailable.'});
    }
  };
}
module.exports = {collectorConfig, connectorEvent, collectorHandler};
