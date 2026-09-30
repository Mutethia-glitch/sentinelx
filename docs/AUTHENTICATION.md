# SentinelX Authentication — Task 05

Task 05 implements authentication in the layered modular server. PostgreSQL
remains behind `src/data/`; the API boundary is `src/api/` and password/session
logic is `src/auth/`. RBAC, user-management UI and security workflow features are
not implemented by this task. Requirements covered: FR-026 and the authentication
portions of NFR-002–005, NFR-007 and NFR-015.

## Decisions and behavior

- Node's built-in HTTP server provides three authentication routes. `pg` is the
  only new runtime dependency and queries use PostgreSQL parameters.
- Passwords use Node's built-in scrypt (N=131072, r=8, p=1) with independent
  16-byte random salts and 64-byte derived keys. Comparisons use `timingSafeEqual`.
  New accounts require at least 15 Unicode characters; passwords are not trimmed
  or truncated and input is capped at 1024 UTF-8 bytes. Two concurrent derivations
  are allowed per process to bound memory use.
- Unknown users, inactive users and wrong passwords produce the same 401 message
  and perform password-derivation work. Malformed inputs produce 400; database or
  internal failures produce a generic 503, with no driver errors, SQL or secrets.
- Sessions use independently generated 32-byte opaque random tokens. Only SHA-256
  token digests are stored in `auth_sessions`. These high-entropy tokens need no
  signing key; there is no hardcoded or fallback authentication secret.
- A session has an eight-hour absolute limit and a 30-minute idle limit. Successful
  authenticated access updates idle activity; expired/revoked sessions fail closed.
  Every login creates a fresh token; separate client sessions are independent.
- Logout revokes the presented session in PostgreSQL and clears its cookie.
  Deactivating a user or changing their password hash revokes all their sessions
  through the migration's database trigger, including across reactivation.
- Login success, logout and local user provisioning are transactionally paired
  with authentication audit records. Provisioning records the local OS user/host
  as operator context. Failed credential checks also create generic
  `AUTH_LOGIN_FAILED` records, with no email, password, cookie, token or request
  body. Audit service/query/permission features remain Task 27; other rejected
  requests are not yet a comprehensive security logging implementation.
- Cookies are HttpOnly, SameSite=Strict, Path=/ and have an absolute Max-Age.
  HTTPS uses Secure and the `__Host-sentinelx_session` name. Local HTTP development
  uses `sentinelx_session`. Tokens are never returned in JSON, read from query
  strings or accepted through Authorization headers.
- POST requests require an exact `Origin` matching `APP_ORIGIN`, including for
  command-line clients. Missing/null/cross-origin requests fail with 403. No CORS
  permissions are enabled. This origin check complements SameSite cookie behavior.
- Login accepts only JSON containing exactly `email` and `password`. Bodies are
  bounded at 8 KiB; compressed bodies and unsupported media types are rejected.
  Logout accepts only an empty JSON object. Responses use `Cache-Control: no-store`.
- Login is throttled to 20 attempts per connection IP and 10 per normalized email
  in 15 minutes, including successful attempts. IP identity comes from the socket,
  not caller-controlled forwarding headers. The bounded in-memory limiter is for
  this single-process core; it resets on restart. Task 35 adds a broader API limiter
  but deliberately continues to use the actual socket peer and does not trust
  caller-supplied forwarding headers. Behind a reverse proxy, requests therefore
  share the proxy connection identity unless complementary deployment-edge controls
  are configured later.
- The server binds only to 127.0.0.1. Production requires an explicit HTTPS origin
  and a correctly configured local TLS reverse proxy. The core does not provision
  hosting or TLS. Database credentials come from process environment variables.

## HTTP contract

| Method | Route | Request | Success | Protection |
|---|---|---|---|---|
| POST | `/api/auth/login` | JSON `{email,password}`, exact Origin | 200 `{user:{id,email,displayName}}` and Set-Cookie | Input, origin, throttling |
| GET | `/api/auth/me` | Session cookie | 200 `{user:{id,email,displayName}}` | Valid active session |
| POST | `/api/auth/logout` | Session cookie, JSON `{}`, exact Origin | 204 and expired Set-Cookie | Valid active session, origin |

There is no signup, social login, password-reset API or role assignment in Task 05.
Only a local operator with database credentials can provision initial accounts.
The provisioning command never replaces an existing account/password or grants
any role. Task 06 defines Administrator, Security Analyst and Viewer/Management
permissions in `docs/ACCESS_CONTROL.md`; later security operations must enforce them.

## Windows local setup

From the repository's PowerShell window:

```powershell
git pull origin main
npm.cmd ci
```

Use the same PostgreSQL `bin` PATH and connection values verified in Task 04:

```powershell
$env:PGHOST = "localhost"
$env:PGPORT = "5432"
$env:PGDATABASE = "sentinelx"
$env:PGUSER = "sentinelx_owner"
$databaseCredential = Get-Credential -UserName "sentinelx_owner" -Message "Database password"
$env:PGPASSWORD = $databaseCredential.GetNetworkCredential().Password
Remove-Variable databaseCredential
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
node scripts/migrate.js
```

This adds `002_auth_sessions.sql` without modifying the applied `001_core.sql`.
The migration adds one table, two query indexes and a session-revocation trigger.
There should now be 17 public tables and two migration records.

Provision your first application login (its password is separate from the database
role password). Pick a passphrase of at least 15 characters. Enter it only in the
local credential prompt:

```powershell
$env:AUTH_USER_EMAIL = Read-Host "Application login email"
$env:AUTH_USER_NAME = Read-Host "Display name"
$applicationPassphrase = Read-Host "Create a NEW application passphrase (15+ characters)" -AsSecureString
$applicationCredential = [System.Net.NetworkCredential]::new("", $applicationPassphrase)
$env:AUTH_USER_PASSWORD = $applicationCredential.Password
try {
    node scripts/create-user.js
} finally {
    Remove-Item Env:AUTH_USER_PASSWORD -ErrorAction SilentlyContinue
    Remove-Variable applicationPassphrase,applicationCredential -ErrorAction SilentlyContinue
}
```

Start the API in this window:

```powershell
$env:NODE_ENV = "development"
$env:APP_ORIGIN = "http://localhost:3000"
node src/api/server.js
```

In a second PowerShell window, log in and keep the cookie in a web-request session:

```powershell
$loginEmail = Read-Host "Application login email"
$loginPassphrase = Read-Host "Your APPLICATION passphrase" -AsSecureString
$loginCredential = [System.Net.NetworkCredential]::new("", $loginPassphrase)
$loginBody = @{ email = $loginEmail; password = $loginCredential.Password } | ConvertTo-Json -Compress
$origin = @{ Origin = "http://localhost:3000" }
try {
    Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/auth/login" -Headers $origin -ContentType "application/json" -Body $loginBody -SessionVariable sentinelSession
} finally {
    Remove-Variable loginBody,loginCredential,loginPassphrase -ErrorAction SilentlyContinue
}
Invoke-RestMethod -Uri "http://localhost:3000/api/auth/me" -WebSession $sentinelSession
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/auth/logout" -Headers $origin -ContentType "application/json" -Body '{}' -WebSession $sentinelSession
```

After logout, another `/api/auth/me` request must return 401. Close the client
session when finished. Stop the server with Ctrl+C and remove `PGPASSWORD` from
the original shell using `Remove-Item Env:PGPASSWORD`.

Commands do not automatically load `.env` and never print passwords or token
values. An ignored local `.env` can be loaded with your own environment tooling;
do not paste or commit it. No frontend authentication screen exists yet.

## Verification and gate

`npm run quality` runs foundation checks, all JavaScript syntax checks and seven
authentication/HTTP tests without requiring PostgreSQL. The PostgreSQL integration
suite requires a separate disposable database selected through the same connection
variables, then:

```powershell
$env:SENTINELX_TEST_DATABASE = "1"
npm.cmd run test:auth:integration
npm.cmd run test:database
Remove-Item Env:SENTINELX_TEST_DATABASE
```

The flag acknowledges that the chosen database is disposable; it does not infer
whether a host/database is safe. Integration tests apply migrations, create
synthetic accounts and authentication audit/session records, and exercise the
real HTTP endpoints. Synthetic account/session records are cleaned up; generic
failed-login audit records and the test schema remain in the disposable database.
Never point this suite at an operational database.

Verified with PostgreSQL 16: login/logout, generic failures, injection resistance,
cookie flags, origin rejection, input limits, independent sessions, inactivity and
absolute expiry, permanent deactivation/password-change revocation, stale password
race rejection, hashed token storage and transactional login/logout audit failures.
Task 04's integrity suite still passes; dependency audit reports no vulnerabilities.

Task 05 is Complete. On 2026-09-29, the user verified migration 002, local
provisioning, API startup, login, authenticated current-user retrieval, logout and
subsequent access rejection on Windows/PostgreSQL 18.6. The application passphrase
was entered through `Read-Host -AsSecureString`, separately from the database
password. This record contains no credentials, account identifiers or tokens.
Task 06 adds the role policy and protected access-management APIs; see `docs/ACCESS_CONTROL.md`.

## Reference guidance

- [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Node crypto API](https://nodejs.org/docs/latest-v22.x/api/crypto.html)
- [node-postgres parameterized queries](https://node-postgres.com/features/queries)
