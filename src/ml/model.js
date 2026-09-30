const { PIPELINE_VERSION, FEATURE_NAMES } = require('./features');
const MODEL_VERSION = '1.0.0';
const MODEL_KIND = 'standardized-baseline-distance';
const MODEL_FEATURES = Object.freeze(FEATURE_NAMES.slice(0, 5));
const SCALE_FLOOR = 1;

function invalid() { throw new TypeError('Invalid ML research input or model.'); }
function validTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}
function validatePipeline(pipeline) {
  if (!pipeline || pipeline.pipelineVersion !== PIPELINE_VERSION ||
      !Number.isSafeInteger(pipeline.windowSeconds) || pipeline.windowSeconds <= 0 ||
      !Number.isSafeInteger(pipeline.windowSeconds * 1000) ||
      !Array.isArray(pipeline.featureNames) ||
      JSON.stringify(pipeline.featureNames) !== JSON.stringify(FEATURE_NAMES) ||
      !Array.isArray(pipeline.rows)) invalid();
  const ids = new Set();
  for (const row of pipeline.rows) {
    if (!row || typeof row.recordId !== 'string' || !row.recordId.trim() ||
        ids.has(row.recordId) || !validTimestamp(row.timestamp) ||
        !row.features || Array.isArray(row.features) ||
        Object.keys(row.features).sort().join(',') !== [...FEATURE_NAMES].sort().join(',')) invalid();
    ids.add(row.recordId);
    if (MODEL_FEATURES.some(name => !Number.isSafeInteger(row.features[name]) || row.features[name] < 0) ||
        !Number.isInteger(row.features.utcHour) || row.features.utcHour < 0 || row.features.utcHour > 23 ||
        !Number.isInteger(row.features.utcDayOfWeek) || row.features.utcDayOfWeek < 0 ||
        row.features.utcDayOfWeek > 6) invalid();
  }
  return pipeline;
}
function fitModel(pipeline) {
  validatePipeline(pipeline);
  if (pipeline.rows.length < 2) invalid();
  // Canonical ordering makes floating-point fitting independent of input order.
  const rows = [...pipeline.rows].sort((a, b) =>
    a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0);
  const means = [], scales = [];
  for (const name of MODEL_FEATURES) {
    let mean = 0, m2 = 0, count = 0;
    for (const row of rows) {
      count++;
      const delta = row.features[name] - mean;
      mean += delta / count;
      m2 += delta * (row.features[name] - mean);
    }
    means.push(mean);
    scales.push(Math.max(SCALE_FLOOR, Math.sqrt(Math.max(0, m2 / rows.length))));
  }
  const model = { modelKind: MODEL_KIND, modelVersion: MODEL_VERSION,
    pipelineVersion: PIPELINE_VERSION, windowSeconds: pipeline.windowSeconds,
    featureNames: [...MODEL_FEATURES], trainingCount: rows.length,
    scaleFloor: SCALE_FLOOR, means, scales };
  validateModel(model);
  return model;
}
function validateModel(model) {
  if (!model || model.modelKind !== MODEL_KIND || model.modelVersion !== MODEL_VERSION ||
      model.pipelineVersion !== PIPELINE_VERSION || model.scaleFloor !== SCALE_FLOOR ||
      !Number.isSafeInteger(model.windowSeconds) || model.windowSeconds <= 0 ||
      !Number.isSafeInteger(model.windowSeconds * 1000) ||
      !Number.isSafeInteger(model.trainingCount) || model.trainingCount < 2 ||
      JSON.stringify(model.featureNames) !== JSON.stringify(MODEL_FEATURES) ||
      !Array.isArray(model.means) || !Array.isArray(model.scales) ||
      model.means.length !== MODEL_FEATURES.length || model.scales.length !== MODEL_FEATURES.length ||
      model.means.some(value => !Number.isFinite(value) || value < 0) ||
      model.scales.some(value => !Number.isFinite(value) || value < SCALE_FLOOR)) invalid();
  return model;
}
function scoreModel(model, pipeline) {
  validateModel(model);
  validatePipeline(pipeline);
  if (model.windowSeconds !== pipeline.windowSeconds) invalid();
  return pipeline.rows.map(row => {
    const residuals = MODEL_FEATURES.map((name, index) =>
      (row.features[name] - model.means[index]) / model.scales[index]);
    const distance = Math.hypot(...residuals) / Math.sqrt(MODEL_FEATURES.length);
    const anomalyScore = distance / (1 + distance);
    if (!Number.isFinite(distance) || !Number.isFinite(anomalyScore)) invalid();
    return { recordId: row.recordId, timestamp: row.timestamp, distance, anomalyScore };
  });
}
module.exports = { MODEL_VERSION, MODEL_KIND, MODEL_FEATURES, SCALE_FLOOR,
  validatePipeline, fitModel, validateModel, scoreModel };
