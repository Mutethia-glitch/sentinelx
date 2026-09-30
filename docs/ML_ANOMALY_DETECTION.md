# Task 31 — Learned baseline anomaly service

`src/ml/model.js` implements a standardized baseline-distance model; it is not
Isolation Forest. The contract permits one documented approach. This small,
dependency-free one-class statistical learning method fits a mean and population
standard deviation for each of Task 30's five behavioral count features.
Each scale is floored at 1 count to handle constant training features.
Training needs at least two rows and sorts by record ID for reproducibility.

For each count x, compute z = (x - fitted mean) / fitted scale. Distance d is
sqrt(mean(z squared)) over five counts; anomalyScore = d / (1 + d).
Scores range from 0 toward 1; larger means farther from the learned baseline.
This is neither an attack probability nor evidence of maliciousness. Model
metadata pins the schema, feature order, window, training size and model version.
Model objects can be serialized as JSON and validated before scoring.

UTC hour and weekday are validated but excluded: their integer codes are cyclic
categories, not meaningful linear distances. Labels, scenario, severity and raw
identities do not enter fitting/scoring. Training data selection must be explicit;
the model does not use labels to select rows or automatically fit on production.
Correlated counts may be counted multiple times. Mean/variance estimates are
sensitive to contamination, and this method cannot learn nonlinear relationships.

`src/ml/service.js` exposes synchronous in-memory `mlService({ enabled })`,
`fit(pipeline)` and `score(pipeline)`. Status is ready, disabled or unavailable.
Failed fits clear the old model; failed scoring returns an empty scores array,
never a misleading zero/benign score. Errors and input contents are not exposed.
The service retains its own model copy. Disabled calls do not train or score.

Task 31 itself remains a research service module with no HTTP endpoint, external API,
package dependency or migration. Task 33 now imports it through the guarded
evidence-only adapter documented in ML_INTEGRATION.md. The adapter runs only after
a deterministic rule qualifies, stores a snapshot in existing alert JSON, and
uses savepoint recovery so recoverable optional-ML SQL failures do not replace
normal rule evaluation. Alert severity/confidence, incident risk and automatic
response behavior are not changed by ML.

Run `npm.cmd run verify:ml:model` and `npm.cmd run quality` on Windows.
The verifier covers bounded scores, deterministic training, schema validation,
unavailable/disabled behavior and protection against stale or mutated models.
Task 31 is Complete following Windows acceptance on 2026-09-30.

## Local acceptance — 2026-09-30

The user reported successful Windows `verify:ml:model` and `verify:ml:evaluation`
output. Evaluation reproduced TP 12, TN 10, FP 0, FN 8 on 30 synthetic held-out
records (accuracy 0.7333333333333333, precision 1, recall 0.6, F1 0.75).
Together with the recorded automated quality suite of 161/161, these results
satisfy local acceptance for Tasks 31 and 32. No separate Windows quality-suite
output was supplied in this acceptance message. Task 33 is Implemented — awaiting local acceptance; see ML_INTEGRATION.md.
