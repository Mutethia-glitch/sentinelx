const { DATASET_ID, generateDataset } = require('./dataset');
const { DEFAULT_WINDOW_SECONDS, generateFeatures } = require('./features');
const { MODEL_FEATURES } = require('./model');
const { mlService } = require('./service');

const INTEGRATION_VERSION = '1.0.0';
const SYNTHETIC_DEMO_MODE = 'synthetic-demo';
const MISSING_VALUE = '__sentinelx_missing__';
const EVIDENCE_ROLE = 'supporting-evidence';
const EVIDENCE_STATUSES = new Set(['ready', 'disabled', 'unavailable']);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
function safeIso(now) {
  const value = typeof now === 'function' ? now() : now;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Invalid ML integration clock.');
  return date.toISOString();
}
function canonicalRecord(record) {
  return {
    recordId: record.recordId,
    timestamp: record.timestamp,
    type: record.type,
    sourceIp: record.sourceIp ?? null,
    user: record.user ?? null,
    host: record.host ?? null,
    action: record.action ?? MISSING_VALUE,
    status: record.status ?? MISSING_VALUE,
  };
}
function historicalEvidence() {
  return { status: 'historical', role: EVIDENCE_ROLE, note: 'No ML evidence snapshot was stored when this alert was created.' };
}
function mlEvidenceView(matchEvidence) {
  const stored = matchEvidence && typeof matchEvidence === 'object' && !Array.isArray(matchEvidence) ? matchEvidence.ml : null;
  if (!stored) return historicalEvidence();
  if (typeof stored !== 'object' || Array.isArray(stored) || !EVIDENCE_STATUSES.has(stored.status)) {
    return { status: 'unavailable', role: EVIDENCE_ROLE, note: 'Stored ML evidence is unavailable.' };
  }
  return structuredClone(stored);
}
function matchEvidenceView(matchEvidence) {
  const base = matchEvidence && typeof matchEvidence === 'object' && !Array.isArray(matchEvidence) ? structuredClone(matchEvidence) : {};
  base.ml = mlEvidenceView(matchEvidence);
  return base;
}
function mlIntegration({ mode = process.env.SENTINELX_ML_MODE, now = () => new Date() } = {}) {
  const configured = mode === undefined || mode === null || mode === '' || mode === 'disabled' ? 'disabled' : mode;
  let state = configured === 'disabled' ? 'disabled' : 'unavailable';
  let service = null; let model = null;
  if (configured === SYNTHETIC_DEMO_MODE) {
    try {
      const pipeline = generateFeatures(generateDataset(), { windowSeconds: DEFAULT_WINDOW_SECONDS });
      const training = { ...pipeline, rows: pipeline.rows.slice(0, 40) };
      service = mlService();
      const fitted = service.fit(training);
      if (fitted.status === 'ready') { model = fitted.model; state = 'ready'; }
    } catch { state = 'unavailable'; service = null; model = null; }
  }
  const provenance = configured === SYNTHETIC_DEMO_MODE ? {
    source: 'Task 31/32 accepted synthetic baseline', datasetId: DATASET_ID,
    trainingRecordRange: 'SX-ML-0001..SX-ML-0040', syntheticOnly: true,
  } : null;
  function base(saved, status) {
    const snapshot = {
      integrationVersion: INTEGRATION_VERSION, status, role: EVIDENCE_ROLE,
      mode: configured === SYNTHETIC_DEMO_MODE ? configured : (configured === 'disabled' ? 'disabled' : 'unsupported'),
      triggerEventId: saved?.id ?? null, triggerEventTimestamp: saved?.event?.timestamp ?? null,
    };
    if (model) snapshot.model = {
      kind: model.modelKind, version: model.modelVersion, pipelineVersion: model.pipelineVersion,
      windowSeconds: model.windowSeconds, trainingCount: model.trainingCount, featureNames: [...model.featureNames],
    };
    if (provenance) snapshot.provenance = structuredClone(provenance);
    return snapshot;
  }
  return {
    requiresHistory() { return state === 'ready'; },
    snapshot(saved) { return deepFreeze(base(saved, state === 'ready' ? 'unavailable' : state)); },
    unavailable(saved) { const result = base(saved, 'unavailable'); result.attemptedAt = safeIso(now); return deepFreeze(result); },
    score(saved, records) {
      if (state !== 'ready' || !service || !model || !saved?.id || !saved.event || !Array.isArray(records)) return this.unavailable(saved);
      try {
        const pipeline = generateFeatures(records.map(canonicalRecord), { windowSeconds: DEFAULT_WINDOW_SECONDS });
        const featureRow = pipeline.rows.find(row => row.recordId === saved.id && row.timestamp === saved.event.timestamp);
        if (!featureRow) return this.unavailable(saved);
        const result = service.score(pipeline);
        if (result.status !== 'ready') return this.unavailable(saved);
        const score = result.scores.find(row => row.recordId === saved.id && row.timestamp === saved.event.timestamp);
        if (!score) return this.unavailable(saved);
        const snapshot = base(saved, 'ready');
        snapshot.scoredAt = safeIso(now); snapshot.anomalyScore = score.anomalyScore; snapshot.distance = score.distance;
        snapshot.featureCounts = Object.fromEntries(MODEL_FEATURES.map(name => [name, featureRow.features[name]]));
        snapshot.featureContext = {
          utcHour: featureRow.features.utcHour, utcDayOfWeek: featureRow.features.utcDayOfWeek,
          historyPolicy: '[trigger - 15 minutes, trigger); equal timestamps excluded',
        };
        return deepFreeze(snapshot);
      } catch { return this.unavailable(saved); }
    },
  };
}

module.exports = { INTEGRATION_VERSION, SYNTHETIC_DEMO_MODE, MISSING_VALUE, mlIntegration, mlEvidenceView, matchEvidenceView };
