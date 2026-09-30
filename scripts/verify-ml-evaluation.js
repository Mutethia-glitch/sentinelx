const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { evaluateModel } = require('../src/ml/evaluation');
const { verifyMlModel } = require('./verify-ml-model');
function verifyMlEvaluation() {
  verifyMlModel();
  const actual = evaluateModel();
  const expected = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/ml/task32-evaluation.json'), 'utf8'));
  // Permit insignificant cross-platform floating-point differences only.
  const canonical = value => JSON.parse(JSON.stringify(value, (_, x) =>
    typeof x === 'number' ? Number(x.toPrecision(12)) : x));
  assert.deepEqual(canonical(actual), canonical(expected));
  assert.deepEqual(actual, evaluateModel());
  return actual;
}
if (require.main === module) {
  const report = verifyMlEvaluation();
  console.log(JSON.stringify(report.metrics, null, 2));
  console.log('Reproducible held-out ML evaluation, confusion metrics, calibration threshold and synthetic dataset limitations verified.');
}
module.exports = { verifyMlEvaluation };
