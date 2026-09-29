# Configurable threat categories — Task 11

The seven categories come from the approved families named in Task 14. They are
classification choices for future rules/incidents, not implemented detection
claims. Task 11 adds no detection logic, alerts, rule-management workflow or
incident-management workflow. Severity and incident status remain independent.

| Stable code | Default label |
|---|---|
| BRUTE_FORCE | Brute force |
| CREDENTIAL_ATTACK | Credential attacks |
| PRIVILEGE_ESCALATION | Privilege escalation |
| SUSPICIOUS_ACCOUNT_ACTIVITY | Suspicious account activity |
| UNAUTHORIZED_ACCESS | Unauthorized access |
| RECONNAISSANCE | Reconnaissance |
| SUSPICIOUS_NETWORK_ACTIVITY | Suspicious network activity |

Migration `004_threat_categories.sql` creates the catalog and seeds these choices.
Stable codes are restricted to the approved set. Labels (1–100 characters),
descriptions (0–1000 characters) and availability (`enabled`) are configurable;
new arbitrary categories are not part of the API. Blank labels, null characters,
unknown input fields and invalid booleans are rejected. All seven start selectable,
which does not enable any detection rule.

## Rule and incident references

`detection_rules.category_code` and `incidents.category_code` reference the same
catalog, with RESTRICT deletion/key updates and indexes. Existing records keep
null (unknown) classifications instead of guessed backfills. Future rule/incident
services must validate required selection according to their own task contracts.
The current migration preserves previous fixtures and unknown historical records.

Database triggers reject a new or changed selection when the category is disabled
or unknown. Existing references are retained when a category is disabled; unrelated
updates or reassigning the same recorded category remain possible. Enabling or
disabling a category changes its availability for new classifications, not the
rule's enabled state, incident status, threat level, or recorded classification.
Category-row locks serialize selection against changes in availability.

The internal repository supplies `list(selectable)`, `requireSelectable(code)`
and `update(actorId, code, configuration)`. The database mutation rechecks the
active Administrator role, locks the category and persists an attributed
`THREAT_CATEGORY_UPDATED` audit atomically. Audit context retains the stable code,
previous/next catalog values and required reason (1–500 characters). The target is
`threat_category`; its text code is in context rather than UUID `target_id`.

## Protected catalog APIs

| Method / endpoint | Access and behavior |
|---|---|
| GET /api/threat-categories | Approved role with categories.read; all catalog entries, including disabled choices. |
| GET /api/threat-categories?selectable=true | Same read grant; enabled choices for future rule/incident selection. |
| PATCH /api/threat-categories/{CODE} | Administrator categories.manage, exact Origin and bounded JSON; audited configuration change. |

Only `selectable=true` or `selectable=false` is accepted as a list filter; unknown
or duplicate parameters are rejected. Read responses return
`{categories: [{code, name, description, enabled, updatedAt}]}`. PATCH requires
exactly `{name, description, enabled, reason}` and returns `{category: {...}}`.
No cookie/token/query field elevates caller roles. Mutation inputs use the existing
8 KiB JSON limit, and backend failures are sanitized as 503. Changes persist
immediately in PostgreSQL, without server restart or external API keys.

Example body, supplied through an authenticated session:

```json
{"name":"Brute force","description":"Repeated authentication attempts; classification only.","enabled":true,"reason":"Maintain approved taxonomy"}
```

No category configuration page is added in Task 11; the catalog API and database
references provide the choices for later rule/incident interfaces.

## Verification and Windows setup

`npm run quality` runs 23 unit/API tests. `npm run test:categories:integration`
requires a disposable database with `SENTINELX_TEST_DATABASE=1` and checks approved
codes, foreign-key selection, disabled-choice rejection, preserved historical
classification, independent incident status/level, audit attribution, audit
rollback and revoked Administrator access. Existing identity/event/ingestion and
browser regressions pass after migration 004.

On Windows, stop the server and run in the window with your PostgreSQL environment:

```powershell
git pull origin main
node scripts/migrate.js
node scripts/verify-threat-categories.js
npm.cmd start
```

Expected: `Seven threat categories and rule/incident selection verified. Synthetic
changes rolled back.` The verifier checks actual database catalog/selection behavior
inside a transaction and rolls back its synthetic records and availability changes.
It does not persist test incidents or enable detections. With your normal signed-in
browser, open `/api/threat-categories?selectable=true` to see the catalog. Task 11
remains In Progress until local migration, selection verification and catalog
access are confirmed.
