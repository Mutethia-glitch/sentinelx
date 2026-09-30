# Manual response workflow — Task 22

Task 22 adds a controlled, auditable **manual response record** to the existing
Incident → Investigation → Response → Resolution flow. SentinelX does not execute
external host/account/network operations in this task.

## Reused approved foundations

The Task 01 core migration already created `response_actions`; Task 22 reuses
that table. No migration 014 is necessary. Migrations 001–013 are unchanged.

- Task 18 already provides authenticated incident assignment and
  RESOLVED/DISMISSED workflow with a mandatory terminal note.
- Task 21 already provides append-only investigation notes and findings.
- Task 22 records response activity and gives the approved CONTAINED state a
  controlled entry path.
- Task 23 implements real in-app notifications through a separate authenticated API.
  A Task 22 COMMUNICATION entry is **only a record of something reported as
  communicated externally**, not a message sent by SentinelX.

## Allowed manual response types

`CONTAINMENT`, `ESCALATION`, `FOLLOW_UP_TASK`, `COMMUNICATION`.

These are bounded API choices, not commands passed to an external tool. Attempts
to submit unsupported actions such as arbitrary shell execution, account disable,
data deletion, or host blocking are rejected.

## API

`GET /api/responses/{incidentId}?page=1`

- requires `responses.read`;
- returns response records with action, responsible user, reason, result,
  success flag, and recorded timestamp;
- pages contain at most 50 actions, ordered most recently recorded first.

`POST /api/responses/{incidentId}/actions`

- requires `responses.execute`;
- is same-origin authenticated and accepts JSON only;
- exact request body:

```json
{
  "action": "CONTAINMENT",
  "reason": "Authorized containment was needed for the affected account session.",
  "details": "The session was revoked manually outside SentinelX and the outcome was confirmed.",
  "succeeded": true,
  "containmentPerformed": true
}
```

The reason must be nonblank, no more than 500 characters. The reported outcome
details must be nonblank, no more than 2000 characters. Boolean values are strict.
Unknown fields are rejected.

`containmentPerformed` must be true **only** when action is CONTAINMENT and
succeeded is true; all other combinations require false.

## Containment invariant (FR-015 to FR-018)

There is no automatic containment on event/alert detection. An Administrator or
Security Analyst must report that an approved containment activity was actually
performed outside SentinelX and explicitly confirm the successful outcome.

When an active incident is NEW or INVESTIGATING:
- unsuccessful containment is recorded with `succeeded=false` and leaves the
  existing incident state unchanged;
- successful confirmed manual containment inserts a response record and changes
  incident status to CONTAINED within one database transaction;
- both `RESPONSE_ACTION_RECORDED` and `INCIDENT_STATUS_CHANGED` audits are
  written in that transaction with a response-action ID linking the evidence.

CONTAINED never means RESOLVED, does not change incident threat level or risk, and
does not add a resolution note. A duplicate successful containment of an already
CONTAINED incident is rejected. RESOLVED/DISMISSED incidents reject new response
actions. Direct mutation of CONTAINED through the Task 18 status endpoint remains
unavailable.

The `succeeded` flag and `containmentPerformed` are **analyst attestations**:
SentinelX does not independently verify external system changes or pretend to
have operated on an endpoint.

## Persistence and auditing

A response action is appended to the existing `response_actions` table with:
incident ID, responsible actor, action, reason, JSON result, success flag and
`performed_at` (the **time SentinelX records the manual report**, not a claimed
independently measured external execution time).

Stored result JSON contains:
`{summary, mode:"MANUAL_ATTESTATION", containmentPerformed}`.

All write requests check the actor's live active status and role inside PostgreSQL
and lock the incident for mutation. Record insertion, any CONTAINED state change,
and audit insertion commit or roll back together. The API exposes no update/delete
endpoint for historical response records.

## Incident history and UI

The existing incident inspection console displays paginated response history and
a manual response form only for roles holding `responses.execute`.
Viewer/Management can read response history but cannot record new actions.

The investigation timeline also displays incident-targeted
`RESPONSE_ACTION_RECORDED` and `INCIDENT_STATUS_CHANGED` audit history.
Response content is rendered using `textContent`, not HTML interpretation.

The existing assignment, analyst findings, and terminal resolution/dismissal
forms remain separate and retain their already-established authorization rules.

## Verification

The focused staged backend/API checks passed 12/12 before preparing the repository
update. Coverage includes action validation, bounded pagination, Viewer rejection,
origin/method rejection, successful and failed containment, live RBAC recheck,
duplicate/terminal protection, response history and atomic audit rollback.

The PostgreSQL verifier additionally checks that non-containment actions do not
send notifications or change incident status, and that containment preserves
severity/risk and appears in incident/investigation history.

Windows acceptance gate:

```powershell
git pull origin main
npm.cmd run quality
node scripts/migrate.js
npm.cmd run verify:responses
```

Expected verifier output:

`Controlled manual response recording, failed/successful containment, incident history, RBAC, terminal protection and atomic audit rollback verified. Synthetic changes cleaned up.`

Optional integration/browser checks should only run against a disposable database:

```powershell
$env:SENTINELX_TEST_DATABASE='1'
npm.cmd run test:responses:integration
npm.cmd run test:responses:ui
```

No additional migration, integration credential, or external API key is required.
Task 23 Notifications is separately implemented and awaiting its Windows/PostgreSQL acceptance gate.

## Completion

Task 22 is **Complete**. Focused staged backend/API checks passed 12/12.
The Windows/PostgreSQL acceptance verifier passed on 2026-09-30 with:

`Controlled manual response recording, failed/successful containment, incident history, RBAC, terminal protection and atomic audit rollback verified. Synthetic changes cleaned up.`

Task 23 Notifications remains Not Started. No new migration or external API key
was required.
