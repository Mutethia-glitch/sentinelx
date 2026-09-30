# Task 36 — Frontend security and UX

Task 36 hardens the existing SentinelX operational consoles without changing backend authority or inventing new capabilities.

## Shared frontend behavior

All seven consoles load `/ui/sentinelx-ui.js`. Permissioned navigation links are hidden in HTML by default and are revealed only after the existing protected `GET /api/access/me` response confirms the corresponding grant. On sign-out or authentication reset, those links are hidden again.

The shared helper also provides a consistent loading-state message and safe fallback text for network failures. It does not store identity, roles, permissions, passwords, cookies, or API data in `localStorage` or `sessionStorage`.

Navigation grants map directly to implemented backend permissions:

- Dashboard → `dashboard.read`
- Events → `events.read`
- Alerts → `alerts.read`
- Incidents → `incidents.read`
- Notifications → `notifications.read`
- Audit → `audit.read`
- Access management remains available as the sign-in/access entry point; backend APIs still decide what the authenticated user may view or change.

Navigation visibility is convenience only. It never substitutes for backend authentication/RBAC.

## Safe rendering and data protection

Operational API values continue to be rendered using `textContent`, text nodes, DOM element creation, or form value assignment. Task 36 adds regression checks forbidding `innerHTML` assignment, `insertAdjacentHTML`, `document.write`, `eval`, `localStorage`, and `sessionStorage` in the SentinelX frontend.

Password fields use `autocomplete="current-password"` and are cleared after login attempts. Session tokens remain HttpOnly cookies and are never exposed to frontend JavaScript.

The existing page Content Security Policy remains restrictive: scripts/styles/connect calls are same-origin, objects are disabled, base URI is disabled, framing is denied, and forms cannot submit outside the scripted same-origin API flow. The shared helper asset is no-store, no-sniff, same-origin-resource-policy protected, and GET-only.

## Analyst states

Each console presents an explicit loading state before primary data loads and updates navigation after live access is retrieved. Authentication loss clears protected panels/navigation. A valid authenticated user without a console's read grant remains identified but sees a clear permission-denied message rather than fabricated data.

Task 36 does not turn frontend visibility into authorization, add client-side tokens, add visual-only security claims, or implement Task 37 testing infrastructure.

## Verification

Run:

```powershell
npm.cmd run quality
if ($LASTEXITCODE -ne 0) { throw 'Quality checks failed' }

npm.cmd run verify:frontend-security
if ($LASTEXITCODE -ne 0) { throw 'Task 36 frontend security verification failed' }

npm.cmd run test:frontend-security:ui
if ($LASTEXITCODE -ne 0) { throw 'Task 36 frontend browser verification failed' }
```

The verifier requires no PostgreSQL. The browser check uses stubbed SentinelX services, synthetic identity/data, and Playwright Chromium; it does not require a database or real credentials.


## Acceptance — 2026-09-30

Windows local acceptance passed. `npm.cmd run verify:frontend-security` verified permission-aware navigation, loading/error handling, safe DOM rendering and browser credential-storage protections. `npm.cmd run test:frontend-security:ui` passed 1/1 in Playwright, and the full quality suite passed 181/181. Task 36 is Complete.
