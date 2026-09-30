# Investigation workspace — Task 21

Task 21 implements the Investigation stage between Incident and Response.

The workspace is incident-centric and preserves the existing Event, Alert, and
Incident records instead of copying or merging them.

## Evidence available to investigators

For an incident, SentinelX derives the workspace from existing persisted links:

- incident → incident_alerts → alerts
- alerts → alert_events → security_events
- incident → investigation_notes
- incident-targeted audit history

The workspace returns:

- incident context, severity, classification, status, assignment, and risk;
- all linked alert summaries;
- distinct linked security-event summaries;
- affected users, hosts, source IPs, and destination IPs;
- append-only analyst findings;
- one chronological timeline.

## Affected entities

Affected entities are aggregated deterministically from the linked alerts and
normalized linked events.

Supported entity fields are:

- user
- host
- sourceIp
- destinationIp

Values are deduplicated and sorted. SentinelX does not infer entities that are not
present in the recorded alert/event evidence.

## Timeline

The investigation timeline combines:

1. linked security events at their occurred timestamps;
2. linked alerts at their generation timestamps;
3. the incident creation timestamp;
4. incident-targeted audit history such as assignment, status, and assessment
   changes;
5. analyst findings at their creation timestamps.

Items are ordered chronologically with deterministic tie-breaking.

Task 21 reads existing incident audit history for investigation context, but it does
not implement the general audit-log module reserved for Task 27.

## Analyst findings

Task 01's core schema already created `investigation_notes`, so Task 21 does not
need a new migration.

Notes are append-only through:

`POST /api/investigations/{incidentId}/notes`

Exact request body:

```json
{
  "content": "The same user and host appear across both authentication events.",
  "alertIds": ["..."],
  "eventIds": ["..."]
}
```

Rules:

- content must be 1–4000 characters after trimming;
- up to 50 unique alert IDs may be cited;
- up to 50 unique event IDs may be cited;
- every cited alert must belong to the incident;
- every cited event must be linked through one of the incident's alerts.

A finding can contain no explicit references when the analyst is recording a
general investigation observation.

Findings are not editable or deletable in Task 21. Preserving them append-only
keeps investigation history stable; corrections can be recorded as a later finding.

## Authorization and auditing

`GET /api/investigations/{incidentId}` requires `investigations.read`.

Administrator, Security Analyst, and Viewer/Management currently have this read
permission.

Adding findings requires `investigations.write`, currently held by Administrator
and Security Analyst roles only.

The repository rechecks the writer's active user and live role inside the
PostgreSQL transaction.

Every successful finding writes `INVESTIGATION_NOTE_ADDED` to the incident audit
trail in the same transaction. If audit persistence fails, the note insertion
rolls back.

## UI

The existing `/incidents` inspection screen now contains the investigation
workspace rather than creating a second competing incident page.

It displays:

- affected entities;
- linked security events;
- chronological investigation timeline;
- existing analyst findings;
- a Record finding form for investigation writers.

Viewer/Management sees the same evidence/timeline/findings but does not receive the
write form.

All user- and event-derived text is rendered with `textContent`.

## Response boundary

Task 21 does not execute containment, escalation, notifications, response tasks, or
other response actions.

Task 22 owns controlled response execution and CONTAINED transitions.

## Verification

Focused Task 21 tests cover:

- note input bounds;
- investigation read/write RBAC;
- affected-entity deduplication;
- deterministic timeline ordering;
- linked alert/event retrieval;
- unrelated-evidence rejection;
- append-only finding persistence;
- audit attribution and rollback;
- Viewer read-only browser behavior;
- safe rendering of analyst content.

PostgreSQL integration:

```powershell
$env:SENTINELX_TEST_DATABASE='1'
npm.cmd run test:investigations:integration
```

Browser integration:

```powershell
$env:SENTINELX_TEST_DATABASE='1'
npm.cmd run test:investigations:ui
```

Windows/PostgreSQL acceptance:

```powershell
git pull origin main
npm.cmd run quality
npm.cmd run verify:investigations
```

No migration command is required specifically for Task 21 because it reuses the
existing `investigation_notes` table from migration 001, although running the
normal migration command remains safe.

Expected verifier output:

`Investigation evidence, affected entities, chronological timeline, analyst findings, RBAC, evidence validation, auditing and rollback verified. Synthetic changes cleaned up.`

No external API or API key is required.

## Completion

Task 21 is Complete. Focused Task 21 logic checks passed 4/4, and the
Windows/PostgreSQL acceptance verifier passed on 2026-09-30 with:

`Investigation evidence, affected entities, chronological timeline, analyst findings, RBAC, evidence validation, auditing and rollback verified. Synthetic changes cleaned up.`

The migration integrity/replay check also passed:
`PostgreSQL migrations verified/applied.`

Task 22 Response Workflow remains separate and Not Started. No external API or
API key is required.
