const { normalizeRawEvent } = require('../normalization/service');
const { securityEvent } = require('./model');
const { requirePermission } = require('../access/policy');
const { AuthError } = require('../auth/errors');
function approvedSources(env = process.env) {
  const names = (env.EVENT_INGEST_SOURCES ?? 'sentinelx-simulated').split(',').map(value => value.trim());
  if (!names.length || names.length > 20 || names.some(name => !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(name)) || new Set(names).size !== names.length) throw new Error('Invalid approved event source configuration.');
  return Object.freeze(names);
}
function ingestionService(repository, access, sources, detector = null) {
  const approved = new Set(sources);
  return {
    async authorize(token) {
      const identity = await access.me(token);
      requirePermission(identity.roles, 'events.ingest');
      return identity.user;
    },
    async ingestRaw(token, input) {
      await this.authorize(token);
      return this.ingest(token, normalizeRawEvent(input));
    },
    async ingest(token, input) {
      const actor = await this.authorize(token);
      const event = securityEvent(input);
      if (!approved.has(event.source)) throw new AuthError(403, 'Event source is not approved.');
      const saved = await repository.create(event, actor.id);
      const alerts = detector ? await detector.evaluate(saved) : [];
      return { id: saved.id, receivedAt: saved.receivedAt, normalizedAt: saved.normalizedAt, alertsGenerated: alerts.length };
    },
  };
}
module.exports = { ingestionService, approvedSources };
