const { createHash } = require('node:crypto');
const { DATASET_ID, generateDataset, jsonl } = require('./dataset');
const { generateFeatures } = require('./features');
const { fitModel, scoreModel } = require('./model');

function classificationMetrics(labels, predictions) {
  if (!Array.isArray(labels) || !Array.isArray(predictions) || labels.length !== predictions.length ||
      labels.some(x => x !== 0 && x !== 1) || predictions.some(x => x !== 0 && x !== 1)) {
    throw new TypeError('Invalid evaluation labels or predictions.');
  }
  let tp = 0, tn = 0, fp = 0, fn = 0;
  labels.forEach((label, i) => {
    if (label === 1) { if (predictions[i] === 1) tp++; else fn++; }
    else if (predictions[i] === 1) fp++; else tn++;
  });
  const ratio = (a, b) => b === 0 ? null : a / b;
  return { count: labels.length, tp, tn, fp, fn, accuracy: ratio(tp + tn, labels.length),
    precision: ratio(tp, tp + fp), recall: ratio(tp, tp + fn),
    f1: ratio(2 * tp, 2 * tp + fp + fn), falsePositiveRate: ratio(fp, fp + tn) };
}

// Fixed Task 29 experiment. No test labels participate in fitting or threshold selection.
function evaluateModel() {
  const records = generateDataset();
  const pipeline = generateFeatures(records);
  const subset = (start, end) => ({ ...pipeline, rows: pipeline.rows.slice(start, end) });
  const training = subset(0, 40), calibration = subset(40, 50), testing = subset(50, 80);
  const model = fitModel(training);
  const threshold = Math.max(...scoreModel(model, calibration).map(row => row.anomalyScore));
  const byId = new Map(records.map(row => [row.recordId, row]));
  const rows = scoreModel(model, testing).map(row => ({ ...row,
    label: byId.get(row.recordId).label, scenario: byId.get(row.recordId).scenario,
    prediction: row.anomalyScore > threshold ? 1 : 0 }));
  const summarize = items => classificationMetrics(items.map(r => r.label), items.map(r => r.prediction));
  const perScenario = {};
  for (const scenario of [...new Set(rows.map(row => row.scenario))].sort()) {
    perScenario[scenario] = summarize(rows.filter(row => row.scenario === scenario));
  }
  const split = items => ({ count: items.rows.length, recordIds: items.rows.map(row => row.recordId) });
  return { evaluationVersion: '1.0.0', datasetId: DATASET_ID,
    datasetSha256: createHash('sha256').update(jsonl(records)).digest('hex'),
    split: { training: split(training), calibration: split(calibration), test: split(testing) },
    historyPolicy: 'Prior-only history crosses split boundaries; timestamp ties excluded.',
    model, threshold, thresholdPolicy: 'Strictly greater than maximum calibration score.',
    metrics: summarize(rows), perScenario, rows,
    limitations: [
      'Only 80 artificial records; held-out test has 10 baseline and 20 injected anomalies.',
      'Chronological scenario blocks are confounded with time and are not independent samples.',
      'Training is baseline authentication only; calibration is baseline network only.',
      'Prior-only counts can miss the first event and transfer-volume anomalies: no byte-volume feature exists.',
      'No real-world accuracy, prevalence, maliciousness or operational readiness claim.',
      'Threshold uses only 10 calibration examples; no cross-validation or uncertainty estimate.'
    ] };
}
module.exports = { classificationMetrics, evaluateModel };
