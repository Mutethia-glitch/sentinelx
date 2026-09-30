# SentinelX continuation checkpoint

Tasks 01–20 are Complete. Task 21 (Investigation Workspace) is implemented and is
Verification Pending. Do not begin Task 22 until Task 21's Windows/PostgreSQL gate
passes and Task 21 is explicitly marked Complete.

Task 21 implements the Investigation stage using the existing core
`investigation_notes` table from migration 001. No new migration was required, so
the applied append-only migration chain remains 001–013.

Investigation workspace endpoint:
- `GET /api/investigations/{incidentId}`

It returns:
- incident context;
- linked alert summaries;
- distinct linked security-event summaries;
- affected user/host/source-IP/destination-IP values;
- append-only analyst findings;
- one chronological timeline combining events, alerts, incident creation,
  incident-targeted audit history, and findings.

Finding endpoint:
- `POST /api/investigations/{incidentId}/notes`

Exact body:
`{content, alertIds, eventIds}`

Content is bounded to 4000 characters. Up to 50 unique alert IDs and 50 unique
event IDs may be cited. Every cited alert/event must already belong to the incident;
unrelated evidence is rejected.

Viewer/Management has `investigations.read` only. Administrator and Security
Analyst roles have `investigations.write`. The repository rechecks the writer's
live role inside PostgreSQL.

Findings are append-only in Task 21. Every successful finding writes
`INVESTIGATION_NOTE_ADDED` to the incident audit trail in the same transaction;
audit failure rolls back the note.

The existing `/incidents` inspection UI now contains the investigation workspace.
It displays affected entities, linked events, timeline, and findings. Only
investigation writers see the Record finding form. User-derived content is rendered
with textContent.

Task 21 does not perform containment, escalation, notification, tasks, or other
response actions. Task 22 owns controlled response workflows.

Focused Task 21 isolated logic checks passed 4/4. PostgreSQL and browser
verification entry points are implemented.

Run the Windows/PostgreSQL acceptance gate:

```powershell
git pull origin main
npm.cmd run quality
npm.cmd run verify:investigations
```

Expected output:

`Investigation evidence, affected entities, chronological timeline, analyst findings, RBAC, evidence validation, auditing and rollback verified. Synthetic changes cleaned up.`

Optional explicit disposable-database checks:

```powershell
$env:SENTINELX_TEST_DATABASE='1'
npm.cmd run test:investigations:integration
npm.cmd run test:investigations:ui
```

No Task 21 migration is required because `investigation_notes` already existed in
migration 001. Migrations 001–013 remain immutable and checksum tracked.

PostgreSQL remains hosted on the user's Windows computer. Task 21 requires no
external API or API key. Never expose or commit actual `.env` values or database
credentials.

Task 22 (Response Workflow) remains Not Started.
