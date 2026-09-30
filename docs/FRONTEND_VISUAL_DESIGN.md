# Task 37 — Frontend visual design and polish

Task 37 applies the approved SentinelX visual direction to the existing secure frontend without changing the application architecture.

## Design source and implementation boundary

A separate private Lovable mock-data prototype was used only to establish the visual direction: a restrained professional SOC interface with strong information hierarchy, cyan/blue operational accents, semantic severity/status colors, dense but readable tables, clear analyst workspaces, and responsive navigation. After prototype approval, the user selected a light production theme for SentinelX.

The Lovable React/Tailwind prototype is not imported into SentinelX and is not connected to the SentinelX repository. SentinelX remains the existing Node.js/PostgreSQL application with static HTML/CSS/JavaScript consoles. No Supabase, frontend framework, runtime dependency, database, authentication replacement, API replacement, or external integration was added by Task 37.

## Shared design system

All seven consoles load `/ui/sentinelx-theme.css`. The shared theme defines:

- light off-white/slate application and sidebar surfaces with white operational panels;
- typography, spacing, border, radius and focus conventions;
- responsive desktop sidebar and compact narrow-screen navigation;
- page headers, operational panels and metric cards;
- form fields, buttons, filter areas and pagination;
- dense tables with contained horizontal scrolling;
- evidence/code blocks and definition grids;
- semantic LOW/MEDIUM/HIGH/CRITICAL and lifecycle treatments;
- visually distinct CONTAINED and RESOLVED states;
- notification, finding, audit-entry and role-management cards;
- success/error/info state presentation, including the existing visible `Incident created.` success state.

The shared frontend helper marks the current navigation item and applies presentation-only semantic classes to exact severity/status values. It does not grant permissions, store data, or alter backend authorization.

## Security and accessibility preservation

Task 36 permission-aware navigation remains unchanged: protected links start hidden and are shown only from live `/api/access/me` grants. Backend RBAC remains authoritative.

API/user values continue to render through `textContent`, DOM nodes and form values. Task 37 does not introduce `innerHTML`, browser credential storage, client-side tokens, or unsafe script execution. Existing CSP and shared-asset no-store/no-sniff/same-origin protections remain in force.

The light theme includes visible focus states, labeled form controls, high-contrast dark text on light surfaces, status labels in addition to color, reduced-motion handling, and a responsive layout designed for approximately 390px and wider. Technical evidence/code blocks deliberately remain dark for legibility and visual separation. Wide tables scroll inside their table containers rather than forcing page-level horizontal scrolling.

## Verification

Run:

```powershell
npm.cmd run quality
if ($LASTEXITCODE -ne 0) { throw 'Quality checks failed' }

npm.cmd run verify:frontend-design
if ($LASTEXITCODE -ne 0) { throw 'Task 37 frontend design verification failed' }

npm.cmd run test:frontend-design:ui
if ($LASTEXITCODE -ne 0) { throw 'Task 37 frontend design browser verification failed' }
```

The Task 37 verifier and browser check require no PostgreSQL. The browser check uses synthetic stub services and Playwright Chromium.
