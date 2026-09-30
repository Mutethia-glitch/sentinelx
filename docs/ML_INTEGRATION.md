# Task 33 — ML integration

Task 33 integrates the existing Task 31 anomaly model as **supporting evidence only** after a deterministic detection rule has already qualified. It does not create alerts by itself, change rule thresholds, alter alert severity/confidence, change incident risk/classification, bypass RBAC/auditing/duplicate suppression, or execute response actions.

## Modes and provenance

ML integration is disabled by default. Set `SENTINELX_ML_MODE=synthetic-demo` explicitly to use the accepted Task 31/32 synthetic baseline. Any other non-disabled value is treated as unavailable. The demo model is fitted from Task 29 records `SX-ML-0001..SX-ML-0040` using the existing Task 30 15-minute feature pipeline and Task 31 model/service. This remains synthetic research evidence, not an attack probability, maliciousness verdict, or production-accuracy claim.

No external API, credential, migration, or new package is introduced.

## Stored alert snapshot

After a deterministic rule meets its threshold, the detection engine computes at most one ML snapshot for that trigger event and reuses it for every alert created from that trigger. The snapshot is stored inside the existing `alerts.match_evidence` JSON under `ml`. Ready snapshots contain the anomaly score, standardized distance, five model feature counts, UTC context, trigger ID/timestamp, score timestamp, integration/model/pipeline versions, training count, and synthetic provenance.

States are `ready`, `disabled`, `unavailable`, and `historical`. Historical means the alert predates Task 33 and has no stored snapshot; historical alerts are never rescored on read. Alert inspection displays the complete match-evidence JSON. Incident inspection displays each linked alert's stored ML state and, when ready, its score.

## History and failure isolation

Production feature history uses normalized security events from the 15 minutes ending at the trigger timestamp. The Task 30 pipeline processes timestamp cohorts together, so the current event and all equal-timestamp events are excluded from each other's history. Nullable production action/status values are mapped only inside feature generation to a non-matching sentinel; stored events are unchanged.

Optional ML history runs inside the existing event transaction behind a PostgreSQL savepoint with a 2-second local statement timeout. A recoverable history SQL error/timeout rolls back and releases that savepoint, stores `unavailable`, and continues normal deterministic alert creation. If savepoint recovery itself fails, the surrounding transaction fails rather than hiding uncertain state.

## Verification and acceptance

Tool-runtime reconstruction checks passed focused Task 33 plus existing deterministic detection/duplicate-suppression/Task 15 alert-persistence regressions before publication. They are not a substitute for Windows/PostgreSQL/browser acceptance.

```powershell
npm.cmd run quality
if ($LASTEXITCODE -ne 0) { throw 'Quality checks failed' }
npm.cmd run verify:ml:model
if ($LASTEXITCODE -ne 0) { throw 'Task 31 model verification failed' }
npm.cmd run verify:ml:evaluation
if ($LASTEXITCODE -ne 0) { throw 'Task 32 evaluation verification failed' }
npm.cmd run verify:ml:integration
if ($LASTEXITCODE -ne 0) { throw 'Task 33 PostgreSQL integration verification failed' }
npm.cmd run test:alerts:ui
if ($LASTEXITCODE -ne 0) { throw 'Alert UI verification failed' }
npm.cmd run test:investigations:ui
if ($LASTEXITCODE -ne 0) { throw 'Incident evidence UI verification failed' }
```

Task 33 remains **Implemented — awaiting local acceptance** until successful local results are supplied.
