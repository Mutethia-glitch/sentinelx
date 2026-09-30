const CORRELATION_WINDOW_SECONDS = 900;
const ENTITY_FIELDS = Object.freeze(['user', 'sourceIp', 'host']);

function relationship(current, candidate, windowSeconds = CORRELATION_WINDOW_SECONDS) {
  if (!current?.id || !candidate?.id || current.id === candidate.id) return null;
  const currentTime = Date.parse(current.timestamp);
  const candidateTime = Date.parse(candidate.timestamp);
  if (!Number.isFinite(currentTime) || !Number.isFinite(candidateTime) || candidateTime > currentTime) return null;
  const timeDeltaSeconds = Math.floor((currentTime - candidateTime) / 1000);
  if (timeDeltaSeconds > windowSeconds) return null;
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
      const candidates = await repository.candidates(alert, windowSeconds, db);
      const correlations = [];
      for (const candidate of candidates) {
        const evidence = relationship(alert, candidate, windowSeconds);
        if (!evidence) continue;
        const saved = await repository.link(alert.id, candidate.id, evidence, db);
        if (saved) correlations.push({ alertId: candidate.id, ...evidence });
      }
      const groupAlertIds = await repository.group(alert.id, db);
      return { alertId: alert.id, correlations, groupAlertIds };
    },
  };
}

module.exports = { CORRELATION_WINDOW_SECONDS, ENTITY_FIELDS, relationship, correlationEngine };
