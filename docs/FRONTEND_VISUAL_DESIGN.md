# Task 37 — Frontend visual design and polish

Task 37 applies the user-approved Lovable SentinelX prototype to the existing secure frontend without changing backend behavior.

## Authoritative design source

The final private Lovable prototype is the Task 37 visual source of truth.

Lovable project commit:

`5514aa322c48e6c21cea1518a5b98e946fc4bc11`

The final Lovable source is imported verbatim into:

- `frontend/design-reference/lovable/sentinelx-console.tsx`
- `frontend/design-reference/lovable/styles.css`

Those reference files preserve the approved seven-screen composition, dark OKLCH theme tokens, component hierarchy, responsive shell, and Lucide icon choices.

The production SentinelX runtime does **not** replace the existing application with Lovable's React/Tailwind stack. The same visual system is adapted to the existing static HTML/CSS/JavaScript consoles so the already-implemented Node.js/PostgreSQL backend, APIs, authentication, RBAC, CSP, and safe DOM rendering remain unchanged.

## Final visual system

The served frontend now follows the approved Lovable design:

- dark navy/slate SOC application shell;
- 240px desktop sidebar with SentinelX/IPHYN branding and the same navigation icon concepts;
- collapsible desktop navigation and mobile drawer behavior;
- sticky 64px operational top bar;
- restrained cyan/blue primary accent;
- exact Lovable background, card, sidebar, border, severity, lifecycle, success, warning and information OKLCH tokens;
- metric cards, panels, filter areas, dense tables, evidence blocks, notices, pagination, entity/finding/action presentation and analyst controls;
- distinct LOW/MEDIUM/HIGH/CRITICAL and NEW/INVESTIGATING/CONTAINED/RESOLVED/DISMISSED treatments;
- contained horizontal scrolling for dense tables rather than page-level overflow;
- one authoritative runtime stylesheet for layout/spacing, with page-only exceptions scoped by `body[data-page]` to prevent CSS collisions;
- normalized panel/content spacing and a stable top-right session-action cluster for Refresh and Sign out;
- the standard logout/exit icon for Sign out.

The real backend data replaces Lovable mock values. No fabricated production records are introduced.

### Dashboard screenshot alignment — 2026-10-01

The severity and workflow panels use Lovable's label/count rows with colored dots
and thin full-width tracks below. Severity is displayed Critical to Low; bar widths
represent each count's share of its own alert or incident group (zero stays empty).
Threat categories use divided list rows with right-aligned counts, readable labels
and the canonical code available on hover. Every category returned by the API is
rendered, with no frontend top-ten cutoff.

Recorded response outcomes use two large value-first cards: green successful
containment and neutral reported unsuccessful. The API has no pending-validation
metric, so the mock's pending label is not reused. Existing action-type details
remain below the cards. Severity remains explicitly all-time, and alert/incident
groups stay separate to preserve the existing API semantics. Panels stack below
1280px, matching the Lovable reference breakpoint. All styling is dashboard-scoped
in the shared stylesheet; the backend, API, migrations and taxonomy are unchanged.

### Automatic console updates and UTC graph — 2026-10-01

The seven-day dashboard trend is a cyan column graph built from the existing UTC
API buckets, with a selector for alerts (default), events, incidents and responses.
Each column has its actual count and UTC day. Zero counts have zero height; the
current UTC day remains partial. A disclosure retains the complete daily table.

All seven consoles poll their existing authorized APIs every five seconds while
the tab is visible and active. This is near-real-time snapshot polling, not a
server-push event stream or a new ingestion/detection scheduler. Open events,
alerts (including source-event details), incidents, investigations and response
history refresh alongside their lists. Audit selections remain open because audit
entries are immutable. Current filters, pages, selected trend series and incident
tabs are preserved. API/RBAC/database/session behavior is unchanged.

The shared refresh coordinator never overlaps its refresh cycles or starts while
another API request is pending. Background rendering checks both page generation
and user activity before applying results. It does not clear the screen, steal
focus or replace unsaved form values. Refresh pauses while editing or with an
unsaved form, offline, hidden, or after 60 seconds without trusted user activity;
the status indicator explains the pause. This bounds the session idle extension
caused by polling existing authenticated endpoints. Typing/clicking resumes
activity; saving/resetting forms clears their pending edits. Manual refresh remains
available. The status indicator records the last successful background update.

Requests time out after 15 seconds. Failed background refreshes keep the last
snapshot, show delayed/stale status, and retry with exponential backoff (up to
60 seconds, or the server's numeric Retry-After up to five minutes). Authentication
or permission failures clear protected UI through the existing reset flow.
Sign-out invalidates pending results; polling stops while signed out. No Web
Storage, new runtime dependency, backend endpoint or migration is introduced.

Browser acceptance (synthetic APIs, no database):

```powershell
node --test tests/integration/live-updates-ui.test.js
if ($LASTEXITCODE -ne 0) { throw "Live console browser checks failed" }
```

## Screen mapping

The existing SentinelX backend workflows are fitted into the approved design:

- **Dashboard:** Lovable-style metric cards, severity/workflow/threat panels, response outcomes and UTC trend presentation.
- **Events:** two-column normalized event stream and event inspection workspace.
- **Alerts:** deterministic detection queue with evidence workspace and analyst status control.
- **Incidents:** incident queue + create panel, then the approved evidence/investigation/response tabbed workspace with separate incident control area.
- **Notifications:** inbox/send split with severity-aware presentation.
- **Audit:** protected entry table plus selected entry context panel.
- **Access:** structured secure sign-in screen, authenticated access overview, and role-management presentation. There is no self-service sign-up control because the backend exposes no registration endpoint; accounts are administrator-provisioned.

## Backend and security boundary

Task 37 does not change backend logic. In particular:

- no PostgreSQL schema or migration changes;
- no API contract or authorization changes;
- no Supabase;
- no authentication/session replacement;
- no client-side credential, token, role, permission or security-record storage;
- no destructive/offensive response behavior;
- no unsafe HTML rendering.

Task 36 permission-aware navigation remains presentation-only. Protected links start hidden and are revealed only from live `/api/access/me` grants. Backend RBAC remains authoritative.

User/API values continue to render through `textContent`, text nodes, DOM creation and form values. The existing restrictive CSP remains in force.

The exact visible incident creation success behavior remains:

`message('Incident created.',false,true);`

## Verification

Run on Windows:

```powershell
npm.cmd run quality
if ($LASTEXITCODE -ne 0) { throw "Quality checks failed" }

npm.cmd run verify:frontend-design
if ($LASTEXITCODE -ne 0) { throw "Task 37 frontend design verification failed" }

npm.cmd run test:frontend-design:ui
if ($LASTEXITCODE -ne 0) { throw "Task 37 frontend design browser verification failed" }
```

The Task 37 verifier and browser gate do not require PostgreSQL. The browser gate uses synthetic stub services and Playwright Chromium.

The site root redirects to `/access`, the existing secure sign-in and company access page. Failed login requests display the backend error in the page status area; expired sessions retain the sign-in prompt.

Console sign-in panels start hidden while backend session checks run and appear when authentication or connectivity fails. Verification shows a 60-second resend countdown beside the button, retained across reloads in the current tab.
