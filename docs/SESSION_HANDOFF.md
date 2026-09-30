# SentinelX continuation checkpoint

Tasks 01–23 are **Complete**. Task 24 (Dashboard) is implemented and
**Verification Pending**. Do not begin Task 25 (Search and Filtering) before
Task 24's Windows/PostgreSQL acceptance and the user's request.

Task 24 fulfills FR-032 using existing security event, alert, incident and
response-action data. No new migration was required. Applied append-only,
checksum-protected migrations 001–014 remain unchanged.

Endpoint:
- `GET /api/dashboard`; requires existing `dashboard.read` permission,
  granted to Administrator, Security Analyst and Viewer/Management.
- No parameters, mutation routes or general cross-record filters are introduced
  (Task 25 owns search/filtering).
- A single PostgreSQL REPEATABLE READ, READ ONLY transaction supplies all
  aggregates from one snapshot, timestamped by `transaction_timestamp()`.
- Errors roll back and return a generic unavailable message, not SQL/credentials.

Dashboard data:
- All-time events/alerts/incidents, active incidents (NEW, INVESTIGATING,
  CONTAINED), NEW alerts, recorded responses, reported successes/failures,
  successful manually attested containment and mean generated incident risk.
- Rolling 24-hour events by received_at, alerts/incidents by created_at,
  responses by performed_at.
- Separate alert/incident LOW/MEDIUM/HIGH/CRITICAL breakdowns and independent
  approved alert/incident status buckets, zero-filled when absent.
- Leading ten alert and incident taxonomy codes; null incident classification
  is UNCLASSIFIED.
- Response-action totals and reported outcomes by action.
- Seven current/preceding UTC calendar-day buckets, where current UTC day is
  partial. No forecasts or hard-coded decorative metrics.
- Task 22 response succeeded flags remain human attestations, not independently
  measured actions. Mean Task 20 risk is null when no incidents exist.

`/dashboard` is an authenticated, responsive, read-only web console with a
manual refresh button and safe text-rendered metric bars/tables. The existing
console navigation exposes the dashboard. No external analytics API/key is used.

Unit/API tests, PostgreSQL acceptance verifier and optional browser integration
are implemented. Task 24 must remain Verification Pending until the user runs:

```powershell
git pull origin main
npm.cmd run quality
node scripts/migrate.js
npm.cmd run verify:dashboard
```

Expected verifier output:

`Live dashboard totals, severity/status distributions, threat and UTC trends, recorded response outcomes, Viewer access, refresh accuracy and read-only rollback verified. Synthetic changes cleaned up.`

Optional explicit disposable-database checks:

```powershell
$env:SENTINELX_TEST_DATABASE='1'
npm.cmd run test:dashboard:integration
npm.cmd run test:dashboard:ui
```

PostgreSQL remains local on the user's Windows computer. Do not expose real
`.env` values, edit applied migrations, or claim tests passed before validation.
See `docs/DASHBOARD.md`, `docs/DEVELOPMENT_STATUS.md` and
`tasks/24-dashboard.md`.

Task 25 Search and Filtering remains **Not Started**.
