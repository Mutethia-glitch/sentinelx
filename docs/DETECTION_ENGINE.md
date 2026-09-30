# Deterministic detection engine — Task 13

Task 13 implements SentinelX's required rule-based detection foundation. It runs
after canonical normalization and before later alert-correlation/incident work.
No machine learning, external SIEM, destructive response action or third-party API
is involved.

## Execution path

For authenticated canonical and supported raw ingestion:

```
Event -> Normalization -> PostgreSQL event write -> Rule evaluation -> Alert write
```

The event write, `EVENT_INGESTED` audit record and any generated alerts execute
inside the same PostgreSQL transaction. If rule evaluation or alert persistence
fails, the transaction is rolled back and ingestion returns the existing sanitized
503 response. This avoids a committed event whose required deterministic alert was
lost during the same ingestion attempt.

Only enabled rules with the exact persisted schema-v1 definition are executable.
Legacy, malformed or unsupported definitions are skipped rather than guessed.
Task 13 does not install production rules; Task 14 owns the initial approved rule set.

## Matching semantics

All configured conditions are conjunctive (AND). Evaluation uses only the canonical
normalized fields already approved by Task 12: `source`, `type`, `sourceIp`,
`destinationIp`, `user`, `host`, `action`, `status` and `severity`.

- `equals`: literal equality, including null.
- `notEquals`: literal inequality; null follows PostgreSQL `IS DISTINCT FROM` semantics.
- `in`: literal membership in the configured bounded set, including optional null.
- `exists`: tests whether the normalized field is non-null.

There is no regex, script execution, dynamic SQL, arbitrary JSON selector, fuzzy
matching or case folding.

For a matching trigger event, the engine selects matching normalized events whose
`occurred_at` timestamps are no later than the trigger and no older than the
configured `windowSeconds`. Configured `groupBy` fields must match the trigger
event exactly, including null. An empty group is global.

When at least `threshold` events exist in that group/window, the latest threshold
events become the alert evidence. Re-processing the same trigger event for the same
rule is idempotent: SentinelX derives a deterministic alert UUID from the rule id
and trigger event id and inserts it with `ON CONFLICT (id) DO NOTHING`. A later
matching trigger event produces a different deterministic alert id and may
legitimately create another alert; correlation across distinct alerts belongs to
later tasks.

The detection engine can run inside the ingestion transaction or outside an
existing transaction. When no transaction client is supplied, repository methods
use their configured PostgreSQL pool.

## Alert persistence

Task 13 uses the existing `alerts` and `alert_events` tables from migration 001.
No new migration or external service is required. Generated alerts persist:

- the matched rule identifier;
- the rule threat level;
- a deterministic human-readable match reason;
- evidence containing category code, trigger event id, threshold, window, group fields/values and the selected event ids;
- one `alert_events` link for each selected evidence event.

The ingestion HTTP receipt includes `alertsGenerated`.

## Verification

Pure automated checks are included in `tests/rules/detection.test.js` and
`tests/rules/detection-repository.test.js`. PostgreSQL integration coverage is in
`tests/integration/detection.test.js`.

The local Windows/PostgreSQL acceptance verifier is:

```powershell
node scripts/migrate.js
npm.cmd run verify:detection
```

It creates synthetic rule/event/alert data, verifies matching, non-matching,
threshold, event-time window, grouping, duplicate-trigger suppression, persisted
evidence and transaction rollback, then removes its synthetic records and restores
the prior BRUTE_FORCE category enabled state. It never reads or prints application
credentials.

Windows/PostgreSQL acceptance verification passed on 2026-09-30 with:

`Deterministic matching, non-match rejection, thresholds, grouping, windows, duplicate suppression and atomic rollback verified.`

Task 13 is Complete and requires no external API key.
