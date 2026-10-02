# Task 41 — Production Deployment

## Status

Task 41 application/deployment support is implemented, but a live internet deployment
must pass the production smoke and onboarding checks before Task 41 can be marked Complete.

## Production architecture

SentinelX uses **database-per-company isolation**. It does not place unrelated
companies in one security-events database and depend on application
`company_id` predicates for separation.

```text
Internet
  |
HTTPS / HSTS edge
  |
  +-- signup.<domain> --------------------+
  |                                      |
  |                              onboarding/control plane
  |                              platform PostgreSQL
  |                              tenant metadata only
  |
  +-- <company-a>.<domain> --> SentinelX tenant A --> PostgreSQL A
  |
  +-- <company-b>.<domain> --> SentinelX tenant B --> PostgreSQL B
```

The onboarding database may contain company name, generated tenant UUID/slug,
Administrator email, provisioning status, and temporary signup-verification
material. It **does not contain** tenant security events, alerts, incidents,
investigations, response history, reports, or tenant audit history.

Every company runtime receives its own `DATABASE_URL`, exact HTTPS
`APP_ORIGIN`, random tenant UUID and host-only SentinelX cookies. A user/session
from one company is therefore not a database identity in another company.

## Company signup and initial Administrator

The public onboarding service exposes the signup page and three mutation APIs.

1. Company submits company name, first Administrator name/email and a password of
   at least 15 characters.
2. SentinelX generates random tenant/registration UUIDs and a non-authoritative
   URL slug.
3. The password is immediately converted to the existing salted scrypt hash.
   Plaintext is not stored.
4. A cryptographically generated six-digit code is HMAC-protected at rest and
   sent to the Administrator email.
5. Correct verification changes the registration to VERIFIED.
6. The onboarding service calls the configured HTTPS infrastructure provisioner.
7. The provisioner must create an isolated PostgreSQL database and SentinelX
   runtime, apply migrations 001–016, run `tenant:bootstrap`, configure HTTPS
   routing and return the exact expected tenant origin.
8. The platform marks the company ACTIVE and deletes the temporary signup
   password hash and verification digest from its database.
9. The first Administrator signs in at that company's URL and completes normal
   password + six-digit email 2FA.

The provisioner request is identified by immutable `tenantId`. **Provisioning
must be idempotent by tenantId.** A network interruption can occur after
infrastructure creation but before the onboarding service receives the response;
a retry must return the same tenant rather than create another database.

## Tenant bootstrap

For a new company database, the trusted provisioner performs:

```text
npm run db:migrate
npm run tenant:bootstrap
```

The bootstrap process receives the verified tenant identity and initial
Administrator **scrypt password hash** through transient secret environment
variables. It writes one `tenant_profile` row, creates the first company
Administrator if necessary, assigns the existing Administrator role and records
`TENANT_PROVISIONED` in that tenant's audit trail.

Bootstrap is deliberately fail-closed and idempotent. A retry must match the
same tenant UUID/name/slug and Administrator email/password hash. It will not
silently turn a different existing account into the company Administrator.

Because the normal SentinelX migration chain is applied to every tenant database,
each new company receives the complete accepted core, including the same fifteen
canonical threat categories and Task 28's deliberately partial ATT&CK mappings.

## Six-digit email 2FA

Production tenant configuration always enables email 2FA.

```text
email + password
       |
       v
PASSWORD VERIFIED
       |
       | no session created
       v
6-digit code sent by email
       |
       v
EMAIL CODE VERIFIED
       |
       v
SentinelX session cookie issued
```

Rules:

- code is generated with Node cryptographic randomness and is always six digits;
- code lifetime is 10 minutes;
- maximum five failed code attempts;
- resend cooldown is 60 seconds;
- resend replaces the usable code but does not reset failed-attempt history;
- a new password login revokes prior outstanding login challenges for that user;
- successful code verification is single-use;
- readable codes are never stored in PostgreSQL or audit records;
- challenge storage contains only an HMAC-SHA256 digest scoped to challenge and
  purpose using `AUTH_OTP_SECRET`;
- normal session tokens remain opaque random values with only SHA-256 digests
  stored in `auth_sessions`;
- production cookies are `Secure; HttpOnly; SameSite=Strict; Path=/` and use
  the `__Host-` prefix;
- the temporary 2FA challenge cookie is HttpOnly and cannot be used as an
  authenticated SentinelX session.

The email relay is provider-independent. `EMAIL_DELIVERY_URL` must be HTTPS and
the bearer credential comes only from the runtime secret environment. A concrete
provider can therefore be changed without rewriting authentication.

## Company-managed users and roles

A company Administrator manages users **inside that tenant database only**.

Existing roles remain authoritative:

| Role | Purpose |
|---|---|
| Administrator | Company user/role/configuration administration plus operational privileges |
| Security Analyst | Operational detection, alert, incident, investigation and approved response work |
| Viewer/Management | Read-oriented security and management visibility |

New Administrator-only behavior:

- POST `/api/access/invitations`: create a pending user invitation with one
  approved initial role and an auditable reason;
- invited user receives a six-digit activation code;
- `/activate` requires invited email, six-digit code and a new 15+ character
  password before the user row/role is created;
- PATCH `/api/access/users/{id}/active`: disable or re-enable a company user;
- disabling a user revokes all active sessions;
- role changes continue to revoke sessions;
- neither role change nor disablement may remove/disable the last active
  Administrator.

There is no tenant selector for ordinary users. The company is established by
the exact tenant origin/database before authentication.

## Trusted proxy and client address

Tasks 35/39 correctly ignored forwarding headers on local deployments. Task 41
adds explicit reverse-proxy trust.

`TRUSTED_PROXY_IPS` is empty by default. If a request's socket peer is not in
that exact allowlist, SentinelX ignores `X-Forwarded-For`. If the peer is
trusted, SentinelX accepts only one syntactically valid client IP value; a comma
chain or invalid value is rejected as client identity and the proxy address is
used instead.

The example Nginx configuration **replaces** rather than appends
`X-Forwarded-For`. Cloud load balancers must provide an equivalent, documented
trust boundary. Do not put broad public CIDRs in `TRUSTED_PROXY_IPS`.

## HTTPS and HSTS

The Node application may speak HTTP only on the private/container side of the
trusted TLS edge. Public tenant and onboarding origins must be HTTPS.

The HTTPS edge must:

- redirect/deny plain HTTP according to deployment policy;
- terminate a valid certificate;
- emit HSTS;
- forward to a non-public application port;
- preserve the exact public host;
- replace client-IP forwarding according to the trusted-proxy contract.

`deploy/nginx.sentinelx.conf.example` is an example, not a committed private
key/certificate or a substitute for a managed cloud load balancer.

## Secret/environment model

Never commit real values. Files named `deploy/*.env` are ignored by Git and
Docker build context. Example files contain names/placeholders only.

Tenant runtime:

- `DATABASE_URL`
- `APP_ORIGIN`
- `TENANT_ID`, `TENANT_NAME`, `TENANT_SLUG`
- `AUTH_OTP_SECRET` (independent random secret, 32+ bytes)
- `EMAIL_DELIVERY_URL`, `EMAIL_DELIVERY_TOKEN`, `EMAIL_FROM`
- `TRUSTED_PROXY_IPS`
- configured event-source values and any optional integration secrets

Onboarding/control plane:

- `PLATFORM_DATABASE_URL` — separate database
- `PLATFORM_ORIGIN`
- `PLATFORM_OTP_SECRET` — independent from tenant OTP secrets
- email delivery values
- `TENANT_BASE_DOMAIN`
- `TENANT_PROVISIONER_URL`, `TENANT_PROVISIONER_TOKEN`
- `TRUSTED_PROXY_IPS`

Use the cloud/host secret manager. Do not persist provisioning bootstrap
variables after the bootstrap process exits.

## Container artifacts

The root `Dockerfile` uses Node 22 Alpine, installs only the PostgreSQL client
needed by migrations, installs production npm dependencies, runs the application
as the non-root `node` user, and contains no baked credentials.

Reference Compose files under `deploy/` bind Node ports to host loopback only.
They are convenient single-host examples; a managed container platform may use
the same image/config contract instead.

## Database migrations

Tenant database:

```text
npm run db:migrate
```

Task 41 adds append-only migration
`016_tenant_identity_and_email_auth.sql`. Migrations 001–015 are unchanged.

Onboarding database:

```text
npm run db:migrate:platform
```

It has an independent checksum ledger and migration directory under
`platform/db/migrations/`.

Never run disposable integration tests against a production tenant or platform
database.

## Health and startup

Both the tenant runtime and onboarding service expose GET `/healthz` for
process-level liveness. Startup separately verifies required database schema;
tenant startup also refuses a configured tenant identity that does not exactly
match the database's `tenant_profile`.

Task 42 remains responsible for expanded observability/recovery behavior.

## Acceptance gates

Repository/local implementation gates:

```powershell
npm.cmd run quality
npm.cmd run verify:deployment

$env:SENTINELX_TEST_DATABASE = "1"
npm.cmd run db:migrate
npm.cmd run test:tenant-auth:integration
npm.cmd run test:platform-signup:integration
```

The integration database must be disposable.

Live acceptance, after real infrastructure exists:

```powershell
$env:DEPLOYMENT_PLATFORM_ORIGIN = "https://signup.<your-domain>"
$env:DEPLOYMENT_TENANT_ORIGIN = "https://<test-company>.<your-domain>"
npm.cmd run smoke:online
```

The live smoke test requires HTTPS, HSTS, healthy onboarding/tenant processes
and protected pages. Final Task 41 acceptance must additionally perform one
controlled company signup through a real recipient mailbox, verify the six-digit
email, provision a tenant, sign in with password + a fresh six-digit login code,
invite one synthetic company user with a role, activate/sign in that user, and
confirm that the account cannot authenticate to another company's isolated
tenant.

No production credentials or verification codes should be pasted into issue,
chat, test output or source control.

The tenant Access page includes a company-registration link. Set `COMPANY_SIGNUP_URL` to the deployed HTTPS onboarding signup page to enable its redirect. Until configured, the link displays registration availability rather than accepting credentials or creating accounts in the company database.

## Render / Neon pilot onboarding preparation

`deploy/render.platform.yaml` defines a separate free-plan Docker web service
named `sentinelx-onboarding`. Use that file as the Blueprint path, or create a
separate Docker web service with command `node src/platform/server.js` and health
path `/healthz`. Do not change the running tenant service's command. The platform
uses Render's `PORT` unless `PLATFORM_PORT` is explicitly set; leave the latter
unset on Render. No database or paid service is created by this template.

Create a **separate, empty Neon project/database** for the control plane. Run
`npm run db:migrate:platform` against its `PLATFORM_DATABASE_URL` (only
`?sslmode=require` for migration scripts). Never use the existing tenant database
or a branch copied from its data as the onboarding database.

Provide the exact assigned HTTPS `PLATFORM_ORIGIN`, independent platform OTP
secret, email sender/token, `TENANT_ORIGIN_MODE=render` and authenticated
`TENANT_PROVISIONER_URL`/token. The template deliberately has no invented
provisioner URL. Startup remains blocked until these real dependencies exist.
The provisioner must enforce idempotency, create a separate company database and
runtime, apply migrations/bootstrap, configure the expected custom hostname,
and report readiness before returning that origin. The adapter bounds each request to ten seconds; the included provisioner returns
202 between recorded steps so longer deployments can be checked on later requests.

When the service and provisioner are ready, set the tenant service's
`COMPANY_SIGNUP_URL` to `https://<onboarding-host>/signup`. Do not enable that link
for public registration merely because a static signup page loads. Resend's
`onboarding@resend.dev` sender remains limited to the account owner's mailbox
until a controlled domain is verified. Render free-service inactivity and
shared usage limits also apply to this additional service.

The signup page uses the centered authentication layout, displays provider/API
errors, clears passwords after submission, shows the sixty-second resend timer,
and prevents overlapping resend/verification requests. Temporary provisioning
failures retain the entered code for retry within its validity window. Registration
credentials/codes are not persisted in browser storage.

UI regression check (requires Playwright Chromium):
`node --test tests/integration/company-signup-ui.test.js`.

## Render/Neon provisioner implementation

The trusted provisioner is now included at `src/provisioning/server.js`, with
`deploy/render.provisioner.yaml` and `deploy/provisioner.env.example`. It is a
separate Docker web service, command `node src/provisioning/server.js`. Keep its
provider API keys out of company runtimes and out of the onboarding frontend.
Its bearer-authenticated POST `/provision` checks the platform database's verified
registration before making provider requests. Both services use the same platform
database and the same `TENANT_PROVISIONER_TOKEN` (32+ characters). Use an independent
random `PROVISIONER_OTP_KEY` (32+ characters), which deterministically derives a
separate HMAC key per company; do not rotate it without accounting for existing
company secrets. `RENDER_OWNER_ID` and `NEON_ORG_ID` select the operator's accounts.

Apply append-only platform migration 002 with `npm run db:migrate:platform` before
starting the provisioner. `tenant_provisioning` stores non-secret resource IDs,
progress and an HMAC request fingerprint, never DB connection URLs or API keys.
PostgreSQL advisory locks serialize requests for the same tenant. Before each
non-idempotent resource creation or deploy request, the stage is persisted. An
uncertain result pauses for operator review rather than repeating creation. Review
the provider dashboards for resources named `sentinelx-<tenant UUID>` and reconcile
the resource IDs/stage after verifying ownership and tenant identity. Never reset
a paused job to NEW without confirming no resource was created. Do not delete
live resources as an automatic retry mechanism.

The provisioner creates a fresh Neon project/database, applies all tenant
migrations and bootstraps the verified Administrator through transient child
process environment variables. It then creates a Render Docker web service with
`plan: free`, separate tenant identity/database and email 2FA. It does not select
paid plans or register custom domains. Provider errors, quota limits, payment
requirements and private-repository access failures stop the operation. A free
Neon account/organization is an operational prerequisite; this code cannot change
or guarantee the provider's account-level billing plan.

For this pilot, set onboarding `TENANT_ORIGIN_MODE=render`. Its provisioner payload
has `origin: null`; the trusted Render API assigns the actual `https://*.onrender.com`
origin. The initial runtime origin is deliberately non-routable
`https://unconfigured.invalid`. The provisioner updates APP_ORIGIN to the assigned
URL and triggers a deployment. Company activation waits for HTTPS `/healthz` to
return that exact company's non-secret tenant UUID and configured public origin.
This prevents an initial deployment with the placeholder APP_ORIGIN from being
marked ready before the corrected configuration is live. Existing custom-domain
adapters remain supported through the platform's default `custom` mode and exact
TENANT_BASE_DOMAIN matching, but the included Render provisioner uses assigned
Render URLs. This avoids needing a custom application domain per tenant; email
sending still requires a verified sender domain for recipients beyond Resend's
own-account test restriction.

The provisioning adapter returns HTTP 202 while preparation is incomplete. The
signup page checks again each minute, using the code still in browser memory;
no password, hash, code or provider key is stored in browser storage. Only the
non-secret registration UUID is kept in sessionStorage to resume after reload. Keep that
page open during preparation. The original ten-minute verification expiry and
failed-attempt limits remain enforced. If preparation outlasts code validity,
request a fresh code and retry; it resumes the same recorded resources. Already queued initialization continues if the page is closed while the process
is running. Readiness checks and recovery after process restarts resume on verified
requests. In-flight ambiguous creation stages still require operator review. On completion the
platform erases temporary password/code material as before.

Free Render services can sleep and share workspace usage limits, so these
artifacts support a pilot rather than guarantee always-on multi-company service.
The actual Render/Neon account permissions, API response compatibility, private
repository deployment access and multi-company isolation must pass live
acceptance. Local provider tests use fixtures and do not create cloud resources.

Configuration order: provisioner database migration and environment -> provisioner
service URL -> onboarding TENANT_PROVISIONER_URL (`https://<host>/provision`) and
matching token -> onboarding exact PLATFORM_ORIGIN -> tenant COMPANY_SIGNUP_URL.
Never paste provider keys or database passwords into chat or commits.

Set provisioner `COMPANY_SIGNUP_URL` to the onboarding HTTPS signup page before
accepting company registrations, so newly created company services also receive
the company-registration link. Existing services must be updated separately.
Changing TENANT_PROVISIONER_TOKEN changes request fingerprints; finish or carefully
reconcile pending jobs before token rotation. Provider keys may be rotated without
changing those fingerprints.

Provisioning responses include a non-secret stage for progress display. Verification
progress has a separate IP budget of twenty requests per minute; signup/resend
retain the original login limiter. The database's five wrong-code attempts and
ten-minute code expiry remain enforced. On successful activation the signup page
clears the code/registration ID and opens the company's `/access` page. Cloud
startup, cold starts and provider limits can still take minutes; the background
acknowledgement removes deliberate step delays and is not a three-second
infrastructure-creation guarantee. No new schema migration is needed for this
background-processing change.

## Central company sign-in and tenant routing

The root URL of a tenant with `COMPANY_SIGNUP_URL` configured redirects to the separate
onboarding control plane's `/login` company locator. A direct company URL's
`/access` remains its normal tenant-specific login. The locator asks **only**
for company name or immutable sign-in code; do not enter a password on the
shared control plane. It checks ACTIVE registry entries and responds with the
pre-registered, validated HTTPS tenant origin. The browser then navigates to
`/access` on that tenant, where the existing password + emailed six-digit code,
host-only session cookies, and database-local roles are enforced. This is a
two-stage routing/authentication flow, not central password authentication.

The platform lookup is `POST /api/company-login/resolve` with an exact JSON
object `{"company":"<company name or code>"}`, exact Origin, no CORS, no-store
response and per-client attempt limit. Responses cannot accept arbitrary URLs
from the user. Names matching multiple ACTIVE tenants must be resolved by
their unique company code instead. An invited employee uses their company's
name/code just like its first Administrator; the control plane does not
receive or query invited staff emails or their tenant password hashes.

Company signup still lives at `/signup`; after verification it provides the
company slug and origin. Operators may include one or more independently
verified pre-onboarding tenants by configuring `COMPANY_LOGIN_LEGACY_ROUTES`
on the onboarding service (at most eight non-secret records, fields exactly
`companyName`, `slug`, `origin`; origin must be validated HTTPS onrender.com
or exact registered custom tenant hostname). No existing production tenant
is inserted into a signup ledger or its user database rewritten. If an
existing-company mapping conflicts with an ACTIVE registry entry, resolution
must fail closed rather than direct someone to the wrong organization.

For the original SentinelX entry URL set `COMPANY_SIGNUP_URL` to the HTTPS
onboarding origin or its `/signup` page. This setting changes only its root
entry routing; direct `/access` remains functional for its own tenant. Do not
configure any Vercel variables for this SentinelX control-plane change.
