# Alert correlation — Task 17

Task 17 implements deterministic, explainable alert-to-alert correlation between
the Alert and Incident stages. It does not create incidents, change alert status,
or merge underlying alerts/events.

## Correlation rule

SentinelX evaluates a newly generated alert against visible alerts whose generation
timestamps differ by at most 15 minutes (900 seconds), in either direction. This
also covers concurrent transactions that commit in a different timestamp order.

Two alerts correlate only when all of the following are true:

1. the alerts have different identifiers;
2. the absolute time delta is at most 900 seconds;
3. at least two relationship signals match from:
   - user
   - sourceIp
   - host
   - threat category
4. at least one of the matches is an entity field (user, sourceIp, or host).

This deliberately rejects category-only correlation. A broad category such as
MALWARE or BRUTE_FORCE is not enough by itself to claim that two alerts are part
of the same activity.

The rule also permits cross-category correlation when two entity relationships
match. For example, a credential alert and a privilege alert for the same user
and host can correlate even though their categories differ.

Destination IP is retained on the alert model but is not a Task 17 relationship
signal. The task contract names user, source IP, host, category and time as the
approved core relationships, so Task 17 does not silently expand that set.

## Explainability

Every stored relationship records:

- matchedFields: the exact relationship fields that matched;
- timeDeltaSeconds: elapsed time between the two alerts;
- windowSeconds: the configured deterministic window (900).

No score, probability, machine-learning feature, fuzzy similarity, or opaque
weighting is used.

## Grouping

Correlation relationships form an undirected graph. A correlation group is the
connected component containing an alert.

This means A may correlate with B and A may correlate with C, producing the group
A/B/C even when B and C do not directly satisfy the pairwise rule. The individual
stored edges retain the evidence explaining why the group is connected.

Correlation is not an Incident. Task 18 owns incident creation/lifecycle.

## Pair deduplication

Append-only migration `010_alert_correlation.sql` creates
`alert_correlations`.

Each row stores one unordered alert pair in canonical UUID order. PostgreSQL
enforces:

- both alert foreign keys;
- different/canonical alert IDs;
- JSON-object relationship evidence;
- a unique alert pair.

The repository also uses `ON CONFLICT DO NOTHING`, so reevaluating the same alert
does not duplicate an existing relationship. Reverse-direction inserts are
rejected by the canonical-order constraint.

## Runtime integration

The Task 13 detection engine accepts the Task 17 correlator as an optional
dependency. In the production server it is enabled.

When event ingestion creates a new alert, correlation executes with the same
PostgreSQL transaction client. A correlation failure therefore propagates through
the normal ingestion transaction instead of being silently ignored.

If alert creation is duplicate-suppressed and returns no new alert, correlation is
not rerun for that duplicate trigger.

Task 17 does not backfill historical alerts automatically. Migration 010 adds the
relationship structure; newly generated alerts are correlated from that point
forward. Historical correlation can be an explicit future administrative workflow
if approved rather than silently rewriting historical relationships during a
schema migration.

## Tests

Pure tests cover:

- same-category plus entity matching;
- cross-category two-entity matching;
- rejection of category-only and single-entity relationships;
- 15-minute window rejection;
- reversed timestamp order and fractional window-overflow rejection;
- connected grouping;
- canonical pair normalization;
- duplicate-safe pair persistence;
- sanitized repository failures;
- detection-pipeline invocation and rollback propagation.

The focused Task 13/17 pre-push suite passed 14/14.

PostgreSQL integration coverage is:

```powershell
$env:SENTINELX_TEST_DATABASE='1'
npm.cmd run test:correlation:integration
```

## Windows/PostgreSQL acceptance

Run:

```powershell
git pull origin main
npm.cmd run quality
node scripts/migrate.js
npm.cmd run verify:correlation
```

Expected verifier output:

`Explainable alert correlation, connected grouping, time-window rejection and pair deduplication verified. Synthetic changes rolled back.`

The verifier creates synthetic rules/events/alerts inside one database transaction
and rolls everything back. It validates same-category correlation, cross-category
entity correlation, category-only rejection, time-window rejection, connected
groups, duplicate-pair rejection and reverse-pair rejection.

No external API or API key is required.


## Completion

Task 17 is Complete. Focused Task 13/17 tests passed 14/14, and the
Windows/PostgreSQL acceptance verifier passed on 2026-09-30 with:

`Explainable alert correlation, connected grouping, time-window rejection and pair deduplication verified. Synthetic changes rolled back.`

Task 18 incident management remains separate. No external API or
API key is required.

## Concurrent ingestion correction — 2026-09-30

Correlation evaluation acquires PostgreSQL transaction advisory lock 73482117
before reading candidates and holds it until the enclosing ingestion transaction
commits or rolls back. In the production READ COMMITTED transaction, a waiting
evaluator then sees the first evaluator's committed alerts. Candidate lookup and
relationship checks use the same symmetric, exact 900-second boundary; canonical
pair uniqueness still prevents duplicate edges. Standalone evaluation uses its
own transaction and rolls back on failure. No migration is required.

This deliberately serializes correlation evaluation across ingestion transactions;
it is a small-system correctness choice and can increase wait time under load.
Existing statement/query timeout behavior still applies. Historical relationships
are not automatically rebuilt.

The regression verifier runs two PostgreSQL transactions, proves the second waits
for the first to commit, then confirms one canonical edge and one connected group.
It explicitly makes the waiting alert older than the first committed alert and
checks repeated evaluation does not create another edge. Its uniquely identified
synthetic records are removed in finally; no existing configuration is altered.
Run in the PowerShell window with PostgreSQL connection variables:

```powershell
npm.cmd run verify:correlation:concurrency
```

Expected: `Concurrent correlation blocking, reversed timestamp order, connected grouping and pair deduplication verified. Synthetic changes cleaned up.`
