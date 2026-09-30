const test = require('node:test');
const assert = require('node:assert/strict');
const { classificationMetrics, evaluateModel } = require('../../src/ml/evaluation');
const { generateDataset } = require('../../src/ml/dataset');
const { generateFeatures } = require('../../src/ml/features');
const { fitModel, scoreModel } = require('../../src/ml/model');
const { verifyMlEvaluation } = require('../../scripts/verify-ml-evaluation');
test('confusion metrics match a hand-calculated mixed example', () => {
  assert.deepEqual(classificationMetrics([1, 1, 0, 0, 0], [1, 0, 1, 0, 0]),
    { count: 5, tp: 1, tn: 2, fp: 1, fn: 1, accuracy: 0.6, precision: 0.5,
      recall: 0.5, f1: 0.5, falsePositiveRate: 1 / 3 });
});
test('undefined metric denominators are null and invalid labels fail', () => {
  assert.equal(classificationMetrics([], []).accuracy, null);
  assert.equal(classificationMetrics([0], [0]).precision, null);
  assert.equal(classificationMetrics([0], [0]).recall, null);
  assert.equal(classificationMetrics([1], [0]).f1, 0);
  for (const args of [[null, []], [[1], []], [[2], [0]], [[1], [true]]]) {
    assert.throws(() => classificationMetrics(...args), TypeError);
  }
});
test('split IDs are disjoint, chronological and complete; threshold is calibration-only', () => {
  const report = evaluateModel(), records = generateDataset();
  const groups = Object.values(report.split).map(group => group.recordIds);
  assert.deepEqual(groups.map(group => group.length), [40, 10, 30]);
  assert.equal(new Set(groups.flat()).size, 80);
  assert.deepEqual(groups.flat(), records.map(row => row.recordId));
  const pipeline = generateFeatures(records.slice(0, 50));
  const model = fitModel({ ...pipeline, rows: pipeline.rows.slice(0, 40) });
  assert.deepEqual(model, report.model);
  assert.equal(report.threshold, Math.max(...scoreModel(model,
    { ...pipeline, rows: pipeline.rows.slice(40) }).map(row => row.anomalyScore)));
  assert.equal(report.metrics.count, 30);
  assert.ok(report.rows.every(row => row.prediction === Number(row.anomalyScore > report.threshold)));
});
test('held-out feature generation cannot change training features through future history', () => {
  const records = generateDataset();
  assert.deepEqual(generateFeatures(records).rows.slice(0, 40), generateFeatures(records.slice(0, 40)).rows);
});
test('checked-in evaluation reproduces and states limitations', () => {
  const report = verifyMlEvaluation();
  assert.ok(report.limitations.length >= 5);
  assert.equal(report.perScenario.transfer_volume_anomaly.tp, 0);
});
