# Task 30 — ML feature engineering

`src/ml/features.js` provides the pure research pipeline
`generateFeatures(records, { windowSeconds: 900 })`. It consumes the Task 29
normalized-style synthetic records and returns a versioned numeric feature schema
and rows linked by `recordId` and `timestamp`. Input records are never modified.
No model is trained, evaluated or connected to production detection in Task 30.

## Window and grouping decisions

The smallest interpretation of frequency is a count in a fixed window, rather
than a fitted rate or learned baseline. Default window: 900 seconds (15 minutes).
For an event at time t, counts use [t - window, t): the lower boundary is included,
the current event and all equal-timestamp events are excluded. Only records
provided to this call supply history; the first window can be incomplete.

Rows are sorted by timestamp then lexicographic record ID, independently of input
order. Timestamp cohorts are extracted together before their counts are added.
Sorting costs O(n log n); sliding count maintenance and extraction cost O(n).
Identity grouping is exact and case-sensitive, without fitting or encoding IDs.

| Feature | Meaning |
|---|---|
| userLoginCount | Earlier events for the same user with type authentication and action login |
| userFailedLoginCount | Those login events whose status is failed |
| sourceIpEventCount | Earlier events with the same sourceIp, across event types |
| hostEventCount | Earlier events with the same host, across event types |
| eventCount | All earlier events in the supplied history window |
| utcHour | Current event hour, 0–23, in UTC |
| utcDayOfWeek | Current event weekday, Sunday 0 through Saturday 6, in UTC |

Counts are nonnegative integers. UTC timing values are numeric categories; Task 30
does not claim these are optimal model encodings. `featureNames` fixes vector order;
`pipelineVersion` and `windowSeconds` make the configuration explicit.

## Validation and research boundaries

Required string fields: recordId, timestamp, type, action, status. IDs must be
unique. Timestamp must be canonical UTC ISO format, for example
`2026-01-01T00:00:00.000Z`. User, host and sourceIp must be nonempty strings or
explicit null. Null identities yield zero in their grouped features and are never
pooled into a shared unknown entity. Missing fields and malformed input are
rejected with fixed messages that do not echo record contents. Window seconds
must be a positive integer whose millisecond value is also a safe integer.
Empty input yields an empty result with the same schema metadata.

Only consumed behavioral fields are copied. Labels, scenario, severity, source
names and any extra fields do not affect the vectors. Record IDs and timestamps
are linkage metadata outside `features`; identities are never numeric predictors.
Keep labels separately for future research. When a future task defines dataset
splits, decide whether preceding history may cross a split boundary explicitly;
this pipeline does not perform splitting, scaling, training or evaluation.

The Task 29 fixture has sparse fixed-interval behavior, deliberately injected
scenarios and artificial identities. These features do not establish real-world
accuracy, attack prevalence or operational detection performance.

The pipeline imports no database, production detection, API or credential module.
No migration, new dependency, external API or API key is needed.

## Verification and acceptance

The quality suite includes boundary, tie, identity, missing-value, input-order,
immutability, leakage, UTC, configurable-window and invalid-input regressions.
`verify:features` first verifies the checked-in Task 29 dataset, then compares every
feature row against an independent direct-count oracle and reversed-input output.
Its text reader supports LF and Windows CRLF checkouts. Both verifiers are read-only.

```powershell
git pull --ff-only origin main
npm.cmd run quality
if ($LASTEXITCODE -ne 0) { throw 'Quality checks failed' }
npm.cmd run verify:dataset
if ($LASTEXITCODE -ne 0) { throw 'Dataset verification failed' }
npm.cmd run verify:features
if ($LASTEXITCODE -ne 0) { throw 'Feature verification failed' }
```

Expected feature verifier output:

`Reproducible behavioral features, prior-only windows, numeric schema and synthetic dataset compatibility verified.`

Task 30 is **Complete**. The user reported successful Windows dataset and feature
verifiers on 2026-09-30. Together with the recorded 149/149 automated quality
checks and simulated CRLF verification, this satisfies Task 30 acceptance.
Task 31 is Not Started.
