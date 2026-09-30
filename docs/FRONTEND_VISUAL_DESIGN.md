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
