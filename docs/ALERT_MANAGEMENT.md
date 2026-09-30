# Alert management — Task 16

Task 16 adds the operational alert workflow on top of the Task 15 alert model without merging alerts into incidents.

## Supported workflow

Alert readers can list and inspect persisted alerts and trace the linked source events that formed the detection evidence.

Task 16 supports two alert states:

- `NEW`
- `ACKNOWLEDGED`

Authorized alert managers (Administrator and Security Analyst) can acknowledge a NEW alert or return an acknowledged alert to NEW when renewed attention is required. Every actual status transition requires a reason, re-checks live `alerts.manage` permission inside the PostgreSQL transaction, records the acting user/time, and writes an `ALERT_STATUS_CHANGED` audit entry.

Viewer/Management has `alerts.read` but not `alerts.manage`: it can inspect alerts and source evidence but cannot mutate status.

Task 16 deliberately does not introduce `CONTAINED`, `INVESTIGATING`, `RESOLVED`, or `DISMISSED` alert states. Those meanings belong to the later incident lifecycle.

## API

- `GET /api/alerts?page=1` — bounded 50-record pages.
- `GET /api/alerts/{uuid}` — alert detail plus linked source-event summaries.
- `PATCH /api/alerts/{uuid}/status` — Administrator/Security Analyst only, exact Origin and JSON body `{status, reason}`.

Supported list filters are `q`, `status`, `severity`, `categoryCode`, `source`, `ruleId`, `from`, `to`, and `page`. Free-text search is parameterized and covers safe summary fields such as rule name, source, threat category, match reason, and affected entities.

Alert detail includes the rule reference, trigger event, threat, severity, source, timestamp, affected entities, status/confidence, match evidence, and linked event summaries. Raw event evidence remains available through the existing protected event inspection API rather than being duplicated into the alert summary.

## UI

`/alerts` serves the Task 16 analyst console. Authorized users can filter alerts, inspect an alert, review affected entities and evidence, trace linked source-event identifiers, and—when they have `alerts.manage`—acknowledge or reopen the alert with a reason.

Browser output uses text content rather than HTML injection and is served with the same restrictive security headers used by the existing operational pages.

## Persistence

Append-only migration `009_alert_management.sql` expands the Task 15 status constraint to `NEW` and `ACKNOWLEDGED`, and adds `status_updated_at` plus `status_updated_by`. Existing alerts remain NEW and no incident is created automatically.

## Verification

Focused Task 15–16 management/API/UI regressions pass 7/7 before repository completion updates.

PostgreSQL integration coverage:
```powershell
$env:SENTINELX_TEST_DATABASE='1'
npm.cmd run test:alert-management:integration
```

Windows/PostgreSQL acceptance gate:
```powershell
git pull origin main
npm.cmd run quality
node scripts/migrate.js
npm.cmd run verify:alerts
```

Expected verifier output:

`Alert listing, filtering, detail inspection, source-event tracing, Analyst status workflow, Viewer denial and audit attribution verified.`

No external API or API key is required.
