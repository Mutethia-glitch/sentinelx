# SentinelX continuation checkpoint

Tasks 01–21 are Complete. Task 21 (Investigation Workspace) passed its
Windows/PostgreSQL acceptance gate on 2026-09-30. Task 22 (Response Workflow)
remains Not Started and must not begin until the user requests it.

Task 21 implements the Investigation stage using the existing core
`investigation_notes` table from migration 001. No new migration was required.
The applied append-only/checksum-tracked migration chain remains 001–013.
The Windows migration check passed with:
`PostgreSQL migrations verified/applied.`

Investigation workspace endpoint:
- `GET /api/investigations/{incidentId}`

It returns incident context, linked alert summaries, distinct linked security-event
summaries, affected user/host/source-IP/destination-IP values, append-only analyst
findings, and one chronological timeline combining events, alerts, incident creation,
incident-targeted audit history, and findings.

Finding endpoint:
- `POST /api/investigations/{incidentId}/notes`

Exact body: `{content, alertIds, eventIds}`.

Content is bounded to 4000 characters. Up to 50 unique alert IDs and 50 unique
event IDs may be cited. Every cited alert/event must already belong to the
incident; unrelated evidence is rejected.

Viewer/Management has `investigations.read` only. Administrator and Security
Analyst roles have `investigations.write`. The repository rechecks the writer's
live role inside PostgreSQL.

Findings are append-only in Task 21. Every successful finding writes
`INVESTIGATION_NOTE_ADDED` to the incident audit trail in the same transaction;
audit failure rolls back the note.

The existing `/incidents` inspection UI contains the investigation workspace,
displaying affected entities, linked events, timeline, and findings. Only
investigation writers see the Record finding form. User-derived content is rendered
with textContent.

Task 21 does not perform containment, escalation, notification, tasks, or other
response actions. Task 22 owns controlled response workflows.

Focused Task 21 isolated logic checks passed 4/4. Windows/PostgreSQL acceptance
verification passed on 2026-09-30 with:

`Investigation evidence, affected entities, chronological timeline, analyst findings, RBAC, evidence validation, auditing and rollback verified. Synthetic changes cleaned up.`

Do not edit migrations 001–013 or bypass checksum verification.
PostgreSQL remains hosted on the user's Windows computer. Task 21 requires no
external API or API key. Never expose or commit actual `.env` values or database
credentials.

When work resumes, read repository instructions, this handoff,
`docs/DEVELOPMENT_STATUS.md`, and `tasks/22-response-workflow.md` before beginning.
Proceed numerically from Task 22 only when requested.
