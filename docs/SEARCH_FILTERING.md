# Task 25 — Consistent search and filtering

Task 25 implements FR-031 on the existing protected list endpoints:

- `GET /api/events` — requires `events.read`.
- `GET /api/alerts` — requires `alerts.read`.
- `GET /api/incidents` — requires `incidents.read`.

No new unauthenticated global search endpoint or database migration is introduced.
These routes retain their prior pagination, ordering, response envelope, record
inspection, live role authorization, and evidence boundaries.

## Shared conventions

The three domain query parsers now use `src/search/filters.js`.
Common parameter names and validation are identical:

| Parameter | Meaning |
|---|---|
| `q` | Case-insensitive literal substring over the already approved domain summary fields; not raw evidence. |
| `from` / `to` | Inclusive ISO-8601 timestamp bounds, validated and converted to UTC; both optional, `from` may not exceed `to`. |
| `severity` | LOW, MEDIUM, HIGH, CRITICAL. Events additionally accept UNKNOWN for missing normalized severity. |
| `status` | Domain-specific: normalized source-event status text, alert NEW/ACKNOWLEDGED, incident NEW/INVESTIGATING/CONTAINED/RESOLVED/DISMISSED. |
| `categoryCode` | One of the approved fifteen taxonomy codes. Incident also accepts UNCLASSIFIED for a null assessment. |
| `source` | Exact source label (event source, alert snapshot source, or source of a linked incident alert). |
| `sourceIp` / `destinationIp` | Exact canonical evidence entity; validated IPv4/IPv6 literal. |
| `user` / `host` | Exact normalized evidence entity. |
| `ruleId` | Approved UUID of a linked detection rule. |
| `mitreTechniqueId` | Exact existing rule-associated MITRE identifier in `T####` or `T####.###` format. Unknown but syntactically valid IDs return no matches. |
| `page` | Decimal 1–2000, 50 results per page (up to 51 rows fetched to compute `hasMore`). |

Domain-specific parameters are preserved: events support `type` and `action`,
while incidents support `assignedTo` (UUID or UNASSIGNED).

The event time axis is `security_events.occurred_at`; alerts and incidents use
their respective `created_at`. Results remain newest first by that timestamp,
with ID as a stable tie-breaker. Dates may use an explicit UTC Z or a valid
numeric timezone offset and are normalized to UTC before reaching PostgreSQL.

Unknown/duplicated/empty filter parameters, malformed identifiers/IPs/timestamps,
invalid enumerations, reversed date ranges, out-of-range pages and URL-encoded
query strings over 4096 characters fail with HTTP 400. `q` is bounded to 200
characters; other text filters are bounded to 500 characters. Literal SQL
LIKE wildcard characters `%` and `_`, plus backslashes, are escaped.
All user-provided values are PostgreSQL bound parameters, never SQL fragments.

## Evidence-chain semantics

Event-local fields (including IP/user/host/status) read normalized event data.
Event category/rule/MITRE constraints use an `EXISTS` join through
`alert_events` to a **single associated alert and its rule**. An event with
no qualifying linked alert will not appear for a rule/category/MITRE filter.

Alert category, severity, source, rule and status use persisted alert snapshots.
Alert IP/user/host constraints match a **single linked security event** through
`alert_events`. MITRE matches an associated `rule_mitre_mappings` and
`mitre_mappings` identifier for the alert's rule.

Incident category, severity, status and assignment use the authoritative incident
row. Incident source/rule/MITRE and IP/user/host constraints are checked together
against a **single incident → linked alert → linked evidence event chain**.

Multiple filter fields are combined with AND. All evidence-related conditions
within a linked chain must match that same chain, not unrelated alerts or events.
All link searches use `EXISTS`, which prevents row multiplication and incorrect
pagination when a record has several linked events or alerts.

MITRE association is contextual rule metadata, **not proof that the individual
event demonstrates the technique**. The UI labels these fields as linked rule or
linked MITRE technique where applicable.

The free-text `q` searches only previously approved summary strings, without
exposing raw event payloads, audit context, notification contents or secrets.

## Console changes

Existing filter forms on `/events`, `/alerts` and `/incidents` expose the
shared fields. Task 40 adds the same canonical fifteen-code threat-category datalist to all three category filters so operators can select every approved taxonomy code without memorizing it; backend validation remains authoritative. Existing FormData serialization converts the date-local
inputs to ISO strings, resets pagination on filter changes, retains filters
between page changes, and supports Clear filters. Text remains safely rendered
with `textContent`.

No Task 24 dashboard filtering, Task 26 report export, destructive actions,
external API keys, Supabase or new threat taxonomy is introduced.

## Verification

The focused search unit tests cover shared parsing, domain-specific exceptions,
invalid inputs, parameterized SQL, common evidence-chain joins, literal wildcard
behavior and stable pagination.

The Windows/PostgreSQL verifier creates synthetic linked event/alert/incident
records, adds and later deletes one synthetic rule-MITRE mapping, tests positive
and contradictory combinations in all three domains, validates date/status/
severity/category/IP/user/host/rule/MITRE behavior, checks three authorized
roles, and cleans all synthetic changes.

Run the acceptance gate:

```powershell
git pull origin main
npm.cmd run quality
node scripts/migrate.js
npm.cmd run verify:search
```

Expected output:

`Consistent event/alert/incident date, severity, status, category, IP, user, host, rule and MITRE filters, evidence-chain matching, RBAC and safe pagination verified. Synthetic changes cleaned up.`

Optional tests **only on a disposable database**:

```powershell
$env:SENTINELX_TEST_DATABASE='1'
npm.cmd run test:search:integration
npm.cmd run test:search:ui
```

Task 25 adds no migration; applied migrations 001–014 remain immutable.
Task 26 Reporting is Not Started.

## Completion

Task 25 is **Complete**. Isolated parser/repository checks passed 15/15.
The Windows/PostgreSQL `verify:search` acceptance verifier passed on 2026-09-30:

`Consistent event/alert/incident date, severity, status, category, IP, user, host, rule and MITRE filters, evidence-chain matching, RBAC and safe pagination verified. Synthetic changes cleaned up.`

No migration was added. Preserve the applied 001–014 checksum-protected
migration chain. Task 26 Reporting is separately scoped and Not Started.
