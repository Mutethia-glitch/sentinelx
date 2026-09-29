# Configurable detection rule model — Task 12

Task 12 implements persistent declarative rule configuration and protected rule
management APIs. It does not evaluate event streams, generate alerts, install core
rules or claim detection coverage. Execution is Task 13; approved core rule logic
and scenario expectations are Task 14. Enabling a configuration records operator
intent but has no event-processing effect in the current implementation.

## Candidate schema

POST/create and POST/validate require exactly the fields below. PUT/update requires
the same fields plus the current integer `version` from the rule response.

| Field | Contract |
|---|---|
| name | Nonblank, maximum 100 characters; unique case-sensitive database name. |
| description | Text, maximum 2000 characters; empty allowed. |
| enabled | Explicit boolean; synthetic fixture starts false. |
| severity | LOW, MEDIUM, HIGH or CRITICAL, separate from category. |
| categoryCode | Approved shared taxonomy code; a new selection must be enabled. |
| conditions | 1–10 `{field, operator, value}` conditions, intended conjunctive (AND) matching. |
| threshold | Integer count, 1–10000. |
| windowSeconds | Integer time-window seconds, 1–86400. |
| groupBy | 0–3 distinct supported fields; empty means a global group. |
| mitreTechniqueIds | 0–5 distinct identifiers present in the local MITRE catalog. |
| reason | Nonblank administrative reason, maximum 500 characters; audit only. |
| version | PUT only; positive current version for optimistic edit protection. |

Supported fields are source, type, sourceIp, destinationIp, user, host, action,
status and severity. Raw evidence, metadata paths, credentials and arbitrary JSON
selectors are not rule condition fields. Supported operators:

| Operator | Value schema and intended comparison |
|---|---|
| equals | Exact text or null (unknown). |
| notEquals | Text or null. |
| in | 1–10 unique text/null values. |
| exists | Boolean indicating whether the field is non-null. |

Text values are trimmed, nonblank and at most 500 characters; null characters are
rejected. IP condition values must be valid IPv4/IPv6 text; severity values must be
one of the four approved levels. Text/IP comparison is literal; no regex, scripts,
eval, arbitrary SQL, case folding or vendor-field guessing is introduced. These
are the model's declarative semantics; runtime event counting, matching and window
handling will be tested in Task 13, not performed by Task 12's validation endpoint.

The persisted definition is
`{schemaVersion: 1, conditions, threshold, windowSeconds, groupBy}`. Name,
description, enabled state, severity and category use existing columns. MITRE
associations use the existing `rule_mitre_mappings` relation. No executable rule
logic is hard-coded in controllers or UI. The shipped authentication fixture is
synthetic configuration data, not an installed or validated production detector.

## MITRE reference catalog

Migration 006 seeds three official technique references without replacing existing
catalog rows: [T1110 Brute Force](https://attack.mitre.org/techniques/T1110/),
[T1078 Valid Accounts](https://attack.mitre.org/techniques/T1078/) and
[T1087 Account Discovery](https://attack.mitre.org/techniques/T1087/).
Mappings are operator-selected annotations, not proof that a rule detects a
technique. Unknown catalog identifiers are rejected even when their syntax is valid.
The full mapping catalog and MITRE workflow remain Task 28. No external API key or
runtime network lookup is needed; mappings can be omitted with an empty array.

## Persistence and concurrency

Migration `006_rule_configuration.sql` adds `updated_at` and positive `version`
columns to detection_rules. Existing definitions, enabled states and categories
remain unchanged; legacy definitions may lack schemaVersion 1 and must be explicitly
validated/upgraded before a future engine can use them. Task 13 must reject
unsupported definitions instead of guessing their meaning.

Creating or editing a rule rechecks the active Administrator/Security Analyst
`rules.manage` grant inside the database transaction. Rule edits lock the record
and require the expected version; successful updates increment it. Stale or
concurrent edits return 409 rather than overwrite another change. Rule configuration,
MITRE associations and attributed RULE_CREATED/RULE_UPDATED audit commit together;
audit failure rolls all changes back. Audit stores previous/next snapshots and reason.
Duplicate names return 409; missing rules return 404; reference/input failures are
400; driver failures are sanitized 503. Database values are parameterized.

Disabled categories cannot be newly assigned. Existing disabled-category references
can be retained during edits/disable operations. Turning a disabled rule on requires
its existing category to be selectable. Category availability changes do not
silently change the enabled state of existing rules.

## Protected APIs

| Method / endpoint | Behavior |
|---|---|
| GET /api/rules?page=1 | Admin/Analyst rules.read; 50-record pages, page range 1–1000. |
| GET /api/rules/{uuid} | Admin/Analyst; one persisted configuration or 404. |
| GET /api/rules/mitre-mappings | Admin/Analyst; bounded local catalog (maximum 500 entries). |
| POST /api/rules/validate | Admin/Analyst rules.manage; validates a new candidate and catalog references without persisting a rule. |
| POST /api/rules | Admin/Analyst; creates and audits a rule. |
| PUT /api/rules/{uuid} | Admin/Analyst; replaces configuration, including enabled state, using current version. |

Viewer/Management has neither rules.read nor rules.manage, so direct rule access
and mutations are denied regardless of client controls or forged role headers.
Mutations require a valid session cookie, exact APP_ORIGIN Origin header and
application/json with the existing 8 KiB bound. Unsupported methods/paths and
unknown/duplicate query fields are rejected. No deletion API is added because
rule references and audit history must be preserved.

Rule responses contain id, name, description, enabled, severity, categoryCode,
definition, mitreTechniqueIds, version, createdAt and updatedAt. List responses
wrap rules plus page/pageSize/hasMore. Validation returns
`{valid: true, definition, executionImplemented: false}` for the current Task 12
stage; it does not run events or predict alerts. Future execution work must update
this stage indicator as appropriate.

## Tests and Windows gate

`npm run quality` covers 26 unit/API checks, including invalid expressions/fields,
bounds, role rejection, validation and sanitized backend failures.
`npm run test:rules:integration` requires a disposable database with
`SENTINELX_TEST_DATABASE=1`. It verifies persisted definitions and mappings,
create/edit/toggle, duplicate names, category/MITRE rejection, stale and concurrent
edits, audit rollback and full authenticated HTTP lifecycle with Viewer denial.
Existing identity, event, normalization, taxonomy, database and browser regressions
are run sequentially against the shared disposable test database.

On Windows, stop the server and run with the existing PostgreSQL environment:

```powershell
git pull origin main
node scripts/migrate.js
npm.cmd start
```

In a second PowerShell window at the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-rules.ps1
```

Use Administrator application credentials. Expected:
`Rule creation, editing, enable/disable, validation and version protection verified.`
The verifier leaves one auditable synthetic rule disabled. It also attempts to
disable that record if an intermediate check fails. Then run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-rules.ps1 -ExpectDenied
```

Use the existing Viewer/Management test account. Expected:
`Viewer rule access and management rejection verified.` The policy override is
process-local; credentials are prompted privately and the verifier logs out its
own session. Task 12 remains In Progress until both checks succeed locally.
After completing Task 12, pause for the user's requested break before Task 13.
