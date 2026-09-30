# Alert management — Task 16

The `/alerts` console lists and filters persisted detection alerts, shows their
rule identity and snapshot fields, and traces linked source events to normalized
and raw evidence through the existing authorized event API. Alerts remain
separate from incidents. Deterministic confidence remains null (displayed as
“Not calibrated”). Rule names are current catalog labels; threat, severity,
source and affected entities retain their alert snapshots.

## Access and API

Administrator, Security Analyst and Viewer/Management can list and inspect alerts
with `alerts.read`. Source-event inspection independently requires `events.read`.
Only Administrator and Security Analyst can change status with `alerts.manage`.
All grants are checked on the backend against the current session and roles.

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/alerts` | 50-row pages, newest generation time/id first; `hasMore` indicates another page. |
| GET | `/api/alerts/{uuid}` | Alert fields, match evidence and ordered source-event summaries; trigger flagged. |
| PATCH | `/api/alerts/{uuid}/status` | Exact JSON `{status, reason}`; authenticated manager and exact Origin required. |
| GET | `/api/events/{uuid}` | Existing normalized event/raw evidence inspection used by source-event buttons. |

Filters: `q` (literal case-insensitive substring of rule name, source, category,
reason or entity), `status`, `severity`, `categoryCode`, `source`, `ruleId`, `from`,
`to`, and `page`. Exact filters and inclusive ISO timestamps apply; local browser
dates convert to UTC. All fifteen catalog category codes are accepted. Pages are
1–2000; search is at most 200 characters, text filters at most 500, and encoded
queries at most 4096. Duplicate, unknown and malformed filters return 400.
List responses omit raw and match evidence; details retain evidence-event links.

## Minimal analyst workflow

Append-only migration `009_alert_management.sql` adds `ACKNOWLEDGED` alongside
`NEW`, status timestamp/actor fields and indexes. An analyst can acknowledge after
reviewing evidence or return an alert to NEW for renewed review. No incident
resolution/containment states are introduced.

Status requests require a nonblank reason of at most 500 characters. The active
actor is locked and roles rechecked within the transaction; the alert is locked
before mutation. An `ALERT_STATUS_CHANGED` audit records previous/new status,
actor, alert id and reason in the same transaction. Audit failure rolls back the
status change. Repeating the current state returns `changed:false` and creates
no additional audit record. Concurrent writes serialize; the last committed
request determines the status. This endpoint has no optimistic version contract.

Missing alerts return 404; missing authentication 401; forbidden access/origin
403; invalid input 400; method mismatch 405; persistence failure a sanitized 503.
Mutation JSON uses the existing 8 KiB limit and application/json requirement.
The browser renders data with textContent, clears evidence on logout/filtering
or lost permission, ignores stale responses and presents errors in red.

## Validation and Windows acceptance

Automated checks cover real PostgreSQL pagination, filters, role boundaries,
source-event evidence, audited transitions, repeat-state behavior, revoked roles
and rollback. Chromium checks cover list/detail navigation, evidence rendering
without HTML execution, status updates, Viewer read-only behavior, empty results,
mobile layout and logout cleanup.

In the PowerShell window with your PostgreSQL connection environment:

```powershell
git pull origin main
node scripts/migrate.js
node scripts/verify-alert-management.js
```

The verifier creates only uniquely identified synthetic users/rule/events/alerts,
starts an ephemeral loopback HTTP server, and removes its synthetic records in
finally. It requires permission to provision local synthetic users and an enabled
category. Existing application data and configuration are not altered. It uses
an internal synthetic passphrase, never asks for your application password and
never prints database credentials. A hard process interruption can leave synthetic
records; normal success/failure performs cleanup.

Expected result:
`Alert listing, filtering, source-event inspection, audited status changes, Viewer rejection and atomic rollback verified. Synthetic changes cleaned up.`

Then restart `npm start`, visit `http://localhost:3000/alerts`, and confirm the
browser workflow using an Administrator/Analyst and Viewer account. Task 16
completion remains pending local Windows acceptance. No external API key is needed.
