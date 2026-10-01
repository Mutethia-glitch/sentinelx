const { createHash, timingSafeEqual } = require('node:crypto');
const { isIP } = require('node:net');
const { AuthError } = require('../auth/errors');
const { readJson } = require('../api/auth-handler');
const { timestamp } = require('../events/model');
function collectorConfig(env, tenant) {
  if (!env.CONNECTOR_TOKEN && !env.CONNECTOR_SOURCE && !env.CONNECTOR_HOST) return null;
  if (!tenant || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(env.CONNECTOR_SOURCE || '') ||
      !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(env.CONNECTOR_HOST || '') ||
      !/^[a-f0-9]{64}$/.test(env.CONNECTOR_TOKEN || '')) throw new Error('Invalid connector configuration.');
  return { tenantId: tenant.id, source: env.CONNECTOR_SOURCE, host: env.CONNECTOR_HOST,
    tokenHash: createHash('sha256').update(env.CONNECTOR_TOKEN).digest() };
}
function connectorEvent(body, config, now = Date.now()) {
  const fail = () => { throw new AuthError(400, 'Invalid connector event.'); };
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(k => !['eventId','timestamp','kind','sourceIp','subject'].includes(k)) ||
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.eventId || '') ||
      !['login_failed','access_denied','rate_limit_blocked'].includes(body.kind) ||
      (body.sourceIp !== null && (typeof body.sourceIp !== 'string' || !isIP(body.sourceIp))) ||
      (body.subject !== undefined && (typeof body.subject !== 'string' || !/^[0-9a-f]{64}$/.test(body.subject)))) fail();
  let occurred; try { occurred = timestamp(body.timestamp); } catch { fail(); }
  if (Math.abs(now - Date.parse(occurred)) > 10 * 60 * 1000) fail();
  const login = body.kind === 'login_failed';
  return { timestamp: occurred, source: config.source, host: config.host,
    type: login ? 'authentication' : 'application', action: login ? 'login' : body.kind,
    status: login ? 'failed' : 'blocked', sourceIp: body.sourceIp,
    user: body.subject || null, severity: 'LOW', rawData: { kind: body.kind },
    metadata: { connector: config.source, tenantId: config.tenantId, externalId: body.eventId } };
}
function collectorHandler(config, repository, detector) {
  return async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    try {
      if (!config || req.url !== '/api/connectors/events') { req.resume(); return send(404, {error:'Not found.'}); }
      if (req.method !== 'POST') { req.resume(); res.setHeader('Allow','POST'); return send(405,{error:'Method not allowed.'}); }
      const supplied = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
      const digest = createHash('sha256').update(supplied.startsWith('Bearer ') ? supplied.slice(7) : '').digest();
      if (req.headers.origin || !timingSafeEqual(digest, config.tokenHash)) throw new AuthError(401, 'Connector authentication failed.');
      const body = await readJson(req);
      const event = connectorEvent(body, config);
      const saved = await repository.create(event, null, async (persisted, client) => {
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
