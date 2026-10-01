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
