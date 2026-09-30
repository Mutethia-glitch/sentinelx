const assert = require('node:assert/strict');
const { generateDataset } = require('../src/ml/dataset');
const { generateFeatures } = require('../src/ml/features');
const { fitModel, scoreModel } = require('../src/ml/model');
const { mlService } = require('../src/ml/service');
const { verifyFeatures } = require('./verify-features');
function verifyMlModel() {
  verifyFeatures();
  const pipeline = generateFeatures(generateDataset());
  const training = { ...pipeline, rows: pipeline.rows.slice(0, 40) };
  const model = fitModel(training);
  assert.deepEqual(model, fitModel({ ...training, rows: [...training.rows].reverse() }));
  const scores = scoreModel(model, pipeline);
  assert.equal(scores.length, 80);
  for (const row of scores) {
    assert.ok(Number.isFinite(row.distance));
    assert.ok(row.anomalyScore >= 0 && row.anomalyScore < 1);
  }
  const service = mlService();
  assert.equal(service.score(pipeline).status, 'unavailable');
  const fitted = service.fit(training);
  assert.equal(fitted.status, 'ready');
  fitted.model.means.fill(1000);
  assert.deepEqual(service.score(pipeline).scores, scores);
  assert.deepEqual(service.score(null), { status: 'unavailable', scores: [] });
  assert.equal(service.fit(null).status, 'unavailable');
  assert.equal(service.score(pipeline).status, 'unavailable');
  assert.deepEqual(mlService({ enabled: false }).fit(training), { status: 'disabled', scores: [] });
  return true;
}
if (require.main === module) {
  verifyMlModel();
  console.log('Learned baseline anomaly scores, reproducibility, schema validation and safe unavailable/disabled behavior verified.');
}
module.exports = { verifyMlModel };
