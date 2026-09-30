# Incident management — Task 18

Task 18 implements SentinelX's Incident layer after alert correlation. Incidents
remain separate records from alerts and events.

## Authoritative lifecycle

The Task 02 requirements baseline governs later implementation when older task
wording conflicts. FR-013 defines the approved incident states as:

- NEW
- INVESTIGATING
- CONTAINED
- RESOLVED
- DISMISSED

The older Task 18 wording that mentioned OPEN and CLOSED is therefore corrected by
this implementation. OPEN and CLOSED are rejected by the model/API and remain
unsupported by the PostgreSQL incident_status enum.

Every created incident begins in NEW.

Task 18 permits analyst transitions to INVESTIGATING, RESOLVED, or DISMISSED.
RESOLVED and DISMISSED require a nonblank terminal note. Terminal incidents cannot
be reassigned.

CONTAINED remains a valid persisted incident state, but Task 18 does not allow an
analyst to set it directly. FR-017 requires a successful approved containment
action to be performed and recorded first; Task 22 owns that controlled response
workflow. Task 18 can read CONTAINED incidents and permits a future contained
incident to move to INVESTIGATING, RESOLVED, or DISMISSED.

## Incident creation

POST /api/incidents creates an incident from 1–100 existing unique alert IDs.

Creation is transactional:
- actor authorization is rechecked inside PostgreSQL;
- all alerts must exist;
- incident and incident_alert links are written together;
- an INCIDENT_CREATED audit record is written in the same transaction.

The initial threat level is the highest severity among the linked alerts. This is a
deterministic creation default only; Task 19 owns controlled incident
classification/severity adjustment.

If every selected alert has the same currently selectable threat category, that
category is copied to the incident. Mixed categories or a category disabled after
the alerts were generated leave the incident category unset for later Task 19
classification instead of silently re-enabling or guessing a category.

## Assignment

PATCH /api/incidents/{uuid}/assignment accepts an assignee UUID or null plus a
reason. The target must be an active Administrator or Security Analyst with
incidents.manage permission. Assignment changes are locked, audited as
INCIDENT_ASSIGNMENT_CHANGED, and committed atomically.

The browser console offers assign-to-me and unassign controls; the API supports
assignment to any active incident manager UUID.

## Status updates

PATCH /api/incidents/{uuid}/status accepts:
- INVESTIGATING with reason and resolutionNote=null;
- RESOLVED with reason and a required resolution note;
- DISMISSED with reason and a required dismissal note.

Direct NEW, CONTAINED, OPEN and CLOSED status commands are rejected.

Status updates are locked and audited as INCIDENT_STATUS_CHANGED. Threat level is
not changed by status transitions.

## Read/search API

GET /api/incidents provides bounded 50-record pages with validated filters:
status, severity, threat category, assignee/UNASSIGNED, creation range and safe
text search.

GET /api/incidents/{uuid} returns the incident plus the linked alert summaries so
analysts can trace the alert evidence without merging the Alert and Incident
models.

Administrator, Security Analyst and Viewer/Management roles can read incidents.
Only Administrator and Security Analyst roles can create, assign or change
incident status.

## Persistence

Append-only migration 011 adds:
- updated_at;
- assignment_updated_at / assignment_updated_by;
- status_updated_at / status_updated_by;
- resolution_note / resolution_at / resolution_by.

It does not change the approved incident_status enum and does not edit migrations
001–010. Existing incidents receive updated_at=created_at; attribution and
resolution fields remain null unless later actions populate them.

## UI

/incidents provides:
- authenticated incident list/filtering;
- incident creation from alert IDs;
- linked-alert inspection;
- self-assignment/unassignment for incident managers;
- INVESTIGATING / RESOLVED / DISMISSED transitions;
- required terminal notes;
- Viewer/Management read-only behavior.

Rendered incident/alert values use textContent; the frontend does not interpret
stored text as HTML.

## Verification

Focused Task 18 model/service/repository tests passed 10/10 before repository
update. They cover authoritative lifecycle validation, bounded input/filters,
RBAC, SQL parameterization, severity/category derivation, alert linking,
transactional auditing and threat-level preservation.

PostgreSQL integration:
```powershell
$env:SENTINELX_TEST_DATABASE='1'
npm.cmd run test:incidents:integration
```

Browser integration:
```powershell
$env:SENTINELX_TEST_DATABASE='1'
npm.cmd run test:incidents:ui
```

Windows/PostgreSQL acceptance:
```powershell
git pull origin main
npm.cmd run quality
node scripts/migrate.js
npm.cmd run verify:incidents
```

Expected verifier output:

`Incident creation, alert linking, severity inheritance, assignment, lifecycle, terminal notes, RBAC, auditing and rollback verified. Synthetic changes cleaned up.`

No external API or API key is required. Task 19 remains separate and owns
classification/severity adjustment.


## Completion

Task 18 is Complete. Focused Task 18 tests passed 10/10, and the
Windows/PostgreSQL acceptance verifier passed on 2026-09-30 with:

`Incident creation, alert linking, severity inheritance, assignment, lifecycle, terminal notes, RBAC, auditing and rollback verified. Synthetic changes cleaned up.`

Task 19 incident classification/severity adjustment remains separate and Not Started.
No external API or API key is required.


## Task 19 assessment extension

Task 19 now provides the controlled correction path anticipated by Task 18. Authorized incident managers may update the incident taxonomy category and LOW/MEDIUM/HIGH/CRITICAL severity with a required reason. These adjustments are independent of incident lifecycle, so a terminal incident can be reclassified without reopening it or losing its resolution/dismissal note.

The Task 18 highest-linked-alert severity and common-category behavior remain creation defaults, not immutable conclusions. See [INCIDENT_CLASSIFICATION.md](INCIDENT_CLASSIFICATION.md).
