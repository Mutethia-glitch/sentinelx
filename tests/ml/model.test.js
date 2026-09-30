const test = require('node:test');
const assert = require('node:assert/strict');
const { generateDataset } = require('../../src/ml/dataset');
const { generateFeatures } = require('../../src/ml/features');
const { fitModel, scoreModel } = require('../../src/ml/model');
const { mlService } = require('../../src/ml/service');
const { verifyMlModel } = require('../../scripts/verify-ml-model');
function pipeline(values) {
  return { ...generateFeatures([]), rows: values.map((value, index) => ({
    recordId: 'row-' + index, timestamp: '2026-01-01T00:00:00.000Z',
    features: { userLoginCount: value, userFailedLoginCount: value,
      sourceIpEventCount: value, hostEventCount: value, eventCount: value,
      utcHour: 0, utcDayOfWeek: 4 }
  })) };
}
test('learns mean/population scale and produces the documented distance and bounded score', () => {
  const model = fitModel(pipeline([0, 4]));
  assert.deepEqual(model.means, [2, 2, 2, 2, 2]);
  assert.deepEqual(model.scales, [2, 2, 2, 2, 2]);
  const scores = scoreModel(model, pipeline([2, 4, 8]));
  assert.equal(scores[0].distance, 0);
  assert.equal(scores[0].anomalyScore, 0);
  assert.equal(scores[1].distance, 1);
  assert.equal(scores[1].anomalyScore, 0.5);
  assert.equal(scores[2].anomalyScore, 0.75);
});
test('constant baseline has finite scales and high deviations rank higher', () => {
  const model = fitModel(pipeline([0, 0]));
  assert.deepEqual(model.scales, [1, 1, 1, 1, 1]);
  const scores = scoreModel(model, pipeline([0, 1, 10, Number.MAX_SAFE_INTEGER]));
  assert.ok(scores.every(row => Number.isFinite(row.anomalyScore) && row.anomalyScore < 1));
  assert.ok(scores[2].anomalyScore > scores[1].anomalyScore);
});
test('fit is reproducible, JSON round trips score identically, and inputs stay unchanged', () => {
  const input = pipeline([0, 2, 10]), before = structuredClone(input);
  const model = fitModel(input), snapshot = structuredClone(model);
  assert.deepEqual(model, fitModel({ ...input, rows: [...input.rows].reverse() }));
  assert.deepEqual(scoreModel(JSON.parse(JSON.stringify(model)), input), scoreModel(model, input));
  assert.deepEqual(input, before);
  assert.deepEqual(model, snapshot);
});
test('research labels and categorical UTC timing cannot influence model scores', () => {
  const records = generateDataset(), original = generateFeatures(records);
  const changed = generateFeatures(records.map(row => ({ ...row, label: 1 - row.label, scenario: 'changed', severity: 'CRITICAL' })));
  const model = fitModel({ ...original, rows: original.rows.slice(0, 40) });
  changed.rows.forEach(row => { row.features.utcHour = 23; row.features.utcDayOfWeek = 6; });
  assert.deepEqual(scoreModel(model, original), scoreModel(model, changed));
});
test('rejects malformed schema, incompatible windows, nonfinite counts and corrupt models', () => {
  const good = pipeline([0, 1]), model = fitModel(good);
  for (const bad of [null, pipeline([]), pipeline([0]), { ...good, pipelineVersion: 'future' },
    { ...good, featureNames: [...good.featureNames].reverse() }]) assert.throws(() => fitModel(bad), TypeError);
  for (const value of [NaN, Infinity, -1, 1.5, '1']) {
    const bad = structuredClone(good); bad.rows[0].features.eventCount = value;
    assert.throws(() => scoreModel(model, bad), TypeError);
  }
  const duplicate = structuredClone(good); duplicate.rows[1].recordId = duplicate.rows[0].recordId;
  assert.throws(() => fitModel(duplicate), TypeError);
  assert.throws(() => scoreModel(model, { ...good, windowSeconds: 60 }), TypeError);
  for (const bad of [null, { ...model, modelVersion: 'future' }, { ...model, scales: [0, 1, 1, 1, 1] },
    { ...model, means: [NaN, 0, 0, 0, 0] }, { ...model, trainingCount: 1 }]) {
    assert.throws(() => scoreModel(bad, good), TypeError);
  }
});
test('safe service returns no score on failures, clears stale refits and owns its model', () => {
  const service = mlService(), input = pipeline([0, 1]);
  assert.deepEqual(service.score(input), { status: 'unavailable', scores: [] });
  const fitted = service.fit(input), expected = service.score(input);
  fitted.model.means.fill(999);
  assert.deepEqual(service.score(input), expected);
  assert.deepEqual(service.score({ secret: 'must-not-appear' }), { status: 'unavailable', scores: [] });
  assert.deepEqual(service.score(input), expected);
  assert.deepEqual(service.fit(null), { status: 'unavailable', scores: [] });
  assert.equal(service.score(input).status, 'unavailable');
  assert.deepEqual(mlService({ enabled: false }).score(input), { status: 'disabled', scores: [] });
});
test('read-only synthetic model verifier passes', () => { assert.equal(verifyMlModel(), true); });
