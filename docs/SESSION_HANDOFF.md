# SentinelX continuation checkpoint

Tasks 01–24 are **Complete**. Task 24's Windows/PostgreSQL Dashboard verifier passed
on 2026-09-30. Task 25 (Search and Filtering) is implemented and
**Verification Pending**. Task 26 (Reporting) remains Not Started and must not
begin until Task 25 is verified and the user requests it.

Task 25 extends the **existing** protected:
- GET /api/events (events.read);
- GET /api/alerts (alerts.read);
- GET /api/incidents (incidents.read).

`src/search/filters.js` unifies validation of:
`q`, `from`, `to`, `severity`, `status`, `categoryCode`, `source`,
`sourceIp`, `destinationIp`, `user`, `host`, `ruleId`,
`mitreTechniqueId`, and `page`. Legacy event type/action, incident
assignedTo, event UNKNOWN severity and per-domain status rules remain intact.
`categoryCode=UNCLASSIFIED` matches null only on incidents.

Date bounds are inclusive UTC-normalized ISO timestamps. Event dates filter
occurred_at; alert/incident dates filter created_at. Pagination stays 50 items,
page 1–2000, latest first and stable ID tie-break. Bad, duplicate, empty,
oversized, invalid IP/UUID/MITRE/taxonomy/enum/date and reversed-range inputs
return HTTP 400.

Entity constraints use canonical normalized linked security events. Event
category/rule/MITRE applies to a single linked alert; alert entity constraints
apply to a single linked event; incident linked source/rule/MITRE/entity
constraints apply together to one linked alert-event chain. All queries use
parameter binding and EXISTS to avoid cross-evidence false positives or
duplicates from many-to-many joins. MITRE mapping is contextual rule metadata,
not a per-event attack-technique assertion.

All three existing list console forms expose applicable new filters; their
existing FormData/date conversion/pagination/clear workflow is retained.
No raw evidence, sensitive notification data, new unauthenticated search
endpoint, report export or destructive response functionality is introduced.

Task 25 adds **no migration**. Applied migrations 001–014 are immutable and
checksum tracked. PostgreSQL is hosted on the user's Windows computer.
No Supabase, external search service or API key is required.

Focused Task 25 query/SQL unit tests, a live PostgreSQL verifier and an
optional Chromium smoke test were added. The verifier uses the established
synthetic incident fixture, adds a temporary unique MITRE mapping, checks all
three authorized roles, meaningful AND combinations, positive and negative
filter results, date boundaries, category/status differences, input rejection
and no duplicate pagination; it then cleans up MITRE and fixture data.

Windows/PostgreSQL acceptance gate:

```powershell
git pull origin main
npm.cmd run quality
node scripts/migrate.js
npm.cmd run verify:search
```

Expected result:

`Consistent event/alert/incident date, severity, status, category, IP, user, host, rule and MITRE filters, evidence-chain matching, RBAC and safe pagination verified. Synthetic changes cleaned up.`

Optional checks only with an explicitly disposable database:

```powershell
$env:SENTINELX_TEST_DATABASE='1'
npm.cmd run test:search:integration
npm.cmd run test:search:ui
```

Task 25 must remain Verification Pending until the user reports Windows success.
Do not start Task 26 before that gate and explicit continuation. Do not print
or commit actual `.env` values or other credentials. See
`docs/SEARCH_FILTERING.md` and `docs/DEVELOPMENT_STATUS.md`.
