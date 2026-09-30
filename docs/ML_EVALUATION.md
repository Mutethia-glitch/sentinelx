# Task 32 — Reproducible synthetic evaluation

Run `npm.cmd run verify:ml:evaluation`. The read-only verifier validates the Task
29 fixture, Task 30 features, Task 31 model and checked-in evaluation report at
`fixtures/ml/task32-evaluation.json`. It permits only 12-significant-digit numeric
comparison rounding for cross-platform math; counts, IDs and labels remain exact.
`src/ml/evaluation.js` exports the pure reproducible experiment and metric helper.
The report includes a canonical dataset SHA-256, full split IDs, fitted parameters,
threshold, per-record held-out scores/predictions and per-scenario confusion counts.

## Fixed protocol

Chronological records 1–40 train the baseline, 41–50 calibrate the threshold, and
51–80 are held out for evaluation. These are disjoint IDs with 40 baseline
authentication training rows, 10 baseline network calibration rows, and 10 baseline
network plus 20 anomaly test rows. No shuffle, random seed or tuned hyperparameter
search is used. This is one deliberately fixed experiment, not cross-validation.

Features retain prior-only history across split boundaries, as available in a
stream. Earlier test events may contribute to later test counts; future events
and tied timestamps cannot. Fit uses training rows only. Threshold is the maximum
calibration anomaly score (approximately 0.06286493151681935); predictions use
strictly greater than this threshold. Test labels only compute metrics. No test
score or label chooses the threshold. Calibration is only 10 examples and does
not establish a population false-positive bound.

## Measured held-out results

| Metric | Result |
|---|---:|
| True positive | 12 |
| True negative | 10 |
| False positive | 0 |
| False negative | 8 |
| Accuracy | 73.33% |
| Precision | 100% |
| Recall | 60% |
| F1 | 0.75 |
| False-positive rate | 0% |

These are computed results on 30 synthetic test rows only. Undefined denominators
return null, never an invented zero. Accuracy = (TP+TN)/N; precision = TP/(TP+FP);
recall = TP/(TP+FN); F1 = 2TP/(2TP+FP+FN); FPR = FP/(FP+TN).

Authentication anomalies: 7/8 flagged. Network discovery anomalies: 5/6 flagged.
Transfer-volume anomalies: 0/6 flagged. First events lack prior anomalous history;
transfer byte volume is absent from the current features. All 10 held-out baseline
network events were unflagged. A predict-baseline-only comparator would achieve
33.33% accuracy and 0% recall on this intentionally anomaly-heavy test split.

## Limitations and acceptance

Only 80 artificial, fixed-interval records exist. Scenario blocks align with time;
rows share history and are not independent. Training does not cover representative
normal network traffic, and the selected counts miss transfer volume entirely.
Constructed class balance, artificial identities, sparse activity and synthetic
labels cannot establish real-world accuracy, prevalence, maliciousness, uncertainty
or operational readiness. No deployment recommendation follows from these metrics.

Tasks 31 and 32 were authorized as a batch and implemented in order. Both passed Windows local
acceptance on 2026-09-30. Task 33 has not started. No external API,
database, credentials, migration or new dependency is required.

```powershell
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw 'Pull failed' }
npm.cmd run quality
if ($LASTEXITCODE -ne 0) { throw 'Quality checks failed' }
npm.cmd run verify:ml:model
if ($LASTEXITCODE -ne 0) { throw 'ML model verification failed' }
npm.cmd run verify:ml:evaluation
if ($LASTEXITCODE -ne 0) { throw 'ML evaluation verification failed' }
```

## Local acceptance — 2026-09-30

The user reported successful Windows `verify:ml:model` and `verify:ml:evaluation`
output. Evaluation reproduced TP 12, TN 10, FP 0, FN 8 on 30 synthetic held-out
records (accuracy 0.7333333333333333, precision 1, recall 0.6, F1 0.75).
Together with the recorded automated quality suite of 161/161, these results
satisfy local acceptance for Tasks 31 and 32. No separate Windows quality-suite
output was supplied in this acceptance message. Task 33 remains Not Started.
