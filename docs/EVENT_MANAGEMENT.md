# Event management — Task 10

The `/events` page provides authenticated event viewing, searching, filtering and
inspection. Administrator, Security Analyst and Viewer/Management can read events
through the existing `events.read` grant. Unauthenticated users receive 401 and
users without an approved role receive 403. Every list/inspection request rechecks
live identity and roles; hiding UI controls does not authorize access.

Events are separate from alerts/incidents. This page does not run detection,
change event evidence, delete records or perform response actions.

## Implemented read APIs

| Method / endpoint | Behavior |
|---|---|
| GET /api/events | Bounded filtered summaries, newest occurrence first. |
| GET /api/events/{uuid} | One event, normalized representation and preserved raw evidence; 404 if absent. |

The list returns `{events, page, pageSize: 50, hasMore}`. Each summary contains id,
timestamp, source, type, receivedAt, normalized, severity, user, host, action,
status and IPs. It excludes raw evidence and metadata. Ordering is stable by
`occurred_at DESC, id DESC`; offset pages can shift if new events arrive between
requests. Pages are limited to 1–2000 (100,000 accessible rows per filter); narrow
filters for larger result sets. No expensive total-count query is used.

Inspection returns `{event: {id, source, type, timestamp, receivedAt, normalizedAt,
event, rawData}}`, where the inner `event` is the canonical structure. Existing
unnormalized rows have a null inner event/normalization time, while source/type/time
and raw evidence remain inspectable. Read APIs do not normalize historical rows.
All data responses are no-store. Missing/expired sessions clear the session cookie.
Database errors return a sanitized 503 without SQL or connection details.

## Event filters

| Query | Matching |
|---|---|
| q | Literal case-insensitive substring of source, type, user, host, action, status or IPs; maximum 200 characters. |
| source, type, user, host, action, status | Exact case-sensitive text, maximum 500 characters each. |
| severity | LOW, MEDIUM, HIGH, CRITICAL or UNKNOWN for null severity. |
| sourceIp, destinationIp | Exact validated IPv4/IPv6 text as recorded. |
| from, to | Inclusive occurrence-time bounds; ISO timestamps with explicit timezone. |
| page | Integer 1–2000, defaults to 1. |

Unknown, duplicate, empty or malformed filters are rejected with 400. Query length
is bounded to 4096 encoded characters. `%`, `_` and backslash in search are literal,
not wildcard instructions. All filter values use PostgreSQL parameters; columns
are selected from fixed internal mappings. Raw evidence/metadata are not searched.
These APIs implement event-specific filters required by Task 10; broader SOC search
remains Task 25.

The page converts local date/time inputs to UTC query bounds and displays occurrence
and receipt times in UTC. Applying/clearing filters returns to page 1. Empty results
are shown explicitly. Inspection shows normalized JSON and raw JSON as text, never
interpreted HTML. Pending/stale requests are ignored after sign-out or a newer
request, and event details are cleared when access fails or filters change.

## Local API availability

All endpoints are implemented in this repository and served on the configured
local `APP_ORIGIN` by `npm start`. There is no external subscription or API key.
Pulling main stores their code/documentation locally. See [LOCAL_API_GUIDE.md](LOCAL_API_GUIDE.md)
for the current endpoint inventory. Keep database credentials in local environment
variables; never put passwords in event filter queries.

## Verification

- `npm run quality`: 21 unit/API checks including filter validation, permission
  rejection, sanitized failures and parameterized literal search.
- `npm run test:events:ui`: disposable PostgreSQL plus Chromium browser checks for
  53 synthetic records, multiple pages, exact/search/time/IP filters, unknown
  severity, pending normalization, raw inspection, all approved roles, no-role
  denial, role removal, logout and XSS-safe evidence rendering.
- Existing authentication, RBAC, model and ingestion integration suites pass
  sequentially with a shared disposable database.

The browser test requires `SENTINELX_TEST_DATABASE=1` and an installed Playwright
Chromium; optionally set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an existing test
binary. Automated tests use synthetic data and clean up their own fixtures.

On Windows, stop the server, pull main and restart it with your existing database
environment. No new migration or dependency is needed. Open
`http://localhost:3000/events`, sign in as Administrator and confirm that the
previously accepted synthetic events appear. Filter source `sentinelx-simulated`
and severity LOW, inspect an event, and check normalized data plus raw evidence.
Search for a nonexistent value and confirm an empty result; clear filters to
restore records. Repeat viewing/inspection as Viewer/Management, then sign out
and confirm `/api/events` returns Authentication required. Task 10 remains
In Progress until the local viewing/filter/inspection/access checks succeed.
