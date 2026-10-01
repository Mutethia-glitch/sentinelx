# SentinelX Access Control — Task 06

Task 06 defines the approved Administrator, Security Analyst and Viewer/Management
roles and enforces permissions in the backend. It covers FR-027, the access
management portion of FR-028 and NFR-003–005, NFR-007 and NFR-015. Task 05's
authentication/session model is preserved.

## Minimal role policy

The task contract names the roles without a detailed matrix. The implementation
uses the smallest operational split consistent with those names: Administrator
can configure access; Security Analyst can handle security work without managing
roles; Viewer/Management can read security information without changing it.

| Permission | Administrator | Security Analyst | Viewer/Management | Implemented feature |
|---|---|---|---|---|
| `access.read` | Yes | Yes | Yes | Own access summary |
| `users.read` | Yes | No | No | Access-management user list |
| `users.roles.manage` | Yes | No | No | Role catalog and assignment |
| `dashboard.read` | Yes | Yes | Yes | Reserved for Task 24 |
| `events.read` | Yes | Yes | Yes | Event list/filter/inspection (Task 10) |
| `events.ingest` | Yes | Yes | No | Controlled ingestion (Tasks 08–09) |
| `categories.read` | Yes | Yes | Yes | Shared threat catalog (Task 11) |
| `categories.manage` | Yes | No | No | Audited taxonomy configuration (Task 11) |
| `rules.read`, `rules.manage` | Yes | Yes | No | Rule configuration/validation (Task 12); execution remains Task 13 |
| `alerts.read` | Yes | Yes | Yes | Reserved for Tasks 15–16 |
| `alerts.manage` | Yes | Yes | No | Reserved for Task 16 |
| `incidents.read` | Yes | Yes | Yes | Reserved for Task 18 |
| `incidents.manage` | Yes | Yes | No | Reserved for Task 18 |
| `investigations.read` | Yes | Yes | Yes | Reserved for Task 21 |
| `investigations.write` | Yes | Yes | No | Reserved for Task 21 |
| `responses.read` | Yes | Yes | Yes | Reserved for Task 22 |
| `responses.execute` | Yes | Yes | No | Reserved for Task 22 |
| `reports.read` | Yes | Yes | Yes | Reserved for Task 26 |
| `audit.read` | Yes | Yes | No | Reserved for Task 27 |

Reserved names establish the authorization vocabulary only. No event, rule,
alert, incident, response, report or dashboard feature is implemented by Task 06.
Response permission does not itself perform or automatically authorize a response;
Task 22 must enforce its human-controlled action workflow and auditing.

Role names are exact: `Administrator`, `Security Analyst`, `Viewer/Management`.
Multiple approved roles use the union of their explicit grants, matching the
existing many-to-many `user_roles` schema. Unknown roles/permissions grant nothing.
A user with no role may authenticate and inspect their own identity/access
summary, but cannot use privileged access-management routes. No wildcard grants,
client-supplied authority, custom-role API or role-creation API exists.

## Backend behavior

- Each access request validates the existing PostgreSQL session and reads the
  current active user's roles from PostgreSQL. Roles are not trusted from request
  headers, body, cookies, browser state or a stale login claim.
- `src/access/policy.js` is the immutable permission vocabulary. Unknown
  permissions deny by default. Later APIs must authenticate, retrieve live roles
  and call `requirePermission` before their protected operation.
- `src/access/service.js` performs the current API authorization checks. Only
  Administrators can list other users, retrieve the role catalog or assign roles.
  The user list is limited to the first 100 accounts sorted by email; responses
  contain only id, email, display name, active flag and approved roles.
- Role assignment requires an existing UUID user identifier, an exact JSON object
  containing `roles` and `reason`, unique approved role names (or an empty list to
  remove access), and a nonblank reason of at most 500 characters. The update
  replaces the user's assignments; it does not silently add arbitrary roles.
- PUT requires the same exact-Origin and bounded JSON rules used by authentication.
  Missing/expired sessions return 401; insufficient permission returns 403;
  invalid input returns 400; missing users return 404; unsafe last-admin removal
  returns 409; internal/database failures return a sanitized 503.
- Role mutation and initial Administrator setup share a transaction-level advisory
  lock. Mutation rechecks the actor's live Administrator permission inside the
  transaction, preventing stale role authority from authorizing a later change.
- Role changes, session revocation and `RBAC_ROLES_CHANGED` auditing commit
  together. Audit records contain the actor/context, target, old/new roles and
  reason; they contain no password or session token. Audit failure rolls back both
  assignments and revocation. Unchanged assignments are a no-op and keep sessions.
- Changing roles signs the affected user out across all sessions. They must sign
  in again to obtain access under the new roles. A following request cannot retain
  the old grants.
- A role update cannot remove the last active Administrator. Competing role
  updates are serialized, and tested concurrent self-demotions leave one active
  Administrator. Account deactivation is not an API in this task; future user
  management must preserve this invariant too. Direct database-owner changes are
  outside these API guards and must not be used as normal role management.

## Implemented HTTP and UI

| Method | Route | Required access | Result |
|---|---|---|---|
| GET | `/api/access/me` | Valid session; own user only | User identity, approved roles and policy grants |
| GET | `/api/access/users` | `users.read` | Safe user summaries, up to 100 |
| GET | `/api/access/roles` | `users.roles.manage` | Three approved roles and their policy grants |
| PUT | `/api/access/users/{uuid}/roles` | `users.roles.manage`, exact Origin | Updated role list and changed flag |
| GET | `/access` | Public static page; data/actions remain protected | Minimal role-aware access page |

The page supports existing authentication, own role display, Administrator role
assignment and logout. It contains no simulated SOC capabilities. Management
controls are initially hidden and appear only when the authenticated API grants
both user-list and role-management access. All actions remain backend-checked,
even if a caller reveals or edits the DOM. Dynamic user data uses text nodes;
the page uses a restrictive Content Security Policy and HttpOnly session cookies.
Passwords are cleared after login and no credentials/tokens are stored in browser
localStorage/sessionStorage.

## Windows setup and local gate

Stop the current server with Ctrl+C. In your repository's PowerShell window:

```powershell
git pull origin main
npm.cmd ci
```

Keep PostgreSQL's `bin` directory on the current session's PATH. If needed:

```powershell
$psqlFile = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $psqlFile) { throw "PostgreSQL command-line tools were not found." }
$env:Path += ";" + $psqlFile.DirectoryName
```

Use the same local connection from Tasks 04–05, entering the database password
privately. No secret is written to the repository:

```powershell
$env:PGHOST = "localhost"
$env:PGPORT = "5432"
$env:PGDATABASE = "sentinelx"
$env:PGUSER = "sentinelx_owner"
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
$databasePassphrase = Read-Host "Your DATABASE password" -AsSecureString
$databaseCredential = [System.Net.NetworkCredential]::new("", $databasePassphrase)
$env:PGPASSWORD = $databaseCredential.Password
Remove-Variable databasePassphrase,databaseCredential
node scripts/migrate.js
```

`003_rbac_roles.sql` seeds only the three role names and grants nobody a role.
No prior applied migration is changed. There are still 17 public tables, with
three migration records after Task 06.

Assign the first Administrator to your already provisioned application account:

```powershell
$env:RBAC_BOOTSTRAP_EMAIL = Read-Host "Existing application account to make Administrator"
node scripts/bootstrap-administrator.js
Remove-Item Env:RBAC_BOOTSTRAP_EMAIL
```

This local-operator command requires database credentials, an existing active
account and no active Administrator. It is serialized and audited with the
operator's OS user/host. It is not a public API or an ongoing bypass for role
management. If an active Administrator already exists, it refuses another
bootstrap. Sign in again after bootstrap because affected sessions are revoked.

Start the server, then open the exact configured origin:

```powershell
$env:NODE_ENV = "development"
$env:PORT = "3000"
$env:APP_ORIGIN = "http://localhost:3000"
node src/api/server.js
```

Visit `http://localhost:3000/access` in your browser. Sign in with your application
email and passphrase. Your Administrator role and role controls should appear.
An attempted removal of the only active Administrator must show a rejection.

Use `scripts/create-user.js` as documented in `docs/AUTHENTICATION.md` to provision
separate test application users when needed, then assign Security Analyst and
Viewer/Management through the Administrator page with a reason. Do not assign a
role as part of a login request. Check that those users see their own access but
no role-management controls, and that direct user-list/update requests are denied.

Local Windows/PostgreSQL 18.6 checks were confirmed on 2026-09-30: migration and bootstrap, Administrator controls, last-Administrator rejection, restricted Security Analyst and Viewer/Management controls, denied direct user-list requests and session revocation after role change. Task 06 is Complete. Errors appear in a red bordered notice that scrolls into view.
After testing, stop the server with Ctrl+C and clear the database password from
the server's PowerShell process using `Remove-Item Env:PGPASSWORD`.

## Automated checks

- `npm run quality`: foundation, syntax, authentication and RBAC policy/HTTP tests;
  no database required. The current suite contains 11 tests.
- `npm run test:rbac:integration`: real PostgreSQL authorization, concurrent first
  admin setup, concurrent last-admin demotion protection, session revocation,
  unapproved roles, unknown targets, safe responses and audit rollback.
- `npm run test:auth:integration` and `npm run test:database`: regression checks for
  Tasks 04–05 after applying migration 003.
- `npm run test:rbac:ui`: real Chromium plus PostgreSQL checks of all three roles,
  manually revealed controls, forbidden direct requests, literal rendering of
  HTML-looking display names, Administrator role changes, revoked sessions,
  last-admin rejection and logout.

All integration/browser commands require `SENTINELX_TEST_DATABASE=1` and connection
variables pointing to a separate disposable database. They apply migrations and
create/clean synthetic accounts and role mappings. Failed-login audit records or
schema objects may remain. Never select the local operational `sentinelx` database
for this suite. Run integration suites sequentially because first-admin bootstrap
uses database-wide state.

Playwright is a development-only dependency; the application still uses only `pg`
at runtime. Browser checks require a test Chromium installation, normally installed
with `npx playwright install chromium`. A preinstalled compatible Chromium binary
can be selected through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Linux browser
verification used a compatible Chromium Headless Shell 141 binary after the
default archive download failed. This does not change production dependencies.

Reference: [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

## Task 08 permission
Administrator and Security Analyst now have events.ingest for the controlled ingestion API. Viewer/Management remains read-only. Ingestion rechecks active actor roles at the database boundary and audits accepted events transactionally.

## Task 11 catalog permissions
All three approved roles have categories.read for the shared threat catalog. Only Administrator has categories.manage for audited label/description/availability configuration. Security Analyst manages rule selection in its later task rather than changing the global taxonomy.


## Task 41 company user administration extension

Task 41 adds Administrator-only `users.manage` while preserving the three
existing role names and all prior permission boundaries.

- `POST /api/access/invitations` creates a pending company user invitation with
  one approved initial role and an auditable reason, then sends a six-digit
  activation code.
- `PATCH /api/access/users/{uuid}/active` disables/re-enables a tenant user.
  Disablement revokes active sessions.
- Existing role changes continue to revoke sessions.
- The last active Administrator may neither be demoted nor disabled.

These operations are tenant-local because the Access service is connected only
to that company's PostgreSQL database. A company Administrator has no platform
administrator authority and cannot enumerate or mutate another tenant's users.
