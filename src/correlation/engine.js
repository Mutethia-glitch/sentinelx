const CORRELATION_WINDOW_SECONDS = 900;
const ENTITY_FIELDS = Object.freeze(['user', 'sourceIp', 'host']);

function relationship(current, candidate, windowSeconds = CORRELATION_WINDOW_SECONDS) {
  if (!current?.id || !candidate?.id || current.id === candidate.id) return null;
  const currentTime = Date.parse(current.timestamp);
  const candidateTime = Date.parse(candidate.timestamp);
  if (!Number.isFinite(currentTime) || !Number.isFinite(candidateTime)) return null;
  const timeDeltaMilliseconds = Math.abs(currentTime - candidateTime);
  if (timeDeltaMilliseconds > windowSeconds * 1000) return null;
  const timeDeltaSeconds = Math.floor(timeDeltaMilliseconds / 1000);
  const matchedFields = [];
  for (const field of ENTITY_FIELDS) {
    const left = current.affectedEntities?.[field] ?? null;
    const right = candidate.affectedEntities?.[field] ?? null;
    if (left !== null && right !== null && left === right) matchedFields.push(field);
  }
  if (current.threat && candidate.threat && current.threat === candidate.threat) matchedFields.push('category');
  const entityMatches = matchedFields.filter(field => field !== 'category');
  if (!entityMatches.length || matchedFields.length < 2) return null;
  return { windowSeconds, timeDeltaSeconds, matchedFields };
}

function correlationEngine(repository, windowSeconds = CORRELATION_WINDOW_SECONDS) {
  return {
    async evaluate(alert, db = undefined) {
      return repository.withLock(async client => {
        const candidates = await repository.candidates(alert, windowSeconds, client);
        const correlations = [];
        for (const candidate of candidates) {
          const evidence = relationship(alert, candidate, windowSeconds);
          if (!evidence) continue;
          const saved = await repository.link(alert.id, candidate.id, evidence, client);
          if (saved) correlations.push({ alertId: candidate.id, ...evidence });
        }
        const groupAlertIds = await repository.group(alert.id, client);
        return { alertId: alert.id, correlations, groupAlertIds };
      }, db);
    },
  };
}

module.exports = { CORRELATION_WINDOW_SECONDS, ENTITY_FIELDS, relationship, correlationEngine };
