# Incident classification and severity — Task 19

Task 19 adds controlled analyst adjustment of an Incident's approved threat
taxonomy classification and severity while keeping lifecycle status independent.

## Approved values

Classification uses the existing fifteen-code threat taxonomy from Task 11:

- BRUTE_FORCE
- CREDENTIAL_ATTACK
- PRIVILEGE_ESCALATION
- SUSPICIOUS_ACCOUNT_ACTIVITY
- UNAUTHORIZED_ACCESS
- RECONNAISSANCE
- SUSPICIOUS_NETWORK_ACTIVITY
- PHISHING_SOCIAL_ENGINEERING
- MALWARE
- RANSOMWARE
- DENIAL_OF_SERVICE
- DATA_EXFILTRATION
- WEB_APPLICATION_ATTACK
- INSIDER_THREAT
- SUPPLY_CHAIN_COMPROMISE

An incident may also remain unclassified with `categoryCode=null`.

Severity uses only the approved baseline values:

- LOW
- MEDIUM
- HIGH
- CRITICAL

Unknown category codes and severity labels are rejected.

## Priority boundary

The Task 19 objective mentions priority, but the requirements baseline and
repository define no separate incident-priority vocabulary such as P1/P2/P3/P4
and explicitly prohibit inventing undocumented scoring or labels.

Therefore Task 19 uses the approved incident severity as the visible triage-priority
dimension. It does **not** add another priority field, label set, or numeric score.

Task 20 is the separate deterministic Risk Scoring task and must document its own
formula before any risk number is presented.

## Automatic default and analyst adjustment

Task 18 already supplies a conservative automatic incident default:

- initial severity = highest linked-alert severity;
- if every linked alert has one common currently selectable taxonomy category,
  that category is copied;
- mixed or unavailable categories leave the incident unclassified.

Task 19 adds the controlled analyst correction path:

`PATCH /api/incidents/{uuid}/assessment`

Exact request body:

```json
{
  "categoryCode": "MALWARE",
  "severity": "CRITICAL",
  "reason": "Endpoint and linked-alert evidence confirm malware execution."
}
```

`categoryCode` may be null to return an incident to an unclassified state.

The adjustment changes classification/severity only. It does not change incident
status, assignment, linked alerts, resolution notes, or response history.

## Category availability

A newly selected non-null category must currently be enabled/selectable in the
Task 11 catalog. The repository locks the selected category while changing the
incident, so category configuration and incident classification are serialized.

If an incident already references a category that was later disabled, an analyst
may still change only its severity while retaining that historical category. This
preserves existing classification instead of forcing a rewrite merely because the
catalog choice is no longer selectable for new classifications.

## Lifecycle independence

Classification/severity adjustment is allowed for active and terminal incidents.
For example, a RESOLVED incident may be reclassified after later forensic review
without reopening it or losing its resolution note.

This implements the baseline requirement that incident lifecycle status and threat
level are independent dimensions.

## Authorization and auditing

Administrator and Security Analyst roles may update incident assessment through the
existing `incidents.manage` permission. Viewer/Management remains read-only.

The repository rechecks the actor's live role inside the database transaction.

Every material change creates one `INCIDENT_ASSESSMENT_CHANGED` audit record with:

- previousCategoryCode
- categoryCode
- previousSeverity
- severity
- required reason

If category and severity are both unchanged, the operation returns
`changed=false` and does not create a redundant audit record.

If audit persistence fails, the classification/severity update rolls back.

## Persistence

Append-only migration `012_incident_classification_severity.sql` adds:

- `assessment_updated_at`
- `assessment_updated_by`

The existing `incidents.category_code` and `incidents.threat_level` fields remain
the authoritative stored classification and severity. Migration 012 does not add a
priority score or modify migrations 001–011.

## UI

The `/incidents` detail view displays the current classification and severity.
Authorized incident managers receive a Classification and severity form populated
from the currently selectable taxonomy catalog.

If the incident retains a historical category that is no longer selectable, the UI
shows that current category as unavailable but still permits a severity-only
adjustment.

Viewer/Management users see the resulting classification/severity but no assessment
controls.

## Verification

Focused pre-push Task 19 tests passed 5/5. They cover:

- all four approved severity values;
- approved/null taxonomy validation;
- rejection of invented priority fields and unknown labels;
- Viewer mutation rejection;
- terminal-incident reassessment without lifecycle changes;
- old/new audit evidence;
- disabled historical category retention;
- selectable-category enforcement;
- no-op deduplication.

PostgreSQL integration:

```powershell
$env:SENTINELX_TEST_DATABASE='1'
npm.cmd run test:incident-classification:integration
```

Browser integration:

```powershell
$env:SENTINELX_TEST_DATABASE='1'
npm.cmd run test:incident-classification:ui
```

Windows/PostgreSQL acceptance:

```powershell
git pull origin main
npm.cmd run quality
node scripts/migrate.js
npm.cmd run verify:incident-classification
```

Expected output:

`Incident taxonomy classification, severity adjustment, lifecycle independence, RBAC, auditing and rollback verified. Synthetic changes cleaned up.`

No external API or API key is required.


## Completion

Task 19 is Complete. Focused Task 19 tests passed 5/5, and the
Windows/PostgreSQL acceptance verifier passed on 2026-09-30 with:

`Incident taxonomy classification, severity adjustment, lifecycle independence, RBAC, auditing and rollback verified. Synthetic changes cleaned up.`

Task 20 Risk Scoring remains separate and Not Started. No external API or API key
is required.
