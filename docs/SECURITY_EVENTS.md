# Security event model — Task 07

The internal, vendor-neutral `securityEvent()` model validates canonical events.
Task 07 adds persistence only; ingestion APIs, source authorization, vendor field
mapping, searches and event UI belong to subsequent tasks. The repository is an
internal database boundary, not an API authorization bypass. Future services must
authorize callers before using it.

| Field | Contract |
|---|---|
| timestamp | Required ISO timestamp with explicit timezone; stored as UTC. |
| source, type | Required nonblank text; maximum 500 characters each. |
| sourceIp, destinationIp | Optional IPv4 or IPv6 address; absent values become null. |
| user, host, action, status | Optional source-context text; maximum 500 characters each. |
| severity | LOW, MEDIUM, HIGH, CRITICAL or null for unknown. |
| rawData | Required JSON object preserving original evidence. |
| metadata | JSON object; defaults to an empty object. |

Event status describes the source action outcome (for example `failed`), not an
incident lifecycle state. Event user is the source identity, not an application
user foreign key. No vendor format or event-type taxonomy is imposed.
Unknown canonical fields are rejected. JSON values must be lossless JSON, nesting
is limited to 32 levels and each JSON object is limited to 256 KiB. Null characters
are rejected for PostgreSQL compatibility. These model bounds do not define the
future HTTP ingestion limit. Raw evidence and metadata are copied without masking
or coercion; callers must avoid collecting secrets as event evidence.

## Persistence

`eventRepository(pool).create(input)` parameterizes an atomic INSERT into the
existing `security_events` table. Required source/type/occurrence fields use the
existing columns; other canonical fields use `normalized_data`. Raw evidence is
stored separately in `raw_data` without duplication in normalized JSON. PostgreSQL
assigns the UUID, receipt time and normalization time. No migration is needed and
previous migrations are unchanged.

`getById(uuid)` returns `{id, receivedAt, normalizedAt, event, rawData}` or null
for a missing UUID. A pre-existing unnormalized row has `event: null` while its raw
evidence remains readable. Canonical validation failures and sanitized database
failures use separate error classes. No update/delete or bulk-search public method
is provided; evidence retention and later pipeline transitions remain future work.

## Verification

Run `npm run quality` for model validation and identity regression tests.
`npm run test:events:integration` requires a disposable database and
`SENTINELX_TEST_DATABASE=1`; it applies migrations and verifies a full PostgreSQL
round trip, IPv4/IPv6, unknown optional fields, raw evidence and missing IDs.
Run integration suites sequentially if sharing a disposable database.

On Windows, after pulling main, use the PowerShell window with your PostgreSQL
connection environment variables:

```powershell
node scripts/migrate.js
node scripts/verify-event-model.js
```

Expected: `Security event model persistence verified.` The verifier inserts only
synthetic documentation-range IPs, checks all fields and deletes its own generated
record. It prints no database credentials or raw driver errors. Local Windows/PostgreSQL 18.6 verification was confirmed on 2026-09-30. Task 07 is Complete.

## Task 08 integration
The controlled ingestion service calls create(input, actorId), which rechecks the active actor ingestion grant and inserts its event and audit record transactionally. Internal create(input) remains available to trusted local model verification. See [EVENT_INGESTION.md](EVENT_INGESTION.md).
